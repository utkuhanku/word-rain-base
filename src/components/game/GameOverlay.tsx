'use client';

import { useGameStore } from '@/lib/store/gameStore';
import { useScoreBoard } from '@/lib/hooks/useScoreBoard';
import { useAccount } from 'wagmi';

export default function GameOverlay() {
    const status = useGameStore((state) => state.status);
    const score = useGameStore((state) => state.score);
    const resetGame = useGameStore((state) => state.resetGame);

    const { isConnected } = useAccount();
    const { submitScore } = useScoreBoard();

    const shareScore = () => {
        const text = `I just survived the storm with a score of ${score} in Word Rain 🌧️\n\nCan you stay dry?`;
        const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=https://word-rain.base.org`;
        window.open(url, '_blank');
    };

    if (status === 'playing') return null;

    return (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">

            {status === 'idle' && (
                <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
                    <button
                        onClick={resetGame}
                        className="group relative px-10 py-5 bg-white text-black font-black text-2xl tracking-tighter hover:scale-105 transition-transform"
                    >
                        START RUN
                        <div className="absolute inset-0 bg-[#0052FF] mix-blend-difference opacity-0 group-hover:opacity-20 transition-opacity" />
                    </button>
                    <div className="space-y-1">
                        <p className="text-zinc-500 text-xs font-mono tracking-widest">PRESS ANY KEY</p>
                    </div>
                </div>
            )}

            {status === 'game_over' && (
                <div className="text-center space-y-8 animate-in fade-in zoom-in duration-300 flex flex-col items-center max-w-sm w-full px-6">
                    <div className="space-y-2">
                        <h2 className="text-white font-medium text-4xl tracking-tight">Run Complete</h2>
                        <p className="text-zinc-500 font-mono text-sm tracking-wide">FINAL SCORE: <span className="text-white font-bold">{score}</span></p>
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                        {/* Primary Action: Retry */}
                        <button
                            onClick={resetGame}
                            className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-bold tracking-tight text-sm uppercase transition-colors"
                        >
                            Start New Run
                        </button>

                        {/* Secondary: Share */}
                        {score > 0 && (
                            <button
                                onClick={shareScore}
                                className="w-full py-4 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white font-medium tracking-tight text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                Share on Warpcast
                            </button>
                        )}

                        {/* Tertiary: Onchain */}
                        {isConnected && score > 0 && (
                            <button
                                onClick={() => submitScore(score)}
                                className="text-xs text-[#0052FF] hover:text-blue-400 font-mono underline underline-offset-4 mt-2"
                            >
                                Submit Logic Score (Onchain)
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
