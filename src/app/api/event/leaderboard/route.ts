import { kv, hasKvRequestConfig } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSeason } from '@/lib/season';

export const runtime = 'edge';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const currentSeason = getCurrentSeason();

        let seasonId = currentSeason.id;
        const requestedSeason = searchParams.get('season');
        if (requestedSeason) {
            const parsed = parseInt(requestedSeason);
            if (!isNaN(parsed) && parsed > 0) seasonId = parsed;
        }

        const DB_KEY = seasonId === 1 ? 'event_leaderboard_final' : `event_leaderboard_s${seasonId}`;

        // DIAGNOSTIC CHECK
        const config = hasKvRequestConfig();

        if (!config.hasUrl || !config.hasToken) {
            console.error("KV ERROR: Missing Env Vars");
            return NextResponse.json({
                error: 'MISSING_ENV',
                details: config
            }, { status: 503 }); // Service Unavailable
        }

        const rawData = await kv.zrange(DB_KEY, 0, 49, { rev: true, withScores: true });
        return NextResponse.json(rawData);
    } catch (error: any) {
        console.error("KV Read Error:", error);
        return NextResponse.json({
            error: 'KV_CONNECTION_FAILED',
            message: error.message
        }, { status: 500 });
    }
}
