import { kv } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const normalizedAddress = address.toLowerCase();

  // Dört partition + key kombinastonundan meta çek
  const [m1, m2, m3, m4, omegaScore, ethdenverScore] = await Promise.all([
    kv.hgetall(`wordrain:lb:ethdenver:meta:wallet:${address}`),
    kv.hgetall(`wordrain:lb:ethdenver:meta:${address}`),
    kv.hgetall(`wordrain:lb:omega:meta:wallet:${address}`),
    kv.hgetall(`wordrain:lb:omega:meta:${address}`),
    kv.zscore('event_leaderboard_omega', `wallet:${address}`),
    kv.zscore('event_leaderboard_ethdenver', `wallet:${address}`),
  ]);

  // Metadata birleştir (en sonuncunun önceliği var)
  const meta = { ...(m4 || {}), ...(m3 || {}), ...(m2 || {}), ...(m1 || {}) };

  // Kaç event'e katılmış
  const eventsEntered = [omegaScore, ethdenverScore].filter(s => s !== null).length;

  // web3.bio'dan Farcaster profili çek (cache'li)
  let profile: any = null;
  try {
    const cached = await kv.get(`wordrain:lb:profile:web3bio:${address}`);
    if (cached && !(cached as any).empty) {
      profile = cached;
    } else {
      const bioRes = await fetch(`https://api.web3.bio/profile/${address}`);
      if (bioRes.ok) {
        const bioData = await bioRes.json();
        profile = bioData.find((p: any) => p.platform === 'farcaster') || bioData[0];
        // Sadece valid data varsa kısa süreli cache'e at
        if (profile) {
            await kv.set(`wordrain:lb:profile:web3bio:${address}`, profile, { ex: 3600 }); // 1 hour cache
        }
      }
    }
  } catch {}

  return NextResponse.json({
    address,
    username: profile?.identity ? (profile.platform === 'farcaster' ? `@${profile.identity}` : profile.identity) : null,
    display_name: profile?.displayName || null,
    pfp_url: profile?.avatar || null,
    // Stats
    bestScore: Math.max(omegaScore ? Number(omegaScore) : 0, ethdenverScore ? Number(ethdenverScore) : 0),
    omegaScore: omegaScore ? Number(omegaScore) : null,
    ethdenverScore: ethdenverScore ? Number(ethdenverScore) : null,
    eventsEntered,
    streak: meta.streak ? parseInt(meta.streak as string) : 0,
    revivesUsed: meta.revivesUsed ? parseInt(meta.revivesUsed as string) : 0,
    lastActive: meta.lastActive || null,
    platform: meta.platform || null,
  });
}
