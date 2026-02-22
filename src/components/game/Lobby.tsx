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

    const [isTrainingExpanded, setIsTrainingExpanded] = useState(false);
    const [hasEventAccess, setHasEventAccess] = useState(false);
    const { setMode } = useGameStore();

    // Check Persistent Event Access (Server + Local Fallback)
    useEffect(() => {
        if (!address) return;
        const checkAccess = async () => {
            try {
                const payKey = `ethdenver_entry_paid_${address}`;
                // 1. Check Local First (Instant)
                if (localStorage.getItem(payKey) === 'true') {
                    setHasEventAccess(true);
                }

                // 2. Check Server (Authoritative)
                const res = await fetch(`/api/event/access?address=${address}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.hasAccess) {
                        setHasEventAccess(true);
                        localStorage.setItem(payKey, 'true'); // Re-sync local
                    }
                }
            } catch (e) {
                console.error("Access check failed", e);
            }
        };
        checkAccess();
    }, [address]);

    // ... (keep existing hooks)

    const handleStartTraining = () => {
        setMode('CLASSIC'); // Default to classic/training
        onStart();
    };


    const handleStartPvP = (gameId: string) => {
        setPvPGameId(gameId);
        onStart();
    };


    return (
        <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-[#050505] flex flex-col items-center z-20">
            {/* Background Ambience (Keep existing) */}
            <div className="absolute inset-0 pointer-events-none -z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-[#0052FF]/10 blur-[150px] rounded-full animate-pulse opacity-50" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_60%,transparent_100%)]" />
            </div>

            {/* Overlays (Keep existing) */}
            <AnimatePresence>
                {/* Only EventLobby and HelpModal needed now. GlobalLeaderboard is embedded. */}
                {showEvent && (
                    <EventLobby
                        onBack={() => setShowEvent(false)}
                        onStart={onStart}
                    />
                )}
                {showEthDenver && (
                    // ... Keep existing ETHDenver Modal ...
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
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowEthDenver(false);
                                        setTimeout(() => setShowEvent(true), 50);
                                    }}
                                    className="w-full h-14 bg-[#3B82F6] text-white font-black font-space tracking-widest uppercase hover:bg-[#2563EB] active:scale-95 transition-all rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.5)] flex items-center justify-center gap-2 relative z-50 disabled:opacity-50"
                                >
                                    {hasEventAccess ? "ENTER ARENA" : "ENTER FOR $1"}
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
                {/* Event Intro Modal (Keep or remove? Maybe remove for simplicity if user wants less complexity. Let's keep it as it adds info) */}
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
                                        <span className="text-xl font-bold text-white">{hasEventAccess ? "PAID" : "1 USDC"}</span>
                                    </div>
                                </div>

                                <div className="text-sm text-zinc-400 font-mono leading-relaxed">
                                    Competitors have 2 weeks to set the highest score. Top 3 players share the pot.
                                    <br />
                                    <span className="text-white font-bold">Unlocks Exclusive Badge.</span>
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowEventIntro(false);
                                        setTimeout(() => setShowEthDenver(true), 50);
                                    }}
                                    className="w-full h-14 bg-[#0052FF] text-white font-black uppercase tracking-widest hover:bg-[#2563EB] active:scale-95 transition-all rounded-xl shadow-[0_0_20px_rgba(0,82,255,0.4)] flex items-center justify-center gap-2 relative z-50"
                                >
                                    {hasEventAccess ? "ENTER ARENA" : "ENTER ARENA ($1)"}
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


            {/* Main Content */}
            <AnimatePresence mode="wait">
                {isReady && !showEvent ? (
                    <motion.div
                        key="main-interface"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col w-full h-full max-w-md mx-auto relative z-10"
                    >
                        {/* TOP: Identity & Hero Streak */}
                        <div className="flex flex-col gap-4 p-6 shrink-0 relative z-20">
                            {/* Pilot Info */}
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-[#0052FF] rotate-45 shadow-[0_0_10px_#0052FF]" />
                                    {displayName ? (
                                        <span className="text-xs font-mono tracking-[0.15em] text-zinc-400">
                                            PILOT: <span className="text-white font-bold">{displayName}</span>
                                        </span>
                                    ) : (
                                        <span className="text-xs font-mono tracking-[0.15em] text-zinc-600 animate-pulse">
                                            CONNECTING...
                                        </span>
                                    )}
                                </div>
                                {!isMenuOpen && (
                                    <button
                                        onClick={() => setShowHelp(true)}
                                        className="text-[10px] text-zinc-600 hover:text-white font-mono uppercase transition-colors"
                                    >
                                        [ Help ]
                                    </button>
                                )}
                            </div>

                            {/* HERO STREAK WIDGET */}
                            <button
                                onClick={handleGMaction}
                                disabled={isSending}
                                className={`w-full relative overflow-hidden rounded-xl border ${canGM ? "border-orange-500/50 bg-orange-500/10" : "border-white/10 bg-white/5"} p-4 group transition-all hover:scale-[1.01]`}
                            >
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex flex-col items-start gap-1">
                                        <span className="text-[9px] font-black text-zinc-500 tracking-[0.2em] group-hover:text-white transition-colors">
                                            {canGM ? "MISSION AVAILABLE" : "MISSION COMPLETE"}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-2xl font-black italic tracking-widest ${canGM ? "text-orange-500 animate-pulse" : "text-white"}`}>
                                                {canGM ? "CLAIM GM" : `STREAK: ${streak}`}
                                            </span>
                                            <span className="text-2xl">🔥</span>
                                        </div>
                                    </div>
                                    {canGM && (
                                        <div className="w-10 h-10 rounded-full bg-orange-500 text-black flex items-center justify-center font-bold text-xl shadow-[0_0_20px_rgba(249,115,22,0.5)] animate-bounce">
                                            !
                                        </div>
                                    )}
                                </div>
                                {/* Mystery Text */}
                                <div className="mt-2 w-full h-px bg-white/5" />
                                <div className="mt-2 flex items-center gap-2 opacity-50">
                                    <span className="text-[8px] font-mono tracking-widest text-[#0052FF]">
                                        CLASSIFIED //
                                    </span>
                                    <span className="text-[8px] font-mono text-zinc-400">
                                        KEEP THE FLAME ALIVE. UNLOCK HIDDEN REWARDS.
                                    </span>
                                </div>
                            </button>
                        </div>

                        {/* MIDDLE: Event Hero (Flexible Grow) */}
                        <div className="flex-1 flex flex-col items-center justify-center p-6 -mt-10">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={() => setShowEventIntro(true)}
                                className="w-full relative group cursor-pointer"
                            >
                                <div className="absolute -inset-1 bg-gradient-to-br from-[#0052FF] to-blue-900 rounded-3xl blur-xl opacity-40 group-hover:opacity-70 transition-opacity animate-pulse" />
                                <div className="relative bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 overflow-hidden transform transition-transform group-hover:scale-[1.02]">

                                    {/* "Live" Badge */}
                                    <div className="absolute top-4 left-4 flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <span className="text-[9px] font-black text-emerald-500 tracking-widest">LIVE</span>
                                    </div>

                                    <div className="absolute top-0 right-0 p-6 opacity-30">
                                        <span className="text-6xl filter grayscale group-hover:grayscale-0 transition-all">🏔️</span>
                                    </div>

                                    <div className="flex flex-col gap-2 mt-4 text-center items-center">
                                        <h1 className="text-5xl font-black text-white italic tracking-[-0.05em] leading-none drop-shadow-lg">
                                            ETH<span className="text-[#0052FF]">DENVER</span>
                                        </h1>
                                        <p className="text-zinc-400 font-mono text-xs tracking-widest uppercase bg-white/5 px-2 py-1 rounded">
                                            OFFICIAL TOURNAMENT
                                        </p>
                                    </div>

                                    <div className="mt-8 flex flex-col items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-3xl font-bold text-white">$250</span>
                                            <span className="text-sm font-mono text-zinc-500">USDC POOL</span>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setShowEventIntro(false);
                                                setShowEthDenver(false);
                                                setShowEvent(true);
                                            }}
                                            className="w-full h-14 bg-[#0052FF] text-white font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(0,82,255,0.4)] hover:bg-[#004ad1] transition-colors flex items-center justify-center gap-2 relative z-50"
                                        >
                                            {hasEventAccess ? "ENTER ARENA" : "ENTER ARENA ($1)"}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>


                        {/* BOTTOM: TRAINING EXPANDER (Fixed/Overlay) */}
                        <motion.div
                            initial={false}
                            animate={{
                                height: isTrainingExpanded ? "60%" : "80px",
                                backgroundColor: isTrainingExpanded ? "#0A0A0A" : "transparent"
                            }}
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                            className={`w-full max-w-md mx-auto rounded-t-3xl border-t border-white/10 overflow-hidden relative z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] ${isTrainingExpanded ? "absolute bottom-0 inset-x-0" : "shrink-0 bg-[#0A0A0A]/80 backdrop-blur-md"}`}
                        >
                            {/* Handle / Header */}
                            <div
                                onClick={() => setIsTrainingExpanded(!isTrainingExpanded)}
                                className="w-full h-[80px] flex items-center justify-between px-8 cursor-pointer group hover:bg-white/5 transition-colors absolute top-0 left-0 z-20"
                            >
                                <div className="flex flex-col items-start gap-1">
                                    <h3 className="text-lg font-bold text-zinc-300 font-space uppercase tracking-widest group-hover:text-white transition-colors">
                                        TRAINING
                                    </h3>
                                    <span className="text-[9px] font-mono text-zinc-600">
                                        {isTrainingExpanded ? "TAP TO CLOSE" : "TAP TO EXPAND"}
                                    </span>
                                </div>
                                <div className={`w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 transition-transform duration-300 ${isTrainingExpanded ? "rotate-90 bg-white text-black border-transparent" : "-rotate-90"}`}>
                                    →
                                </div>
                            </div>

                            {/* EXPANDED CONTENT */}
                            <div className={`pt-[100px] pb-6 px-6 h-full flex flex-col gap-6 overflow-hidden ${isTrainingExpanded ? "opacity-100" : "opacity-0"}`}>

                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleStartTraining();
                                    }}
                                    className="w-full h-14 bg-white text-black font-space font-black uppercase tracking-widest rounded-xl active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.5)] flex items-center justify-center gap-2 shrink-0 relative z-50 pointer-events-auto"
                                >
                                    <span>START TRAINING</span>
                                    <span className="text-xs font-bold opacity-60">(FREE)</span>
                                </button>

                                {/* Embedded Leaderboard */}
                                <div className="flex-1 flex flex-col bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-white/5 bg-black/20 flex justify-between items-center">
                                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                                            GLOBAL STANDINGS
                                        </span>
                                        <span className="text-[9px] font-bold text-[#0052FF]">NO PRIZES</span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {isScanningList ? (
                                            <div className="flex justify-center py-8">
                                                <span className="text-[10px] text-zinc-600 font-mono animate-pulse">LOADING DATA...</span>
                                            </div>
                                        ) : (
                                            leaderboard.slice(0, 15).map((entry, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors text-xs font-mono">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`${i < 3 ? "text-white font-bold" : "text-zinc-600"}`}>{i + 1}</span>
                                                        <span className="text-zinc-300 truncate max-w-[120px]">{entry.name}</span>
                                                    </div>
                                                    <span className="text-zinc-500">{entry.score}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                        </motion.div>

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
            </AnimatePresence>
        </div>
    );
}
