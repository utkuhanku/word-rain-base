'use client';

import { useEffect, useState } from 'react';
import { useLeaderboard } from '@/lib/hooks/useLeaderboard';
import { motion } from 'framer-motion';

interface GlobalLeaderboardProps {
    onClose: () => void;
}

export default function GlobalLeaderboard({ onClose }: GlobalLeaderboardProps) {
    const { leaderboard, isLoading, fetchLeaderboard } = useLeaderboard();
    const [season, setSeason] = useState<'S2' | 'S1'>('S2');

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    const filteredLeaderboard = leaderboard.filter(entry =>
        season === 'S1' ? entry.isLegacy : !entry.isLegacy
    ).sort((a, b) => b.score - a.score);

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />

            {/* Card */}
            <div className="w-full max-w-md h-[80vh] flex flex-col bg-[#0A0A0A] border border-white/10 shadow-2xl relative z-10 rounded-xl overflow-hidden">

                {/* Reward Banner */}
                <div className="relative overflow-hidden h-8 bg-[#0052FF] flex items-center shrink-0">
                    <motion.div
                        className="flex whitespace-nowrap gap-8"
                        animate={{ x: ["0%", "-50%"] }}
                        transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
                    >
                        {[...Array(4)].map((_, i) => (
                            <span key={i} className="text-white font-bold font-mono text-xs tracking-widest uppercase flex items-center gap-6">
                                <span className="text-[#0052FF]">FEBRUARY SPRINT</span>
                                <span className="text-white/20">//</span>
                                <span>$250 PRIZE POOL</span>
                                <span className="text-white/20">//</span>
                                <span className="text-emerald-400">TOP 3 WINS CASH</span>
                                <span className="text-white/20">//</span>
                                <span>ENDS FEB 28</span>
                                <span className="text-white/20">//</span>
                            </span>
                        ))}
                    </motion.div>
                </div>

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex flex-col gap-4 bg-white/[0.02] shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-white uppercase font-mono">Global Elite</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)] ${season === 'S2' ? "bg-emerald-500" : "bg-zinc-500"}`} />
                                <p className="text-zinc-500 text-[10px] font-mono tracking-widest uppercase">
                                    {season === 'S2' ? "Verified Payers (Feb Sprint)" : "Season 1 Archive"}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Season Toggles */}
                    <div className="flex p-1 bg-black/40 rounded-lg border border-white/5">
                        <button
                            onClick={() => setSeason('S2')}
                            className={`flex-1 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded transition-all ${season === 'S2' ? "bg-[#0052FF] text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"}`}
                        >
                            Season 2 (Active)
                        </button>
                        <button
                            onClick={() => setSeason('S1')}
                            className={`flex-1 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded transition-all ${season === 'S1' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                        >
                            Season 1
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1 relative">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4 opacity-50">
                            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            <p className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">Scanning Chain...</p>
                        </div>
                    ) : filteredLeaderboard.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30">
                            <p className="text-xs font-mono text-zinc-500 uppercase">No Entries Yet</p>
                        </div>
                    ) : (
                        filteredLeaderboard.map((entry, i) => {
                            const rank = i + 1;

                            // Rank Styles
                            let rowStyle = "bg-white/[0.02] hover:bg-white/[0.06] border-transparent hover:border-white/5";
                            let rankIcon = rank.toString().padStart(2, '0');
                            let rankColor = "text-zinc-600 group-hover:text-zinc-400";
                            let nameColor = "text-zinc-300 group-hover:text-white";
                            let ringColor = "bg-zinc-800 border border-white/10";


                            if (rank === 1) {
                                rowStyle = "bg-[#FFD700]/10 border-[#FFD700]/50 shadow-[0_0_20px_rgba(255,215,0,0.15)] bg-gradient-to-r from-[#FFD700]/5 to-transparent";
                                rankIcon = "👑";
                                rankColor = "text-[#FFD700] text-xl scale-125";
                                nameColor = "text-[#FFD700] font-bold";
                                ringColor = "ring-2 ring-[#FFD700] shadow-[0_0_10px_#FFD700]";
                            } else if (rank === 2) {
                                rowStyle = "bg-zinc-300/10 border-zinc-300/30";
                                rankIcon = "🥈";
                                rankColor = "text-zinc-300 text-lg";
                                nameColor = "text-white font-bold";
                                ringColor = "ring-1 ring-zinc-300";
                            } else if (rank === 3) {
                                rowStyle = "bg-amber-700/10 border-amber-700/30";
                                rankIcon = "🥉";
                                rankColor = "text-amber-600 text-lg";
                                nameColor = "text-amber-500 font-bold";
                                ringColor = "ring-1 ring-amber-600";
                            }

                            if (season === 'S1') {
                                // S1 Specifics: Maybe less glowy?
                                // User wants them to see Top 3 so keep glow.
                                // We can add opacity if needed but lets clear it up.
                            }

                            return (
                                <div
                                    key={i}
                                    className={`group flex justify-between items-center p-4 rounded-lg border transition-all duration-300 ${rowStyle}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`font-mono font-bold w-8 flex justify-center items-center ${rankColor}`}>
                                            {rankIcon}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Avatar */}
                                            <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 ${ringColor}`}>
                                                {entry.avatar ? (
                                                    <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className={`w-full h-full flex items-center justify-center text-[10px] font-mono ${rank === 1 ? "bg-[#FFD700] text-black" : "bg-gradient-to-br from-zinc-800 to-black text-zinc-500"}`}>
                                                        {entry.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-mono tracking-wide transition-all ${nameColor}`}>
                                                        {entry.name}
                                                    </span>
                                                    {rank === 1 && (
                                                        <span className="bg-[#FFD700] text-black text-[8px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                                                            MVP
                                                        </span>
                                                    )}
                                                </div>
                                                {rank <= 3 && season === 'S2' && (
                                                    <span className="text-[9px] font-mono tracking-widest opacity-80 flex items-center gap-1">
                                                        <span className={rank === 1 ? "text-[#FFD700]" : (rank === 2 ? "text-zinc-300" : "text-amber-600")}>
                                                            {rank === 1 ? "CURRENT CHAMPION" : (rank === 2 ? "RUNNER UP" : "PODIUM")}
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-mono text-sm font-bold opacity-80 group-hover:opacity-100 transition-all ${rank === 1 ? "text-[#FFD700]" : "text-[#0052FF]"}`}>
                                            {entry.score}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                let url = `https://wallet.coinbase.com/profile/${entry.address}`;
                                                if (entry.name.startsWith('@')) {
                                                    url = `https://warpcast.com/${entry.name.slice(1)}`;
                                                } else if (entry.name.endsWith('.eth')) {
                                                    url = `https://wallet.coinbase.com/profile/${entry.name}`;
                                                }
                                                window.open(url, '_blank');
                                            }}
                                            className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/20 text-zinc-500 hover:text-white rounded transition-all text-[10px]"
                                            title="View Base Profile"
                                        >
                                            ↗
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
