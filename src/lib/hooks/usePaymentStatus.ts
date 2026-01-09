import { useState, useEffect, useCallback } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { parseAbiItem } from 'viem';

// Constants
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8"; // Game Wallet
const CHECK_AMOUNT = BigInt(150000); // 0.15 USDC
const START_BLOCK = BigInt(3000000); // Aug 2023
const INITIAL_CHUNK = BigInt(50000);

// Constraints
const RPC_TIMEOUT_MS = 10000; // 10s hard timeout per call
const MAX_SCAN_DURATION_MS = 30000; // 30s total budget
const MAX_CHUNKS_SCANNED = 100; // Safety cap

export function usePaymentStatus() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [hasPaid, setHasPaid] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    // Reset state on address change
    useEffect(() => {
        setHasPaid(false);
    }, [address]);

    const checkPayment = useCallback(async (): Promise<boolean> => {
        if (!address || !publicClient) return false;

        const startTime = Date.now();
        console.log(`[PaymentCheck] Starting Hardened Scan for: ${address}`);
        setIsChecking(true);

        try {
            // 1. Network Validation
            const chainId = await publicClient.getChainId().catch(() => 0);
            if (chainId !== 8453) {
                console.warn("[PaymentCheck] Wrong Network/Fetch Error");
                setIsChecking(false);
                return false;
            }

            const currentBlock = await publicClient.getBlockNumber();
            let pointer = currentBlock;
            let chunksProcessed = 0;

            // 2. Bounded Backward Scan
            while (pointer > START_BLOCK) {
                // Global Constraints Check
                if (Date.now() - startTime > MAX_SCAN_DURATION_MS) {
                    console.warn("[PaymentCheck] Time Budget Exceeded (30s). Stopping.");
                    break;
                }
                if (chunksProcessed >= MAX_CHUNKS_SCANNED) {
                    console.warn("[PaymentCheck] Max Chunks Exceeded. Stopping.");
                    break;
                }

                let currentChunkSize = INITIAL_CHUNK;
                let logs = null;
                let retries = 0;
                let chunkSuccess = false;

                // Retry Loop for Current Range
                while (!chunkSuccess && retries < 3) {
                    // Calc Range
                    const from = pointer - currentChunkSize > START_BLOCK ? pointer - currentChunkSize : START_BLOCK;
                    const to = pointer;

                    // Fetch with Timeout
                    try {
                        const fetchPromise = publicClient.getLogs({
                            address: USDC_ADDRESS,
                            event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                            args: {
                                to: RECIPIENT // CLIENT-SIDE FILTERING: Only fetch by recipient
                            },
                            fromBlock: from,
                            toBlock: to
                        });

                        const timeoutPromise = new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error("RPC Timeout")), RPC_TIMEOUT_MS)
                        );

                        // Race against time
                        logs = await Promise.race([fetchPromise, timeoutPromise]);
                        chunkSuccess = true;

                    } catch (err) {
                        console.warn(`[PaymentCheck] Chunk ${from}-${to} failed/timeout. Retrying...`);
                        currentChunkSize = currentChunkSize / BigInt(2);
                        if (currentChunkSize < BigInt(2000)) currentChunkSize = BigInt(2000);
                        retries++;
                        // Tiny backoff
                        await new Promise(r => setTimeout(r, 200));
                    }
                }

                if (chunkSuccess && logs) {
                    // Client-Side Filter for User
                    const userPayment = logs.some(log => {
                        const isFromUser = log.args.from?.toLowerCase() === address.toLowerCase();
                        const isAmount = log.args.value && log.args.value >= CHECK_AMOUNT;
                        return isFromUser && isAmount;
                    });

                    if (userPayment) {
                        console.log(`[PaymentCheck] FOUND PAYMENT at approx block ${pointer}!`);
                        setHasPaid(true);
                        setIsChecking(false);
                        return true; // SUCCESS EARLY EXIT
                    }
                } else {
                    console.warn(`[PaymentCheck] Skipped chunk ending at ${pointer} after retries.`);
                }

                // POINTER DECREMENT: Explicitly move by the size we ATTEMPTED/USED
                pointer = pointer - currentChunkSize;
                chunksProcessed++;
                await new Promise(r => setTimeout(r, 10)); // Yield
            }

            console.log(`[PaymentCheck] Scan ended. Not found or timed out.`);
            setHasPaid(false);
            return false;

        } catch (error) {
            console.error("[PaymentCheck] Fatal Error:", error);
            return false;
        } finally {
            setIsChecking(false);
        }
    }, [address, publicClient]);

    // Constructive check on mount or address change
    useEffect(() => {
        if (address) {
            checkPayment();
        }
    }, [address, checkPayment]);

    return { hasPaid, isChecking, checkPayment };
}
