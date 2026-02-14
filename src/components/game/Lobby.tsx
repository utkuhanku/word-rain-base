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
import { useGMStreak } from '@/lib/hooks/useGMStreak';
import { useGameStore } from '@/lib/store/gameStore';


import CompetitionLobby from './CompetitionLobby';
import EventLobby from './EventLobby';
import HelpModal from './HelpModal';

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
    const [showCompetition, setShowCompetition] = useState(false);
    const [showEvent, setShowEvent] = useState(false);
    const [showEthDenver, setShowEthDenver] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false); // Menu State
    const [isLeaderboardOpening, setIsLeaderboardOpening] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [showEventIntro, setShowEventIntro] = useState(false);

    // Leaderboard Hook
    const { leaderboard, fetchLeaderboard, isLoading: isScanningList } = useLeaderboard();
    const { hasPaid, isChecking: isCheckingPayment, checkAddresses } = usePaymentStatus();
    // GM Streak Hook (Onchain)
    const { streak, canGM, isSending, sendGM, fetchStreak } = useGMStreak(address);
    const setPvPGameId = useGameStore(state => state.setPvPGameId);

    const [showStreakSuccess, setShowStreakSuccess] = useState(false);

    const handleGMaction = async () => {
        if (!address) {
            setErrorMsg("CONNECT WALLET TO START STREAK");
            return;
        }

        if (canGM) {
            try {
                await sendGM();
                // Success Animation
                setShowStreakSuccess(true);
                setTimeout(() => {
                    setShowStreakSuccess(false);
                    // Open share after animation
                    const text = encodeURIComponent(`GM! I just levelled up my onchain streak to ${streak + 1} on Word Rain 🟦 🌧️\n\nVerifiable. Permanent. Based.\n\npowered by @utkus`);
                    const embed = encodeURIComponent(window.location.origin);
                    window.open(`https://warpcast.com/~/compose?text=${text}&embeds[]=${embed}`, '_blank');
                }, 2500); // 2.5s display

            } catch (e: any) {
                // If user rejected or error
                if (e.message.includes("User rejected")) return;
                setErrorMsg("GM Failed. Try again.");
            }
        } else {
            // Already GM'd -> Just Share
            const text = encodeURIComponent(`My Onchain GM Streak is ${streak} 🔥 on Word Rain 🟦 🌧️\n\nCan you beat it?\n\npowered by @utkus`);
            const embed = encodeURIComponent(window.location.origin);
            window.open(`https://warpcast.com/~/compose?text=${text}&embeds[]=${embed}`, '_blank');
        }
    };

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
                    setTimeout(() => setIsMenuOpen(true), 500);
                } else if (address) {
                    // Fallback to Wallet if already connected
                    try {
                        const name = await getName({ address, chain: base });
                        setDisplayName((name ?? "PLAYER ONE").toUpperCase());
                        setTimeout(() => setIsMenuOpen(true), 500);
                    } catch {
                        setDisplayName("PLAYER ONE");
                        setTimeout(() => setIsMenuOpen(true), 500);
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
            if (address) checkAddresses([address]);
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
    }, [displayName, checkAddresses]);

    const handleOpenLeaderboard = () => {
        setErrorMsg("");
        setShowLeaderboard(true);
    };

    // Ready State Animation
    useEffect(() => {
        if (!isChecking) {
            const timer = setTimeout(() => setIsReady(true), 300);
            return () => clearTimeout(timer);
        }
    }, [isChecking]);

    const handleStartPvP = (gameId: string) => {
        setPvPGameId(gameId);
        onStart();
    };

    return (
        <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-[#050505] flex flex-col items-center z-20">
            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none -z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-[#0052FF]/10 blur-[150px] rounded-full animate-pulse opacity-50" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_60%,transparent_100%)]" />
            </div>

            {/* Overlays */}
            <AnimatePresence>

                {showLeaderboard && (
                    <GlobalLeaderboard onClose={() => setShowLeaderboard(false)} />
                )}
                {showCompetition && (
                    <CompetitionLobby
                        onClose={() => setShowCompetition(false)}
                        onStartGame={handleStartPvP}
                    />
                )}
                {/* Event Lobby (ETHDenver) */}
                {showEvent && (
                    <EventLobby
                        onBack={() => setShowEvent(false)}
                        onStart={onStart}
                    />
                )}

                {/* ETH Denver Modal */}
                {showEthDenver && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
                        onClick={() => setShowEthDenver(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#3B82F6]/20 blur-[50px] rounded-full" />

                            <div className="relative z-10 flex flex-col items-center text-center gap-6">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-16 h-16 bg-gradient-to-br from-[#3B82F6] to-[#1d4ed8] rounded-2xl flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(59,130,246,0.3)] mb-2">
                                        🏔️
                                    </div>
                                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                                        ETHDenver<br /><span className="text-[#3B82F6]">Special</span>
                                    </h2>
                                    <p className="text-xs font-mono text-zinc-400 tracking-widest max-w-[200px]">
                                        COMPETE FOR THE HIGHEST SCORE ON THE OFFICIAL LEADERBOARD
                                    </p>
                                </div>

                                <div className="w-full h-px bg-white/10" />

                                <div className="w-full flex flex-col gap-3">
                                    <div className="flex justify-between items-center text-sm font-bold font-mono">
                                        <span className="text-zinc-500">1ST PLACE</span>
                                        <span className="text-white">$100 USDC</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-bold font-mono">
                                        <span className="text-zinc-500">2ND PLACE</span>
                                        <span className="text-white">$75 USDC</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-bold font-mono">
                                        <span className="text-zinc-500">3RD PLACE</span>
                                        <span className="text-white">$50 USDC</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-bold font-mono">
                                        <span className="text-zinc-500">4TH PLACE</span>
                                        <span className="text-white">$25 USDC</span>
                                    </div>
                                </div>

                                <div className="w-full h-px bg-white/10" />

                                <button
                                    onClick={() => {
                                        setShowEthDenver(false);
                                        setShowEvent(true);
                                    }}
                                    className="w-full py-4 bg-white text-black font-bold font-space tracking-widest uppercase hover:bg-zinc-200 transition-colors rounded-xl flex items-center justify-center gap-2"
                                >
                                    ENTER FOR $1
                                </button>

                                <p className="text-[9px] text-zinc-600 font-mono">
                                    WINNERS ANNOUNCED AT THE END OF THE EVENT
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {showHelp && (
                    <HelpModal onClose={() => setShowHelp(false)} />
                )}
                {/* ... streak success ... */}
                {showStreakSuccess && (
                    <motion.div
                        key="streak-success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
                        transition={{ duration: 0.4 }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505]/90 backdrop-blur-xl"
                    >
                        <motion.div
                            initial={{ y: 20 }}
                            animate={{ y: 0 }}
                            className="flex flex-col items-center gap-4"
                        >
                            <div className="text-8xl font-black text-white italic tracking-tighter drop-shadow-[0_0_50px_rgba(0,82,255,0.8)]">
                                {streak}
                            </div>
                            <div className="text-3xl font-bold text-[#0052FF] font-space tracking-widest uppercase text-center flex flex-col gap-2">
                                <span>DAYS ON BASE</span>
                                <span className="text-6xl">🟦</span>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <AnimatePresence mode="wait">
                {isReady && !showLeaderboard && !showEvent ? (
                    <motion.div
                        key="main-interface"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col justify-between w-full h-full max-w-md mx-auto p-6 relative z-10"
                    >

                        {/* Header Status */}
                        <div className="w-full flex justify-between items-center py-4 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                <span className="text-[10px] font-mono text-zinc-500 tracking-[0.2em] uppercase">System Online</span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-600 tracking-widest">ETHDenver Edition</span>
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
                                <div className="space-y-3">
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

                                    {/* Help Button */}
                                    <div className="w-full">
                                        <button
                                            onClick={() => setShowHelp(true)}
                                            className="w-full h-10 border border-white/5 hover:bg-white/5 text-[10px] tracking-widest font-mono text-zinc-600 hover:text-white uppercase transition-colors flex items-center justify-center gap-2 group"
                                        >
                                            <span className="opacity-30 group-hover:opacity-100 transition-opacity text-xs">?</span> HOW TO PLAY
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
                                    {/* ETHDenver Special Event Button - PRIMARY CTA */}
                                    <div className="relative w-full group/event">
                                        {/* Animated Arrows & Price Labels */}
                                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full hidden md:flex flex-col items-center gap-1 animate-pulse">
                                            <span className="text-[10px] font-black text-[#0052FF] rotate-90 tracking-widest">$250</span>
                                            <span className="text-2xl text-[#0052FF]">⮕</span>
                                        </div>
                                        <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full hidden md:flex flex-col items-center gap-1 animate-pulse">
                                            <span className="text-[10px] font-black text-[#0052FF] -rotate-90 tracking-widest">$250</span>
                                            <span className="text-2xl text-[#0052FF] rotate-180">⮕</span>
                                        </div>

                                        {/* Mobile Inline Arrows (Visible only on small screens) */}
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 md:hidden">
                                            <span className="text-[8px] font-black text-[#0052FF] bg-white px-1.5 py-0.5 rounded shadow-sm animate-bounce">
                                                WIN $250
                                            </span>
                                        </div>

                                        <motion.button
                                            onClick={() => setShowEventIntro(true)}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="w-full h-20 relative overflow-hidden rounded-xl group border-2 border-[#0052FF] shadow-[0_0_20px_rgba(0,82,255,0.3)]"
                                        >
                                            <div className="absolute inset-0 bg-[#0052FF] animate-pulse" />
                                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay" />
                                            <div className="absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />

                                            <div className="relative z-10 flex items-center justify-between px-6 h-full">
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className="text-[10px] font-black italic tracking-widest text-white/90 uppercase bg-black/20 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10">
                                                        LIMITED TIME EVENT
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-2xl filter drop-shadow-lg">🏔️</span>
                                                        <div className="flex flex-col items-start leading-none">
                                                            <span className="text-2xl font-black text-white italic tracking-tighter uppercase drop-shadow-md">
                                                                ETHDENVER
                                                            </span>
                                                            <span className="text-[10px] font-mono text-white/80 tracking-[0.2em] uppercase">
                                                                OFFICIAL SERIES
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="bg-white text-[#0052FF] px-3 py-1 rounded-lg font-black font-mono text-sm shadow-lg flex items-center gap-1">
                                                        <span>$250</span>
                                                        <span className="text-[8px] opacity-60">USDC</span>
                                                    </div>
                                                    <span className="text-[9px] text-white/80 font-mono text-right">
                                                        1 USDC ENTRY
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.button>
                                    </div>

                                    <div className="w-full h-px bg-white/10 my-1" />

                                    <button
                                        onClick={onStart}
                                        className="w-full h-14 bg-zinc-100 text-black font-space font-bold text-base tracking-widest uppercase flex items-center justify-between px-6 hover:bg-white transition-colors border border-white/20"
                                    >
                                        <span className="text-zinc-600 group-hover:text-black transition-colors">Training Mode</span>
                                        <span className="opacity-50">→</span>
                                    </button>

                                    {/* GM Streak Button */}
                                    <button
                                        onClick={handleGMaction}
                                        disabled={isSending}
                                        className={`w-full h-14 ${canGM ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] border-none" : "bg-zinc-900 border border-zinc-800 text-zinc-500"} font-space font-bold text-base tracking-widest uppercase flex items-center justify-between px-6 transition-all relative overflow-hidden group`}
                                    >
                                        {canGM && <div className="absolute inset-0 bg-white/20 animate-pulse" />}

                                        <div className="flex flex-col items-start gap-0.5 relative z-10">
                                            <span className="text-[9px] opacity-90 font-mono leading-none tracking-wider">
                                                {canGM ? "BUILD YOUR LEGACY" : "LEGACY SECURED"}
                                            </span>
                                            <span className="flex items-center gap-2">
                                                {isSending ? "MINTING..." : (canGM ? "GM STREAK" : `STREAK: ${streak}`)}
                                                <span className="text-lg">🔥</span>
                                            </span>
                                        </div>
                                        {canGM ? (
                                            <span className="text-[10px] font-black bg-white text-orange-600 px-2 py-1 rounded shadow-sm">
                                                +1
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-mono opacity-60 border border-zinc-700 px-2 py-0.5 rounded">
                                                SHARE
                                            </span>
                                        )}
                                    </button>

                                    <button
                                        onClick={handleOpenLeaderboard}
                                        className={`w-full h-14 border ${hasPaid ? "border-[#0052FF]/30 text-[#0052FF] bg-[#0052FF]/5" : "border-white/10 text-zinc-500"} font-mono text-xs tracking-widest uppercase flex items-center justify-between px-6 hover:border-[#0052FF] hover:bg-[#0052FF]/10 transition-all`}
                                    >
                                        <span className="flex items-center gap-2">
                                            {isCheckingPayment || isLeaderboardOpening ? "Verifying..." : "GLOBAL STANDINGS"}
                                            {hasPaid && !isCheckingPayment && <div className="w-1.5 h-1.5 bg-[#0052FF] rounded-full animate-pulse shadow-[0_0_5px_#0052FF]" />}
                                        </span>
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
                ) : (!isReady) ? (
                    <motion.div
                        key="loading-screen"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 flex items-center justify-center bg-[#050505] z-50 text-white font-mono text-[10px] tracking-[0.5em]"
                    >
                        <span className="animate-pulse">LOADING RESOURCES...</span>
                    </motion.div>
                ) : null}
                {/* ETHDenver Intro Modal */}
                {showEventIntro && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowEventIntro(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="w-full max-w-sm bg-[#0052FF] rounded-2xl p-1 shadow-[0_0_50px_rgba(0,82,255,0.4)] border border-white/20 overflow-hidden relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />

                            <div className="bg-black/90 rounded-xl p-6 relative z-10 flex flex-col items-center text-center gap-6">
                                <div className="space-y-2">
                                    <div className="inline-block bg-[#0052FF]/20 text-[#0052FF] px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border border-[#0052FF]/50">
                                        Feb 13 - Feb 28
                                    </div>
                                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                                        <span className="block text-2xl text-zinc-500">The</span>
                                        ETHDenver
                                        <span className="block text-[#0052FF]">Sprint</span>
                                    </h2>
                                </div>

                                <div className="grid grid-cols-2 gap-3 w-full">
                                    <div className="bg-white/5 rounded-lg p-3 flex flex-col items-center border border-white/5">
                                        <span className="text-2xl mb-1">💰</span>
                                        <span className="text-xs text-zinc-400 uppercase tracking-wider font-mono">Prize Pool</span>
                                        <span className="text-xl font-bold text-white">$250</span>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-3 flex flex-col items-center border border-white/5">
                                        <span className="text-2xl mb-1">🎟️</span>
                                        <span className="text-xs text-zinc-400 uppercase tracking-wider font-mono">Entry Fee</span>
                                        <span className="text-xl font-bold text-white">1 USDC</span>
                                    </div>
                                </div>

                                <div className="text-sm text-zinc-400 font-mono leading-relaxed">
                                    Competitors have 2 weeks to set the highest score. Top 3 players share the pot.
                                    <br />
                                    <span className="text-white font-bold">Unlocks Exclusive Badge.</span>
                                </div>

                                <button
                                    onClick={() => {
                                        setShowEventIntro(false);
                                        setShowEthDenver(true);
                                    }}
                                    className="w-full bg-[#0052FF] hover:bg-[#004ad1] text-white font-black py-4 rounded-xl uppercase tracking-widest transition-all shadow-lg hover:shadow-[#0052FF]/25 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    Enter Arena
                                </button>

                                <button
                                    onClick={() => setShowEventIntro(false)}
                                    className="text-xs text-zinc-500 hover:text-white transition-colors"
                                >
                                    Maybe Later
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
