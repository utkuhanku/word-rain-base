const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

// Config
const TARGET_TX = "0x4341fd79ad3d9593f10441289acd3db4d63251d1ebecab276d3714d94f365e9e";
const NEW_REGISTRY = "0x9Dc0EC4618506538AF41fbBd2c1340cb25675108".toLowerCase();
const OLD_REGISTRY = "0xB97f1EABb2A68ef8c885D363431C4bBD74Fda12a".toLowerCase();

async function main() {
    console.log(`--- FORENSICS: ${TARGET_TX} ---`);
    // Robust RPC
    const RPCS = ["https://base.llamarpc.com", "https://1rpc.io/base"];
    const client = createPublicClient({ chain: base, transport: http(RPCS[0]) });

    try {
        const tx = await client.getTransaction({ hash: TARGET_TX });
        const receipt = await client.getTransactionReceipt({ hash: TARGET_TX });

        console.log(`Status: ${receipt.status} (${receipt.status === 'success' ? '✅ SUCCESS' : '❌ REVERTED'})`);
        console.log(`To: ${tx.to ? tx.to.toLowerCase() : 'null'}`);

        if (tx.to && tx.to.toLowerCase() === NEW_REGISTRY) {
            console.log("✅ DESTINATION: NEW REGISTRY (Correct)");
        } else if (tx.to && tx.to.toLowerCase() === OLD_REGISTRY) {
            console.log("❌ DESTINATION: OLD GHOST REGISTRY (Cached Frontend?)");
        } else {
            console.log(`❓ DESTINATION: OTHER (${tx.to})`);
        }

        console.log(`Input: ${tx.input.slice(0, 10)}...`);
        // 0xdef8315a = submitScore

        console.log("\n[LOGS]");
        receipt.logs.forEach((log, i) => {
            console.log(`Log ${i} Address: ${log.address} | Topics: ${log.topics.length}`);
            if (log.address.toLowerCase() === NEW_REGISTRY) {
                console.log("  🎉 EVENT EMITTED BY NEW REGISTRY!");
            }
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
