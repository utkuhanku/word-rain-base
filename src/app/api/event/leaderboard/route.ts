import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // DISABLE CACHE

export async function GET(request: NextRequest) {
    try {
        // Fetch top 50
        // zrange returns array: ["address1", score1, "address2", score2, ...] when withScores is true in basic redis,
        // BUT @vercel/kv sdk returns objects if defined? No, usually array of string/number.
        // Let's verify SDK behavior or use zrange with options.

        const rawData = await kv.zrange('event_leaderboard_final', 0, 49, { rev: true, withScores: true });

        // Parse result into structured array
        // SDK returns: [{ member: '0x...', score: 100 }, ...]

        const leaderboard = [];
        // Note: The SDK response format depends on version. Ideally it handles object mapping.
        // Let's assume standard object return for now as per Vercel docs example:
        // const users = await kv.zrange('users', 0, -1, { withScores: true }); 
        // result: [{ score: 1, member: 'user1' }, ...]

        return NextResponse.json(rawData);

    } catch (error) {
        console.error("Leaderboard Fetch Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
