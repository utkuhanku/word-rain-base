import lexiconData from '@/data/lexicon.json';

export type LexiconTier = 'common' | 'mid' | 'expert';

interface WordDef {
    text: string;
    weight: number;
}

interface LexiconSchema {
    version: string;
    tiers: {
        common: WordDef[];
        mid: WordDef[];
        expert: WordDef[];
    };
}

const lexicon = lexiconData as LexiconSchema;

export class LexiconManager {
    static getRandomWord(maxTier: LexiconTier = 'common'): string {
        let pool: WordDef[] = [...lexicon.tiers.common];

        if (maxTier === 'mid' || maxTier === 'expert') {
            pool = [...pool, ...lexicon.tiers.mid];
        }
        if (maxTier === 'expert') {
            pool = [...pool, ...lexicon.tiers.expert];
        }

        // Weighted Random Selection
        const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;

        for (const word of pool) {
            if (random < word.weight) {
                return word.text.toUpperCase();
            }
            random -= word.weight;
        }

        return pool[0].text.toUpperCase();
    }
}
