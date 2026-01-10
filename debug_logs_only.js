const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

// Config
const TARGET_TX = "0x6986ef859269514db84091cedddf30441e5af09a30819be1da51d4e1a929ee1f";
const REGISTRY_ADDRESS = "0xB97f1EABb2A68ef8c885D363431C4bBD74Fda12a";

async function main() {
    const client = createPublicClient({
        chain: base,
        transport: http()
    });

    try {
        const receipt = await client.getTransactionReceipt({ hash: TARGET_TX });
        console.log(`\nLOGS FOUND: ${receipt.logs.length}`);

        receipt.logs.forEach((log, index) => {
            console.log(`\n[Log ${index}] Address: ${log.address}`);
            console.log(`  Topics: ${log.topics}`);
            if (log.address.toLowerCase() === REGISTRY_ADDRESS.toLowerCase()) {
                console.log("  🚨 MATCHES REGISTRY ADDRESS! (Event was emitted)");
            }
        });

        if (receipt.logs.every(l => l.address.toLowerCase() !== REGISTRY_ADDRESS.toLowerCase())) {
            console.log("\n❌ CONCLUSION: No logs emitted by ScoreRegistry.");
            console.log("   The transaction did NOT touch the leaderboard contract.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
