import { useState, useCallback } from 'react';
import { getName, getAvatar } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';

export type LeaderboardEntry = {
    address: string;
    score: number;
    streak: number;
    name: string;
    avatar?: string | null;
    rank?: number;
    isLegacy?: boolean;
};

export function useLeaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchLeaderboard = useCallback(async (seasonId: number = 2) => {
        setIsLoading(true);
        // console.log(`[Leaderboard] Fetching Season ${seasonId} from API...`);

        try {
            const res = await fetch(`/api/event/leaderboard?season=${seasonId}&_t=${Date.now()}`);
            if (!res.ok) throw new Error("API Fetch Failed");

            const data: { address: string; score: number; streak?: number }[] = await res.json();

            // 1. Map to basic entries
            const basicEntries = data.map(item => ({
                address: item.address,
                score: item.score,
                streak: item.streak || 0,
                name: `${item.address.slice(0, 6)}...${item.address.slice(-4)}`,
                avatar: null as string | null,
                isLegacy: seasonId === 1 // Helper for UI filtering if needed, though API handles filtering
            }));

            // 2. Resolve Identities (Parallel)
            const resolvedEntries = await Promise.all(basicEntries.map(async (entry) => {
                let finalName = entry.name;
                let finalAvatar = entry.avatar;

                if (entry.address && entry.address.startsWith("0x")) {
                    // 0. Hardcoded Fix
                    if (entry.address.toLowerCase() === "0x6edd22E9792132614dD487aC6434dec3709b79A8".toLowerCase()) {
                        finalName = "@utkus.base.eth";
                        try { finalAvatar = await getAvatar({ ensName: "utkus.base.eth", chain: base }); } catch { }
                    } else {
                        // 1. Basename / ENS
                        try {
                            const name = await getName({ address: entry.address as `0x${string}`, chain: base });
                            if (name) {
                                finalName = name;
                                try { finalAvatar = await getAvatar({ ensName: name, chain: base }); } catch { }
                            } else {
                                // 2. Web3 Bio Fallback (Farcaster)
                                try {
                                    const bioRes = await fetch(`https://api.web3.bio/profile/${entry.address}`);
                                    if (bioRes.ok) {
                                        const bioData = await bioRes.json();
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

                return {
                    ...entry,
                    name: finalName,
                    avatar: finalAvatar
                };
            }));

            setLeaderboard(resolvedEntries);

        } catch (err) {
            console.error("[Leaderboard] Error:", err);
            setLeaderboard([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { leaderboard, isLoading, fetchLeaderboard };
}
