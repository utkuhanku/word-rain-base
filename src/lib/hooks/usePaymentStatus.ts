import { useState, useEffect, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';

// Constants
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8"; // Game Wallet
const CHECK_AMOUNT = BigInt(150000); // 0.15 USDC
const START_BLOCK = BigInt(3000000); // Aug 2023
const INITIAL_CHUNK = BigInt(50000);

// Constraints
const RPC_TIMEOUT_MS = 10000; // 10s hard timeout
const MAX_SCAN_DURATION_MS = 30000; // 30s budget
const MAX_CHUNKS_SCANNED = 100;

export function usePaymentStatus() {
    // We remove the internal 'useAccount' dependency for the check logic
    // The hook will now receive addresses to check as arguments or maintain internal state
    // But to keep API consistent, we can expose a 'checkAddresses' function
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

        const uniqueAddresses = [...new Set(addressesToCheck.map(a => a.toLowerCase()))];
        setLastCheckedAddresses(uniqueAddresses);

        const startTime = Date.now();
        console.log(`[PaymentCheck] Starting Scan for ${uniqueAddresses.length} addresses:`, uniqueAddresses);
        setIsChecking(true);
        setFailureReason("");

        try {
            const chainId = await publicClient.getChainId().catch(() => 0);
            if (chainId !== 8453) {
                console.warn("[PaymentCheck] Wrong Network");
                setIsChecking(false);
                setFailureReason("Wrong Network (Not Base)");
                return false;
            }

            const currentBlock = await publicClient.getBlockNumber();
            let pointer = currentBlock;
            let chunksProcessed = 0;

            // Bounded Backward Scan
            while (pointer > START_BLOCK) {
                // Constraints
                if (Date.now() - startTime > MAX_SCAN_DURATION_MS) {
                    setFailureReason("Time Budget Exceeded (Max 30s)");
                    break;
                }
                if (chunksProcessed >= MAX_CHUNKS_SCANNED) {
                    setFailureReason("Max Chunks Exceeded");
                    break;
                }

                let currentChunkSize = INITIAL_CHUNK;
                let logs = null;
                let retries = 0;
                let chunkSuccess = false;

                // Retry Loop
                while (!chunkSuccess && retries < 3) {
                    const from = pointer - currentChunkSize > START_BLOCK ? pointer - currentChunkSize : START_BLOCK;
                    const to = pointer;

                    try {
                        const fetchPromise = publicClient.getLogs({
                            address: USDC_ADDRESS,
                            event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                            args: {
                                to: RECIPIENT
                            },
                            fromBlock: from,
                            toBlock: to
                        });

                        const timeoutPromise = new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error("RPC Timeout")), RPC_TIMEOUT_MS)
                        );

                        logs = await Promise.race([fetchPromise, timeoutPromise]);
                        chunkSuccess = true;
                    } catch (err) {
                        console.warn(`[PaymentCheck] Chunk ${from}-${to} failed/timeout. Retrying...`);
                        currentChunkSize = currentChunkSize / BigInt(2);
                        if (currentChunkSize < BigInt(2000)) currentChunkSize = BigInt(2000);
                        retries++;
                        await new Promise(r => setTimeout(r, 200));
                    }
                }

                if (chunkSuccess && logs) {
                    // Filter: Did ANY of our addresses send >= 0.15 USDC?
                    const foundLog = logs.find(log => {
                        const sender = log.args.from?.toLowerCase();
                        const val = log.args.value;
                        return sender && uniqueAddresses.includes(sender) && val && val >= CHECK_AMOUNT;
                    });

                    if (foundLog) {
                        console.log(`[PaymentCheck] SUCCESS! Found pay from ${foundLog.args.from} at block ${foundLog.blockNumber}`);
                        setHasPaid(true);
                        setIsChecking(false);
                        return true;
                    }
                } else {
                    console.warn(`[PaymentCheck] Skipped chunk ending at ${pointer} after retries.`);
                }

                pointer = pointer - currentChunkSize;
                chunksProcessed++;
                await new Promise(r => setTimeout(r, 10));
            }

            console.log(`[PaymentCheck] Scan ended. Not found.`);
            setHasPaid(false);
            if (!failureReason) setFailureReason("No qualifying transfer found in history (3M+).");
            return false;

        } catch (error: any) {
            console.error("[PaymentCheck] Fatal Error:", error);
            setFailureReason(`Scan Error: ${error.message}`);
            return false;
        } finally {
            setIsChecking(false);
        }
    }, [publicClient, failureReason]);

    // Constructive check on mount or address change
    useEffect(() => {
        // This useEffect is now empty as the checkAddresses function is called externally.
        // The previous logic for 'address' is no longer relevant here.
    }, []);

    return { hasPaid, isChecking, checkAddresses, lastCheckedAddresses, failureReason };
}
