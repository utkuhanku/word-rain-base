"use client";

import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { motion } from "framer-motion";
import { parseAbiItem } from "viem";
import { Identity, Avatar, Name, Address } from '@coinbase/onchainkit/identity';
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
// ----------------------------

export default function EventLobby({ onBack, onStart }: { onBack: () => void, onStart: () => void }) {
    const { address } = useAccount();
    const { setMode } = useGameStore();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const [isProcessing, setIsProcessing] = useState(false);
    const [hasPaidEntry, setHasPaidEntry] = useState(false);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

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
                const res = await fetch(`/api/leaderboard/top?limit=50&partition=ethdenver&_t=${Date.now()}`, {
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

            const hash = await writeContractAsync({
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
                abi: [parseAbiItem('function transfer(address to, uint256 value)')],
                functionName: 'transfer',
                args: [TREASURY, ENTRY_FEE]
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
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0052FF] animate-pulse shadow-[0_0_8px_rgba(0,82,255,0.8)]" />
                    <span className="text-[10px] text-[#0052FF] font-bold tracking-widest uppercase font-mono">LIVE ZERO-SUM</span>
                </div>
                <div className="flex bg-[#0052FF]/10 text-[#0052FF] px-3 py-1.5 border border-[#0052FF]/20 rounded-full">
                    <span className="text-[11px] font-bold tracking-widest uppercase font-mono">
                        SURPRISE POOL
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-hide space-y-6">

                {/* Prize Pool Card */}
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#050505] p-6 text-center group shadow-2xl">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
                    <div className="text-[10px] text-zinc-500 font-bold tracking-[0.3em] uppercase mb-1 drop-shadow-sm">TOTAL PRIZE POOL</div>
                    <div className="text-6xl font-black text-white tracking-tighter drop-shadow-[-2px_-2px_0px_#0052FF,2px_2px_0px_#0052FF]">
                        ???
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-2 font-mono uppercase tracking-widest">
                        A dynamic pool awaits the victor.<br />
                        No second chances.
                    </p>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleEntryPayment}
                    disabled={isProcessing}
                    className="w-full py-5 font-black text-xl bg-white text-black hover:bg-zinc-200 uppercase tracking-widest rounded-xl relative overflow-hidden transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
                >
                    <span className="relative z-10 flex items-center justify-center gap-3">
                        {isProcessing ? "PROCESSING..." : (hasPaidEntry ? "ENTER THE VOID" : "DEPOSIT 1 USDC TO ENTER")}
                    </span>
                </button>

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
                            {/* UNIFIED DATA TABLE */}
                            <div className="flex flex-col w-full rounded-2xl bg-[#030303] border border-white/5 overflow-hidden shadow-2xl pb-4">
                                {leaderboard.map((entry: any, i) => {
                                    const isTop = i === 0;
                                    const isTop3 = i > 0 && i < 3;
                                    return (
                                        <div
                                            key={entry.member || entry.address}
                                            onClick={() => setSelectedPlayer(entry)}
                                            className={`flex items-center justify-between p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 active:bg-white/10 ${isTop ? 'bg-gradient-to-r from-white/10 to-transparent relative overflow-hidden' : ''}`}
                                        >
                                            {isTop && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]" />}
                                            {isTop3 && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />}

                                            <div className="flex items-center gap-4 relative z-10 w-full px-2">
                                                <div className={`font-mono text-xs w-6 text-center shrink-0 ${isTop ? 'text-white font-black drop-shadow-[0_0_8px_rgba(255,255,255,1)]' : 'text-zinc-600 font-bold'}`}>
                                                    {i + 1}
                                                </div>

                                                <div className="relative shrink-0">
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border ${isTop ? 'border-white/50 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'border-white/10 bg-[#050505]'}`}>
                                                        {/* FALLBACK ICON */}
                                                        <div className={`absolute inset-0 flex items-center justify-center rounded-full ${isTop ? 'bg-gradient-to-br from-zinc-700 to-black' : 'bg-black'}`}>
                                                            <svg className={`w-1/2 h-1/2 ${isTop ? 'text-white' : 'text-zinc-600'} opacity-80`} viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                            </svg>
                                                        </div>
                                                        {entry.pfp_url && (
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
                                                        <span className={`font-bold text-sm truncate ${isTop3 ? 'text-white' : 'text-zinc-300'}`}>
                                                            {entry.username ? entry.username : entry.type === 'wallet' || entry.identifier?.startsWith('0x') ? <Name address={entry.identifier as `0x${string}`} /> : (entry.displayName || `Pilot ${entry.identifier?.slice(0, 4)}`)}
                                                        </span>
                                                        {isTop3 && (
                                                            <div className="w-3.5 h-3.5 rounded-full bg-[#0052FF] flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(0,82,255,0.8)]" title="Prize Winner">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                            </div>
                                                        )}
                                                        {entry.power_badge && <span className="text-[10px] shrink-0">⚡</span>}
                                                    </div>
                                                    {isTop && (
                                                        <span className="text-[9px] text-white font-mono tracking-widest uppercase mt-0.5 font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">CURRENT LEADER</span>
                                                    )}
                                                    {!isTop && entry.streak > 0 && (
                                                        <span className="text-[9px] text-orange-500 font-mono tracking-widest mt-0.5">🔥 {entry.streak} DAY</span>
                                                    )}
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span className={`font-space font-bold text-xl tracking-tight ${isTop ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-zinc-500'}`}>
                                                        {entry.score}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* DISQUALIFIED SECTION */}
                            <div className="mt-8 pt-6 border-t border-red-500/20">
                                <div className="flex items-center gap-2 mb-3 px-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                    <h3 className="text-xs font-bold text-red-500 tracking-widest uppercase">Disqualified Players</h3>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {[
                                        '0xe555eBCa692D41300773F488FDb92244AAf81Fa7',
                                        '0xB27F239610e47cACDfF082A79bE829384d46b976',
                                        '0x53481a207B5dd683a7C018157709A5092774b09A',
                                        '0x0Ea03d210e1E3743A0815204FbCFcD36e07Ec230'
                                    ].map(blockedAddr => (
                                        <div key={blockedAddr} className="flex flex-col p-3 rounded-xl bg-red-950/30 border border-red-500/30 w-full relative overflow-hidden group">
                                            {/* Striped warning background */}
                                            <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ef4444_10px,#ef4444_20px)] pointer-events-none"></div>

                                            <div className="flex items-center justify-between relative z-10 w-full">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-red-500/50 text-[10px] w-4 text-center">X</span>
                                                    <div className="relative">
                                                        <img
                                                            src={`/base-logo.svg`}
                                                            className="w-8 h-8 rounded-full bg-black/50 object-cover border border-red-500/30 p-1 opacity-50 grayscale"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-red-400 font-mono text-xs max-w-[140px] whitespace-nowrap overflow-hidden line-through decoration-red-500/50" title={blockedAddr}>
                                                            {blockedAddr.slice(0, 10)}...
                                                        </span>
                                                        <span className="text-[9px] text-red-500/70 font-mono uppercase tracking-wider mt-0.5">
                                                            REFUNDED & DISQUALIFIED
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-red-500/50 font-mono font-bold text-sm block">0.00</span>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            <a
                                                href="https://warpcast.com/utkus"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-3 relative z-10 w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold tracking-widest uppercase rounded border border-red-500/20 flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <span>DM @UTKUS FOR INQUIRIES</span>
                                                <span>→</span>
                                            </a>
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
