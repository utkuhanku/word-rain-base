import { useCallback, useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { parseAbi } from 'viem';
import { ScoreRegistryABI } from '@/lib/abi/ScoreRegistryABI';

// Config
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCORE_REGISTRY_ADDRESS as `0x${string}` || "0x9Dc0EC4618506538AF41fbBd2c1340cb25675108";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
const FEE_AMOUNT = BigInt(150000); // 0.15 USDC

export function useScoreBoard() {
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const submitScore = useCallback(async (score: number) => {
        if (!walletClient || !publicClient) {
            setErrorMsg("Wallet not connected");
            return;
        }

        setIsSubmitting(true);
        setErrorMsg("");

        try {
            const [account] = await walletClient.getAddresses();

            // 1. Check Allowance
            const allowance = await publicClient.readContract({
                address: USDC_ADDRESS,
                abi: parseAbi(['function allowance(address, address) view returns (uint256)']),
                functionName: 'allowance',
                args: [account, REGISTRY_ADDRESS]
            }) as bigint;

            if (allowance < FEE_AMOUNT) {
                console.log("[ScoreBoard] Requesting Approval...");
                const hash = await walletClient.writeContract({
                    address: USDC_ADDRESS,
                    abi: parseAbi(['function approve(address, uint256) returns (bool)']),
                    functionName: 'approve',
                    args: [REGISTRY_ADDRESS, FEE_AMOUNT], // Approve exact amount to safely pass wallet simulation
                    chain: walletClient.chain,
                    account
                });
                await publicClient.waitForTransactionReceipt({ hash });
                console.log("[ScoreBoard] Approved.");
            }

            // 2. Submit Score
            console.log("[ScoreBoard] Submitting Score...");
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
            await publicClient.waitForTransactionReceipt({ hash });

            console.log("[ScoreBoard] Score Submitted Successfully!");
            setIsSubmitting(false);
            return true;

        } catch (e: any) {
            console.error("[ScoreBoard] Error:", e);
            setErrorMsg(e.message || "Failed to submit score");
            setIsSubmitting(false);
            return false;
        }
    }, [publicClient, walletClient]);

    return { submitScore, isSubmitting, errorMsg };
}
