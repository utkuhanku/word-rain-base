import { kv } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, score } = body;

        if (!address || typeof score !== 'number') {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // Redis Sorted Set: specific key for this event
        // ZADD key score member
        // We use 'GT' (Greater Than) implicitly by logic or just overwrite?
        // KV doesn't support 'GT' option in simple SDK easily without specific command options object.
        // But for simplicity, we just add. Rank is determined by score. 
        // We want HIGHEST score. 
        // If we just ZADD, it overwrites the score for that member.
        // We only want to update if new score is higher.

        // 1. Get current score
        const currentScore = await kv.zscore('event_leaderboard_final', address);

        if (currentScore === null || score > currentScore) {
            await kv.zadd('event_leaderboard_final', { score: score, member: address });
            return NextResponse.json({ success: true, updated: true });
        }

        return NextResponse.json({ success: true, updated: false, message: "Score not higher" });

    } catch (error) {
        console.error("Score Submit Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
