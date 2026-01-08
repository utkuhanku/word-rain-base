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

    // 2. Handle Entry (Active Quick Auth)
    const handleInitialize = useCallback(async () => {
        if (displayName) {
            setIsMenuOpen(true); // Open Menu
            return;
        }
        setErrorMsg('');

        // ... [Rest of Auth Logic same but change onStart to check menu] ...
        // I will just override the lines for handling success to setMenu

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
            <div className="flex flex-col items-center justify-center w-full h-full relative z-20">
                {/* Background Ambience */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-[#0052FF]/5 blur-[120px] rounded-full animate-pulse" />
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
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                            transition={{ duration: 0.8, ease: "circOut" }}
                            className="flex flex-col items-center gap-12"
                        >
                            {/* Title Block */}
                            <div className="text-center space-y-4">
                                <motion.h1
                                    className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-600 font-mono"
                                    initial={{ y: 20 }}
                                    animate={{ y: 0 }}
                                    transition={{ duration: 0.8, delay: 0.2 }}
                                >
                                    NEO RAIN
                                </motion.h1>
                                <motion.div
                                    className="flex items-center justify-center gap-2 text-[#0052FF] text-xs font-mono tracking-[0.5em] uppercase"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                >
                                    <span className="w-2 h-2 bg-[#0052FF] rounded-full animate-ping" />
                                    System Online
                                </motion.div>
                            </div>

                            {/* Identity Badge */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.0 }}
                                className="bg-white/5 border border-white/10 px-6 py-3 rounded-full backdrop-blur-md flex flex-col items-center gap-1"
                            >
                                {displayName ? (
                                    <>
                                        <span className="text-white font-mono text-sm tracking-widest flex items-center gap-2">
                                            IDENTITY: <span className="text-[#0052FF] font-bold">{displayName}</span>
                                        </span>
                                    </>
                                ) : (
                                    // While unidentified, show placeholder
                                    <div className="text-zinc-500 font-mono text-xs tracking-widest flex items-center gap-2">
                                        <span className="w-2 h-2 bg-zinc-500 rounded-full animate-pulse" />
                                        WAITING FOR AUTH
                                    </div>
                                )}
                            </motion.div>

                            {!isMenuOpen ? (
                                // AUTH BUTTON
                                <motion.button
                                    onClick={handleInitialize}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="group relative px-12 py-6 bg-white text-black font-black font-mono text-xl tracking-widest uppercase overflow-hidden"
                                >
                                    <span className="relative z-10 group-hover:tracking-[0.2em] transition-all duration-300 flex items-center gap-2">
                                        {!displayName && (
                                            // Icon based on context (Farcaster vs Base)
                                            context?.client ? (
                                                <div className="w-5 h-5 bg-[#855DCD] rounded-full" />
                                            ) : (
                                                <div className="w-5 h-5 bg-[#0052FF] rounded-full" />
                                            )
                                        )}
                                        {!displayName && context?.client ? "VERIFY FARCASTER" : (displayName ? "ENTER SYSTEM" : "CONNECT IDENTITY")}
                                    </span>
                                    <div className="absolute inset-0 bg-[#0052FF] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left -z-0 opacity-20" />
                                </motion.button>
                            ) : (
                                // MAIN MENU
                                <div className="flex flex-col gap-4 w-64">
                                    <motion.button
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        onClick={onStart} // Start Game
                                        className="w-full py-4 bg-white text-black font-black font-mono text-lg tracking-widest uppercase hover:bg-zinc-200 transition-colors"
                                    >
                                        PLAY MISSION
                                    </motion.button>
                                    <motion.button
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 }}
                                        onClick={handleOpenLeaderboard}
                                        className="w-full py-4 border border-[#0052FF] text-[#0052FF] font-black font-mono text-lg tracking-widest uppercase hover:bg-[#0052FF]/10 transition-colors"
                                    >
                                        {isCheckingList ? "SCANNING..." : "GLOBAL ELITE"}
                                    </motion.button>
                                </div>
                            )}

                            {/* Error Feedback */}
                            {errorMsg && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-red-500 font-mono text-xs text-center max-w-[80vw] break-words bg-red-500/10 p-2 rounded"
                                >
                                    ERROR: {errorMsg}
                                </motion.div>
                            )}

                            {/* Hidden Fallback - Clean UI */}

                        </motion.div>
                    ) : null}

                    {(!isReady) && (
                        // Loading State
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-white font-mono text-xs tracking-[0.5em] animate-pulse absolute"
                        >
                            ESTABLISHING LINK...
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }
