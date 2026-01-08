import { useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';
import { getName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';

export interface LeaderboardEntry {
    address: string;
    name: string;
    score: number;
}

export function useLeaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const publicClient = usePublicClient();

    const fetchLeaderboard = useCallback(async () => {
        setIsLoading(true);
        try {
            // USDC on Base
            const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
            const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8";

            if (!publicClient) return;

            // Optimistic Recursive Fetching (Binary Split on Error)
            // This attempts to fetch the whole range first, and splits only if necessary.
            // Much faster than pessimistic chunking on good RPCs.

            const getLogsRecursive = async (from: bigint, to: bigint): Promise<any[]> => {
                if (from > to) return [];
                try {
                    return await publicClient.getLogs({
                        address: USDC_ADDRESS,
                        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                        args: { to: RECIPIENT },
                        fromBlock: from,
                        toBlock: to
                    });
                } catch (err: any) {
                    // If range is too large or rate limited, split in half
                    const mid = from + (to - from) / BigInt(2);
                    if (mid === from) return []; // Can't split further

                    // Parallel fetch subsections
                    const [left, right] = await Promise.all([
                        getLogsRecursive(from, mid),
                        getLogsRecursive(mid + BigInt(1), to)
                    ]);
                    return [...left, ...right];
                }
            };

            const currentBlock = await publicClient.getBlockNumber();
            const startBlock = BigInt(21000000);

            console.log(`Starting Recursive Scan: ${startBlock} -> ${currentBlock}`);
            const allLogs = await getLogsRecursive(startBlock, currentBlock);

            console.log("Scan Complete. Total Logs:", allLogs.length);

            const payers = new Set<string>();
            allLogs.forEach(log => {
                const val = log.args.value;
                if (val && val >= BigInt(150000)) {
                    payers.add(log.args.from!);
                }
            });

            // Resolve Names in Parallel
            const uniqueAddrs = Array.from(payers);
            const resolvedEntries = await Promise.all(
                uniqueAddrs.map(async (addr) => {
                    let name = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
                    try {
                        const baseName = await getName({ address: addr as `0x${string}`, chain: base });
                        if (baseName) name = baseName.toUpperCase();
                    } catch (e) {
                        // Ignore name resolve error
                    }

                    return {
                        address: addr,
                        name: name,
                        score: 100 // Default Verified Score
                    };
                })
            );

            setLeaderboard(resolvedEntries);
        } catch (e) {
            console.error("Fetch Error", e);
        } finally {
            setIsLoading(false);
        }
    }, [publicClient]);

    return { leaderboard, isLoading, fetchLeaderboard };
}
