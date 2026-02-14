import { kv } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSeason } from '@/lib/season';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, score, streak, partition } = body;

        if (!address || typeof score !== 'number') {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const season = getCurrentSeason();

        let DB_KEY = season.id === 1 ? 'event_leaderboard_final' : `event_leaderboard_s${season.id}`;

        if (partition === 'ethdenver') {
            DB_KEY = 'event_leaderboard_ethdenver';
        }

        const META_KEY = `${DB_KEY}:meta`;

        // 1. Get current score from SPECIFIC season key
        const { hasUrl, hasToken } = await import('@/lib/database').then(m => m.hasKvRequestConfig());

        if (!hasUrl || !hasToken) {
            console.warn("KV MISSING: Simulating Score Submit (Mock Mode)");
            return NextResponse.json({ success: true, updated: true, season: season.id, mock: true });
        }

        const currentScore = await kv.zscore(DB_KEY, address);

        // Update Metadata (Streak) regardless of score improvement if provided
        if (typeof streak === 'number') {
            await kv.hset(META_KEY, { [address]: JSON.stringify({ streak }) });
        }

        if (currentScore === null || score > currentScore) {
            await kv.zadd(DB_KEY, { score: score, member: address });
            return NextResponse.json({ success: true, updated: true, season: season.id });
        }

        return NextResponse.json({ success: true, updated: false, message: "Score not higher", season: season.id });

    } catch (error) {
        console.error("Score Submit Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
