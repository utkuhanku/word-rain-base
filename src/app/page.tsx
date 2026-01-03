import GameCanvas from "@/components/game/GameCanvas";
import HUD from "@/components/game/HUD";
import GameOverlay from "@/components/game/GameOverlay";
import TutorialOverlay from "@/components/game/TutorialOverlay";
import GameWallet from "@/components/ui/GameWallet";

export default function Home() {
  return (
    <main className="flex h-[100dvh] w-full flex-col items-center justify-between p-2 md:p-4 relative overflow-hidden">

      {/* Header - Compact */}
      <div className="w-full flex justify-between items-center z-50 px-2 py-2 md:absolute md:top-4 md:right-4 md:block md:w-auto">
        <div className="text-left md:hidden">
          <h1 className="text-lg font-black tracking-tight leading-none text-white/90">WORD RAIN</h1>
          <p className="text-[10px] text-zinc-500 font-mono tracking-widest">V1.1</p>
        </div>
        <GameWallet />
      </div>

      <div className="z-10 flex flex-col items-center flex-1 w-full max-w-md h-full min-h-0 pb-safe">

        {/* Desktop Title (Hidden on Mobile) */}
        <div className="hidden md:block mb-8 space-y-2 text-center">
          <h1 className="text-4xl font-black tracking-tighter text-white/90">
            Word Rain
          </h1>
          <p className="text-zinc-500 font-mono text-xs tracking-[0.2em] uppercase">
            Base Reflex Instrument v1.1
          </p>
        </div>

        {/* Game Container - Grows to fill space */}
        <div className="w-full flex-1 md:h-[800px] md:flex-none md:max-h-[90vh] md:border md:border-white/5 md:rounded-3xl bg-[#050505] relative overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/5 flex flex-col">
          <HUD />
          <TutorialOverlay />
          <div className="flex-1 relative w-full h-full min-h-0">
            <GameCanvas />
          </div>
          <GameOverlay />
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
