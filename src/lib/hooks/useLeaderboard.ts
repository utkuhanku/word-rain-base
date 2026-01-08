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

            // Chunked Fetching Logic
            const currentBlock = await publicClient.getBlockNumber();
            const startBlock = BigInt(21000000); // Approx Oct 2024
            const range = currentBlock - startBlock;
            const CHUNK_SIZE = BigInt(1000000); // 1M blocks per chunk (try aggressive first)

            const chunks = [];
            let from = startBlock;
            while (from <= currentBlock) {
                const to = from + CHUNK_SIZE > currentBlock ? currentBlock : from + CHUNK_SIZE;
                chunks.push({ from, to });
                from = to + BigInt(1);
            }

            console.log(`Scanning ${chunks.length} chunks from ${startBlock} to ${currentBlock}`);

            const results = await Promise.all(chunks.map(async ({ from, to }) => {
                try {
                    return await publicClient.getLogs({
                        address: USDC_ADDRESS,
                        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                        args: { to: RECIPIENT },
                        fromBlock: from,
                        toBlock: to
                    });
                } catch (err) {
                    console.error(`Fetch failed for chunk ${from}-${to}`, err);
                    return [];
                }
            }));

            const logs = results.flat();
            console.log("Total Leaderboard Logs Found:", logs.length);

            const payers = new Set<string>();
            logs.forEach(log => {
                const val = log.args.value;
                // Fix: Ensure value check handles verified payment size (0.15 USDC = 150000)
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
