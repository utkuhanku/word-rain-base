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
        <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-md h-[80vh] flex flex-col border border-white/10 rounded-2xl bg-[#050505] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">Global Elite</h2>
                        <p className="text-zinc-500 text-[10px] font-mono tracking-widest">VERIFIED PAYERS (0.15 USDC)</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
                    {isLoading ? (
                        <div className="text-center py-10 text-zinc-500 font-mono text-xs animate-pulse">
                            Scanning Blockchain...
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="text-center py-10 text-zinc-500 font-mono text-xs">
                            No elites found yet. Be the first.
                        </div>
                    ) : (
                        leaderboard.map((entry, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-lg hover:border-[#0052FF]/50 transition-colors"
                            >
                                <span className="font-mono text-sm text-zinc-400 flex items-center gap-3">
                                    <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
                                    {entry.name}
                                </span>
                                <span className="font-mono text-sm text-[#0052FF] font-bold">{entry.score}</span>
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-white/5 text-center">
                    <p className="text-[10px] text-zinc-600 font-mono">
                        Validating via Base Mainnet
                    </p>
                </div>
            </div>
        </div>
    );
}
