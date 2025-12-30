'use client';

import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '@/lib/game/GameEngine';
import { useGameStore } from '@/lib/store/gameStore';

export default function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);

    // Subscribe to status changes
    const status = useGameStore((state) => state.status);
    const resetGame = useGameStore((state) => state.resetGame);

    // Initialize Engine
    useEffect(() => {
        if (!canvasRef.current) return;

        const engine = new GameEngine(canvasRef.current);
        engineRef.current = engine;

        return () => {
            engine.stop();
        };
    }, []);

    // Handle Game Status Changes
    useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;

        if (status === 'playing' && !engine.isRunning) {
            engine.start();
        } else if (status !== 'playing' && engine.isRunning) {
            engine.stop();
        }
    }, [status]);

    // Handle Input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (status !== 'playing') return;

            // Prevent default behavior for game keys if needed, 
            // but for typing games, usually not needed unless capturing Tab/Space explicitly for mechanics.

            // We only care about A-Z usually, maybe Space.
            if (e.key.length === 1) {
                engineRef.current?.handleInput(e.key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status]);

    // Handle Damage Effects (Shake/Red Flash)
    const lives = useGameStore((state) => state.lives);
    const prevLives = useRef(lives);
    const [isHit, setIsHit] = useState(false);

    useEffect(() => {
        if (lives < prevLives.current) {
            // Lost a life
            setIsHit(true);
            setTimeout(() => setIsHit(false), 400); // 400ms duration
        }
        prevLives.current = lives;
    }, [lives]);

    return (
        <div className={`w-full h-full relative ${isHit ? 'animate-shake' : ''}`}>
            <div className={`absolute inset-0 bg-red-500/20 pointer-events-none transition-opacity duration-100 z-10 ${isHit ? 'opacity-100' : 'opacity-0'}`} />
            <canvas
                ref={canvasRef}
                className="w-full h-full block touch-none select-none relative z-0"
            />
        </div>
    );
}
