import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    // Base App "Add" flow sends a notification token here.
    // We must return 200 OK to confirm registration.
    // For now, we just log it and accept access.
    try {
        const body = await req.json();
        console.log("Base App Webhook Received:", body);

        // We can store the notification token 'body.token' in a DB later.
        // Return standard success response.
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (e) {
        console.error("Webhook Error:", e);
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
}

export async function GET() {
    return NextResponse.json({ status: "Webhook Active" });
}
