import { useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';
import { getName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';

export interface LeaderboardEntry {
    address: string;
    name: string;
    score: number; // Placeholder for future GameScore
    blockNumber: number; // Used for sorting (Newest first)
}

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8";
const START_BLOCK = BigInt(21000000); // Approx. deployment
const INITIAL_CHUNK = BigInt(10000);
const MIN_AMOUNT = BigInt(150000);

export function useLeaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [scanProgress, setScanProgress] = useState<string>("");
    const publicClient = usePublicClient();

    const fetchLeaderboard = useCallback(async () => {
        if (!publicClient) return;

        // 1. Chain Validation
        try {
            const chainId = await publicClient.getChainId();
            if (chainId !== 8453) {
                console.error("Wrong Network: Connect to Base (8453)");
                setScanProgress("Wrong Network");
                return;
            }
        } catch (e) {
            console.error("Chain ID Check Failed", e);
            return;
        }

        setIsLoading(true);
        setScanProgress("Initializing...");

        try {
            const currentBlock = await publicClient.getBlockNumber();
            let pointer = currentBlock;
            const seen = new Set<string>();
            // const foundEntries: LeaderboardEntry[] = []; // Accumulate temporarily // This line was commented out in the instruction, so keeping it out.

            // Progressive Backward Scan
            while (pointer > START_BLOCK) {
                // Adaptive Chunking Logic
                let currentChunkSize = INITIAL_CHUNK;
                let logs = null;
                let retries = 0;

                while (!logs && retries < 3) {
                    const from = pointer - currentChunkSize > START_BLOCK ? pointer - currentChunkSize : START_BLOCK;
                    const to = pointer;

                    try {
                        logs = await publicClient.getLogs({
                            address: USDC_ADDRESS,
                            event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                            args: { to: RECIPIENT },
                            fromBlock: from,
                            toBlock: to
                        });

                        // If successful, update pointer for next loop
                        // BUT we need to handle the loop correctly. 
                        // The outer loop decrements pointer by chunkSize.
                        // Here we just found a valid chunk size.
                    } catch (err) {
                        console.warn(`Chunk ${from}-${to} failed. Retrying with smaller size...`);
                        currentChunkSize = currentChunkSize / BigInt(2); // Halve the chunk
                        if (currentChunkSize < BigInt(1000)) currentChunkSize = BigInt(1000); // Floor
                        retries++;
                        await new Promise(r => setTimeout(r, 200)); // Backoff
                    }
                }

                // If completely failed after retries, skip this range (or partial fail)
                if (!logs) {
                    console.error(`Failed to scan range ending at ${pointer} after retries.`);
                    // Move pointer anyway to avoid infinite loop
                    pointer = pointer - INITIAL_CHUNK;
                    continue;
                }

                // Process Logs
                const newEntries: LeaderboardEntry[] = [];
                for (const log of logs) {
                    const val = log.args.value;
                    const addr = log.args.from;

                    if (val && val >= MIN_AMOUNT && addr && !seen.has(addr)) {
                        seen.add(addr);

                        const entry: LeaderboardEntry = {
                            address: addr,
                            name: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
                            score: 100,
                            blockNumber: Number(log.blockNumber)
                        };
                        newEntries.push(entry);

                        // Resolve Name (Background)
                        getName({ address: addr as `0x${string}`, chain: base })
                            .then(n => {
                                if (n) {
                                    setLeaderboard(curr => curr.map(item => item.address === addr ? { ...item, name: n.toUpperCase() } : item));
                                }
                            }).catch(() => { });
                    }
                }

                if (newEntries.length > 0) {
                    setLeaderboard(prev => {
                        const combined = [...prev, ...newEntries];
                        // Sort: Score Desc, then Block Desc (Newest First)
                        return combined.sort((a, b) => {
                            if (b.score !== a.score) return b.score - a.score;
                            return b.blockNumber - a.blockNumber;
                        });
                    });
                }

                // Move Pointer
                pointer = pointer - currentChunkSize;

                // Update Progress
                const total = Number(currentBlock - START_BLOCK);
                const done = Number(currentBlock - pointer);
                const percent = Math.floor((done / total) * 100);
                setScanProgress(`${percent}%`);

                await new Promise(r => setTimeout(r, 20)); // Yield to UI
            }

        } catch (e) {
            console.error("Global Scan Critical Failure", e);
        } finally {
            setIsLoading(false);
            setScanProgress("Synced");
        }
    }, [publicClient]);

    return { leaderboard, isLoading, scanProgress, fetchLeaderboard };
}

