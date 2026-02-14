import { create } from 'zustand';

export type GameStatus = 'idle' | 'playing' | 'game_over';

interface GameState {
    status: GameStatus;
    score: number;
    lives: number;
    bestScore: number;
    crystals: number;
    mode: 'CLASSIC' | 'PVP' | 'EVENT';
    pvpGameId: string | null;
    hasUsedRetry: boolean;
    revivesUsed: number;

    // Actionsr leaderboard metadata

    startGame: (mode?: 'CLASSIC' | 'PVP' | 'EVENT') => void;
    endGame: () => void;
    addScore: (points: number) => void;
    loseLife: () => void;
    addCrystal: (amount: number) => void;
    setMode: (mode: 'CLASSIC' | 'PVP' | 'EVENT') => void;
    resetGame: () => void;
    reviveGame: () => void;
    useRevive: () => void;
    setBestScore: (score: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
    status: 'idle',
    score: 0,
    lives: 3,
    bestScore: 0,
    crystals: 0,
    mode: 'CLASSIC',
    pvpGameId: null,
    hasUsedRetry: false,
    revivesUsed: 0,

    startGame: (mode) => set((state) => ({
        status: 'playing',
        score: 0,
        lives: 3,
        crystals: 0,
        mode: mode || state.mode || 'CLASSIC', // Preserve mode if active
        revivesUsed: 0,
        hasUsedRetry: false,
        isGameOver: false
    })),

    endGame: () => set({ status: 'game_over' }),

    addScore: (points) => set((state) => ({ score: state.score + points })),

    loseLife: () => set((state) => {
        const newLives = state.lives - 1;
        if (newLives <= 0) {
            return { lives: 0, status: 'game_over' };
        }
        return { lives: newLives };
    }),

    addCrystal: (amount) => set((state) => ({ crystals: state.crystals + amount })),

    setMode: (mode) => set({ mode }),

    setBestScore: (score) => set({ bestScore: score }),

    resetGame: () => set({
        status: 'idle',
        score: 0,
        lives: 3,
        crystals: 0,
        revivesUsed: 0,
        hasUsedRetry: false,
        pvpGameId: null,
    }),

    reviveGame: () => set({ status: 'playing', lives: 1 }),

    useRevive: () => set((state) => ({
        lives: 1,
        status: 'playing',
        revivesUsed: state.revivesUsed + 1
    }))
}));
