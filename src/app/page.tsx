'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { AnimatePresence, motion } from 'framer-motion';
import GameCanvas from "@/components/game/GameCanvas";
import HUD from "@/components/game/HUD";
import PaygateOverlay from "@/components/game/PaygateOverlay";
import TutorialOverlay from "@/components/game/TutorialOverlay";
import GameWallet from "@/components/ui/GameWallet";
import Lobby from "@/components/game/Lobby";

type AppState = 'lobby' | 'game';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('lobby');
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // Game Actions
  const startGame = useGameStore((state) => state.startGame);

  const handleStartGame = () => {
    setAppState('game');
    setTimeout(() => {
      startGame(); // CORRECT: Sets status: 'playing'
    }, 500); // Wait for transition
  };

  useEffect(() => {
    // Force container scaling for Virtual Keyboard
    const handleResize = () => {
      if (window.visualViewport && window.visualViewport.height > 100) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    // Initial Sync
    handleResize();

    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Sync Game Status with App State to handle "Home" navigation
  const status = useGameStore((state) => state.status);
  useEffect(() => {
    if (status === 'idle' && appState === 'game') {
      setAppState('lobby');
    }
  }, [status, appState]);

  const containerStyle = viewportHeight ? { height: `${viewportHeight}px` } : { height: '100dvh' };

  return (
    <main
      className="flex w-full flex-col items-center justify-center p-2 md:p-4 relative overflow-hidden bg-black selection:bg-blue-500/30 transition-[height] duration-200 ease-out"
      style={containerStyle}
    >
      <AnimatePresence mode="wait">
        {appState === 'lobby' ? (
          <motion.div
            key="lobby"
            className="w-full h-full flex items-center justify-center"
            exit={{ opacity: 0, filter: "blur(20px)", scale: 1.1 }}
            transition={{ duration: 0.8, ease: "circIn" }}
          >
            <Lobby onStart={handleStartGame} />
          </motion.div>
        ) : (
          <motion.div
            key="game"
            className="z-10 flex flex-col items-center flex-1 w-full max-w-md h-full min-h-0 pb-safe"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "circOut" }}
          >
            {/* Header - Compact (Only in Game) */}
            <div className="w-full flex justify-between items-center z-50 px-2 py-2 mb-2">
              <div className="text-left">
                <h1 className="text-lg font-black tracking-tight leading-none text-white/90 font-mono">NEO RAIN</h1>
                <p className="text-[10px] text-[#0052FF] font-mono tracking-widest uppercase">Params: 3.5x</p>
              </div>
              <GameWallet />
            </div>

            {/* Game Container */}
            <div className="w-full flex-1 md:h-[800px] md:flex-none md:max-h-[90vh] md:border md:border-white/10 md:rounded-3xl bg-white/5 backdrop-blur-3xl relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5 flex flex-col">
              <HUD />
              <TutorialOverlay />
              <div className="flex-1 relative w-full h-full min-h-0">
                <GameCanvas />
              </div>
              <PaygateOverlay />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Gradients (Persistent) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0052FF]/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#0052FF]/10 blur-[100px] rounded-full" />
      </div>
    </main>
  );
}
