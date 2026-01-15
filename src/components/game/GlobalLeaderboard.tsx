'use client';

import { useEffect } from 'react';
import { useLeaderboard } from '@/lib/hooks/useLeaderboard';
import { motion } from 'framer-motion';

interface GlobalLeaderboardProps {
    onClose: () => void;
}

export default function GlobalLeaderboard({ onClose }: GlobalLeaderboardProps) {
    const { leaderboard, isLoading, fetchLeaderboard } = useLeaderboard();

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

            {/* Card */}
            <div className="w-full max-w-md h-[80vh] flex flex-col bg-[#0A0A0A] border border-white/10 shadow-2xl relative z-10 rounded-xl overflow-hidden">

                {/* Reward Banner */}
                <div className="relative overflow-hidden h-8 bg-[#0052FF] flex items-center">
                    <motion.div
                        className="flex whitespace-nowrap gap-8"
                        animate={{ x: ["0%", "-50%"] }}
                        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                    >
                        {[...Array(4)].map((_, i) => (
                            <span key={i} className="text-white font-bold font-mono text-xs tracking-widest uppercase flex items-center gap-4">
                                <span>STAY BASED & PLAY WORD RAIN</span>
                                <span className="text-white/40">//</span>
                                <span>TOP 5 PLAYERS REWARDED</span>
                                <span className="text-white/40">//</span>
                                <span>1ST PLACE: $100</span>
                                <span className="text-white/40">//</span>
                                <span>TOTAL POOL: $200</span>
                                <span className="text-white/40">//</span>
                            </span>
                        ))}
                    </motion.div>
                </div>

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-white uppercase font-mono">Global Elite</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <p className="text-zinc-500 text-[10px] font-mono tracking-widest uppercase">Verified Payers (0.15 USDC)</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                    >
                        ✕
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1 relative">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4 opacity-50">
                            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            <p className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">Scanning Chain...</p>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30">
                            <p className="text-xs font-mono text-zinc-500 uppercase">Registry Empty</p>
                        </div>
                    ) : (
                        leaderboard.map((entry, i) => {
                            const isTop5 = i < 5;
                            const isFirst = i === 0;

                            return (
                                <div
                                    key={i}
                                    className={`group flex justify-between items-center p-4 rounded-lg border transition-all duration-300 ${isFirst
                                        ? "bg-[#0052FF]/20 border-[#0052FF]/50 shadow-[0_0_30px_rgba(0,82,255,0.2)]"
                                        : isTop5
                                            ? "bg-white/[0.05] border-white/10"
                                            : "bg-white/[0.02] hover:bg-white/[0.06] border-transparent hover:border-white/5"
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`font-mono font-bold w-6 flex justify-center ${isFirst ? "text-[#0052FF] text-lg scale-110" : "text-zinc-600 group-hover:text-zinc-400 text-xs"}`}>
                                            {isFirst ? "👑" : (i + 1).toString().padStart(2, '0')}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Avatar */}
                                            <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 ${isFirst ? "ring-2 ring-[#0052FF]" : "bg-zinc-800 border border-white/10"}`}>
                                                {entry.avatar ? (
                                                    <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className={`w-full h-full flex items-center justify-center text-[10px] font-mono ${isFirst ? "bg-[#0052FF] text-white" : "bg-gradient-to-br from-[#0052FF]/20 to-zinc-900 text-zinc-500"}`}>
                                                        {entry.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-mono tracking-wide transition-all ${isFirst ? "text-white font-bold" : "text-zinc-300 group-hover:text-white"}`}>
                                                        {entry.name}
                                                    </span>
                                                    {isFirst && (
                                                        <span className="bg-[#0052FF] text-white text-[8px] font-bold px-1.5 py-0.5 rounded animate-pulse shadow-[0_0_10px_#0052FF]">
                                                            $100 PRIZE
                                                        </span>
                                                    )}
                                                </div>
                                                {isTop5 && !isFirst && (
                                                    <span className="text-[9px] text-[#0052FF] font-mono tracking-widest opacity-80">
                                                        Top 5 Candidate
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-mono text-sm font-bold opacity-80 group-hover:opacity-100 transition-all ${isFirst ? "text-[#0052FF]" : "text-[#0052FF]"}`}>
                                            {entry.score}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                let url = `https://basescan.org/address/${entry.address}`;
                                                if (entry.name.startsWith('@')) {
                                                    url = `https://warpcast.com/${entry.name.slice(1)}`;
                                                } else if (entry.name.endsWith('.eth')) {
                                                    url = `https://base.org/name/${entry.name}`;
                                                }
                                                window.open(url, '_blank');
                                            }}
                                            className="w-6 h-6 flex items-center justify-center bg-[#0052FF]/10 hover:bg-[#0052FF] text-[#0052FF] hover:text-white rounded transition-all text-[10px]"
                                            title="View Profile"
                                        >
                                            🟦
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Stat */}
                <div className="py-3 px-6 bg-black text-center border-t border-white/5">
                    <p className="text-[9px] text-zinc-700 font-mono uppercase tracking-[0.2em]">
                        Syncing: Base Mainnet
                    </p>
                </div>
            </div>
        </div>
    );
}
