export class WordEntity {
    id: string;
    text: string; // The full word, e.g. "BASE"
    x: number;
    y: number;
    speed: number;

    // Logic
    matchedIndex: number = 0; // How many chars have been correctly typed?
    isDead: boolean = false; // remove flag

    // Style
    color: string = '#FFFFFF';

    constructor(text: string, x: number, speed: number) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.text = text;
        this.x = x;
        this.y = -50; // Start slightly above screen
        this.speed = speed;
    }

    update(dt: number) {
        this.y += this.speed * (dt / 16); // Normalise to roughly 60fps
    }

    matchChar(char: string): boolean {
        // Look at the character at the current matchedIndex
        const targetChar = this.text[this.matchedIndex];
        if (char === targetChar) {
            this.matchedIndex++;
            return true;
        }
        return false;
    }

    isFullyMatched(): boolean {
        return this.matchedIndex >= this.text.length;
    }

    getRemainingText(): string {
        return this.text.substring(this.matchedIndex);
    }
}
