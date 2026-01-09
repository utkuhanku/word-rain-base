```typescript
import { useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';
import { getName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';

export interface LeaderboardEntry {
    address: string;
    name: string;
    score: number;
    timestamp?: number; // Added for future sorting
}

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8";
const START_BLOCK = BigInt(21000000); 
const SAFE_CHUNK = BigInt(10000); // 10k blocks per chunk
const MIN_AMOUNT = BigInt(150000);

export function useLeaderboard() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [scanProgress, setScanProgress] = useState<string>(""); // e.g. "90%"
    const publicClient = usePublicClient();

    const fetchLeaderboard = useCallback(async () => {
        if (!publicClient) return;
        
        setIsLoading(true);
        setScanProgress("Initializing...");

        try {
            const currentBlock = await publicClient.getBlockNumber();
            let pointer = currentBlock;
            const seen = new Set<string>();

            // Note: In a real "Score" implementation, we would query a specific Contract Event or 
            // a Database. Since we are using "Payment as Registry", we scan Transfers.
            
            // Progressive Backward Scan
            while (pointer > START_BLOCK) {
                const from = pointer - SAFE_CHUNK > START_BLOCK ? pointer - SAFE_CHUNK : START_BLOCK;
                const to = pointer;
                
                // Update progress for UI
                const total = Number(currentBlock - START_BLOCK);
                const done = Number(currentBlock - pointer);
                const percent = Math.floor((done / total) * 100);
                setScanProgress(`${ percent }% `);

                try {
                    const logs = await publicClient.getLogs({
                        address: USDC_ADDRESS,
                        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                        args: { to: RECIPIENT },
                        fromBlock: from,
                        toBlock: to
                    });

                    const newEntries: LeaderboardEntry[] = [];

                    for (const log of logs) {
                        const val = log.args.value;
                        const addr = log.args.from;

                        if (val && val >= MIN_AMOUNT && addr && !seen.has(addr)) {
                            seen.add(addr);
                            
                            // Placeholder name
                            let displayName = `${ addr.slice(0, 6) }...${ addr.slice(-4) } `;

                            // Future: Check if this transaction has "Score Data" in calldata?
                            // For now, static score 100.
                            const entry: LeaderboardEntry = {
                                address: addr,
                                name: displayName,
                                score: 100, 
                                timestamp: Number(log.blockNumber) // Use block number as proxy for timestamp
                            };
                            newEntries.push(entry);

                            // Resolve name in background
                            getName({ address: addr as `0x${ string } `, chain: base }).then(baseName => {
                                if (baseName) {
                                    setLeaderboard(prev => prev.map(p => 
                                        p.address === addr ? { ...p, name: baseName.toUpperCase() } : p
                                    ));
                                }
                            }).catch(() => {});
                        }
                    }

                    if (newEntries.length > 0) {
                        setLeaderboard(prev => {
                            // Reverse order of this chunk (since we scan backwards, this chunk is "newer" than the next)
                            // But within the chunk, logs are usually Old -> New.
                            // We want the LIST to be Score Desc, Time Desc.
                            // Since scores are equal, sort by Time Desc (Newest First).
                            // The backward scan gives us Newest Chunks first.
                            // So we append NEW (Old) stuff to the end of the array.
                            // The logs inside `newEntries` are Old->New. We should reverse them to be New->Old?
                            // Let's just create a combined list and sort it properly every update.
                            
                            const combined = [...prev, ...newEntries];
                            // Sort by Score Desc (all 100), then Timestamp/Block Desc (Newest on top)
                            return combined.sort((a, b) => {
                                if (b.score !== a.score) return b.score - a.score;
                                return (b.timestamp || 0) - (a.timestamp || 0);
                            });
                        });
                    }

                } catch (err) {
                    console.warn(`Chunk failed ${ from } -${ to } `, err);
                    // Continue to next chunk even if one fails
                }
                
                pointer = from - BigInt(1);
                await new Promise(r => setTimeout(r, 50)); // Tiny yield
            }

        } catch (e) {
            console.error("Global Leaderboard Error", e);
        } finally {
            setIsLoading(false);
            setScanProgress("Synced");
        }
    }, [publicClient]);

    return { leaderboard, isLoading, scanProgress, fetchLeaderboard };
}
```
