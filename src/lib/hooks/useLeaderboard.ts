import { useState, useCallback } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { parseAbiItem } from 'viem';
import { getName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';

export interface LeaderboardEntry {
    address: string;
    name: string;
    score: number;
}

export function useLeaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const publicClient = usePublicClient();
    const { address: userAddress } = useAccount();

    const fetchLeaderboard = useCallback(async () => {
        // Don't block UI with global scan. Start loading, but resolve fast for the user.
        setIsLoading(true);

        try {
            // USDC on Base
            const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
            const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8";

            if (!publicClient) {
                setIsLoading(false);
                return;
            }

            const currentBlock = await publicClient.getBlockNumber();
            const foundEntries: LeaderboardEntry[] = [];
            const seen = new Set<string>();

            // 1. INSTANT CHECK: Verify the Connected User SPECIFICALLY
            if (userAddress) {
                try {
                    // Check specifically for transfers FROM user TO game
                    // This is much faster than scanning the whole chain
                    const userLogs = await publicClient.getLogs({
                        address: USDC_ADDRESS,
                        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                        args: {
                            from: userAddress,
                            to: RECIPIENT
                        },
                        fromBlock: BigInt(21000000), // Check all history for THIS user
                        toBlock: 'latest'
                    });

                    // If user has paid sufficient amount
                    const validPayment = userLogs.find(log => log.args.value && log.args.value >= BigInt(150000));

                    if (validPayment && !seen.has(userAddress)) {
                        seen.add(userAddress);

                        // Try to resolve name
                        let name = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
                        try {
                            const baseName = await getName({ address: userAddress, chain: base });
                            if (baseName) name = baseName.toUpperCase();
                        } catch (e) { }

                        foundEntries.push({
                            address: userAddress,
                            name: name,
                            score: 100 // Verified
                        });
                    }
                } catch (e) {
                    console.error("User Check Failed", e);
                }
            }

            // Set initial state (User only) to unblock UI
            setLeaderboard([...foundEntries]);
            setIsLoading(false); // <--- KEY: UI Unblocks Here!

            // 2. BACKGROUND: Scan recent history for others (Last 100k blocks only for speed)
            // We don't await this before unblocking.
            const RECENT_HISTORY = BigInt(100000);
            const fromBlock = currentBlock - RECENT_HISTORY > BigInt(21000000) ? currentBlock - RECENT_HISTORY : BigInt(21000000);

            publicClient.getLogs({
                address: USDC_ADDRESS,
                event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                args: { to: RECIPIENT },
                fromBlock: fromBlock,
                toBlock: 'latest'
            }).then(logs => {
                const newFound: LeaderboardEntry[] = [];
                for (const log of logs) {
                    const val = log.args.value;
                    const addr = log.args.from;
                    if (val && val >= BigInt(150000) && addr && !seen.has(addr)) {
                        seen.add(addr);
                        newFound.push({
                            address: addr,
                            name: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
                            score: 100
                        });
                    }
                }

                if (newFound.length > 0) {
                    setLeaderboard(prev => {
                        // Combine and Dedupe
                        const existing = new Set(prev.map(p => p.address));
                        const uniqueNew = newFound.filter(p => !existing.has(p.address));
                        return [...prev, ...uniqueNew];
                    });

                    // Resolve names for new entries in background
                    newFound.forEach(p => {
                        getName({ address: p.address as `0x${string}`, chain: base })
                            .then(n => {
                                if (n) {
                                    setLeaderboard(curr => curr.map(item => item.address === p.address ? { ...item, name: n.toUpperCase() } : item));
                                }
                            }).catch(() => { });
                    });
                }
            }).catch(e => console.error("Global Scan Error", e));

        } catch (e) {
            console.error("Fetch Error", e);
            setIsLoading(false);
        }
    }, [publicClient, userAddress]);

    return { leaderboard, isLoading, fetchLeaderboard };
}
