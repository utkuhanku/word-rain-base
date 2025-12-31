import { WordEntity } from "./Entity";

export class GameRenderer {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;

    constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    draw(entities: WordEntity[], activeTypedChain: string = "", activeWrongChar: string | null = null) {
        this.clear();

        // Draw Text
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        for (const entity of entities) {
            this.drawWord(entity);
        }

        // Input Deck (Footer)
        const deckHeight = 100;
        const deckY = this.height - deckHeight;

        // Draw Deck Background
        this.ctx.fillStyle = "#111111"; // Surface color
        this.ctx.fillRect(0, deckY, this.width, deckHeight);

        // Top Border logic
        this.ctx.strokeStyle = "#222222";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, deckY);
        this.ctx.lineTo(this.width, deckY);
        this.ctx.stroke();

        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        // Draw Active Input Centered in Deck
        if (activeTypedChain) {
            const fontSize = 48;
            this.ctx.font = `700 ${fontSize}px Inter, sans-serif`; // Bold Inter

            const cx = this.width / 2;
            const cy = deckY + (deckHeight / 2);

            // Text Shadow (Glow)
            this.ctx.fillStyle = "#FFFFFF";
            this.ctx.shadowColor = "rgba(0, 82, 255, 0.5)";
            this.ctx.shadowBlur = 20;
            this.ctx.fillText(activeTypedChain, cx, cy);
            this.ctx.shadowBlur = 0;

            // Draw Wrong Char (if exists) appended effectively
            if (activeWrongChar) {
                const currentWidth = this.ctx.measureText(activeTypedChain).width;
                const wcX = cx + (currentWidth / 2) + 20; // Offset to right

                this.ctx.fillStyle = "#FF0033"; // Sharp Red
                this.ctx.shadowColor = "#FF0033";
                this.ctx.shadowBlur = 10;
                this.ctx.fillText(activeWrongChar, wcX, cy);
                this.ctx.shadowBlur = 0;
            }
        } else if (activeWrongChar) {
            // Case where no valid chain but wrong char typed (start of word error)
            const cx = this.width / 2;
            const cy = deckY + (deckHeight / 2);
            const fontSize = 48;
            this.ctx.font = `700 ${fontSize}px Inter, sans-serif`;

            this.ctx.fillStyle = "#FF0033";
            this.ctx.fillText(activeWrongChar, cx, cy);
        } else {
            // Placeholder hint
            const fontSize = 14;
            this.ctx.font = `500 ${fontSize}px Inter, sans-serif`;
            this.ctx.fillStyle = "#333333";
            this.ctx.fillText("TYPE TO DESTROY", this.width / 2, deckY + (deckHeight / 2));
        }
    }

    drawWord(entity: WordEntity) {
        const { text, x, y, matchedIndex } = entity;
        this.ctx.font = "bold 24px Inter, sans-serif";

        const fullWidth = this.ctx.measureText(text).width;
        const startX = x - (fullWidth / 2); // Left align starting point

        // 1. Matched Part (Blue)
        const matchedStr = text.substring(0, matchedIndex);
        const matchedWidth = this.ctx.measureText(matchedStr).width;

        // 2. Unmatched Part (White)
        const unmatchedStr = text.substring(matchedIndex);

        // Draw matched
        this.ctx.fillStyle = "#0052FF"; // Base Blue
        this.ctx.shadowColor = "#0052FF";
        this.ctx.shadowBlur = 10;
        this.ctx.fillText(matchedStr, startX + (matchedWidth / 2), y);
        this.ctx.shadowBlur = 0; // Reset shadow

        // Draw unmatched
        this.ctx.fillStyle = "#FFFFFF";

        const unmatchedWidth = this.ctx.measureText(unmatchedStr).width;
        this.ctx.fillText(unmatchedStr, startX + matchedWidth + (unmatchedWidth / 2), y);
    }
}
