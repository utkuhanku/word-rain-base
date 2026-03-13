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

    // Zoom Exploit Prevention State
    const [zoomWarning, setZoomWarning] = useState(false);
    const initialDpr = useRef(1);
    const initialScale = useRef(1);

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

        if (status === 'playing') {
            // Capture baselines at the exact moment the game starts
            if (typeof window !== 'undefined') {
                initialDpr.current = window.devicePixelRatio || 1;
                initialScale.current = window.visualViewport?.scale || 1;
            }

            if (!engine.isRunning && !zoomWarning) {
                engine.start();
            }
        } else if (engine.isRunning) {
            engine.stop();
        }
    }, [status, zoomWarning]);

    // Handle Input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (status !== 'playing') return;

            // Prevent duplicate input from Virtual Keyboard
            // If the event comes from our hidden input, let onChange handle it
            if (e.target === inputRef.current) return;

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

    // Mobile Virtual Keyboard Handling
    const inputRef = useRef<HTMLInputElement>(null);

    const refocusInput = () => {
        if (status === 'playing' && inputRef.current) {
            inputRef.current.focus();
        }
    };

    // Keep focus for mobile typing
    useEffect(() => {
        if (status === 'playing') {
            refocusInput();
            const interval = setInterval(refocusInput, 1000); // Ensure focus stays
            return () => clearInterval(interval);
        }
    }, [status]);

    // Handle Resize (Mobile Keyboard reliability and Zoom Exploit)
    useEffect(() => {
        const handleResize = () => {
            if (typeof window === 'undefined') return;

            // --- ANTI-CHEAT ZOOM DETECTION ---
            const currentDpr = window.devicePixelRatio || 1;
            const currentScale = window.visualViewport?.scale || 1;

            // If DPR drops or visual scale drops, the user is zooming out to see more of the canvas.
            // On desktop, Cmd/Ctrl + '-' directly reduces devicePixelRatio.
            const isZoomedOut = currentDpr < initialDpr.current || currentScale < initialScale.current;

            if (isZoomedOut) {
                setZoomWarning(true);
                if (engineRef.current?.isRunning) {
                    engineRef.current.stop();
                }
            } else {
                setZoomWarning(false);
                // Safe to resume securely without cheating
                if (useGameStore.getState().status === 'playing' && engineRef.current && !engineRef.current.isRunning) {
                    engineRef.current.resume();
                }
            }

            // --- ENGINE RESIZE ---
            // Use visualViewport if available for accurate keyboard height
            if (window.visualViewport && canvasRef.current && engineRef.current) {
                engineRef.current.resize();
            } else {
                engineRef.current?.resize();
            }
        };

        window.addEventListener('resize', handleResize);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
            }
        };
    }, []);

    const handleMobileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const char = e.target.value.slice(-1); // Get last char
        if (char && engineRef.current) {
            engineRef.current.handleInput(char);
        }
        // Reset to keep input clean but maintain focus context
        e.target.value = '';
    };

    return (
        <div
            className={`w-full h-full relative overflow-hidden bg-black ${isHit ? 'animate-shake' : ''}`}
            onClick={refocusInput} // Tap anywhere to bring up keyboard
        >
            <div className={`absolute inset-0 bg-red-500/20 pointer-events-none transition-opacity duration-100 z-10 ${isHit ? 'opacity-100' : 'opacity-0'}`} />

            {/* ANTI-CHEAT OVERLAY */}
            <div className={`absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center transition-opacity duration-300 ${zoomWarning ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                    <span className="text-3xl animate-pulse">⚙️</span>
                </div>
                <h2 className="text-2xl font-bold font-space text-white mb-2 uppercase tracking-widest text-red-500">System Override</h2>
                <p className="text-zinc-400 max-w-sm mb-6 font-mono text-sm leading-relaxed">
                    Viewport manipulation detected. Zooming out dynamically expands the terminal, giving an unfair tactical advantage.
                    <br /><br />
                    Return your browser zoom to <strong className="text-white">100%</strong> to resume operations.
                </p>
            </div>

            {/* Hidden Input Proxy for Mobile Keyboard */}
            <input
                ref={inputRef}
                type="text"
                className="absolute opacity-0 top-0 left-0 h-0 w-0 pointer-events-none md:pointer-events-auto text-[16px]" // 16px prevents iOS zoom
                style={{ fontSize: '16px' }} // Double insurance
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                onChange={handleMobileInput}
                onBlur={() => {
                    // Optional: Visual cue that keyboard is gone?
                }}
            />

            <canvas
                ref={canvasRef}
                className="w-full h-full block touch-none select-none relative z-0"
            />
        </div>
    );
}
