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
                        leaderboard.map((entry, i) => (
                            <div
                                key={i}
                                className="group flex justify-between items-center p-4 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/5 transition-all duration-300"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-mono text-zinc-600 group-hover:text-zinc-400 w-6">{(i + 1).toString().padStart(2, '0')}</span>
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 overflow-hidden shrink-0">
                                            {entry.avatar ? (
                                                <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-[#0052FF]/20 to-zinc-900 flex items-center justify-center text-[10px] text-zinc-500 font-mono">
                                                    {entry.name.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm text-zinc-300 font-mono tracking-wide group-hover:text-white group-hover:translate-x-1 transition-all">{entry.name}</span>
                                        </div>
                                    </div>
                                </div>
                                <span className="font-mono text-sm text-[#0052FF] font-bold opacity-80 group-hover:opacity-100 shadow-[0_0_15px_rgba(0,82,255,0)] group-hover:shadow-[0_0_15px_rgba(0,82,255,0.4)] transition-all">
                                    {entry.score}
                                </span>
                            </div>
                        ))
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
