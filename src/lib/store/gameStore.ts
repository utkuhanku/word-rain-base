import { create } from 'zustand';

export type GameStatus = 'idle' | 'playing' | 'game_over';

interface GameState {
    status: GameStatus;
    score: number;
    lives: number;
    bestScore: number;
    mode: 'CLASSIC' | 'PVP' | 'EVENT';
    pvpGameId: string | null;
    hasUsedRetry: boolean;

    // Actions
    setMode: (mode: 'CLASSIC' | 'PVP' | 'EVENT') => void;
    setStatus: (status: GameStatus) => void;
    setScore: (score: number) => void;
    setPvPGameId: (id: string | null) => void;
    setHasUsedRetry: (used: boolean) => void;
    // Increment score by delta
    addScore: (delta: number) => void;
    setLives: (lives: number) => void;
    loseLife: () => void;
    resetGame: () => void;
    reviveGame: () => void;
    setBestScore: (score: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
    status: 'idle',
    mode: 'CLASSIC',
    score: 0,
    lives: 3,
    bestScore: 0,

    setMode: (mode) => set({ mode }),
    setStatus: (status) => set({ status }),
    setScore: (score) => set({ score }),
    addScore: (delta) => set((state) => ({ score: state.score + delta })),
    setLives: (lives) => set({ lives }),
    loseLife: () => set((state) => ({ lives: Math.max(0, state.lives - 1) })),
    resetGame: () => set({ status: 'playing', score: 0, lives: 3 }),
    reviveGame: () => set({ status: 'playing', lives: 1 }),
    setBestScore: (score) => set({ bestScore: score }),
    pvpGameId: null,
    setPvPGameId: (id) => set({ pvpGameId: id, hasUsedRetry: false }),
    hasUsedRetry: false,
    setHasUsedRetry: (used) => set({ hasUsedRetry: used }),
}));
