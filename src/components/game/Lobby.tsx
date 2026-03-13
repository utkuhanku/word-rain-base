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
import ProfilePage from './ProfilePage';
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
    type NavTab = 'EVENTS' | 'PROFILE';
    const [activeNavTab, setActiveNavTab] = useState<NavTab>('EVENTS');
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
                    activeNavTab === 'PROFILE' ? (
                        <ProfilePage key="profile-page" onBack={() => setActiveNavTab('EVENTS')} />
                    ) : (
                        <motion.div
                            key="main-interface"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col w-full h-full max-w-md mx-auto relative z-10 pb-20 overflow-y-auto custom-scrollbar"
                        >
                            {/* 1. TOP BAR */}
                            <div className="shrink-0 px-5 pt-5 pb-3 flex items-center justify-between">
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

                            {/* 2. GM STREAK WIDGET */}
                            <div className="mx-5 mb-4">
                                <button
                                    onClick={handleGMaction}
                                    disabled={isSending}
                                    className={`w-full relative overflow-hidden rounded-xl border ${canGM ? "border-orange-500/50 bg-orange-500/10" : "border-white/10 bg-white/5"} py-3 px-4 group transition-all hover:scale-[1.01]`}
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
                                            <div className="w-8 h-8 rounded-full bg-orange-500 text-black flex items-center justify-center font-bold text-lg shadow-[0_0_20px_rgba(249,115,22,0.5)] animate-bounce">
                                                !
                                            </div>
                                        )}
                                    </div>
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

                            {/* 3. LIVE EVENT CARD */}
                            <motion.button
                                onClick={() => setShowEvent(true)}
                                className="mx-5 mb-3 w-[calc(100%-40px)] relative group cursor-pointer"
                            >
                                <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-emerald-500/40 via-emerald-400/20 to-emerald-500/40 animate-pulse" />

                                <div className="relative bg-[#020202] rounded-2xl overflow-hidden p-5 text-left flex flex-col items-start w-full transition-colors duration-500">
                                    <div className="flex items-center justify-between w-full mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)] animate-pulse" />
                                            <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase font-mono">LIVE NOW</span>
                                        </div>
                                        <span className="text-[10px] font-black text-white bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-full font-mono tracking-widest">
                                            $500 POOL
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-1 mb-5 text-left w-full">
                                        <span className="text-[9px] font-mono text-zinc-500 tracking-[0.3em] uppercase">#OMEGA</span>
                                        <h2 className="text-3xl font-black text-white tracking-tight italic leading-none m-0">NEW ERA</h2>
                                        <p className="text-[11px] text-zinc-400 font-mono mt-1 w-full m-0">Zero-sum · Top 5 divide the spoils</p>
                                    </div>

                                    <div className="w-full bg-emerald-500 hover:bg-emerald-400 transition-colors rounded-xl py-3.5 flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(52,211,153,0.3)] group-hover:shadow-[0_0_40px_rgba(52,211,153,0.5)]">
                                        <span className="text-sm font-black text-black tracking-widest uppercase">ENTER THE VOID</span>
                                        <span className="text-black group-hover:translate-x-1 transition-transform font-bold">→</span>
                                    </div>
                                </div>
                            </motion.button>

                            {/* 4. STATS ROW */}
                            <div className="mx-5 mb-4 grid grid-cols-2 gap-2">
                                <div className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 flex flex-col gap-1">
                                    <span className="text-[9px] text-zinc-600 font-mono tracking-widest uppercase">Total Distributed</span>
                                    <span className="text-lg font-black text-white font-mono">$1,000+</span>
                                </div>
                                <div className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 flex flex-col gap-1">
                                    <span className="text-[9px] text-zinc-600 font-mono tracking-widest uppercase">Active Pilots</span>
                                    <span className="text-lg font-black text-white font-mono">21</span>
                                </div>
                            </div>

                            {/* 5. PAST EVENTS SECTION */}
                            <div className="mx-5 mb-2 flex items-center gap-2">
                                <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">◦ PAST EVENTS</span>
                            </div>
                            
                            <button
                                onClick={() => setShowEventDetail('ethdenver')}
                                className="mx-5 mb-4 w-[calc(100%-40px)] bg-[#080808] border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between group hover:border-white/10 transition-all active:scale-[0.98]"
                            >
                                <div className="flex flex-col gap-1 items-start text-left">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                                        <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">CONCLUDED</span>
                                    </div>
                                    <span className="text-base font-black text-zinc-300 italic tracking-tight">
                                        ETH<span className="text-zinc-600">DENVER</span> 2026
                                    </span>
                                    <span className="text-[10px] text-zinc-600 font-mono m-0">17 pilots · $500 USDC distributed</span>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    <span className="text-[9px] font-mono text-zinc-500 group-hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest">
                                        STANDINGS <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                                    </span>
                                </div>
                            </button>

                            {/* 6. TRAINING CAMP */}
                            <div className="mx-5 mb-6 flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
                                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Training Camp</span>
                                </div>
                                <div className="bg-[#050505] border border-white/5 rounded-2xl p-4 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-lg font-black text-white italic tracking-tight uppercase">FREE PRACTICE</span>
                                            <p className="text-[10px] text-zinc-500 font-mono m-0">Global Leaderboard · No Prizes</p>
                                        </div>
                                        <span className="text-2xl grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-100 transition-all">🎯</span>
                                    </div>
                                    <button
                                        onClick={handleStartTraining}
                                        className="w-full py-3 bg-white text-black rounded-xl font-black text-sm tracking-widest uppercase hover:bg-zinc-200 transition-colors"
                                    >
                                        ENTER CAMP <span className="text-[10px] opacity-50 font-normal ml-1">(FREE)</span>
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

                    </motion.div>
                    )
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
                        className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto h-16 bg-black/95 backdrop-blur-xl border-t border-white/10 flex justify-center pb-2 px-6"
                    >
                        <div className="flex items-end h-full w-full justify-center">
                            {/* EVENTS TAB */}
                            <button
                                onClick={() => setActiveNavTab('EVENTS')}
                                className="flex flex-col items-center justify-center gap-1.5 w-1/2 h-full relative"
                            >
                                {activeNavTab === 'EVENTS' && (
                                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#0052FF] shadow-[0_0_10px_rgba(0,82,255,0.8)]" />
                                )}
                                <svg className={`w-5 h-5 ${activeNavTab === 'EVENTS' ? 'text-[#0052FF]' : 'text-zinc-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7" rx="1" />
                                    <rect x="14" y="3" width="7" height="7" rx="1" />
                                    <rect x="14" y="14" width="7" height="7" rx="1" />
                                    <rect x="3" y="14" width="7" height="7" rx="1" />
                                </svg>
                                <span className={`font-mono text-[9px] tracking-widest font-black ${activeNavTab === 'EVENTS' ? 'text-[#0052FF]' : 'text-zinc-600'}`}>EVENTS</span>
                            </button>

                            {/* PROFILE TAB */}
                            <button
                                onClick={() => setActiveNavTab('PROFILE')}
                                className="flex flex-col items-center justify-center gap-1.5 w-1/2 h-full relative"
                            >
                                {activeNavTab === 'PROFILE' && (
                                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#0052FF] shadow-[0_0_10px_rgba(0,82,255,0.8)]" />
                                )}
                                <svg className={`w-5 h-5 ${activeNavTab === 'PROFILE' ? 'text-[#0052FF]' : 'text-zinc-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                <span className={`font-mono text-[9px] tracking-widest font-black ${activeNavTab === 'PROFILE' ? 'text-[#0052FF]' : 'text-zinc-600'}`}>PROFILE</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
