import { createClient } from '@vercel/kv';

// UNIVERSAL KV ADAPTER
// Supports both Vercel Native KV (`KV_REST_API_*`) and Upstash Integration (`UPSTASH_REDIS_REST_*`)

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
    console.warn("KV ADAPTER: No KV/Redis credentials found in environment variables.");
}

export const kv = createClient({
    url: url || "https://example.com", // Fallback to prevent crash on init, logic handles missing connection later
    token: token || "example_token"
});

export const hasKvRequestConfig = (): { hasUrl: boolean, hasToken: boolean } => {
    return {
        hasUrl: !!url,
        hasToken: !!token
    };
};
