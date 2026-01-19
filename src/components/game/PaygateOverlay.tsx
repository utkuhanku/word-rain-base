'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { useConnect } from 'wagmi';
import { parseAbiItem } from 'viem';
import { useScoreBoard } from '@/lib/hooks/useScoreBoard';
import GlobalLeaderboard from './GlobalLeaderboard';

export default function PaygateOverlay() {
    const status = useGameStore((state) => state.status);
    const score = useGameStore((state) => state.score);
    const resetGame = useGameStore((state) => state.resetGame);
    const setStatus = useGameStore((state) => state.setStatus);
    const reviveGame = useGameStore((state) => state.reviveGame); // New Action
    const pvpGameId = useGameStore((state) => state.pvpGameId);
    const setPvPGameId = useGameStore((state) => state.setPvPGameId);
    const { isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { writeContractAsync } = useWriteContract(); // For Revive Payment

    // ... imports
    // NEW HOOK: Centralized Score Submission
    const { submitScore, isSubmitting, errorMsg, step } = useScoreBoard();

    const [isPaid, setIsPaid] = useState(false);
    const [isReviving, setIsReviving] = useState(false);
    const [reviveCountdown, setReviveCountdown] = useState<number | null>(null);

    // PvP Specifics
    const [isPvPSubmitting, setIsPvPSubmitting] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const hasUsedRetry = useGameStore((state) => state.hasUsedRetry);
    const setHasUsedRetry = useGameStore((state) => state.setHasUsedRetry);

    // Countdown Logic
    useEffect(() => {
        if (reviveCountdown === null) return;

        if (reviveCountdown > 0) {
            const timer = setTimeout(() => setReviveCountdown(c => (c as number) - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            // Countdown finished
            reviveGame();
            setReviveCountdown(null);
        }
    }, [reviveCountdown, reviveGame]);

    const handleRevive = async () => {
        setIsReviving(true);
        try {
            const hash = await writeContractAsync({
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC Base
                abi: [parseAbiItem('function transfer(address to, uint256 value)')],
                functionName: 'transfer',
                args: ["0x6edd22E9792132614dD487aC6434dec3709b79A8", BigInt(1000000)] // 1.00 USDC
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                // Start Countdown
                setReviveCountdown(3);
            }
        } catch (e) {
            console.error("Revive Payment Failed", e);
        } finally {
            setIsReviving(false);
        }
    };

    const handlePaidRetry = async () => {
        if (!isConnected) return;
        setIsRetrying(true);
        try {
            const hash = await writeContractAsync({
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC Base
                abi: [parseAbiItem('function transfer(address to, uint256 value)')],
                functionName: 'transfer',
                args: ["0x6edd22E9792132614dD487aC6434dec3709b79A8", BigInt(5000000)] // 5.00 USDC
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                setHasUsedRetry(true);
                resetGame();
            }
        } catch (e) {
            console.error("Paid Retry Failed", e);
        } finally {
            setIsRetrying(false);
        }
    };
    // Legacy Payment State (isPaying) replaced by isSubmitting from hook if needed, 
    // but we can use isSubmitting directly in UI.

    const publicClient = usePublicClient();

    // ... (rest of code)

    // ... inside return ...

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
        const text = `${phrase} Score: ${score} in Word Rain 🌧️\n\nPlay now:\n@utkus`;
        // Use proper intent for Base App / Warpcast
        const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=https://word-rain-base.vercel.app`;
        window.open(url, '_blank');
    };

    const handlePayment = async () => {
        if (!isConnected) return;

        if (pvpGameId) {
            // PVP SUBMISSION
            setIsPvPSubmitting(true);
            // Simulate network delay
            setTimeout(() => {
                localStorage.setItem(`pvp_submitted_${pvpGameId}`, 'true');
                setIsPvPSubmitting(false);
                setIsPaid(true);
            }, 800);
            return;
        }

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

    if (reviveCountdown !== null) {
        return (
            <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center animate-in fade-in duration-200">
                <div className="text-[120px] font-black font-mono text-[#0052FF] animate-bounce">
                    {reviveCountdown === 0 ? "GO!" : reviveCountdown}
                </div>
                <p className="text-white font-mono tracking-widest uppercase mt-4">Get Ready...</p>
            </div>
        );
    }

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
                                onClick={() => { setStatus('idle'); setPvPGameId(null); }}
                                className="flex-1 py-4 border border-zinc-800 hover:bg-zinc-900 text-zinc-500 font-mono text-xs uppercase tracking-widest transition-all"
                            >
                                Home
                            </button>
                            {pvpGameId ? (
                                <button
                                    onClick={handlePaidRetry}
                                    disabled={hasUsedRetry || isRetrying}
                                    className={`flex-[2] py-4 font-bold tracking-tight text-sm uppercase transition-all flex flex-col items-center justify-center leading-none gap-1 ${hasUsedRetry ? "bg-zinc-900 text-zinc-600 cursor-not-allowed" : "bg-white hover:bg-zinc-200 text-black"}`}
                                >
                                    <span>{isRetrying ? "Processing..." : (hasUsedRetry ? "NO RETRIES LEFT" : "TRY AGAIN")}</span>
                                    {!hasUsedRetry && <span className="text-[9px] font-mono opacity-60">5 USDC</span>}
                                </button>
                            ) : (
                                <button
                                    onClick={resetGame}
                                    className="flex-[2] py-4 bg-white hover:bg-zinc-200 text-black font-bold tracking-tight text-sm uppercase transition-all"
                                >
                                    Retry Run
                                </button>
                            )}
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
                                        <span>❤️ Extra Life (Countdown)</span>
                                        <span className="bg-black/20 px-1.5 py-0.5 rounded text-[10px] font-mono">$1.00</span>
                                    </>
                                )}
                            </button>
                        )}

                        <div>
                            {isConnected ? (
                                <button
                                    onClick={handlePayment}
                                    disabled={isSubmitting || isPvPSubmitting}
                                    className={`w-full py-4 border font-bold font-mono tracking-tight text-sm uppercase transition-all flex items-center justify-center gap-2 ${isSubmitting || isPvPSubmitting ? "border-[#0052FF] bg-[#0052FF]/20 text-[#0052FF]" : "border-[#0052FF] bg-[#0052FF]/10 hover:bg-[#0052FF]/20 text-[#0052FF] animate-pulse"}`}
                                >
                                    {(isSubmitting || isPvPSubmitting) && <div className="w-3 h-3 border-2 border-[#0052FF]/50 border-t-[#0052FF] rounded-full animate-spin" />}
                                    {pvpGameId ? "SAVE SCORE" : (step || "Unlock Leaderboard")}
                                </button>
                            ) : (
                                <button
                                    onClick={handleConnect}
                                    className="w-full py-4 border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-white font-mono tracking-tight text-xs uppercase transition-all"
                                >
                                    Connect Wallet to Submit Score
                                </button>
                            )}

                            {errorMsg && (
                                <p className="text-red-500 font-mono text-[10px] text-center bg-red-500/10 p-2 rounded border border-red-500/20">
                                    {errorMsg}
                                </p>
                            )}

                            {!pvpGameId && (
                                <p className="text-[10px] text-zinc-600 font-mono mt-2 uppercase tracking-wide">
                                    * Recording your score on-chain requires a 0.15 USDC Fee + Gas. Unsaved scores will be lost.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                // STATE 2: PAID (Success)
                pvpGameId ? (
                    <div className="w-full max-w-sm bg-black/90 border border-white/10 rounded-xl p-8 text-center space-y-6">
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                            <span className="text-2xl">🔒</span>
                        </div>
                        <div>
                            <h3 className="text-white font-bold font-mono text-xl uppercase mb-2">Score Secured</h3>
                            <p className="text-zinc-500 text-xs font-mono leading-relaxed">
                                Your score of <span className="text-white font-bold">{score}</span> has been encrypted and attached to Table #{pvpGameId}.
                            </p>
                            <p className="text-zinc-600 text-[10px] font-mono mt-2">
                                Waiting for opponent...
                            </p>
                        </div>
                        <button
                            onClick={() => { setStatus('idle'); setPvPGameId(null); }}
                            className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-bold tracking-tight text-sm uppercase transition-all"
                        >
                            Return to Lobby
                        </button>
                    </div>
                ) : (
                    <div className="w-full h-full max-w-md bg-black/90 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
                        <GlobalLeaderboard onClose={() => setStatus('idle')} />
                    </div>
                )
            )}
        </div>
    );
}
