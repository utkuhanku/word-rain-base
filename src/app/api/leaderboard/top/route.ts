import { kv } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';



const LEADERBOARD_KEY = process.env.LEADERBOARD_KEY || 'wordrain:lb:ethdenver';
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

        const { hasUrl, hasToken } = await import('@/lib/database').then(m => m.hasKvRequestConfig());

        if (!hasUrl || !hasToken) {
            console.warn("KV MISSING: Returning MOCK Leaderboard (Memory)");
            const { getMockLeaderboard } = await import('@/lib/mock');
            const data = getMockLeaderboard()
                .sort((a: any, b: any) => b.score - a.score)
                .map((item: any, index: number) => ({ ...item, rank: index + 1 }))
                .slice(0, 50);
            return NextResponse.json(data);
        }

        // Fetch Top Scores
        // zrevrange returns [member1, score1, member2, score2...]
        const rawData = await kv.zrange(LEADERBOARD_KEY, 0, limit - 1, { rev: true, withScores: true });

        if (!rawData || rawData.length === 0) {
            return NextResponse.json([]);
        }

        const entries: any[] = [];
        const fidsToEnrich: number[] = [];
        const walletsToEnrich: string[] = [];

        // Prepare Metadata Fetch Pipeline
        const pipeline = kv.pipeline();
        const members: string[] = [];

        // Parse ZRange Result
        for (let i = 0; i < rawData.length; i += 2) {
            const member = rawData[i] as string;
            const score = Number(rawData[i + 1]);

            members.push(member);
            pipeline.hgetall(`wordrain:lb:ethdenver:meta:${member}`);

            let identifier = member;
            let type = 'wallet';

            if (member.startsWith('fid:')) {
                type = 'fid';
                const fid = parseInt(member.split(':')[1]);
                fidsToEnrich.push(fid);
                identifier = fid.toString();
            } else if (member.startsWith('wallet:')) {
                type = 'wallet';
                const w = member.split(':')[1];
                walletsToEnrich.push(w);
                identifier = w;
            } else {
                // Legacy
                if (member.startsWith('0x')) {
                    walletsToEnrich.push(member);
                    identifier = member;
                }
            }

            entries.push({
                rank: (i / 2) + 1,
                score,
                member,
                type,
                identifier
            });
        }

        // Execute Pipeline for Metadata
        const metadataResults = await pipeline.exec(); // returns array of objects inside array

        // Merge Metadata
        entries.forEach((e, i) => {
            const meta = metadataResults[i] as any; // e.g. { streak: 5, lastActive: '...' }
            if (meta) {
                e.streak = meta.streak ? parseInt(meta.streak) : 0;
                e.lastActive = meta.lastActive;
                e.platform = meta.platform;
            }
        });

        // Neynar Enrichment (Optional)
        // We will fetch enrichments and merge them.
        // Doing this in one pass if possible.
        // User requested: "Enrich leaderboard entries by fid"

        let enrichmentMap: Record<string, any> = {};

        if (NEYNAR_API_KEY && fidsToEnrich.length > 0) {
            try {
                const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fidsToEnrich.join(',')}`;
                const res = await fetch(url, {
                    headers: { 'accept': 'application/json', 'api_key': NEYNAR_API_KEY }
                });

                if (res.ok) {
                    const data = await res.json();
                    // data.users is array
                    if (data.users) {
                        data.users.forEach((u: any) => {
                            enrichmentMap[`fid:${u.fid}`] = {
                                username: u.username,
                                pfp_url: u.pfp_url,
                                display_name: u.display_name,
                                power_badge: u.power_badge,
                                active_status: u.active_status
                            };
                        });
                    }
                }
            } catch (e) {
                console.warn("Neynar enrichment failed for fids", e);
            }
        }

        // Enrich Wallets
        if (NEYNAR_API_KEY && walletsToEnrich.length > 0) {
            try {
                const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${walletsToEnrich.join(',')}`;
                const res = await fetch(url, {
                    headers: { 'accept': 'application/json', 'api_key': NEYNAR_API_KEY }
                });

                if (res.ok) {
                    const data = await res.json();
                    // Neynar returns { [address]: [User objects] }
                    Object.keys(data).forEach(addrKey => {
                        const users = data[addrKey];
                        if (Array.isArray(users) && users.length > 0) {
                            const u = users[0]; // Use first/main profile
                            const originalWallet = walletsToEnrich.find(w => w.toLowerCase() === addrKey.toLowerCase());
                            const enrichedData = {
                                username: u.username,
                                pfp_url: u.pfp_url,
                                display_name: u.display_name,
                                power_badge: u.power_badge,
                                active_status: u.active_status
                            };

                            if (originalWallet) {
                                enrichmentMap[`wallet:${originalWallet}`] = enrichedData;
                                // Also support direct 0x lookups if member key was just address
                                enrichmentMap[originalWallet] = enrichedData;
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn("Neynar enrichment failed for wallets", e);
            }
        }

        // Final Merge
        const normalized = entries.map(e => {
            const enrichment = enrichmentMap[e.member] || {};

            // Basic Wallet Formatting if no enrichment
            let display = e.identifier;
            if (e.type === 'wallet' && e.identifier.length > 10) {
                display = `${e.identifier.slice(0, 6)}...${e.identifier.slice(-4)}`;
            }

            return {
                ...e,
                ...enrichment, // Adds username, pfp_url if found
                displayName: enrichment.display_name || enrichment.username || display
            };
        });

        return NextResponse.json(normalized);

    } catch (error) {
        console.error("Leaderboard Fetch Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
