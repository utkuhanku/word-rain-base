import { kv } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const GET_ACCESS_KEY = (partition?: string) => {
    if (partition === 'cre8core') return 'wordrain:cre8core:access';
    return 'wordrain:omega:access'; // Default
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address')?.toLowerCase();
        const partition = searchParams.get('partition');
        const mode = searchParams.get('mode');

        const key = GET_ACCESS_KEY(partition || undefined);

        if (mode === 'count') {
            const count = await kv.scard(key);
            return NextResponse.json({ count });
        }

        if (!address) {
            return NextResponse.json({ hasAccess: false });
        }

        // Check KV for existence
        const hasAccess = await kv.sismember(key, address);
        return NextResponse.json({ hasAccess: hasAccess === 1 });

    } catch (error) {
        console.error("Access Check Failed:", error);
        return NextResponse.json({ hasAccess: false }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, partition } = body;

        if (!address) {
            return NextResponse.json({ error: 'Address required' }, { status: 400 });
        }

        const normalizedAddr = address.toLowerCase();

        // Add to Set
        await kv.sadd(GET_ACCESS_KEY(partition), normalizedAddr);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Access Grant Failed:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
