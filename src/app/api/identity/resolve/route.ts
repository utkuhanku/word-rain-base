import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { addresses } = body;

        // Mock Response if no API Key (Local Dev)
        if (!NEYNAR_API_KEY) {
            const mockData: Record<string, any> = {};
            if (Array.isArray(addresses)) {
                addresses.forEach((addr: string) => {
                    mockData[addr.toLowerCase()] = {
                        fid: 123,
                        username: 'mock_user',
                        display_name: 'Mock User',
                        pfp_url: 'https://wrpcd.net/cdn-cgi/image/fit=contain,f=auto,w=144/https%3A%2F%2Fwrapt.s3.amazonaws.com%2Ff6da734f-0158-4560-9114-699709287c95%2F1710344463372.png',
                    };
                });
            }
            return NextResponse.json(mockData);
        }

        if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
            return NextResponse.json({ error: 'Invalid addresses' }, { status: 400 });
        }

        // Neynar API: Fetch Users by Address
        // https://docs.neynar.com/reference/user-bulk-by-address
        const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addresses.join(',')}`;

        const res = await fetch(url, {
            headers: {
                'accept': 'application/json',
                'api_key': NEYNAR_API_KEY
            }
        });

        if (!res.ok) {
            console.error("Neynar API Error", res.status, await res.text());
            return NextResponse.json({ error: 'Neynar API Failed' }, { status: 502 });
        }

        const data = await res.json();

        const responseMap: Record<string, any> = {};

        // Neynar returns { [address]: [User objects] }
        Object.keys(data).forEach(key => {
            const users = data[key];
            if (Array.isArray(users) && users.length > 0) {
                // Use the first user (usually the main one)
                const user = users[0];
                responseMap[key.toLowerCase()] = {
                    fid: user.fid,
                    username: user.username,
                    display_name: user.display_name,
                    pfp_url: user.pfp_url,
                    verifications: user.verifications,
                    badges: {
                        active: user.active_status === 'active',
                        power_badge: user.power_badge
                    }
                };
            }
        });

        return NextResponse.json(responseMap);

    } catch (error) {
        console.error("Identity Resolve Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
