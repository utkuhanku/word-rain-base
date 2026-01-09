import { useState, useEffect, useCallback } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { parseAbiItem } from 'viem';

// Constants
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8"; // Game Wallet
const CHECK_AMOUNT = BigInt(150000); // 0.15 USDC (6 decimals)
// FIXED: Lower start block to roughly Aug 2023 (Base Launch) to catch all history
const START_BLOCK = BigInt(3000000);

export function usePaymentStatus() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [hasPaid, setHasPaid] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    // Reset state whenever address changes (Deterministic State)
    useEffect(() => {
        setHasPaid(false);
    }, [address]);

    const checkPayment = useCallback(async () => {
        if (!address || !publicClient) return;

        console.log(`[PaymentDebug] Checking: ${address}`);
        setIsChecking(true);
        try {
            // 1. Validate Network (Optional but good safety)
            const chainId = await publicClient.getChainId();
            console.log(`[PaymentDebug] ChainID: ${chainId}`);
            if (chainId !== 8453) {
                console.warn("[PaymentDebug] Wrong Network");
                setIsChecking(false);
                return;
            }

            // Fetch ALL transfers to recipient (Client-side filter for robustness)
            // Some RPCs struggle with 'from' + 'to' indexed filters combined with large ranges
            const logs = await publicClient.getLogs({
                address: USDC_ADDRESS,
                event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                args: {
                    to: RECIPIENT
                },
                fromBlock: START_BLOCK,
                toBlock: 'latest'
            });

            console.log(`[PaymentDebug] Total Recipient Logs Found: ${logs.length}`);

            // Filter for THIS user in memory
            const userPayment = logs.find(log => {
                const isFromUser = log.args.from?.toLowerCase() === address.toLowerCase();
                const isAmount = log.args.value && log.args.value >= CHECK_AMOUNT;
                return isFromUser && isAmount;
            });

            if (userPayment) {
                console.log(`[PaymentDebug] PAYMENT FOUND! Block: ${userPayment.blockNumber}, Val: ${userPayment.args.value}`);
                setHasPaid(true);
            } else {
                console.log(`[PaymentDebug] No matching payment found for ${address} in ${logs.length} transfers.`);
                setHasPaid(false); // Explicit false
            }
        } catch (error) {
            console.error("[PaymentDebug] Check Failed:", error);
            // Don't set false here, keep previous state or neutral? 
            // Setting false might lock out a paid user due to RPC error. 
            // Better to just log.
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
