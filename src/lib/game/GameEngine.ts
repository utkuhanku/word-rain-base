import { LexiconManager, LexiconTier } from "./Lexicon";
import { WordEntity } from "./Entity";
import { GameRenderer } from "./Renderer";
import { useGameStore } from "../store/gameStore";

export class GameEngine {
    canvas: HTMLCanvasElement;
    renderer: GameRenderer;
    entities: WordEntity[] = [];

    // Loop State
    lastTime: number = 0;
    isRunning: boolean = false;
    animationFrameId: number | null = null;

    // Difficulty State
    spawnTimer: number = 0;
    spawnInterval: number = 1500; // Start spawn rate (ms)
    baseSpeed: number = 1.0;
    difficultyTimer: number = 0; // Track time to ramp up

    // Visuals
    activeTypedChain: string = "";

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get 2D context");

        // Handle high DPI
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        this.renderer = new GameRenderer(ctx, rect.width, rect.height);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.entities = [];
        this.spawnTimer = 0;
        this.difficultyTimer = 0;
        this.spawnInterval = 2000;
        this.baseSpeed = 1.0;
        this.activeTypedChain = "";

        useGameStore.getState().resetGame();

        this.loop(performance.now());
    }

    stop() {
        this.isRunning = false;
        this.activeTypedChain = "";
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    loop(time: number) {
        if (!this.isRunning) return;

        const dt = time - this.lastTime;
        this.lastTime = time;

        this.update(dt);
        this.renderer.draw(this.entities, this.activeTypedChain);

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    update(dt: number) {
        // 1. Difficulty Ramp
        this.difficultyTimer += dt;
        if (this.difficultyTimer > 10000) { // Every 10s
            this.spawnInterval = Math.max(500, this.spawnInterval - 100);
            this.baseSpeed += 0.2;
            this.difficultyTimer = 0;
        }

        // 2. Spawning
        this.spawnTimer += dt;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnWord();
            this.spawnTimer = 0;
        }

        // 3. Move Entities & Check Life
        const height = this.canvas.height / (window.devicePixelRatio || 1); // Logical height

        // Iterate backwards to safely remove
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            entity.update(dt);

            // Hit Floor logic
            if (entity.y > height + 20) {
                this.handleLifeLost(entity);
                this.entities.splice(i, 1);
            }
        }
    }

    spawnWord() {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const padding = 50;
        const x = Math.random() * (width - padding * 2) + padding;

        // Determine Tier based on score or time? Simple logic for now.
        const score = useGameStore.getState().score;
        let tier: LexiconTier = 'common';
        if (score > 20) tier = 'mid';
        if (score > 50) tier = 'expert';

        const text = LexiconManager.getRandomWord(tier);
        const word = new WordEntity(text, x, this.baseSpeed);
        this.entities.push(word);
    }

    handleLifeLost(entity: WordEntity) {
        useGameStore.getState().loseLife();
        // Screen shake or effect could be triggered here via store or event
        const lives = useGameStore.getState().lives;
        if (lives <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        this.stop();
        useGameStore.getState().setStatus('game_over');
    }

    // Input Handling
    handleInput(char: string) {
        if (!this.isRunning) return;

        char = char.toUpperCase();

        // Strategy: Find candidates that match the input char at their current index
        // Prioritize: 
        // 1. Words already partially matched (sticky focus)
        // 2. Lowest Y (closest to danger)

        // Filter entities that CAN match this char
        const candidates = this.entities.filter(e => {
            return e.text[e.matchedIndex] === char;
        });

        if (candidates.length === 0) {
            return;
        }

        // Sort candidates
        candidates.sort((a, b) => {
            if (a.matchedIndex > 0 && b.matchedIndex === 0) return -1;
            if (b.matchedIndex > 0 && a.matchedIndex === 0) return 1;
            return b.y - a.y; // Closest to bottom first
        });

        const target = candidates[0];
        target.matchChar(char);

        // UPDATE VISUALS
        this.activeTypedChain = target.text.substring(0, target.matchedIndex);

        if (target.isFullyMatched()) {
            // Destroy word
            this.entities = this.entities.filter(e => e.id !== target.id);
            useGameStore.getState().addScore(1);
            this.activeTypedChain = "";
        }
    }
}
