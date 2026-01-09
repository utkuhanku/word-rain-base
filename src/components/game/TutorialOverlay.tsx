'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';

export default function TutorialOverlay() {
    const status = useGameStore((state) => state.status);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (status === 'playing') {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 3000);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [status]);

    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div
                className={`text-center space-y-4 px-6 py-4 rounded-xl bg-black/60 backdrop-blur-sm border border-white/5 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
                    }`}
            >
                <h3 className="text-[#0052FF] font-bold text-lg mb-2 tracking-tight">INITIALIZING...</h3>
                <p className="text-zinc-400 font-mono text-xs leading-relaxed tracking-wider">
                    TYPE TO DESTROY
                </p>
            </div>
        </div>
    );
}
