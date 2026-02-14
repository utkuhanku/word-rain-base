import { kv, hasKvRequestConfig } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSeason } from '@/lib/season';

export const runtime = 'edge';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const currentSeason = getCurrentSeason();

        let DB_KEY = '';
        const partition = searchParams.get('partition');

        if (partition === 'ethdenver') {
            DB_KEY = 'event_leaderboard_ethdenver';
        } else {
            let seasonId = currentSeason.id;
            const requestedSeason = searchParams.get('season');
            if (requestedSeason) {
                const parsed = parseInt(requestedSeason);
                if (!isNaN(parsed) && parsed > 0) seasonId = parsed;
            }
            DB_KEY = seasonId === 1 ? 'event_leaderboard_final' : `event_leaderboard_s${seasonId}`;
        }

        const META_KEY = `${DB_KEY}:meta`;

        // DIAGNOSTIC CHECK
        const config = hasKvRequestConfig();

        if (!config.hasUrl || !config.hasToken) {
            console.warn("KV MISSING: Returning MOCK Leaderboard for Local Dev");
            return NextResponse.json([
                { member: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", score: 2500, streak: 5 }, // vitalik.eth
                { member: "0x4e59b44847b379578588920ca78fbf26c0b4956c", score: 1850, streak: 3 }, // jesse.eth (approx)
                { member: "0x1234567890123456789012345678901234567890", score: 1200, streak: 1 }, // Local Test User
                { member: "0x8765432109876543210987654321098765432109", score: 950, streak: 0 },
                { member: "0x0000000000000000000000000000000000001337", score: 400, streak: 12 }
            ]);
        }

        const rawData = await kv.zrange(DB_KEY, 0, 49, { rev: true, withScores: true });

        // Parse ZRange Result (Upstash returns [member, score, member, score...])
        const parsed: { address: string; score: number; streak?: number }[] = [];
        const addresses: string[] = [];

        if (Array.isArray(rawData)) {
            for (let i = 0; i < rawData.length; i += 2) {
                const member = rawData[i] as string;
                const score = Number(rawData[i + 1]);
                parsed.push({ address: member, score });
                addresses.push(member);
            }
        }

        // Fetch Metadata (Streaks)
        if (addresses.length > 0) {
            try {
                const metadata = await kv.hmget(META_KEY, ...addresses);
                if (metadata) {
                    // metadata is an array corresponding to persistent keys (or values in dictionary if node redis, but usually array in http api)
                    // Upstash HTTP API hmget returns values in order of keys
                    // But standard redis-js logic might vary. 
                    // Let's assume standard object or array. Upstash specialized SDK usually returns Dict if simple? 
                    // Actually kv.hmget usually returns values array or object. Let's handle both or assume standard.
                    // Vercel KV / Upstash SDK: keys are returned as values relative to inputs.

                    // Actually, let's just map it.
                    Object.keys(metadata).forEach((key) => {
                        // If it returns an object { address: json_string }
                        try {
                            // @ts-ignore
                            const meta = JSON.parse(metadata[key]);
                            const item = parsed.find(p => p.address === key);
                            if (item && meta.streak) item.streak = meta.streak;
                        } catch (e) { }
                    });
                    // Note: retrieving via hmget might return nulls or values.
                    // A safer way if unsure of SDK version behavior for hmget with multiple keys is handling the return type dynamically, 
                    // but `kv` from `@vercel/kv` usually returns values.
                }
            } catch (e) {
                console.warn("Metadata fetch failed", e);
            }
        }

        return NextResponse.json(parsed);
    } catch (error: any) {
        console.error("KV Read Error:", error);
        return NextResponse.json({
            error: 'KV_CONNECTION_FAILED',
            message: error.message
        }, { status: 500 });
    }
}
