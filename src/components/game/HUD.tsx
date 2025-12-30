'use client';

import { useGameStore } from '@/lib/store/gameStore';

export default function HUD() {
    const score = useGameStore((state) => state.score);
    const lives = useGameStore((state) => state.lives);

    return (
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none z-20">
            {/* Score */}
            <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Score</span>
                <span className="text-2xl font-black font-mono">{score.toString().padStart(3, '0')}</span>
            </div>

            {/* Lives */}
            <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className={`w-3 h-3 rounded-full border border-white/20 ${i < lives ? 'bg-[#0052FF]' : 'bg-transparent'}`}
                    />
                ))}
            </div>
        </div>
    );
}
