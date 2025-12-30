import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { ScoreBoardABI, SCOREBOARD_ADDRESS } from '@/contracts/ScoreBoardABI';
import { useEffect } from 'react';
import { useGameStore } from '@/lib/store/gameStore';

export function useScoreBoard() {
    const { address, isConnected } = useAccount();
    const setBestScore = useGameStore((state) => state.setBestScore);
    const bestScore = useGameStore((state) => state.bestScore);

    // Read Best Score
    const { data: onchainBestScore, refetch } = useReadContract({
        address: SCOREBOARD_ADDRESS,
        abi: ScoreBoardABI,
        functionName: 'getBestScore',
        args: [address as `0x${string}`],
        query: {
            enabled: isConnected && !!address,
        }
    });

    // Write Score
    const { writeContractAsync } = useWriteContract();

    // Sync Onchain Score to Store
    useEffect(() => {
        if (onchainBestScore) {
            const score = Number(onchainBestScore);
            if (score > bestScore) {
                setBestScore(score);
            }
        }
    }, [onchainBestScore, bestScore, setBestScore]);

    const submitScore = async (score: number) => {
        if (!isConnected || !address) return;

        // Only submit if it beats the best score (logic can be client-side optimization)
        // But usually contract checks too.

        try {
            await writeContractAsync({
                address: SCOREBOARD_ADDRESS,
                abi: ScoreBoardABI,
                functionName: 'submitScore',
                args: [BigInt(score)],
            });

            // Optimistic update? Or wait for refetch.
            // For MVP, we just let it happen.
        } catch (e) {
            console.error("Failed to submit score:", e);
        }
    };

    return {
        submitScore,
        refetchBestScore: refetch
    };
}
