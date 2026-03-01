"use client";

import { useAccount, useSendTransaction, usePublicClient } from "wagmi";
import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { motion } from "framer-motion";
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
                            {/* UNIFIED DATA TABLE */}
                            <div className="flex flex-col w-full rounded-2xl bg-[#030303] border border-white/5 overflow-hidden shadow-2xl pb-4">
                                {leaderboard.map((entry: any, i) => {
                                    const isTop = i === 0;
                                    const isTop5 = i > 0 && i < 5;
                                    return (
                                        <div
                                            key={entry.member || entry.address}
                                            onClick={() => setSelectedPlayer(entry)}
                                            className={`flex items-center justify-between p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 active:bg-white/10 ${isTop ? 'bg-gradient-to-r from-white/10 to-transparent relative overflow-hidden' : ''}`}
                                        >
                                            {isTop && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]" />}
                                            {isTop5 && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />}

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
                                                        <span className={`font-bold text-sm truncate ${isTop5 ? 'text-white' : 'text-zinc-300'}`}>
                                                            {entry.username ? entry.username : entry.type === 'wallet' || entry.identifier?.startsWith('0x') ? <Name address={entry.identifier as `0x${string}`} /> : (entry.displayName || `Pilot ${entry.identifier?.slice(0, 4)}`)}
                                                        </span>
                                                        {isTop5 && (
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
