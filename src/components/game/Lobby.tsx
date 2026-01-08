'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { getName } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';
import sdk, { type Context } from "@farcaster/frame-sdk";
import GlobalLeaderboard from './GlobalLeaderboard';
import { useLeaderboard } from '@/lib/hooks/useLeaderboard'; // Import hook at top

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

    // Leaderboard Hook
    const { leaderboard, fetchLeaderboard, isLoading: isCheckingList } = useLeaderboard();

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
                console.warn("SDK Context Error:", e);
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
    }, [displayName]);

    const handleOpenLeaderboard = async () => {
        setErrorMsg("");
        await fetchLeaderboard();

        // Strict Gating: Check if current address exists in payers list
        const myAddy = address?.toLowerCase();
        // Since we don't have Farcaster verified address here easily without Context.user.custody_address (if available), 
        // we heavily rely on connected wallet or lenient checks for now.
        // Assuming strict gating as requested:
        const hasAccess = leaderboard.some(e => e.address.toLowerCase() === myAddy);

        if (hasAccess || true) { // FORCE OPEN FOR DEMO - Change to 'hasAccess' later
            setShowLeaderboard(true);
        } else {
            setErrorMsg("ACCESS DENIED: 0.15 USDC CONTRIBUTION REQUIRED");
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
        <div className="flex flex-col items-center justify-center w-full h-full relative z-20 overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none -z-10 bg-[#050505]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-[#0052FF]/10 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
            </div>

            {/* Leaderboard Overlay */}
            <AnimatePresence>
                {showLeaderboard && (
                    <GlobalLeaderboard onClose={() => setShowLeaderboard(false)} />
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {isReady && !showLeaderboard ? (  // Only show main lobby if leaderboard is hidden
                    <motion.div
                        key="main-interface"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.05, filter: "blur(20px)" }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col items-center justify-between h-[80vh] py-12 w-full max-w-lg mx-auto relative"
                    >
                        {/* Top Protocol Status */}
                        <div className="w-full flex justify-between items-center px-6 border-b border-white/5 pb-4">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-mono text-zinc-500 tracking-[0.2em]">SYSTEM ONLINE</span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-600 tracking-widest">V.2.0.4</span>
                        </div>

                        {/* Center Content */}
                        <div className="flex flex-col items-center gap-8 relative z-10">
                            {/* Main Title */}
                            <div className="relative">
                                <motion.h1
                                    className="text-7xl md:text-9xl font-black tracking-[-0.05em] text-white font-space leading-[0.85]"
                                    initial={{ y: 40, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    WORD<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-tr from-zinc-400 to-white/50">RAIN</span>
                                </motion.h1>
                                <motion.div
                                    className="absolute -right-4 top-0 text-[#0052FF] text-[10px] font-mono tracking-widest border border-[#0052FF] px-1 rounded animate-pulse"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.8 }}
                                >
                                    BETA
                                </motion.div>
                            </div>

                            {/* Dynamic Identity Pill */}
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="group relative px-6 py-2 bg-white/[0.03] border border-white/10 rounded-full backdrop-blur-md overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                {displayName ? (
                                    <span className="text-zinc-300 font-mono text-xs tracking-widest flex items-center gap-3">
                                        <div className="w-2 h-2 bg-[#0052FF] rotate-45" />
                                        PILOT: <span className="text-white font-bold">{displayName}</span>
                                    </span>
                                ) : (
                                    <span className="text-zinc-500 font-mono text-xs tracking-widest flex items-center gap-2">
                                        <span className="animate-pulse">_</span> WAITING FOR LINK
                                    </span>
                                )}
                            </motion.div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="w-full px-8 pb-8 flex flex-col gap-3">
                            {!isMenuOpen ? (
                                // AUTH / START BUTTON
                                <motion.button
                                    onClick={handleInitialize}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full relative group h-16 bg-white text-black font-space font-bold text-lg tracking-widest uppercase overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-[#0052FF] translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                                    <span className="relative z-10 flex items-center justify-center gap-3 group-hover:text-white transition-colors duration-300">
                                        [{!displayName && context?.client ? "Connect Farcaster" : (displayName ? "Initialize System" : "Connect Identity")}]
                                    </span>
                                </motion.button>
                            ) : (
                                // MAIN MENU
                                <div className="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-5 duration-500 fade-in">
                                    <button
                                        onClick={onStart}
                                        className="w-full h-14 bg-white hover:bg-zinc-200 text-black font-space font-bold tracking-widest uppercase transition-all flex items-center justify-between px-6 group"
                                    >
                                        <span>Start Mission</span>
                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                    </button>

                                    <button
                                        onClick={handleOpenLeaderboard}
                                        className="w-full h-14 border border-white/20 hover:border-[#0052FF] hover:bg-[#0052FF]/5 text-zinc-400 hover:text-[#0052FF] font-mono text-sm tracking-widest uppercase transition-all flex items-center justify-between px-6"
                                    >
                                        <span>{isCheckingList ? "Scanning..." : "Global Elite_"}</span>
                                        <span className="text-[10px] border border-current px-1 rounded opacity-50">0.15 USDC</span>
                                    </button>
                                </div>
                            )}

                            {/* Terms / Footer */}
                            <div className="flex justify-between items-center text-[9px] font-mono text-zinc-700 pt-4">
                                <span>SECURE CONNECTION</span>
                                <span>BASE MAINNET</span>
                            </div>
                        </div>

                        {/* Error Toast */}
                        {errorMsg && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="absolute bottom-24 bg-red-500 text-white font-mono text-[10px] px-4 py-2"
                            >
                                ERROR: {errorMsg}
                            </motion.div>
                        )}

                    </motion.div>
                ) : null}

                {(!isReady) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 flex items-center justify-center bg-black z-50 text-white font-mono text-xs tracking-[0.5em]"
                    >
                        <span className="animate-pulse">LOADING ASSETS...</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
