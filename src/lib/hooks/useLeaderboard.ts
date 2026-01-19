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
    isLegacy?: boolean;
};

// TODO: User must set this env var after deployment
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCORE_REGISTRY_ADDRESS as `0x${string}` || "0x9Dc0EC4618506538AF41fbBd2c1340cb25675108";
const START_BLOCK = BigInt(40624000); // Optimized for New Deployment - Fixes Timeout
const COMPETITION_START = 1768827000; // Approx Jan 19 2026 (Today)

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
            const CHUNK_SIZE = BigInt(10000); // 10k blocks - Max Stability
            let allLogs = [];

            // We scan from deeper history to ensure we get old scores too
            for (let i = START_BLOCK; i <= currentBlock; i += CHUNK_SIZE) {
                const toBlock = (i + CHUNK_SIZE - BigInt(1) < currentBlock) ? (i + CHUNK_SIZE - BigInt(1)) : currentBlock;

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
                }
            }

            const logs = allLogs;

            // 1. Process All Entries First
            const rawEntries: LeaderboardEntry[] = await Promise.all(logs.map(async (log) => {
                const { player, score, timestamp } = log.args;
                const ts = Number(timestamp || BigInt(0));

                // Fetch ENS/Basename & Avatar (Simplified for efficiency) - could move this after filtering to save RPC calls
                let displayName: string | undefined = undefined;
                let avatarUrl: string | null = null;
                const playerAddr = player || "0x...";

                // Basic formatted fallback
                displayName = `${playerAddr.slice(0, 6)}...${playerAddr.slice(-4)}`;

                return {
                    address: playerAddr,
                    score: Number(score || BigInt(0)),
                    timestamp: ts,
                    txHash: log.transactionHash,
                    name: displayName,
                    avatar: avatarUrl,
                    isLegacy: ts < COMPETITION_START
                };
            }));

            // 2. Filter Unique Users (Highest Score Only)
            const bestScores = new Map<string, LeaderboardEntry>();

            rawEntries.forEach(entry => {
                const key = entry.address.toLowerCase();
                const existing = bestScores.get(key);

                // Keep if new, or if score is higher, or if score equal but newer
                if (!existing || entry.score > existing.score) {
                    bestScores.set(key, entry);
                }
            });

            const uniqueEntries = Array.from(bestScores.values());

            // 3. Resolve Identities ONLY for the unique list (Saving RPC calls)
            // We re-iterate to fetch names for the final list
            const finalEntries = await Promise.all(uniqueEntries.map(async (entry) => {
                // Skip if we hypothetically already fetched (we didn't above for speed)
                // Implement identity fetching here
                let finalName = entry.name;
                let finalAvatar = entry.avatar;

                if (entry.address && entry.address !== "0x...") {
                    // 0. Hardcoded Fix
                    if (entry.address.toLowerCase() === "0x6edd22E9792132614dD487aC6434dec3709b79A8".toLowerCase()) {
                        finalName = "@utkus.base.eth";
                        try { finalAvatar = await getAvatar({ ensName: "utkus.base.eth", chain: base }); } catch { }
                    } else {
                        // 1. Basename
                        try {
                            const name = await getName({ address: entry.address as `0x${string}`, chain: base });
                            if (name) {
                                finalName = name;
                                try { finalAvatar = await getAvatar({ ensName: name, chain: base }); } catch { }
                            } else {
                                // 2. Web3 Bio Fallback
                                try {
                                    const bioRes = await fetch(`https://api.web3.bio/profile/${entry.address}`);
                                    if (bioRes.ok) {
                                        const bioData = await bioRes.json();
                                        // Prioritize Farcaster
                                        const profile = bioData.find((p: any) => p.platform === 'farcaster') || bioData[0];
                                        if (profile) {
                                            finalName = profile.platform === 'farcaster' ? `@${profile.identity}` : profile.identity;
                                            finalAvatar = profile.avatar;
                                        }
                                    }
                                } catch { }
                            }
                        } catch { }
                    }
                }

                return { ...entry, name: finalName, avatar: finalAvatar };
            }));

            // 4. Sort: Score Desc, then Timestamp Desc
            finalEntries.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return b.timestamp - a.timestamp;
            });

            setLeaderboard(finalEntries);
            console.log(`[Leaderboard] Loaded ${finalEntries.length} unique scores.`);

        } catch (err) {
            console.error("[Leaderboard] Fetch Error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [publicClient]);

    return { leaderboard, isLoading, fetchLeaderboard };
}
