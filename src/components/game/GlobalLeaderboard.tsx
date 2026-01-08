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
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Main Container */}
            <div className="w-full max-w-md h-[85vh] flex flex-col border border-white/10 bg-[#050505] relative overflow-hidden shadow-[0_0_50px_rgba(0,82,255,0.1)]">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-[#0052FF] opacity-50" />
                <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-[#0052FF] opacity-50" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 pointer-events-none" /> {/* Assuming grid pattern or fallback */}

                {/* Header */}
                <div className="p-8 border-b border-white/10 flex justify-between items-start bg-gradient-to-r from-[#0052FF]/10 to-transparent">
                    <div>
                        <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase transform -skew-x-10">
                            GLOBAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0052FF] to-cyan-400">ELITE</span>
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="w-2 h-2 bg-[#0052FF] animate-pulse rounded-full" />
                            <p className="text-zinc-500 text-[10px] font-mono tracking-[0.2em] uppercase">VERIFIED SYNDICATE</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center border border-white/10 hover:bg-white/10 text-zinc-500 hover:text-white transition-all uppercase font-mono text-xs"
                    >
                        [X]
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide relative z-10">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <div className="w-12 h-12 border-4 border-[#0052FF] border-t-transparent rounded-full animate-spin" />
                            <div className="text-zinc-500 font-mono text-xs tracking-[0.3em] animate-pulse">
                                SCANNING BLOCKCHAIN...
                            </div>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                            <h3 className="text-white font-mono text-xl mb-2">NO RECORDS</h3>
                            <p className="text-zinc-600 text-xs tracking-widest uppercase">Be the first to etch your name.</p>
                        </div>
                    ) : (
                        leaderboard.map((entry, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="group relative flex justify-between items-center p-4 mb-2 overflow-hidden"
                            >
                                {/* Item Background */}
                                <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors skew-x-[-10deg]" />
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0052FF/50] group-hover:bg-[#0052FF] transition-colors" />

                                <span className="relative z-10 font-mono text-sm text-zinc-300 flex items-center gap-4">
                                    <span className="text-xs font-bold text-[#0052FF] opacity-50 w-6">{(i + 1).toString().padStart(2, '0')}</span>
                                    <span className="tracking-wider group-hover:text-white transition-colors">{entry.name}</span>
                                </span>
                                <div className="relative z-10 flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest">SCORE</span>
                                    <span className="font-mono text-lg text-[#0052FF] font-black italic">{entry.score}</span>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-black/40 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-repeat opacity-5" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'6\' height=\'6\' viewBox=\'0 0 6 6\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23FFFFFF\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Cpath d=\'M5 0h1v1H5V0zM0 5h1v1H0V5z\'/%3E%3C/g%3E%3C/svg%3E")' }}></div>
                    <p className="text-[10px] text-zinc-600 font-mono tracking-[0.3em] uppercase animate-pulse">
                        LIVE BASE MAINET CONNECTION /// VERIFIED
                    </p>
                </div>
            </div>
        </div>
    );
}
