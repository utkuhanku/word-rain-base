import { useCallback, useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { useGameStore } from '@/lib/store/gameStore';
import { getCurrentSeason } from '@/lib/season';

export function useScoreBoard() {
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [step, setStep] = useState(""); // Granular Status
    const revivesUsed = useGameStore(state => state.revivesUsed);

    const submitScore = useCallback(async (score: number, mode: 'CLASSIC' | 'PVP' | 'EVENT' = 'CLASSIC') => {
        if (!walletClient || !publicClient) {
            setErrorMsg("Wallet not connected");
            return false;
        }

        setIsSubmitting(true);
        setErrorMsg("");
        setStep("Initializing...");

        try {
            const [account] = await walletClient.getAddresses();

            // --- OFFCHAIN SUBMISSION LOGIC ---
            // Both EVENT and CLASSIC modes submit off-chain now (free)
            setStep("Saving Data...");
            const currentSeason = getCurrentSeason();

            const isEvent = mode === 'EVENT';
            const partition = isEvent ? 'ethdenver' : 'season';
            const seasonId = currentSeason.id;
            const localKey = isEvent ? 'event_leaderboard_final' : (seasonId === 1 ? 'event_leaderboard_final' : `event_leaderboard_s${seasonId}`);

            // 1. ALWAYS Save Locally First (Optimistic & Fail-safe)
            try {
                const stored = localStorage.getItem(localKey);
                let data = stored ? JSON.parse(stored) : [];
                if (!Array.isArray(data)) data = [];

                const normalizedAccount = account.toLowerCase();
                const existingIndex = data.findIndex((e: any) => e.address.toLowerCase() === normalizedAccount);

                if (existingIndex > -1) {
                    if (score > data[existingIndex].score) {
                        data[existingIndex].score = score;
                        console.log(`[${mode}] Updated Local Best`, score);
                    }
                } else {
                    data.push({ address: account, score });
                    console.log(`[${mode}] New Local Entry`, score);
                }
                localStorage.setItem(localKey, JSON.stringify(data));
            } catch (e) {
                console.error("Local Save Failed", e);
            }

            setStep("Transmitting...");

            // Get Streak Data
            const streakKey = `streak_${account}`;
            const rawStreak = localStorage.getItem(streakKey);
            let streak = 0;
            if (rawStreak) {
                try {
                    const parsed = JSON.parse(rawStreak);
                    streak = parsed.current;
                } catch (e) {
                    streak = Number(rawStreak) || 0;
                }
            }

            try {
                // POST to API
                const res = await fetch('/api/leaderboard/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet: account,
                        score,
                        streak,
                        revivesUsed,
                        partition,
                        seasonId
                    })
                });

                if (!res.ok) throw new Error("Failed to sync score globally");
                console.log(`[${mode}] Score Synced Globally`);
            } catch (e) {
                console.error("Global Sync Failed, but local saved.", e);
            }

            setIsSubmitting(false);
            setStep("");
            return true;

        } catch (e: any) {
            console.error("[ScoreBoard] Error:", e);
            if (e.message && e.message.includes("User rejected")) {
                setErrorMsg("TRANSACTION CANCELLED");
            } else {
                setErrorMsg(e.message || "Failed to submit score");
            }
            setIsSubmitting(false);
            setStep("");
            return false;
        }
    }, [publicClient, walletClient, revivesUsed]);

    return { submitScore, isSubmitting, errorMsg, step };
}
