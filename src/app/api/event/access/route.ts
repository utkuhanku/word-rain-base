import { kv } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const ETHDENVER_ACCESS_KEY = 'wordrain:ethdenver:access';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address')?.toLowerCase();

        if (!address) {
            return NextResponse.json({ hasAccess: false });
        }

        // Check KV for existence
        const hasAccess = await kv.sismember(ETHDENVER_ACCESS_KEY, address);
        return NextResponse.json({ hasAccess: hasAccess === 1 });

    } catch (error) {
        console.error("Access Check Failed:", error);
        return NextResponse.json({ hasAccess: false }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address } = body;

        if (!address) {
            return NextResponse.json({ error: 'Address required' }, { status: 400 });
        }

        const normalizedAddr = address.toLowerCase();

        // Add to Set
        await kv.sadd(ETHDENVER_ACCESS_KEY, normalizedAddr);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Access Grant Failed:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
