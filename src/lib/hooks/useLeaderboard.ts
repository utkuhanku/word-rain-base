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

            // Batched Chunk Fetching to avoid RPC Rate Limits
            const currentBlock = await publicClient.getBlockNumber();
            const startBlock = BigInt(21000000); // Approx Oct 2024
            const CHUNK_SIZE = BigInt(200000); // 200k blocks (safer for high volume USDC)

            // Create chunks
            const chunks = [];
            let from = startBlock;
            while (from <= currentBlock) {
                const to = from + CHUNK_SIZE > currentBlock ? currentBlock : from + CHUNK_SIZE;
                chunks.push({ from, to });
                from = to + BigInt(1);
            }

            console.log(`Queueing ${chunks.length} scan jobs...`);

            // Process in batches of 3
            const BATCH_SIZE = 3;
            const allLogs = [];

            for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                const batch = chunks.slice(i, i + BATCH_SIZE);
                const batchResults = await Promise.all(batch.map(async ({ from, to }) => {
                    try {
                        return await publicClient.getLogs({
                            address: USDC_ADDRESS,
                            event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                            args: { to: RECIPIENT },
                            fromBlock: from,
                            toBlock: to
                        });
                    } catch (err) {
                        console.warn(`Scan missed chunk ${from}-${to}`, err);
                        return []; // Skip failed chunk to keep others
                    }
                }));
                allLogs.push(...batchResults.flat());
            }

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
