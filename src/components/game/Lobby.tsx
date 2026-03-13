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
import EventDetailPage from './EventDetailPage';
import HelpModal from './HelpModal';

interface LobbyProps {
    onStart: () => void;
}

// --- Countdown Component ---
const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
    const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

    useEffect(() => {
        const timer = setInterval(() => {
            const difference = targetDate.getTime() - new Date().getTime();
            if (difference > 0) {
                setTimeLeft({
                    d: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    h: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    m: Math.floor((difference / 1000 / 60) % 60),
                    s: Math.floor((difference / 1000) % 60)
                });
            } else {
                setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [targetDate]);

    return (
        <div className="flex justify-center items-baseline gap-2 font-mono">
            <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-white tracking-tight">{timeLeft.d.toString().padStart(2, '0')}</span>
                <span className="text-[10px] text-zinc-500 font-medium tracking-[0.1em] uppercase mt-0.5">d</span>
            </div>
            <span className="text-xl font-medium text-zinc-800 translate-y-[-10px] block mx-0.5">:</span>
            <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-white tracking-tight">{timeLeft.h.toString().padStart(2, '0')}</span>
                <span className="text-[10px] text-zinc-500 font-medium tracking-[0.1em] uppercase mt-0.5">h</span>
            </div>
            <span className="text-xl font-medium text-zinc-800 translate-y-[-10px] block mx-0.5">:</span>
            <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-white tracking-tight">{timeLeft.m.toString().padStart(2, '0')}</span>
                <span className="text-[10px] text-zinc-500 font-medium tracking-[0.1em] uppercase mt-0.5">m</span>
            </div>
            <span className="text-xl font-medium text-[#0052FF] translate-y-[-10px] block mx-0.5">:</span>
            <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-[#0052FF] tracking-tight">{timeLeft.s.toString().padStart(2, '0')}</span>
                <span className="text-[10px] text-[#0052FF]/70 font-medium tracking-[0.1em] uppercase mt-0.5">s</span>
            </div>
        </div>
    );
};
// ----------------------------

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
    
    // NEW EVENTS HUB STATE
    const [activeNavTab, setActiveNavTab] = useState<'EVENTS' | 'LEADERBOARD'>('EVENTS');
    const [showEventDetail, setShowEventDetail] = useState<string | null>(null);
    
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
    const { setMode } = useGameStore();

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
                {showHelp && (
                    <HelpModal onClose={() => setShowHelp(false)} />
                )}
                {showEventDetail && (
                    <EventDetailPage
                        eventId={showEventDetail}
                        onBack={() => setShowEventDetail(null)}
                    />
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
                        className="flex flex-col w-full h-full max-w-md mx-auto relative z-10 pb-20 overflow-y-auto custom-scrollbar"
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

                        {/* MIDDLE: Event Hero & Past Events (Flexible Grow) */}
                        <div className="flex-1 flex flex-col items-center justify-center p-6 -mt-10 gap-4">

                            {/* PREMIUM EVENT BANNER (Live) */}
                            <motion.button
                                onClick={() => setShowEvent(true)}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="w-full relative group cursor-pointer shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#0052FF]/0 via-[#0052FF]/30 to-[#0052FF]/0 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative bg-[#020202] border border-white/10 group-hover:border-[#0052FF]/50 rounded-2xl overflow-hidden p-6 flex flex-col items-center text-center w-full box-border transition-colors duration-500">

                                    {/* Noise texture and glow for premium feel */}
                                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
                                    <div className="absolute top-0 right-[-10%] w-32 h-32 bg-[#0052FF]/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-[#0052FF]/20 transition-all duration-700" />

                                    {/* Status Header */}
                                    <div className="flex items-center justify-between w-full mb-6 relative z-10 box-border">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse" />
                                            <span className="text-[10px] font-mono font-bold tracking-widest text-red-500 uppercase">LIVE EVENT</span>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-[#3B82F6] tracking-widest uppercase flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                                            $500 <span className="text-white">REWARD</span>
                                        </span>
                                    </div>

                                    {/* Main Typography */}
                                    <div className="flex flex-col gap-3 items-center justify-center w-full relative z-10 box-border pointer-events-none">
                                        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 m-0 p-0 leading-none group-hover:from-white group-hover:to-white transition-all duration-500">
                                            NEW ERA
                                        </h1>
                                        <span className="text-[10px] font-bold text-white bg-[#3B82F6] px-4 py-1 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)] mt-1 tracking-widest uppercase">
                                            $500 Prize Pool
                                        </span>

                                        <p className="text-xs text-zinc-400 max-w-[260px] leading-relaxed mt-2 font-mono group-hover:text-zinc-300 transition-colors">
                                            The void is open. Enter the arena.
                                        </p>
                                    </div>

                                    {/* Action Call */}
                                    <div className="w-full mt-6 bg-gradient-to-r from-[#0052FF] to-[#2563EB] rounded-2xl p-4 flex flex-col items-center justify-center gap-2 relative z-10 box-border shadow-[0_0_30px_rgba(0,82,255,0.4)] group-hover:shadow-[0_0_50px_rgba(0,82,255,0.8)] group-hover:scale-[1.02] transition-all duration-300 border border-[#3B82F6] group-hover:border-white">
                                        <span className="text-xs font-black text-white tracking-widest uppercase flex items-center gap-2">
                                            Enter the Void <span className="group-hover:translate-x-1 transition-transform">→</span>
                                        </span>
                                    </div>
                                </div>
                            </motion.button>

                            {/* TOTAL DISTRIBUTED BANNER */}
                            <div className="w-full flex items-center justify-between px-4 py-3 bg-[#0052FF]/5 border border-[#0052FF]/20 rounded-xl mt-4 shrink-0">
                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Total Distributed</span>
                                <span className="text-sm font-black text-[#0052FF] font-mono">$1,000+</span>
                            </div>

                            {/* PAST EVENTS: ETHDENVER 2026 */}
                            <div className="w-full flex flex-col mt-2 shrink-0">
                                <div className="flex items-center gap-2 mb-2 px-2">
                                    <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full" />
                                    <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
                                        Past Events
                                    </h3>
                                </div>
                                
                                <button
                                    onClick={() => setShowEventDetail('ethdenver')}
                                    className="w-full bg-[#050505] border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col text-left transition-all active:scale-[0.98] group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity grayscale pointer-events-none">
                                        <span className="text-6xl">🏔️</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mb-3 relative z-10">
                                        <span className="text-[9px] font-black w-1.5 h-1.5 rounded-full bg-red-500/50" />
                                        <span className="text-[9px] font-black text-red-500/80 tracking-widest uppercase">CONCLUDED</span>
                                    </div>
                                    
                                    <h3 className="text-xl font-black text-white italic tracking-tight uppercase mb-1 relative z-10">
                                        ETH<span className="text-zinc-500">DENVER</span> 2026
                                    </h3>
                                    <p className="text-[10px] text-zinc-500 font-mono mb-4 relative z-10">
                                        Official sprint event · Feb 2026
                                    </p>
                                    
                                    <div className="w-full bg-black/40 border border-white/5 rounded-xl p-3 mb-4 flex divide-x divide-white/5 relative z-10">
                                        <div className="flex flex-col flex-1 px-2">
                                            <span className="text-[9px] text-zinc-600 font-mono tracking-widest uppercase mb-1">Prize Pool</span>
                                            <span className="text-xs font-bold text-white font-space">$500 USDC <span className="text-zinc-500 font-normal">distributed</span></span>
                                        </div>
                                        <div className="flex flex-col flex-1 px-3">
                                            <span className="text-[9px] text-zinc-600 font-mono tracking-widest uppercase mb-1">Participants</span>
                                            <span className="text-xs font-bold text-white font-space">17 <span className="text-zinc-500 font-normal">pilots</span></span>
                                        </div>
                                    </div>

                                    <div className="flex justify-end w-full relative z-10">
                                        <span className="text-[10px] font-mono font-bold text-zinc-400 group-hover:text-white transition-colors uppercase tracking-[0.2em] flex items-center gap-2">
                                            VIEW STANDINGS <span className="group-hover:translate-x-1 transition-transform">→</span>
                                        </span>
                                    </div>
                                </button>
                            </div>

                            {/* TRAINING CAMP CARD */}
                            <div className="w-full flex mt-4 flex-col gap-3 shrink-0 mb-10">
                                <div className="flex items-center gap-2 mb-1 px-2">
                                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
                                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                                        Training Camp
                                    </h3>
                                </div>
                                <div className="bg-[#050505] border border-white/5 rounded-2xl p-5 flex flex-col gap-5 relative overflow-hidden group">
                                    {/* Background Accent */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-white/10 transition-colors" />

                                    <div className="flex flex-col relative z-10 w-full gap-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-xl font-black text-white italic tracking-tighter uppercase">FREE PRACTICE</span>
                                                <span className="text-[10px] text-zinc-500 font-mono mt-0.5">Global Leaderboard. No Prizes.</span>
                                            </div>
                                            <span className="text-3xl grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-100 transition-all">🎯</span>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleStartTraining();
                                            }}
                                            className="w-full py-3.5 bg-white text-black hover:bg-zinc-200 transition-colors rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                                            style={{ backgroundColor: '#ffffff', color: '#000000' }}
                                        >
                                            ENTER CAMP <span className="text-[10px] opacity-70 block mt-0.5">(FREE)</span>
                                        </button>

                                        {/* Embedded Leaderboard */}
                                        <div className="w-full bg-[#020202] border border-white/5 rounded-xl overflow-hidden flex flex-col h-[180px]">
                                            <div className="px-3 py-2 border-b border-white/5 bg-white/5 flex justify-between items-center shrink-0">
                                                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    <span className="w-1 h-1 rounded-full bg-zinc-500"></span>
                                                    Global Standings
                                                </span>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-hide">
                                                {isScanningList ? (
                                                    <div className="flex justify-center py-6">
                                                        <span className="text-[10px] text-zinc-600 font-mono animate-pulse">LOADING DATA...</span>
                                                    </div>
                                                ) : leaderboard.length === 0 ? (
                                                    <div className="flex justify-center py-6">
                                                        <span className="text-[10px] text-zinc-600 font-mono">NO DATA</span>
                                                    </div>
                                                ) : (
                                                    leaderboard.slice(0, 15).map((entry, i) => (
                                                        <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors text-[11px] font-mono">
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
                                </div>
                            </div>
                        </div>

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

            {/* BOTTOM NAVIGATION BAR */}
            <AnimatePresence>
                {isReady && !showEvent && !showEventDetail && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto h-16 bg-black/95 backdrop-blur-xl border-t border-white/10 flex justify-center items-end pb-2"
                    >
                        <button
                            onClick={() => setActiveNavTab('EVENTS')}
                            className="flex flex-col items-center justify-center gap-1.5 px-8 h-full relative"
                        >
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#0052FF] shadow-[0_0_10px_rgba(0,82,255,0.8)]" />
                            <svg className="w-5 h-5 text-[#0052FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="14" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                            </svg>
                            <span className="font-mono text-[9px] tracking-widest font-black text-[#0052FF]">EVENTS</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
