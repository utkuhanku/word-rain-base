const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

const REGISTRY_ADDRESS = "0xB97f1EABb2A68ef8c885D363431C4bBD74Fda12a";

async function main() {
    const RPCS = ["https://base.llamarpc.com", "https://1rpc.io/base"];
    const client = createPublicClient({ chain: base, transport: http(RPCS[0]) });

    const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    console.log("Reading USDC Code...");
    const usdcCode = await client.getBytecode({ address: USDC_ADDRESS });
    console.log(`USDC Code Length: ${usdcCode ? usdcCode.length : 0}`);

    console.log("Reading Registry Code...");
    const code = await client.getBytecode({ address: REGISTRY_ADDRESS });
    console.log(`Registry Code Length: ${code ? code.length : 0}`);

    if (code && code.length > 2) {
        console.log("✅ Contract Exists on Chain.");
    } else {
        console.log("❌ Contract NOT FOUND (or RPC Error).");
    }
}

main();
