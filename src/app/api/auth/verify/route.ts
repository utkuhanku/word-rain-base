import { createClient, Errors } from '@farcaster/quick-auth';
import { NextRequest, NextResponse } from 'next/server';

// Domain must match your mini app's deployment domain (vercel.app)
// We should use an environment variable or hardcode it for now if focused on this deployment.
const domain = 'word-rain-base.vercel.app';

const client = createClient();

export async function GET(request: NextRequest) {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorization.split(' ')[1];

    try {
        const payload = await client.verifyJwt({ token, domain });
        // payload.sub is the FID
        return NextResponse.json({ fid: payload.sub });
    } catch (e) {
        if (e instanceof Errors.InvalidTokenError) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        console.error("Auth Error:", e);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}
