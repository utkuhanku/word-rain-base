import { useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { getName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';
import { ScoreRegistryABI } from '@/lib/abi/ScoreRegistryABI';

type LeaderboardEntry = {
    address: string;
    score: number;
    timestamp: number;
    name: string;
    txHash: string;
};

// TODO: User must set this env var after deployment
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCORE_REGISTRY_ADDRESS as `0x${string}` || "0x0000000000000000000000000000000000000000";
const START_BLOCK = BigInt(3000000);

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
            const logs = await publicClient.getLogs({
                address: REGISTRY_ADDRESS,
                event: ScoreRegistryABI[0], // ScoreSubmitted
                fromBlock: START_BLOCK,
                toBlock: 'latest'
            });

            // Parse and format entries
            const entries: LeaderboardEntry[] = await Promise.all(logs.map(async (log) => {
                const { player, score, timestamp } = log.args;

                // Fetch ENS/Basename if possible
                let displayName = undefined;
                try {
                    if (player) {
                        const name = await getName({ address: player, chain: base });
                        if (name) displayName = name;
                    }
                } catch (e) { /* ignore name fetch error */ }

                return {
                    address: player || "0x...",
                    score: Number(score || BigInt(0)),
                    timestamp: Number(timestamp || BigInt(0)),
                    txHash: log.transactionHash,
                    name: displayName || `${player?.slice(0, 6)}...${player?.slice(-4)}`
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
