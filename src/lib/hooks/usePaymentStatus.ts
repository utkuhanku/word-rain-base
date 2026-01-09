import { useState, useEffect, useCallback } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { parseAbiItem } from 'viem';

// Constants
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8"; // Game Wallet
const CHECK_AMOUNT = BigInt(150000); // 0.15 USDC (6 decimals)
const START_BLOCK = BigInt(21000000); // Approximate deployment block (Oct 2024)

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

        setIsChecking(true);
        try {
            // 1. Validate Network (Optional but good safety)
            const chainId = await publicClient.getChainId();
            if (chainId !== 8453) {
                console.warn("Payment check skipped: Wrong Network");
                setIsChecking(false);
                return;
            }

            // Check strictly for transfers FROM user TO game wallet
            const logs = await publicClient.getLogs({
                address: USDC_ADDRESS,
                event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                args: {
                    from: address,
                    to: RECIPIENT
                },
                fromBlock: START_BLOCK,
                toBlock: 'latest'
            });

            // Verify amount
            const validPayment = logs.some(log => log.args.value && log.args.value >= CHECK_AMOUNT);

            if (validPayment) {
                setHasPaid(true);
            } else {
                setHasPaid(false); // Explicit false
            }
        } catch (error) {
            console.error("Payment check failed:", error);
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
