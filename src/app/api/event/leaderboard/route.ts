import { kv, hasKvRequestConfig } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        // DIAGNOSTIC CHECK
        const config = hasKvRequestConfig();

        if (!config.hasUrl || !config.hasToken) {
            console.error("KV ERROR: Missing Env Vars");
            return NextResponse.json({
                error: 'MISSING_ENV',
                details: config
            }, { status: 503 }); // Service Unavailable
        }

        const rawData = await kv.zrange('event_leaderboard_final', 0, 49, { rev: true, withScores: true });
        return NextResponse.json(rawData);
    } catch (error: any) {
        console.error("KV Read Error:", error);
        return NextResponse.json({
            error: 'KV_CONNECTION_FAILED',
            message: error.message
        }, { status: 500 });
    }
}
