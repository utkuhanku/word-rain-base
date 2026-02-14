import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'mock_db.json');

export function getMockLeaderboard() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            return [];
        }
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Mock DB Read Failed", e);
        return [];
    }
}

export function updateMockLeaderboard(entry: { wallet: string, score: number, fid?: number, streak?: number, revivesUsed?: number }) {
    try {
        let current = getMockLeaderboard();

        const memberKey = entry.fid ? `fid:${entry.fid}` : `wallet:${entry.wallet}`;
        const existingIndex = current.findIndex((e: any) => e.member === memberKey);

        const newEntry = {
            rank: 0,
            score: entry.score,
            member: memberKey,
            type: entry.fid ? 'fid' : 'wallet',
            identifier: entry.fid ? entry.fid.toString() : entry.wallet,
            displayName: entry.fid ? `Farcaster User #${entry.fid}` : `${entry.wallet.slice(0, 6)}...${entry.wallet.slice(-4)}`,
            streak: entry.streak || 0,
            revivesUsed: entry.revivesUsed || 0,
            activeSince: new Date().toISOString() // Mock value for now
        };

        if (existingIndex > -1) {
            // Keep stats even if score isn't beaten, but update if beaten
            if (entry.score > current[existingIndex].score) {
                current[existingIndex] = { ...current[existingIndex], ...newEntry };
            } else {
                // Update streak anyway
                const existing = current[existingIndex];
                current[existingIndex] = {
                    ...existing,
                    streak: entry.streak || existing.streak,
                    revivesUsed: entry.revivesUsed || existing.revivesUsed
                };
            }
        } else {
            current.push(newEntry);
        }

        fs.writeFileSync(DB_FILE, JSON.stringify(current, null, 2));
    } catch (e) {
        console.error("Mock DB Write Failed", e);
    }
}
