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
                const payKey = `ethdenver_entry_paid_${address}`;
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
                const payKey = `ethdenver_entry_paid_${address}`;
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
                        ETHDENVER <span className="text-[#3B82F6]">SPECIAL</span>
                    </h1>
                    <span className="text-[10px] text-zinc-500 tracking-[0.2em] uppercase">OFFICIAL EVENT</span>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Minimal Countdown Banner */}
            <div className="w-full flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#050505] relative z-20">
                <span className="text-[10px] text-zinc-500 tracking-widest uppercase font-mono">Ends Feb 22</span>
                <CountdownTimer targetDate={new Date('2026-02-23T00:00:00Z')} />
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10 scrollbar-hide space-y-6">

                {/* Prize Pool Card */}
                <div className="relative overflow-hidden rounded-2xl border border-[#3B82F6]/30 bg-[#3B82F6]/5 p-6 text-center">
                    <div className="text-xs text-[#3B82F6] font-bold tracking-widest mb-1">TOTAL PRIZE POOL</div>
                    <div className="text-6xl font-black text-white tracking-tighter drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                        $250
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-2 font-mono">
                        Winners announced at the end of ETHDenver.<br />
                        Highest score single entry wins.
                    </p>
                </div>

                {/* Action Button */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleEntryPayment}
                    disabled={isProcessing}
                    className="w-full py-5 font-black text-xl uppercase tracking-widest rounded-xl relative overflow-hidden group shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                >
                    <span className="relative z-10 flex items-center justify-center gap-3">
                        {isProcessing ? "PROCESSING..." : (hasPaidEntry ? "PLAY NOW" : "ENTER EVENT")}
                        {!hasPaidEntry && <span className="px-2 py-1 rounded text-xs font-bold font-mono" style={{ backgroundColor: '#000000', color: '#ffffff' }}>1 USDC</span>}
                    </span>
                    {hasPaidEntry && <div className="absolute inset-0 bg-[#3B82F6]/20 animate-pulse"></div>}
                </motion.button>

                {/* Leaderboard Header */}
                <div className="flex items-center justify-between px-1 mt-4">
                    <h2 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse"></span>
                        LIVE STANDINGS
                    </h2>
                    <button
                        disabled={isRefreshing}
                        className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest"
                    >
                        {isRefreshing ? "SYNCING..." : "AUTO-UPDATE"}
                    </button>
                </div>

                {/* Rankings - PREMIUM REDESIGN (TOP 4 PODIUM) */}
                <div className="space-y-6 pb-20">
                    {leaderboard.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-white/5 rounded-3xl bg-white/5 mx-6">
                            <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest animate-pulse">Waiting for Players...</p>
                        </div>
                    ) : (
                        <>
                            {/* UNIFIED DATA TABLE */}
                            <div className="flex flex-col w-full rounded-2xl bg-[#030303] border border-white/5 overflow-hidden shadow-2xl pb-4">
                                {leaderboard.map((entry: any, i) => {
                                    const isTop4 = i < 4;
                                    return (
                                        <div
                                            key={entry.member || entry.address}
                                            onClick={() => setSelectedPlayer(entry)}
                                            className={`flex items-center justify-between p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 active:bg-white/10 ${isTop4 ? 'bg-gradient-to-r from-[#0052FF]/10 to-transparent relative overflow-hidden' : ''}`}
                                        >
                                            {isTop4 && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0052FF] shadow-[0_0_10px_rgba(0,82,255,0.8)]" />}

                                            <div className="flex items-center gap-4 relative z-10 w-full px-2">
                                                <div className={`font-mono text-sm w-6 text-center shrink-0 ${isTop4 ? 'text-[#0052FF] font-black' : 'text-zinc-600 font-bold'}`}>
                                                    {i + 1}
                                                </div>

                                                <div className="relative shrink-0">
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border-2 ${isTop4 ? 'border-[#0052FF]/50 shadow-[0_0_15px_rgba(0,82,255,0.3)] bg-[#0052FF]/10' : 'border-white/10 bg-zinc-900 border-transparent'}`}>
                                                        <span className="text-zinc-600 font-mono text-sm">B</span>
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
                                                        <span className={`font-bold text-sm truncate ${isTop4 ? 'text-white' : 'text-zinc-300'}`}>
                                                            {entry.username ? entry.username : entry.type === 'wallet' || entry.identifier?.startsWith('0x') ? <Name address={entry.identifier as `0x${string}`} /> : (entry.displayName || `Pilot ${entry.identifier?.slice(0, 4)}`)}
                                                        </span>
                                                        {isTop4 && (
                                                            <div className="w-3.5 h-3.5 rounded-full bg-[#0052FF] flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(0,82,255,0.8)]" title="Prize Winner">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                            </div>
                                                        )}
                                                        {entry.power_badge && <span className="text-[10px] shrink-0">⚡</span>}
                                                    </div>
                                                    {isTop4 && (
                                                        <span className="text-[9px] text-[#0052FF] font-mono tracking-widest uppercase mt-0.5 font-bold">PRIZE WINNER</span>
                                                    )}
                                                    {!isTop4 && entry.streak > 0 && (
                                                        <span className="text-[9px] text-orange-500 font-mono tracking-widest mt-0.5">🔥 {entry.streak} DAY</span>
                                                    )}
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span className={`font-space font-bold text-xl tracking-tight ${isTop4 ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-zinc-500'}`}>
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
                                        '0x53481a207B5dd683a7C018157709A5092774b09A'
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
                                                            Suspicious Activity
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
