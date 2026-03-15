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

            const DISQUALIFIED_WALLETS = [
                "0xd154d0a276434afd53b1cd866ccdf22a57b60e36", // kevinxware
                "0xf2d9b69621f516e0bb463e57f2c1dea26cc904ab"  // lancersrs
            ];

            // 1. Map to basic entries
            let basicEntries = data.map(item => {
                let cleanAddress = item.address;
                if (cleanAddress.startsWith('wallet:')) {
                    cleanAddress = cleanAddress.substring(7);
                }

                let fallbackName = cleanAddress;
                if (cleanAddress.startsWith('0x')) {
                    fallbackName = `${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-4)}`;
                }

                const isDisqualified = DISQUALIFIED_WALLETS.includes(cleanAddress.toLowerCase());

                return {
                    address: cleanAddress,
                    score: isDisqualified ? 0 : item.score,
                    streak: isDisqualified ? 0 : (item.streak || 0),
                    name: isDisqualified ? "⚠ DISQUALIFIED" : fallbackName,
                    avatar: null as string | null,
                    isLegacy: seasonId === 1,
                    isDisqualified
                };
            });

            // Move disqualified entries to the bottom
            const validEntries = basicEntries.filter(e => !e.isDisqualified);
            const dqEntries = basicEntries.filter(e => e.isDisqualified);
            basicEntries = [...validEntries, ...dqEntries];

            // 2. Resolve Identities (Parallel)
            const resolvedEntries = await Promise.all(basicEntries.map(async (entry) => {
                let finalName = entry.name;
                let finalAvatar = entry.avatar;

                if (entry.address && entry.address.startsWith("0x") && !entry.isDisqualified) {
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
