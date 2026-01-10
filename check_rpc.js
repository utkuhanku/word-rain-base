const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

// Robust RPC list
const RPCS = [
    "https://mainnet.base.org",
    "https://1rpc.io/base",
    "https://base.llamarpc.com",
    "https://base-mainnet.public.blastapi.io"
];

async function checkRpc(url) {
    console.log(`Testing RPC: ${url}`);
    try {
        const client = createPublicClient({
            chain: base,
            transport: http(url, { timeout: 5000 })
        });
        const block = await client.getBlockNumber();
        console.log(`✅ Success! Block: ${block}`);
        return true;
    } catch (e) {
        console.log(`❌ Failed: ${e.message.slice(0, 100)}...`);
        return false;
    }
}

async function main() {
    console.log("--- RPC HEALTH CHECK ---");
    for (const rpc of RPCS) {
        await checkRpc(rpc);
    }
}

main();
