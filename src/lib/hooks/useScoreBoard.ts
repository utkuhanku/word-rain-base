import { useCallback, useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { parseAbi } from 'viem';
import { ScoreRegistryABI } from '@/lib/abi/ScoreRegistryABI';
import { useGameStore } from '@/lib/store/gameStore';

// Config
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCORE_REGISTRY_ADDRESS as `0x${string}` || "0x9Dc0EC4618506538AF41fbBd2c1340cb25675108";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
const FEE_AMOUNT = BigInt(150000); // 0.15 USDC

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

            // --- EVENT MODE LOGIC ---
            // --- EVENT MODE LOGIC ---
            if (mode === 'EVENT') {
                setStep("Saving Data...");

                // 1. ALWAYS Save Locally First (Optimistic & Fail-safe)
                try {
                    const KEY = 'event_leaderboard_final';
                    const stored = localStorage.getItem(KEY);
                    let data = stored ? JSON.parse(stored) : [];
                    if (!Array.isArray(data)) data = [];

                    const normalizedAccount = account.toLowerCase();
                    const existingIndex = data.findIndex((e: any) => e.address.toLowerCase() === normalizedAccount);

                    if (existingIndex > -1) {
                        if (score > data[existingIndex].score) {
                            data[existingIndex].score = score;
                            console.log("[Event] Updated Local Best", score);
                        }
                    } else {
                        data.push({ address: account, score });
                        console.log("[Event] New Local Entry", score);
                    }
                    localStorage.setItem(KEY, JSON.stringify(data));
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
                            revivesUsed
                            // fid: undefined // TODO: Pass FID if available
                        })
                    });

                    if (!res.ok) throw new Error("Failed to sync score globally");
                    console.log("[Event] Score Synced Globally");
                } catch (e) {
                    console.error("Global Sync Failed, but local saved.", e);
                }

                setIsSubmitting(false);
                setStep("");
                return true;
            }

            // --- CLASSIC LOGIC ---
            setStep("Check Allowance...");

            // 1. Check Allowance
            const allowance = await publicClient.readContract({
                address: USDC_ADDRESS,
                abi: parseAbi(['function allowance(address, address) view returns (uint256)']),
                functionName: 'allowance',
                args: [account, REGISTRY_ADDRESS]
            }) as bigint;

            if (allowance < FEE_AMOUNT) {
                console.log("[ScoreBoard] Requesting Approval...");
                setStep("Approve USDC...");
                const hash = await walletClient.writeContract({
                    address: USDC_ADDRESS,
                    abi: parseAbi(['function approve(address, uint256) returns (bool)']),
                    functionName: 'approve',
                    args: [REGISTRY_ADDRESS, FEE_AMOUNT], // Approve exact amount
                    chain: walletClient.chain,
                    account
                });

                setStep("Verifying Approval...");
                await publicClient.waitForTransactionReceipt({ hash });
                console.log("[ScoreBoard] Approved.");
            }

            // 2. Submit Score
            console.log("[ScoreBoard] Submitting Score...");
            setStep("Sign & Submit...");

            const gameId = "0x" + Math.random().toString(16).slice(2).padEnd(64, '0'); // Random Game ID

            const hash = await walletClient.writeContract({
                address: REGISTRY_ADDRESS,
                abi: ScoreRegistryABI,
                functionName: 'submitScore',
                args: [BigInt(score), `0x${gameId.slice(2)}` as `0x${string}`], // Safer casting
                chain: walletClient.chain,
                account
            });

            console.log(`[ScoreBoard] TX Sent: ${hash}`);
            setStep("Finalizing...");

            // OPTIMISTIC UPDATE
            publicClient.waitForTransactionReceipt({ hash }).then(() => {
                console.log("[ScoreBoard] Transaction Confirmed On-Chain");
            }).catch(err => {
                console.error("[ScoreBoard] Transaction likely failed or replaced", err);
            });

            console.log("[ScoreBoard] Optimistic Success");
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
    }, [publicClient, walletClient]);

    return { submitScore, isSubmitting, errorMsg, step };
}
