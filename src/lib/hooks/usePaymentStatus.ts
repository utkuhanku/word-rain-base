import { useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { ScoreRegistryABI } from '@/lib/abi/ScoreRegistryABI';

// Configuration
// TODO: User must set this env var after deployment
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_SCORE_REGISTRY_ADDRESS as `0x${string}` || "0x9Dc0EC4618506538AF41fbBd2c1340cb25675108";
const START_BLOCK = BigInt(38000000);

export function usePaymentStatus() {
    const publicClient = usePublicClient();
    const [hasPaid, setHasPaid] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheckedAddresses, setLastCheckedAddresses] = useState<string[]>([]);
    const [failureReason, setFailureReason] = useState<string>("");

    const checkAddresses = useCallback(async (addressesToCheck: string[]): Promise<boolean> => {
        if (!publicClient || addressesToCheck.length === 0) {
            setFailureReason("No addresses provided");
            return false;
        }

        // Integrity check for contract presence
        if (!REGISTRY_ADDRESS || REGISTRY_ADDRESS === "0x0000000000000000000000000000000000000000") {
            console.warn("Registry Address not set in .env");
            setFailureReason("System Upgrade: Contract Address Not Configured.");
            return false;
        }

        const uniqueAddresses = [...new Set(addressesToCheck.map(a => a.toLowerCase()))];

        // WHITELIST (Restored): Forensics confirmed payment via raw transfer. Granting access.
        const TREASURY = "0x6edd22e9792132614dd487ac6434dec3709b79a8";
        if (uniqueAddresses.includes(TREASURY)) {
            setHasPaid(true);
            setIsChecking(false);
            return true;
        }

        setLastCheckedAddresses(uniqueAddresses);

        setIsChecking(true);
        setFailureReason("");
        console.log(`[ScoreCheck] Scanning for ScoreSubmitted from:`, uniqueAddresses);

        try {
            // Fetch logs for ScoreSubmitted event
            // Note: viem getLogs with indexed args array requires the 'args' object keys to match event ABI
            // ScoreSubmitted: [player, score, gameId, amount, timestamp] -> player is indexed

            const logs = await publicClient.getLogs({
                address: REGISTRY_ADDRESS,
                event: ScoreRegistryABI[0], // ScoreSubmitted event
                args: {
                    player: uniqueAddresses as `0x${string}`[]
                },
                fromBlock: START_BLOCK,
                toBlock: 'latest'
            });

            if (logs.length > 0) {
                console.log(`[ScoreCheck] Found ${logs.length} submissions.`);
                setHasPaid(true); // 'hasPaid' here implies 'hasSubmittedScore' which grants access
                setIsChecking(false);
                return true;
            }

            console.log(`[ScoreCheck] No on-chain score submissions found.`);
            setHasPaid(false);
            setFailureReason("Submit a score once to unlock.");
            return false;

        } catch (error: any) {
            console.error("[ScoreCheck] Error:", error);
            setFailureReason(`Verification Error: ${error.message}`);
            return false;
        } finally {
            setIsChecking(false);
        }
    }, [publicClient]);

    return { hasPaid, isChecking, checkAddresses, lastCheckedAddresses, failureReason };
}
