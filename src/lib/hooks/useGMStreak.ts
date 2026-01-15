import { useState, useCallback, useEffect } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { GMRegistryABI } from '@/lib/abi/GMRegistryABI';

const REGISTRY_ADDRESS = "0x6A73b1b95Ac62c502D8087d86426c7eFB5f4d972";

export function useGMStreak(address?: string) {
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();

    const [streak, setStreak] = useState<number>(0);
    const [canGM, setCanGM] = useState<boolean>(true); // Default true until checked
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const fetchStreak = useCallback(async () => {
        if (!publicClient || !address) return;

        try {
            const data = await publicClient.readContract({
                address: REGISTRY_ADDRESS,
                abi: GMRegistryABI,
                functionName: 'getStreak',
                args: [address as `0x${string}`]
            });

            // data = [count, last, canGM]
            setStreak(Number(data[0]));
            setCanGM(data[2]);
        } catch (e) {
            console.error("[GMStreak] Fetch Error:", e);
        }
    }, [publicClient, address]);

    // Initial fetch
    useEffect(() => {
        fetchStreak();
    }, [fetchStreak]);

    const sendGM = async () => {
        if (!walletClient || !canGM) return;

        setIsSending(true);
        try {
            const hash = await walletClient.writeContract({
                address: REGISTRY_ADDRESS,
                abi: GMRegistryABI,
                functionName: 'gm',
                account: address as `0x${string}`,
                capabilities: {
                    paymasterService: {
                        url: "https://api.developer.coinbase.com/rpc/v1/base/fd060805-4f46-444f-8360-1e563032d847" // Public/Demo or standard Base Paymaster
                    }
                }
            });

            // Wait for confirmation
            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                // Re-fetch to update UI
                await fetchStreak();
            }
            return hash;
        } catch (e) {
            console.error("[GMStreak] Send Error:", e);
            throw e;
        } finally {
            setIsSending(false);
        }
    };

    return { streak, canGM, isLoading, isSending, sendGM, fetchStreak };
}
