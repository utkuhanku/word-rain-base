import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 0; // DISABLE CACHE

export async function GET(request: NextRequest) {
    try {
        // 1. Env Var Check (Prevent Crash)
        if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
            console.error("MISSING KV ENV VARS");
            // Fail Gracefully: Return empty array so client stays "ONLINE"
            // The client-side fail-safe will then inject the local user.
            return NextResponse.json([]);
        }

        const rawData = await kv.zrange('event_leaderboard_final', 0, 49, { rev: true, withScores: true });
        return NextResponse.json(rawData);

    } catch (error) {
        console.error("Leaderboard Fetch Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
