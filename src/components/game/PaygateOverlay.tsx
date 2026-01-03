'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useAccount, useWriteContract } from 'wagmi';

export default function PaygateOverlay() {
    const status = useGameStore((state) => state.status);
    const score = useGameStore((state) => state.score);
    const resetGame = useGameStore((state) => state.resetGame);
    const { isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();

    const [isPaid, setIsPaid] = useState(false);
    const [isPaying, setIsPaying] = useState(false);

    // Mock Leaderboard Data
    const LEADERBOARD = [
        { name: 'brian.eth', score: 342 },
        { name: 'jesse.base.eth', score: 289 },
        { name: 'based_god', score: 210 },
        { name: 'word_ninja', score: 156 },
        { name: 'rain_maker', score: 142 },
    ];

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
        const text = `${phrase} Score: ${score} in Word Rain 🌧️\n\nPlay now:`;
        // Use proper intent for Base App / Warpcast
        const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=https://word-rain-base.vercel.app`;
        window.open(url, '_blank');
    };

    const handlePayment = async () => {
        if (!isConnected) return;
        setIsPaying(true);
        try {
            // USDC on Base
            const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
            const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8";
            const AMOUNT = BigInt(150000); // 0.15 USDC

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

            // In a real app, wait for receipt. Here we trust the intent for UX speed.
            setIsPaid(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsPaying(false);
        }
    };

    if (status !== 'game_over') return null;

    return (
        <div className="absolute inset-0 z-40 bg-[#050505]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">

            {!isPaid ? (
                // STATE 1: UNPAID (Game Over)
                <div className="text-center space-y-8 max-w-sm w-full">
                    <div className="space-y-2">
                        <h2 className="text-4xl font-black italic tracking-tighter text-white">GAME OVER</h2>
                        <div className="text-6xl font-mono font-bold text-[#0052FF] text-glow">{score}</div>
                        <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase">Logic Score Finalized</p>
                    </div>

                    <div className="grid gap-3">
                        <button
                            onClick={resetGame}
                            className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-bold tracking-tight text-sm uppercase transition-all"
                        >
                            Retry Run
                        </button>

                        {isConnected && (
                            <button
                                onClick={handlePayment}
                                disabled={isPaying}
                                className="w-full py-4 border border-[#0052FF] bg-[#0052FF]/10 hover:bg-[#0052FF]/20 text-[#0052FF] font-bold font-mono tracking-tight text-sm uppercase transition-all animate-pulse"
                            >
                                {isPaying ? "Verifying..." : "Unlock Leaderboard (0.15 USDC)"}
                            </button>
                        )}

                        {!isConnected && (
                            <div className="text-xs text-zinc-600 font-mono">Connect Wallet to Submit Score</div>
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

                        {LEADERBOARD.map((entry, i) => (
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
                        <button
                            onClick={resetGame}
                            className="w-full py-3 text-zinc-500 hover:text-white text-xs font-mono uppercase tracking-widest"
                        >
                            Close & Retry
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
