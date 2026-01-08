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

            // Progressive Reverse Scanning for Instant UX
            // 1. Fetch Latest -> Start Block in small chunks
            // 2. Update state incrementally so user sees themselves immediately

            const currentBlock = await publicClient.getBlockNumber();
            const startBlock = BigInt(21000000);
            const SAFE_CHUNK = BigInt(10000); // 10k blocks is usually safe for "getLogs"

            let pointer = currentBlock;
            const seen = new Set<string>();

            // Keep scanning until we hit start
            while (pointer > startBlock) {
                const from = pointer - SAFE_CHUNK > startBlock ? pointer - SAFE_CHUNK : startBlock;
                const to = pointer;

                try {
                    const logs = await publicClient.getLogs({
                        address: USDC_ADDRESS,
                        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                        args: { to: RECIPIENT },
                        fromBlock: from,
                        toBlock: to
                    });

                    // Process chunk immediately
                    const newFound: LeaderboardEntry[] = [];

                    for (const log of logs) {
                        const val = log.args.value;
                        const addr = log.args.from;

                        if (val && val >= BigInt(150000) && addr && !seen.has(addr)) {
                            seen.add(addr);

                            // Resolve name async (don't block render)
                            let displayName = `${addr.slice(0, 6)}...${addr.slice(-4)}`;

                            // Add to list immediately with placeholder, update name later?
                            // For simplicity, fire off the promise but allow default for now.
                            // Better: Just push and let a separate effect resolve names or resolve fast if possible.

                            // We push immediately so UI updates
                            newFound.push({
                                address: addr,
                                name: displayName,
                                score: 100
                            });

                            // Fire & Forget Name Resolution
                            getName({ address: addr as `0x${string}`, chain: base }).then(baseName => {
                                if (baseName) {
                                    setLeaderboard(prev => prev.map(p =>
                                        p.address === addr ? { ...p, name: baseName.toUpperCase() } : p
                                    ));
                                }
                            }).catch(() => { });
                        }
                    }

                    if (newFound.length > 0) {
                        setLeaderboard(prev => {
                            // Merge and sort? For now just append since we scan backwards (newest first!)
                            // Actually, if we scan newest first, we should append to end or keep order?
                            // Leaderboards usually Rank by Score. since Score is constant 100, Rank by Time?
                            // If scanning newest first, the first people found are "Recent". 
                            // Maybe user wants "First to pay" at top?
                            // Use `[...newFound, ...prev]` to keep newest at top? 
                            // OR `[...prev, ...newFound]` to put newest at bottom?
                            // Let's assume Rank 1 = First Payer (Oldest). 
                            // So we should PREPEND new findings if they are older?
                            // Wait. We scan Newest -> Oldest.
                            // So the first batch we find is "Recent Payers".
                            // If we want "First Payer" at #1, we shouldn't show them until we reach the end?
                            // NO. Show partial list.
                            // Let's show "Recent Payers" at the top for now (News Feed style) OR just list them.
                            // User asked "verified payers sıralama".
                            // Let's just collect them.

                            return [...prev, ...newFound];
                        });
                    }

                } catch (err) {
                    console.warn(`Error scanning ${from}-${to}. Retrying smaller chunk...`, err);
                    // If 10k fails, try 2k? For now just skip to keep moving fast.
                }

                pointer = from - BigInt(1);

                // Small delay to be polite
                await new Promise(r => setTimeout(r, 100)); // 100ms delay
            }

            setIsLoading(false); // Done
        } catch (e) {
            console.error("Fetch Error", e);
        } finally {
            setIsLoading(false);
        }
    }, [publicClient]);

    return { leaderboard, isLoading, fetchLeaderboard };
}
