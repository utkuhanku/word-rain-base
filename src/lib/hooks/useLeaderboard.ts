import { useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';

export interface LeaderboardEntry {
    name: string;
    score: number;
}

export function useLeaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const publicClient = usePublicClient();

    const fetchLeaderboard = useCallback(async () => {
        setIsLoading(true);
        try {
            // USDC on Base
            const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
            const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8";

            // Get logs for Transfer(from, to, value)
            const logs = await publicClient?.getLogs({
                address: USDC_ADDRESS,
                event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                args: {
                    to: RECIPIENT
                },
                fromBlock: 24700000n, // Approx start block or Recent
                toBlock: 'latest'
            });

            const payers = new Set<string>();
            logs?.forEach(log => {
                if (log.args.value && log.args.value >= 150000n) {
                    payers.add(log.args.from!);
                }
            });

            const board = Array.from(payers).map(addr => ({
                name: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
                score: 100 + Math.floor(Math.random() * 500) // Placeholder
            }));

            setLeaderboard(board);
        } catch (e) {
            console.error("Leaderboard Fetch Error:", e);
        } finally {
            setIsLoading(false);
        }
    }, [publicClient]);

    return { leaderboard, isLoading, fetchLeaderboard };
}
