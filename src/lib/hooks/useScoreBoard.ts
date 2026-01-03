import { useAccount, useWriteContract } from 'wagmi';

export function useScoreBoard() {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();

    const submitScore = async (score: number) => {
        if (!isConnected || !address) return;

        try {
            // USDC on Base
            const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
            const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8";
            const AMOUNT = BigInt(150000); // 0.15 USDC (6 decimals)

            await writeContractAsync({
                address: USDC_ADDRESS,
                abi: [{
                    name: 'transfer',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [
                        { name: 'to', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    outputs: [{ type: 'bool' }]
                }],
                functionName: 'transfer',
                args: [RECIPIENT, AMOUNT],
            });

            console.log("0.15 USDC Transfer initiated for score:", score);
        } catch (e) {
            console.error("Failed to submit score (USDC Transfer):", e);
        }
    };

    return {
        submitScore,
        // Mock refetch for now as we removed the read logic
        refetchBestScore: async () => { }
    };
}
