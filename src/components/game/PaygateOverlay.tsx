'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { useConnect } from 'wagmi';
import { parseAbiItem } from 'viem';
import { useScoreBoard } from '@/lib/hooks/useScoreBoard';

export default function PaygateOverlay() {
    const status = useGameStore((state) => state.status);
    const score = useGameStore((state) => state.score);
    const resetGame = useGameStore((state) => state.resetGame);
    const setStatus = useGameStore((state) => state.setStatus);
    const reviveGame = useGameStore((state) => state.reviveGame); // New Action
    const { isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { writeContractAsync } = useWriteContract(); // For Revive Payment

    // ... imports
    // NEW HOOK: Centralized Score Submission
    const { submitScore, isSubmitting } = useScoreBoard();

    const [isPaid, setIsPaid] = useState(false);
    const [isReviving, setIsReviving] = useState(false);

    // ...

    const handleRevive = async () => {
        setIsReviving(true);
        try {
            const hash = await writeContractAsync({
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC Base
                abi: [parseAbiItem('function transfer(address to, uint256 value)')],
                functionName: 'transfer',
                args: ["0x6edd22E9792132614dD487aC6434dec3709b79A8", BigInt(500000)] // 0.50 USDC
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                reviveGame(); // Resume Game with 1 Life
            }
        } catch (e) {
            console.error("Revive Payment Failed", e);
        } finally {
            setIsReviving(false);
        }
    };
    // Legacy Payment State (isPaying) replaced by isSubmitting from hook if needed, 
    // but we can use isSubmitting directly in UI.

    const [realLeaderboard, setRealLeaderboard] = useState<{ name: string, score: number }[]>([]);
    const [isLoadingLeaderboard, setIsLoading] = useState(false);
    const publicClient = usePublicClient();

    // Fetch REAL transfer events (Legacy display logic, kept for continuity)
    const fetchLeaderboard = async () => {
        setIsLoading(true);
        try {
            // USDC on Base
            const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
            const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8"; // Game Wallet

            // Get logs for Transfer(from, to, value)
            const logs = await publicClient?.getLogs({
                address: USDC_ADDRESS,
                event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                args: {
                    to: RECIPIENT
                },
                fromBlock: BigInt(24700000), // Approx start block
                toBlock: 'latest'
            });

            // Process logs
            const payers = new Set<string>();
            logs?.forEach(log => {
                // Check value approx 0.15 USDC (150000)
                if (log.args.value && log.args.value >= BigInt(150000)) {
                    payers.add(log.args.from!);
                }
            });

            // Map to Display Objects
            const board = Array.from(payers).map(addr => ({
                name: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
                score: 100 + Math.floor(Math.random() * 500) // Placeholder
            }));

            setRealLeaderboard(board);

        } catch (e) {
            console.error("Leaderboard Fetch Error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-fetch on mount if Game Over
    useEffect(() => {
        if (status === 'game_over') fetchLeaderboard();
    }, [status]);

    // Hype Sentences
    const HYPE_PHRASES = [
        "I just proved I'm BASED. Can you?",
        "Rain couldn't stop me. 🌧️",
        "Top 1% Reflexes on Base.",
        "Verified Logic Score. Onchain.",
        "Don't trust, verify. My score is etched."
    ];

    const generateHype = () => {
        const phrase = HYPE_PHRASES[Math.floor(Math.random() * HYPE_PHRASES.length)];
        const text = `${phrase} Score: ${score} in Word Rain 🌧️\n\nPlay now:\n@utkus.base.eth`;
        // Use proper intent for Base App / Warpcast
        const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=https://word-rain-base.vercel.app`;
        window.open(url, '_blank');
    };

    const handlePayment = async () => {
        if (!isConnected) return;

        // REFACTORED: Use submitScore instead of raw transfer
        const success = await submitScore(score);

        if (success) {
            setIsPaid(true);
        }
    };

    const handleConnect = () => {
        const coinbaseConnector = connectors.find(c => c.id === 'coinbaseWalletSDK');
        if (coinbaseConnector) {
            connect({ connector: coinbaseConnector });
        }
    };

    if (status !== 'game_over') return null;

    return (
        <div className="absolute inset-0 z-50 bg-[#050505] flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">

            {!isPaid ? (
                // STATE 1: UNPAID (Game Over)
                <div className="text-center space-y-8 max-w-sm w-full">
                    <div className="space-y-2">
                        <h2 className="text-4xl font-black italic tracking-tighter text-white">GAME OVER</h2>
                        <div className="text-6xl font-mono font-bold text-[#0052FF] text-glow">{score}</div>
                        <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase">Logic Score Finalized</p>
                    </div>

                    <div className="grid gap-3">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStatus('idle')}
                                className="flex-1 py-4 border border-zinc-800 hover:bg-zinc-900 text-zinc-500 font-mono text-xs uppercase tracking-widest transition-all"
                            >
                                Home
                            </button>
                            <button
                                onClick={resetGame}
                                className="flex-[2] py-4 bg-white hover:bg-zinc-200 text-black font-bold tracking-tight text-sm uppercase transition-all"
                            >
                                Retry Run
                            </button>
                        </div>

                        {/* Revive Option */}
                        {isConnected && (
                            <button
                                onClick={handleRevive}
                                disabled={isReviving}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold tracking-tight text-sm uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2"
                            >
                                {isReviving ? (
                                    <span className="animate-pulse">Resurrecting...</span>
                                ) : (
                                    <>
                                        <span>❤️ Continue (1 Life)</span>
                                        <span className="bg-black/20 px-1.5 py-0.5 rounded text-[10px] font-mono">$0.50</span>
                                    </>
                                )}
                            </button>
                        )}

                        {isConnected ? (
                            <button
                                onClick={handlePayment}
                                disabled={isSubmitting}
                                className="w-full py-4 border border-[#0052FF] bg-[#0052FF]/10 hover:bg-[#0052FF]/20 text-[#0052FF] font-bold font-mono tracking-tight text-sm uppercase transition-all animate-pulse"
                            >
                                {isSubmitting ? "Submitting logic..." : "Unlock Leaderboard (0.15 USDC)"}
                            </button>
                        ) : (
                            <button
                                onClick={handleConnect}
                                className="w-full py-4 border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-white font-mono tracking-tight text-xs uppercase transition-all"
                            >
                                Connect Wallet to Submit Score
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                // STATE 2: PAID (Leaderboard)
                <div className="w-full max-w-md h-full flex flex-col">
                    <div className="py-6 text-center shrink-0">
                        <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">Global Elite</h2>
                        <p className="text-zinc-500 text-xs font-mono">Payment Verified</p>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                        {/* Current User Highlighting */}
                        <div className="flex justify-between items-center p-4 bg-[#0052FF]/20 border border-[#0052FF] rounded-lg mb-4">
                            <span className="font-mono font-bold text-white">YOU</span>
                            <span className="font-mono font-bold text-[#0052FF]">{score}</span>
                        </div>

                        {realLeaderboard.map((entry, i) => (
                            <div key={i} className="flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-lg">
                                <span className="font-mono text-sm text-zinc-400">{i + 1}. {entry.name}</span>
                                <span className="font-mono text-sm text-white">{entry.score}</span>
                            </div>
                        ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="py-6 space-y-3 shrink-0">
                        <button
                            onClick={generateHype}
                            className="w-full py-4 bg-[#0052FF] hover:bg-blue-600 text-white font-bold tracking-tight text-sm uppercase transition-all shadow-[0_0_20px_rgba(0,82,255,0.4)]"
                        >
                            SHARE HYPE (Base App)
                        </button>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setStatus('idle')}
                                className="flex-1 py-4 border border-zinc-800 hover:bg-zinc-900 text-zinc-500 font-mono text-xs uppercase tracking-widest transition-all"
                            >
                                Home
                            </button>
                            <button
                                onClick={resetGame}
                                className="flex-1 py-4 bg-white hover:bg-zinc-200 text-black font-bold tracking-tight text-sm uppercase transition-all"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
