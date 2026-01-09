'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { getName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';
import sdk, { type Context } from "@farcaster/frame-sdk";
import GlobalLeaderboard from './GlobalLeaderboard';
import { useLeaderboard } from '@/lib/hooks/useLeaderboard'; // Import hook at top
import { usePaymentStatus } from '@/lib/hooks/usePaymentStatus';

interface LobbyProps {
    onStart: () => void;
}

export default function Lobby({ onStart }: LobbyProps) {
    const { address } = useAccount();

    const [displayName, setDisplayName] = useState<string>('');
    const [isChecking, setIsChecking] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [context, setContext] = useState<Context.FrameContext | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false); // Menu State
    const [isLeaderboardOpening, setIsLeaderboardOpening] = useState(false);

    // Leaderboard Hook
    const { leaderboard, fetchLeaderboard, isLoading: isScanningList } = useLeaderboard();
    const { hasPaid, isChecking: isCheckingPayment, checkPayment } = usePaymentStatus();

    // ...



    useEffect(() => {
        const signalReady = async () => {
            // Give the app a moment to hydrate
            setTimeout(() => sdk.actions.ready(), 200);
        };
        signalReady();
    }, []);

    // 1. Initial Identity Check (Passive)
    useEffect(() => {
        const init = async () => {
            setIsChecking(true);
            try {
                const ctx = await sdk.context;
                setContext(ctx);

                // Auto-detect from context
                if (ctx?.user?.username) {
                    setDisplayName(ctx.user.username.toUpperCase());
                } else if (address) {
                    // Fallback to Wallet if already connected
                    try {
                        const name = await getName({ address, chain: base });
                        setDisplayName((name ?? "PLAYER ONE").toUpperCase());
                    } catch {
                        setDisplayName("PLAYER ONE");
                    }
                }
            } catch (e) {
                // Fallback to address if SDK fails (e.g. desktop browser)
                if (address) {
                    setDisplayName("PLAYER ONE");
                }
            } finally {
                setIsChecking(false);
                setTimeout(() => sdk.actions.ready(), 500); // Signal readiness
            }
        };
        init();
    }, [address]);

    // 2. Handle Entry (Active Quick Auth)
    const handleInitialize = useCallback(async () => {
        if (displayName) {
            setIsMenuOpen(true);
            // Re-check payment when entering menu to be sure
            checkPayment();
            return;
        }

        try {
            if (sdk.quickAuth) {
                const { token } = await sdk.quickAuth.getToken();
                const res = await fetch('/api/auth/verify', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                if (data.fid) {
                    setDisplayName(`FID #${data.fid}`);
                    setTimeout(() => setIsMenuOpen(true), 800);
                    return;
                }
            } else {
                const result = await sdk.actions.signIn({ nonce: "wordrain" });
                setDisplayName("VERIFIED");
                setTimeout(() => setIsMenuOpen(true), 500);
            }
        } catch (e: any) {
            console.warn("Auth failed:", e);
            setErrorMsg(e.message || "Auth Failed");
        }
    }, [displayName, checkPayment]);

    const handleOpenLeaderboard = async () => {
        setErrorMsg("");

        // GATING LOGIC: Purely based on usePaymentStatus
        if (hasPaid) {
            setIsLeaderboardOpening(true);
            await fetchLeaderboard(); // Trigger fresh scan
            setIsLeaderboardOpening(false);
            setShowLeaderboard(true);
        } else {
            // Re-check one last time in case it just happened
            await checkPayment();
            // We can't immediately check 'hasPaid' here because state updates strictly after render.
            // But usually the effect runs on mount. 
            // If still false, show error.
            if (!hasPaid) {
                setErrorMsg("ACCESS DENIED: 0.15 USDC CONTRIBUTION REQUIRED");
            }
        }
    };

    // Ready State Animation
    useEffect(() => {
        if (!isChecking) {
            const timer = setTimeout(() => setIsReady(true), 300);
            return () => clearTimeout(timer);
        }
    }, [isChecking]);

    return (
        <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-[#050505] flex flex-col items-center z-20">
            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none -z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-[#0052FF]/10 blur-[150px] rounded-full animate-pulse opacity-50" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_60%,transparent_100%)]" />
            </div>

            {/* Leaderboard Overlay */}
            <AnimatePresence>
                {showLeaderboard && (
                    <GlobalLeaderboard onClose={() => setShowLeaderboard(false)} />
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {isReady && !showLeaderboard ? (
                    <motion.div
                        key="main-interface"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                        transition={{ duration: 0.8 }}
                        className="flex flex-col justify-between w-full h-full max-w-md mx-auto p-6 relative z-10"
                    >
                        {/* Header Status */}
                        <div className="w-full flex justify-between items-center py-4 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                <span className="text-[10px] font-mono text-zinc-500 tracking-[0.2em] uppercase">System Online</span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-600 tracking-widest">V.2.1.0</span>
                        </div>

                        {/* Center Hero */}
                        <div className="flex-grow flex flex-col items-center justify-center gap-6 -mt-12">
                            {/* Main Title - Responsive Sizing */}
                            <div className="relative text-center">
                                <motion.h1
                                    className="text-[3.5rem] leading-[0.85] md:text-8xl font-black tracking-[-0.05em] text-white font-space"
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ duration: 0.8, ease: "circOut" }}
                                >
                                    WORD<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-br from-zinc-300 to-zinc-600 block mt-1">
                                        RAIN
                                    </span>
                                </motion.h1>
                                <motion.div
                                    className="absolute -right-2 top-0 text-[#0052FF] text-[9px] font-mono tracking-widest border border-[#0052FF]/30 px-1.5 py-0.5 rounded animate-pulse"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1 }}
                                >
                                    BETA
                                </motion.div>
                            </div>

                            {/* Pilot Identity */}
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="mt-4 px-6 py-2 bg-white/[0.02] border border-white/10 rounded-full backdrop-blur-md flex items-center gap-3"
                            >
                                <div className="w-1.5 h-1.5 bg-[#0052FF] rotate-45 shadow-[0_0_10px_#0052FF]" />
                                {displayName ? (
                                    <span className="text-xs font-mono tracking-[0.15em] text-zinc-400">
                                        PILOT: <span className="text-white font-bold">{displayName}</span>
                                    </span>
                                ) : (
                                    <span className="text-xs font-mono tracking-[0.15em] text-zinc-600 animate-pulse">
                                        ESTABLISHING LINK...
                                    </span>
                                )}
                            </motion.div>
                        </div>

                        {/* Bottom Controls */}
                        <div className="w-full flex flex-col gap-3 pb-8">
                            {!isMenuOpen ? (
                                <motion.button
                                    onClick={handleInitialize}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full h-14 bg-white text-black font-space font-bold text-lg tracking-widest uppercase relative overflow-hidden group hover:scale-[1.02] transition-transform"
                                >
                                    <div className="absolute inset-0 bg-zinc-200 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        [{!displayName && context?.client ? "Connect Farcaster" : (displayName ? "Initialize System" : "Connect Identity")}]
                                    </span>
                                </motion.button>
                            ) : (
                                <div className="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
                                    <button
                                        onClick={onStart}
                                        className="w-full h-14 bg-white text-black font-space font-bold text-base tracking-widest uppercase flex items-center justify-between px-6 hover:bg-zinc-200 transition-colors"
                                    >
                                        <span>Start Mission</span>
                                        <span>→</span>
                                    </button>

                                    <button
                                        onClick={handleOpenLeaderboard}
                                        className={`w-full h-14 border ${hasPaid ? "border-[#0052FF] text-[#0052FF] bg-[#0052FF]/5" : "border-white/10 text-zinc-400"} font-mono text-xs tracking-widest uppercase flex items-center justify-between px-6 hover:border-[#0052FF] hover:bg-[#0052FF]/10 transition-all`}
                                    >
                                        <span className="flex items-center gap-2">
                                            {isLeaderboardOpening ? "Syncing..." : (hasPaid ? "Verified Agents Registry" : "Access Denied")}
                                            {hasPaid && <div className="w-1.5 h-1.5 bg-[#0052FF] rounded-full animate-pulse" />}
                                        </span>
                                        {!hasPaid && <span className="opacity-50 border border-current px-1.5 py-0.5 rounded-[2px] text-[9px]">0.15 USDC</span>}
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-700 mt-2">
                                <span>SECURE CONNECTION</span>
                                <span>BASE MAINNET</span>
                            </div>
                        </div>

                        {/* Error Toast */}
                        {errorMsg && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="absolute bottom-24 left-6 right-6 bg-red-500/10 border border-red-500/50 text-red-500 font-mono text-[10px] px-4 py-2 text-center backdrop-blur-md"
                            >
                                {errorMsg}
                            </motion.div>
                        )}
                    </motion.div>
                ) : null}

                {(!isReady) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 flex items-center justify-center bg-[#050505] z-50 text-white font-mono text-[10px] tracking-[0.5em]"
                    >
                        <span className="animate-pulse">LOADING RESOURCES...</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
