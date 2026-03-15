"use client";

import { useAccount, useSendTransaction, usePublicClient } from "wagmi";
import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { motion, AnimatePresence } from "framer-motion";
import { base } from 'wagmi/chains';
import { encodeFunctionData, parseAbiItem } from "viem";
import { Identity, Avatar, Name, Address } from '@coinbase/onchainkit/identity';
import { Wallet, ConnectWallet } from '@coinbase/onchainkit/wallet';
import PlayerDetailModal from './PlayerDetailModal';

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
        <div className="flex justify-center items-center gap-1.5 font-mono">
            <span className="text-sm font-bold text-white">{timeLeft.d.toString().padStart(2, '0')}</span><span className="text-[10px] text-zinc-500">d</span>
            <span className="text-zinc-700 mx-0.5">:</span>
            <span className="text-sm font-bold text-white">{timeLeft.h.toString().padStart(2, '0')}</span><span className="text-[10px] text-zinc-500">h</span>
            <span className="text-zinc-700 mx-0.5">:</span>
            <span className="text-sm font-bold text-white">{timeLeft.m.toString().padStart(2, '0')}</span><span className="text-[10px] text-zinc-500">m</span>
            <span className="text-zinc-700 mx-0.5">:</span>
            <span className="text-sm font-bold text-[#3B82F6]">{timeLeft.s.toString().padStart(2, '0')}</span><span className="text-[10px] text-[#3B82F6]/70">s</span>
        </div>
    );
};

// --- Onboarding Component ---
const OnboardingOverlay = ({ onClose }: { onClose: () => void }) => {
    const [step, setStep] = useState(1);

    const steps = [
        {
            title: "WHAT IS WORD RAIN?",
            desc: "Words fall from above. Type them before they reach the death line. Each correct word = points. Miss too many = game over."
        },
        {
            title: "THE OMEGA EVENT",
            desc: "Entry fee: 1 USDC. Prize pool: $500 guaranteed. Top 5 players split the spoils. One life — resurrect for 0.5 USDC."
        },
        {
            title: "READY TO ENTER?",
            desc: "Connect your wallet, pay 1 USDC entry, and compete for your share of $500. Only the sharpest minds survive."
        }
    ];

    const nextStep = () => {
        if (step < 3) setStep(step + 1);
        else onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
            >
                {/* Background effects */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#0052FF]/20 blur-[50px] rounded-full pointer-events-none"></div>

                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors hover:bg-white/5 rounded-full">✕</button>

                {/* Progress Indicators */}
                <div className="flex gap-2 mb-8 mt-2">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-[#0052FF]' : 'bg-white/10'}`} />
                    ))}
                </div>

                {/* Content */}
                <div className="min-h-[120px] mb-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <h2 className="font-space font-bold text-xl text-white mb-3 tracking-widest">{steps[step - 1].title}</h2>
                            <p className="font-mono text-sm text-zinc-400 leading-relaxed tracking-wide">
                                {steps[step - 1].desc}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Action */}
                <button
                    onClick={nextStep}
                    className="w-full py-4 bg-gradient-to-r from-[#0052FF]/20 to-[#0052FF]/10 hover:from-[#0052FF] hover:to-[#2563EB] border border-[#0052FF]/30 hover:border-[#0052FF] text-[#0052FF] hover:text-white font-mono font-bold tracking-widest text-sm rounded-xl transition-all active:scale-[0.98]"
                >
                    {step === 3 ? "ENTER THE VOID →" : "NEXT →"}
                </button>
            </motion.div>
        </motion.div>
    );
};
// ----------------------------

