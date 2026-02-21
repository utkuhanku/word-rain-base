'use client';

import { motion } from 'framer-motion';

interface HelpModalProps {
    onClose: () => void;
}

export default function HelpModal({ onClose }: HelpModalProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-sm bg-[#0A0A0A] border border-white/10 p-6 shadow-2xl relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Decorative Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:1rem_1rem] pointer-events-none" />

                <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-start">
                        <h2 className="text-2xl font-black text-white italic tracking-tighter">MISSION BRIEF</h2>
                        <button
                            onClick={onClose}
                            className="text-zinc-500 hover:text-white transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="space-y-4 font-mono text-xs text-zinc-400 leading-relaxed">
                        <div className="p-3 bg-white/5 border border-white/5 rounded">
                            <h3 className="text-white font-bold mb-1">OBJECTIVE</h3>
                            <p>Type the falling words before they hit the floor. Speed and accuracy are paramount.</p>
                        </div>

                        <div className="p-3 bg-white/5 border border-white/5 rounded">
                            <h3 className="text-white font-bold mb-1">SCORING</h3>
                            <p>Each character typed = +1 Score.</p>
                            <p>Completing a word = Bonus.</p>
                        </div>

                        <div className="p-3 bg-[#0052FF]/10 border border-[#0052FF]/20 rounded">
                            <h3 className="text-[#0052FF] font-bold mb-1">VERIFICATION</h3>
                            <p>Reach the end to submit your logic score. Only verified agents appear on the Global Elite Leaderboard.</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-colors uppercase tracking-widest"
                    >
                        Acknowledge
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
