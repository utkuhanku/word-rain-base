import { useState, useEffect, useCallback } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { parseAbiItem } from 'viem';

// Constants
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8"; // Game Wallet
const CHECK_AMOUNT = BigInt(150000); // 0.15 USDC (6 decimals)
// FIXED: Lower start block to roughly Aug 2023 (Base Launch) to catch all history
const START_BLOCK = BigInt(3000000);
const INITIAL_CHUNK = BigInt(50000); // Start nicely aggressive for check

export function usePaymentStatus() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [hasPaid, setHasPaid] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    // Reset state whenever address changes (Deterministic State)
    useEffect(() => {
        setHasPaid(false);
    }, [address]);

    const checkPayment = useCallback(async (): Promise<boolean> => {
        if (!address || !publicClient) return false;

        console.log(`[PaymentCheck] Starting Scan for: ${address}`);
        setIsChecking(true);

        try {
            const chainId = await publicClient.getChainId();
            if (chainId !== 8453) {
                console.warn("[PaymentCheck] Wrong Network");
                setIsChecking(false);
                return false;
            }

            const currentBlock = await publicClient.getBlockNumber();
            let pointer = currentBlock;

            // Adaptive Backward Scan (Early Exit)
            // We search backwards because recent payments are more likely for active users.
            while (pointer > START_BLOCK) {
                let currentChunkSize = INITIAL_CHUNK;
                let logs = null;
                let retries = 0;

                while (!logs && retries < 3) {
                    const from = pointer - currentChunkSize > START_BLOCK ? pointer - currentChunkSize : START_BLOCK;
                    const to = pointer;

                    try {
                        const chunkLogs = await publicClient.getLogs({
                            address: USDC_ADDRESS,
                            event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                            args: {
                                from: address, // We CAN use from filter here if we iterate chunks, usually safer on RPC limits
                                to: RECIPIENT
                            },
                            fromBlock: from,
                            toBlock: to
                        });
                        logs = chunkLogs;
                    } catch (err) {
                        console.warn(`[PaymentCheck] Chunk ${from}-${to} failed. Retrying...`);
                        currentChunkSize = currentChunkSize / BigInt(2);
                        if (currentChunkSize < BigInt(2000)) currentChunkSize = BigInt(2000);
                        retries++;
                        await new Promise(r => setTimeout(r, 200));
                    }
                }

                if (!logs) {
                    console.error(`[PaymentCheck] Failed to scan range ending at ${pointer}`);
                    pointer = pointer - INITIAL_CHUNK;
                    continue;
                }

                // Check for payment in this chunk
                const validPayment = logs.some(log => log.args.value && log.args.value >= CHECK_AMOUNT);

                if (validPayment) {
                    console.log(`[PaymentCheck] FOUND PAYMENT at block ${pointer}!`);
                    setHasPaid(true);
                    setIsChecking(false);
                    return true; // EARLY EXIT
                }

                pointer = pointer - currentChunkSize;
                await new Promise(r => setTimeout(r, 10)); // Tiny yield
            }

            console.log(`[PaymentCheck] Scan complete. No payment found.`);
            setHasPaid(false);
            return false;

        } catch (error) {
            console.error("[PaymentCheck] Scan Error:", error);
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