export default function EventLobby({ onBack, onStart }: { onBack: () => void, onStart: () => void }) {
    const { address } = useAccount();
    const { setMode } = useGameStore();
    const { sendTransactionAsync } = useSendTransaction();
    const publicClient = usePublicClient();

    const [isProcessing, setIsProcessing] = useState(false);
    const [hasPaidEntry, setHasPaidEntry] = useState(false);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);

    // Initial Onboarding Check
    useEffect(() => {
        const hasSeen = localStorage.getItem('wordrain_onboarding_seen');
        if (!hasSeen) {
            setShowOnboarding(true);
        }
    }, []);

    const closeOnboarding = () => {
        localStorage.setItem('wordrain_onboarding_seen', 'true');
        setShowOnboarding(false);
    };

    // Check Persistent Payment Flag (Server + Local Fallback)
    useEffect(() => {
        if (!address) return;
        const checkAccess = async () => {
            try {
                // 1. Check Local First (Instant)
                const payKey = `omega_entry_paid_${address}`;
                if (localStorage.getItem(payKey) === 'true') {
                    setHasPaidEntry(true);
                }

                // 2. Check Server (Authoritative)
                const res = await fetch(`/api/event/access?address=${address}`);
                if (res.ok) {
                    const { hasAccess } = await res.json();
                    if (hasAccess) {
                        setHasPaidEntry(true);
                        localStorage.setItem(payKey, 'true'); // Re-sync local
                    }
                }
            } catch (e) {
                console.error("Access check failed", e);
            }
        };
        checkAccess();
    }, [address]);

    // Load Leaderboard (ETHDenver Partition)
    useEffect(() => {
        const loadLeaderboard = async () => {
            setIsRefreshing(true);
            try {
                // Fetch from new centralized API
                const res = await fetch(`/api/leaderboard/top?limit=50&partition=omega&_t=${Date.now()}`, {
                    cache: 'no-store'
                });

                if (res.ok) {
                    const data = await res.json();
                    setLeaderboard(data);
                }
            } catch (e) {
                console.error("Leaderboard fetch failed", e);
            } finally {
                setIsRefreshing(false);
            }
        };

        loadLeaderboard();
        const interval = setInterval(loadLeaderboard, 10000);
        return () => clearInterval(interval);
    }, []);



    const handleEntryPayment = async () => {
        if (!address) return;

        // SKIP PAYMENT IF ALREADY PAID
        if (hasPaidEntry) {
            setMode('EVENT'); // Using EVENT mode for now, logic in GameEngine will handle scoring
            onStart();
            return;
        }

        setIsProcessing(true);
        try {
            // 1 USDC Entry Fee
            const ENTRY_FEE = BigInt(1000000); // 1.00 USDC
            const TREASURY = "0x6edd22E9792132614dD487aC6434dec3709b79A8";

            const data = encodeFunctionData({
                abi: [parseAbiItem('function transfer(address to, uint256 value)')],
                functionName: 'transfer',
                args: [TREASURY, ENTRY_FEE]
            });

            const hash = await sendTransactionAsync({
                to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
                data: data,
                value: BigInt(0),
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });

                // SAVE PERSISTENT STATE
                await fetch('/api/event/access', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ address }),
                });

                // SAVE LOCAL STATE
                const payKey = `omega_entry_paid_${address}`;
                localStorage.setItem(payKey, 'true');
                setHasPaidEntry(true);

                setMode('EVENT');
                onStart();
            }
        } catch (e) {
            console.error("Entry Failed", e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto h-[100dvh] bg-black text-white font-mono flex flex-col relative overflow-hidden">
            <AnimatePresence>
                {showOnboarding && <OnboardingOverlay onClose={closeOnboarding} />}
            </AnimatePresence>

            {/* Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#3B82F6]/20 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/5 backdrop-blur-md">
                <button
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center border border-white/10 bg-black/50 hover:bg-white/10 transition-all rounded-full"
                >
                    <span className="text-xl">←</span>
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="text-lg font-black italic tracking-widest uppercase text-white">
                        <span className="text-[#3B82F6]">#</span>OMEGA
                    </h1>
                    <span className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase">OFFICIAL EVENT</span>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Premium Countdown Banner Header */}
            <div className="w-full flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#020202] relative z-20 shadow-xl">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    <span className="text-[10px] text-[#3B82F6] font-bold tracking-widest uppercase font-mono">LIVE ZERO-SUM</span>
                </div>
                <div className="flex bg-[#3B82F6]/10 text-[#3B82F6] px-3 py-1.5 border border-[#3B82F6]/20 rounded-full">
                    <span className="text-[11px] font-bold tracking-widest uppercase font-mono">
                        $500 PRIZE POOL
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-hide space-y-6">

                {/* Prize Pool Card - OMEGA THEME */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#000000] p-8 text-center group shadow-[0_0_50px_rgba(0,82,255,0.15)] mt-4">
                    {/* Dynamic Ambient Background */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#0052FF] opacity-10 blur-[80px] group-hover:opacity-20 transition-opacity duration-700 pointer-events-none" />
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center gap-1">
                        <div className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-3">
                            <span className="text-[9px] text-zinc-400 font-bold tracking-[0.3em] uppercase drop-shadow-sm flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
                                GUARANTEED PRIZE POOL
                            </span>
                        </div>

                        <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40 tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                            $500
                        </div>

                        <div className="text-[12px] font-mono text-[#3B82F6] font-bold tracking-widest uppercase mt-4 border-t border-white/10 pt-4 w-2/3">
                            TOP 5 DIVIDE THE SPOILS
                        </div>
                        <p className="text-[9px] text-zinc-500 mt-2 font-mono uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                            No second chances. Only the sharpest minds survive the decrypter.
                        </p>
                    </div>
                </div>

                {/* Action Button / Wallet Connect */}
                <div className="w-full">
                    {!address ? (
                        <Wallet>
                            <ConnectWallet
                                className="w-full py-5 font-black text-xl bg-gradient-to-r from-[#0052FF] to-[#2563EB] text-white uppercase tracking-widest rounded-2xl relative overflow-hidden transition-all shadow-[0_0_30px_rgba(0,82,255,0.4)] hover:shadow-[0_0_50px_rgba(0,82,255,0.6)] hover:scale-[1.02] active:scale-[0.98] border border-[#3B82F6] flex justify-center items-center"
                                text="CONNECT TO DEPOSIT"
                            />
                        </Wallet>
                    ) : (
                        <button
                            onClick={handleEntryPayment}
                            disabled={isProcessing}
                            className="w-full py-5 font-black text-xl bg-gradient-to-r from-[#0052FF] to-[#2563EB] text-white uppercase tracking-widest rounded-2xl relative overflow-hidden transition-all shadow-[0_0_30px_rgba(0,82,255,0.4)] hover:shadow-[0_0_50px_rgba(0,82,255,0.6)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 group border border-[#3B82F6]"
                        >
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent opacity-50" />

                            <span className="relative z-10 flex items-center justify-center gap-3 drop-shadow-md">
                                {isProcessing ? "PROCESSING TX..." : (hasPaidEntry ? "ENTER THE VOID →" : "DEPOSIT 1 USDC TO ENTER")}
                            </span>
                        </button>
                    )}
                </div>

                {/* Leaderboard Header */}
                <div className="flex items-center justify-between px-1 mt-6">
                    <h2 className="text-sm font-bold text-white tracking-widest flex items-center gap-2 font-mono uppercase">
                        <span className="w-1 h-1 rounded-sm bg-white"></span>
                        Decryption Board
                    </h2>
                    <button
                        onClick={() => {
                            // Manual Refresh Trigger
                            setIsRefreshing(true);
                            fetch(`/api/leaderboard/top?limit=50&partition=omega&_t=${Date.now()}`)
                                .then(res => res.json())
                                .then(data => { setLeaderboard(data); setIsRefreshing(false); })
                                .catch(() => setIsRefreshing(false));
                        }}
                        disabled={isRefreshing}
                        className="text-[10px] text-[#0052FF] hover:text-white uppercase tracking-widest transition-colors font-bold"
                    >
                        {isRefreshing ? "SYNCING..." : "PULL LATEST"}
                    </button>
                </div>

                {/* Rankings - OMEGA REDESIGN */}
                <div className="space-y-6 pb-20">
                    {leaderboard.length === 0 ? (
                        <div className="text-center py-20 border border-white/5 rounded-3xl bg-black/50 mx-6 shadow-inner">
                            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest animate-pulse">Scanning the void for signals...</p>
                        </div>
                    ) : (
                        <>
                            {/* UNIFIED DATA TABLE - VERIFIED PILOTS */}
                            <div className="flex flex-col w-full rounded-2xl bg-[#030303] border border-white/5 overflow-hidden shadow-2xl pb-4">
                                {(() => {
                                    const isVerified = (entry: any): boolean => {
                                        if (entry.isDisqualified) return true; // Always show disqualified
                                        const u = (entry.name || entry.username || '').trim().toLowerCase();
                                        // Raw 0x wallet address ise verified değil
                                        if (!u || u.startsWith('0x')) return false;
                                        // @ ile başlayan Farcaster handle, .base.eth, .eth, veya herhangi bir isim → verified
                                        return true;
                                    };

                                    const verifiedPilots = leaderboard.filter(isVerified);
                                    return (
                                        <>
                                            {/* VERIFIED PILOTS SECTION --------------------------------------- */}
                                            {verifiedPilots.map((entry: any, i: number) => {
                                                const rank = i + 1;

                                                const rankStyle = (() => {
                                                    if (rank === 1) return {
                                                        row: 'bg-gradient-to-r from-white/[0.07] to-transparent border-b border-white/10 relative overflow-hidden',
                                                        bar: 'bg-white/80 shadow-[0_0_15px_rgba(255,255,255,0.8)]',
                                                        rankNum: 'text-white font-black drop-shadow-[0_0_8px_rgba(255,255,255,1)]',
                                                        name: 'text-white font-bold',
                                                        score: 'text-white font-black text-xl drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]',
                                                        label: 'CURRENT LEADER',
                                                    };
                                                    if (rank <= 5) return {
                                                        row: 'bg-transparent border-b border-white/5 relative',
                                                        bar: 'bg-[#0052FF]/60',
                                                        rankNum: 'text-zinc-500 font-bold',
                                                        name: 'text-zinc-200 font-semibold',
                                                        score: 'text-[#0052FF] font-bold text-lg',
                                                        label: null,
                                                    };
                                                    return {
                                                        row: 'bg-transparent border-b border-white/5 relative',
                                                        bar: null,
                                                        rankNum: 'text-zinc-600',
                                                        name: 'text-zinc-400',
                                                        score: 'text-zinc-500 font-bold',
                                                        label: null,
                                                    };
                                                })();

                                                return (
                                                    <div
                                                        key={entry.member || entry.address}
                                                        onClick={() => setSelectedPlayer(entry)}
                                                        className={`group flex items-center justify-between p-4 cursor-pointer transition-all hover:bg-white/5 active:bg-white/10 ${rankStyle.row}`}
                                                    >
                                                        {rankStyle.bar && <div className={`absolute left-0 top-0 bottom-0 w-1 ${rankStyle.bar}`} />}

                                                        <div className="flex items-center gap-4 relative z-10 w-full px-2">
                                                            <div className={`font-mono text-xs w-6 text-center shrink-0 ${rankStyle.rankNum}`}>
                                                                {rank}
                                                            </div>

                                                <div className="relative shrink-0">
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border ${rank === 1 ? 'border-white/50 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'border-white/10 bg-[#050505]'}`}>
                                                        {/* FALLBACK ICON */}
                                                        <div className={`absolute inset-0 flex items-center justify-center rounded-full ${rank === 1 ? 'bg-gradient-to-br from-zinc-700 to-black' : 'bg-black'}`}>
                                                            <svg className={`w-1/2 h-1/2 ${rank === 1 ? 'text-white' : 'text-zinc-600'} opacity-80`} viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                            </svg>
                                                        </div>
                                                        {entry.identifier && entry.identifier.startsWith('0x') ? (
                                                            <div className="absolute inset-0 w-full h-full z-20 rounded-full overflow-hidden flex items-center justify-center">
                                                                <Avatar address={entry.identifier as `0x${string}`} chain={base} className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : entry.pfp_url && (
                                                            <img
                                                                src={entry.pfp_url}
                                                                alt="Profile"
                                                                className="absolute inset-0 w-full h-full object-cover rounded-full z-20"
                                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                    <div className="flex flex-col justify-center flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm truncate ${rankStyle.name}`}>
                                                                {(() => {
                                                                    if (entry.isDisqualified) return "⚠ DISQUALIFIED (CHEAT)";
                                                                    const displayName = entry.name || entry.display_name || entry.username || entry.displayName || `Pilot ${entry.identifier?.slice(0, 4) || entry.address?.slice(0, 4)}`;
                                                                    return displayName.startsWith('@') ? displayName.slice(1) : displayName;
                                                                })()}
                                                            </span>
                                                        {rank >= 2 && rank <= 5 && (
                                                            <div className="w-3.5 h-3.5 rounded-full bg-[#0052FF] flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(0,82,255,0.8)]" title="Prize Winner">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                            </div>
                                                        )}
                                                        {entry.power_badge && <span className="text-[10px] shrink-0">⚡</span>}
                                                    </div>
                                                    {rankStyle.label && (
                                                        <span className="text-[9px] text-white font-mono tracking-widest uppercase mt-0.5 font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">{rankStyle.label}</span>
                                                    )}
                                                    {rank !== 1 && entry.streak > 0 && (
                                                        <span className="text-[9px] text-orange-500 font-mono tracking-widest mt-0.5">🔥 {entry.streak} DAY</span>
                                                    )}
                                                </div>

                                                    <div className="text-right shrink-0">
                                                        <span className={`font-space font-bold tracking-tight ${rankStyle.score}`}>
                                                            {entry.score}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                </>
                            );
                        })()}
                    </div>

                            {/* OMEGA DISQUALIFIED SECTION */}
                            <div className="mt-8 pt-6 border-t border-red-500/20 px-4 mb-8">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                    <h3 className="text-xs font-bold text-red-500 tracking-widest uppercase">Disqualified Players</h3>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {[
                                        {
                                            address: '0x982C4c6E24D08D5871b075c0c7A1dC79393868Da',
                                            reason: 'Permanent ban. Flagged for systematic exploitation across multiple events.'
                                        },
                                        {
                                            address: '0x552B03253B49d208417DDD5A1561b9eD888Cf5a8',
                                            reason: 'Illegitimate score. Backend telemetry indicates impossible resurrection and scoring rates.'
                                        },
                                        {
                                            address: '0xF1B0568A4bEdE00950a47bB537b627ED6c88DFFD',
                                            reason: 'Illegitimate score. Backend telemetry indicates impossible resurrection and scoring rates.'
                                        },
                                        {
                                            address: '0xFaa9a44859828cc06b15A57310e3403a8CC7B7de',
                                            reason: 'Illegitimate score. Backend telemetry indicates impossible resurrection and scoring rates.'
                                        }
                                    ].map(blocked => (
                                        <div key={blocked.address} className="flex flex-col p-3 rounded-xl bg-red-950/30 border border-red-500/30 w-full relative overflow-hidden group">
                                            <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ef4444_10px,#ef4444_20px)] pointer-events-none"></div>

                                            <div className="flex items-center justify-between relative z-10 w-full mb-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-red-500/50 text-[10px] w-4 text-center">X</span>
                                                    <div className="relative">
                                                        <img
                                                            src={`/base-logo.svg`}
                                                            className="w-8 h-8 rounded-full bg-black/50 object-cover border border-red-500/30 p-1 opacity-50 grayscale"
                                                            alt="Disqualified Player"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-red-400 font-mono text-xl max-w-[200px] whitespace-nowrap overflow-hidden line-through decoration-red-500/50" title={blocked.address}>
                                                            {blocked.address.slice(0, 6)}...{blocked.address.slice(-4)}
                                                        </span>
                                                        <span className="text-[10px] text-red-500/70 font-mono uppercase tracking-wider mt-0.5">
                                                            DISQUALIFIED FROM OMEGA
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="relative z-10 w-full py-2 px-3 bg-red-500/10 text-red-400 text-[10px] font-mono tracking-wide rounded border border-red-500/20 text-center leading-relaxed">
                                                <span className="font-bold">REASON:</span> {blocked.reason}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

            </div>
            <PlayerDetailModal
                isOpen={!!selectedPlayer}
                onClose={() => setSelectedPlayer(null)}
                player={selectedPlayer}
            />
        </div >
    );
}
