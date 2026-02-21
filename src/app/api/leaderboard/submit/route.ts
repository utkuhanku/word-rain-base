import { kv } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';



const LEADERBOARD_KEY = process.env.LEADERBOARD_KEY || 'wordrain:lb:ethdenver';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { score, wallet, fid, streak, revivesUsed, partition, seasonId } = body;

        // Validation
        if (!wallet || typeof score !== 'number') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        if (score < 0 || score > 50000) { // Sanity check
            return NextResponse.json({ error: 'Invalid score range' }, { status: 400 });
        }

        const { hasUrl, hasToken } = await import('@/lib/database').then(m => m.hasKvRequestConfig());

        if (!hasUrl || !hasToken) {
            console.warn("KV MISSING: Simulating Score Submit (Mock Memory)");
            const { updateMockLeaderboard } = await import('@/lib/mock');
            updateMockLeaderboard({ wallet, score, fid, streak, revivesUsed });
            return NextResponse.json({ success: true, updated: true, mock: true });
        }

        // Rate Limiting (Basic 5s cooldown per wallet)
        const RATE_LIMIT_KEY = `ratelimit:submit:${wallet}`;
        const isRateLimited = await kv.get(RATE_LIMIT_KEY);
        if (isRateLimited) {
            return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        }
        await kv.set(RATE_LIMIT_KEY, '1', { ex: 5 });

        // Identifier Logic: Prefer FID, fallback to Wallet
        // We actually want the member in the sorted set to be consistent.
        // User said: "Member format: fid:<fid> if available else wallet:<address>"

        let member = `wallet:${wallet}`;
        if (fid) {
            member = `fid:${fid}`;
        }

        // METADATA STORAGE (Hash)
        const META_KEY = `wordrain:lb:ethdenver:meta:${member}`;
        // We always update metadata like streak or lastActive if present

        const metadata: Record<string, any> = {
            lastActive: new Date().toISOString(),
            platform: 'base'
        };
        if (streak !== undefined) metadata.streak = streak;
        if (revivesUsed !== undefined) metadata.revivesUsed = revivesUsed;

        await kv.hset(META_KEY, metadata);

        // Determine DB Key
        let targetKey = process.env.LEADERBOARD_KEY || 'wordrain:lb:ethdenver';
        if (partition === 'ethdenver') {
            targetKey = 'event_leaderboard_ethdenver';
        } else if (partition === 'season' && seasonId) {
            targetKey = seasonId === 1 ? 'event_leaderboard_final' : `event_leaderboard_s${seasonId}`;
        }

        // Check Existing Score
        const currentScore = await kv.zscore(targetKey, member);

        if (currentScore === null || score > currentScore) {
            await kv.zadd(targetKey, { score, member });
            // Store Metadata (optional, strictly speaking ZSET only stores score/member, 
            // but we might want to store extra data in a hash if we needed it. 
            // For now, sticking to the plan: ZSET only)
            return NextResponse.json({ success: true, updated: true });
        }

        return NextResponse.json({ success: true, updated: false, message: 'High score not beaten' });

    } catch (error) {
        console.error("Leaderboard Submit Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
