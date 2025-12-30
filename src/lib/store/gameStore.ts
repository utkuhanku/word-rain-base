import { create } from 'zustand';

export type GameStatus = 'idle' | 'playing' | 'game_over';

interface GameState {
    status: GameStatus;
    score: number;
    lives: number;
    bestScore: number;

    // Actions
    setStatus: (status: GameStatus) => void;
    setScore: (score: number) => void;
    // Increment score by delta
    addScore: (delta: number) => void;
    setLives: (lives: number) => void;
    loseLife: () => void;
    resetGame: () => void;
    setBestScore: (score: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
    status: 'idle',
    score: 0,
    lives: 3,
    bestScore: 0,

    setStatus: (status) => set({ status }),
    setScore: (score) => set({ score }),
    addScore: (delta) => set((state) => ({ score: state.score + delta })),
    setLives: (lives) => set({ lives }),
    loseLife: () => set((state) => ({ lives: Math.max(0, state.lives - 1) })),
    resetGame: () => set({ status: 'playing', score: 0, lives: 3 }),
    setBestScore: (score) => set({ bestScore: score }),
}));
