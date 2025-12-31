import GameCanvas from "@/components/game/GameCanvas";
import HUD from "@/components/game/HUD";
import GameOverlay from "@/components/game/GameOverlay";
import TutorialOverlay from "@/components/game/TutorialOverlay";
import GameWallet from "@/components/ui/GameWallet";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 z-50">
        <GameWallet />
      </div>
      <div className="z-10 text-center flex flex-col items-center">
        <div className="mb-12 space-y-2">
          <h1 className="text-4xl font-black tracking-tighter text-white/90">
            Word Rain
          </h1>
          <p className="text-zinc-500 font-mono text-xs tracking-[0.2em] uppercase">
            Base Reflex Instrument v1.1
          </p>
        </div>

        <div className="w-[100vw] h-[100dvh] md:w-[600px] md:h-[800px] md:max-h-[90vh] md:border md:border-white/5 md:rounded-3xl bg-[#050505] relative overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/5">
          <HUD />
          <TutorialOverlay />
          <GameCanvas />
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
