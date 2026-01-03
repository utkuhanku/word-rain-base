'use client';

import { useState, useEffect } from 'react';
import GameCanvas from "@/components/game/GameCanvas";
import HUD from "@/components/game/HUD";
import PaygateOverlay from "@/components/game/PaygateOverlay";
import TutorialOverlay from "@/components/game/TutorialOverlay";
import GameWallet from "@/components/ui/GameWallet";
import IdentityReveal from "@/components/game/IdentityReveal";

export default function Home() {
  const [identityRevealed, setIdentityRevealed] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    // Force container scaling for Virtual Keyboard
    const handleResize = () => {
      if (window.visualViewport) {
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

  const containerStyle = viewportHeight ? { height: `${viewportHeight}px` } : { height: '100dvh' };

  return (
    <main
      className="flex w-full flex-col items-center justify-between p-2 md:p-4 relative overflow-hidden bg-black selection:bg-blue-500/30 transition-[height] duration-200 ease-out"
      style={containerStyle}
    >

      {/* Identity Reveal Animation */}
      {!identityRevealed && <IdentityReveal onComplete={() => setIdentityRevealed(true)} />}

      {/* Header - Compact */}
      <div className={`w-full flex justify-between items-center z-50 px-2 py-2 md:absolute md:top-4 md:right-4 md:block md:w-auto transition-opacity duration-1000 ${identityRevealed ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-left md:hidden">
          <h1 className="text-lg font-black tracking-tight leading-none text-white/90 font-mono">NEO RAIN</h1>
          <p className="text-[10px] text-[#0052FF] font-mono tracking-widest uppercase">Params: 3.5x</p>
        </div>
        <GameWallet />
      </div>

      <div className={`z-10 flex flex-col items-center flex-1 w-full max-w-md h-full min-h-0 pb-safe transition-opacity duration-1000 ${identityRevealed ? 'opacity-100' : 'opacity-0'}`}>

        {/* Desktop Title (Hidden on Mobile) */}
        <div className="hidden md:block mb-8 space-y-2 text-center">
          <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500">
            NEO RAIN
          </h1>
          <p className="text-[#0052FF] font-mono text-xs tracking-[0.4em] uppercase">
            Start Logic / 0.15 USDC
          </p>
        </div>

        {/* Game Container - Glassmorphism */}
        <div className="w-full flex-1 md:h-[800px] md:flex-none md:max-h-[90vh] md:border md:border-white/10 md:rounded-3xl bg-white/5 backdrop-blur-3xl relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5 flex flex-col">
          <HUD />
          <TutorialOverlay />
          <div className="flex-1 relative w-full h-full min-h-0">
            <GameCanvas />
          </div>
          <PaygateOverlay />
        </div>
      </div>

      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0052FF]/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#0052FF]/10 blur-[100px] rounded-full" />
      </div>
    </main>
  );
}
