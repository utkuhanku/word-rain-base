import { useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { getName, getAvatar } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';
import { ScoreRegistryABI } from '@/lib/abi/ScoreRegistryABI';

type LeaderboardEntry = {
    address: string;
    score: number;
    timestamp: number;
    name: string;
    avatar?: string | null;
    txHash: string;
};

// TODO: User must set this env var after deployment
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCORE_REGISTRY_ADDRESS as `0x${string}` || "0x9Dc0EC4618506538AF41fbBd2c1340cb25675108";
const START_BLOCK = BigInt(40624000); // Optimized for New Deployment

export function useLeaderboard() {
    const publicClient = usePublicClient();
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchLeaderboard = useCallback(async () => {
        if (!publicClient) return;

        if (!REGISTRY_ADDRESS || REGISTRY_ADDRESS === "0x0000000000000000000000000000000000000000") {
            console.warn("Registry not set.");
            return;
        }

        setIsLoading(true);
        console.log("[Leaderboard] Fetching Onchain Scores...");

        try {
            // Chunked Fetching to prevent RPC Timeouts
            const currentBlock = await publicClient.getBlockNumber();
            const CHUNK_SIZE = BigInt(10000); // 10k blocks per chunk
            let allLogs = [];

            for (let i = START_BLOCK; i <= currentBlock; i += CHUNK_SIZE) {
                const toBlock = (i + CHUNK_SIZE - BigInt(1) < currentBlock) ? (i + CHUNK_SIZE - BigInt(1)) : currentBlock;
                console.log(`[Leaderboard] Fetching chunk: ${i} to ${toBlock}`);

                try {
                    const chunkLogs = await publicClient.getLogs({
                        address: REGISTRY_ADDRESS,
                        event: ScoreRegistryABI[0], // ScoreSubmitted
                        fromBlock: i,
                        toBlock: toBlock
                    });
                    allLogs.push(...chunkLogs);
                } catch (e) {
                    console.warn(`[Leaderboard] Chunk failed (${i}-${toBlock}):`, e);
                    // Continue to next chunk or handle retries? 
                    // For now, continue to salvage partial data.
                }
            }

            const logs = allLogs;

            // Parse and format entries
            const entries: LeaderboardEntry[] = await Promise.all(logs.map(async (log) => {
                const { player, score, timestamp } = log.args;

                // Fetch ENS/Basename & Avatar
                let displayName: string | undefined = undefined;
                let avatarUrl: string | null = null;

                if (player) {
                    // 0. Hardcoded Fix for Owner (Immediate Relief)
                    if (player.toLowerCase() === "0x6edd22E9792132614dD487aC6434dec3709b79A8".toLowerCase()) {
                        displayName = "@utkus.base.eth";
                        try {
                            // Hardcoded owner name for avatar fetch
                            avatarUrl = await getAvatar({ ensName: "utkus.base.eth", chain: base });
                        } catch { }
                    } else {
                        // 1. Try Basename (OnchainKit)
                        try {
                            const name = await getName({ address: player, chain: base });
                            if (name) {
                                displayName = name;
                                // 2. Only fetch avatar if we have a name
                                try {
                                    avatarUrl = await getAvatar({ ensName: name, chain: base });
                                } catch { }
                            } else {
                                // 3. Fallback: Searchcaster (Public API)
                                try {
                                    const scRes = await fetch(`https://searchcaster.xyz/api/profiles?address=${player}`);
                                    if (scRes.ok) {
                                        const scData = await scRes.json();
                                        if (scData && scData.length > 0) {
                                            const user = scData[0].body;
                                            displayName = `@${user.username}`;
                                            avatarUrl = user.avatarUrl || null;
                                        }
                                    }
                                } catch (e) {
                                    // Silent fail for Searchcaster
                                }
                            }
                        } catch (e) {
                            console.warn("Identity Resolution Failed:", e);
                        }
                    }
                }

                return {
                    address: player || "0x...",
                    score: Number(score || BigInt(0)),
                    timestamp: Number(timestamp || BigInt(0)),
                    txHash: log.transactionHash,
                    name: displayName || `${player?.slice(0, 6)}...${player?.slice(-4)}`,
                    avatar: avatarUrl
                };
            }));

            // Sort by Score (Desc) then Timestamp (Desc)
            entries.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return b.timestamp - a.timestamp;
            });

            setLeaderboard(entries);
            console.log(`[Leaderboard] Loaded ${entries.length} scores.`);

        } catch (err) {
            console.error("[Leaderboard] Fetch Error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [publicClient]);

    return { leaderboard, isLoading, fetchLeaderboard };
}
