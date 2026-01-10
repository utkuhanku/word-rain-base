const { createPublicClient, http, parseAbiItem } = require('viem');
const { base } = require('viem/chains');

// Config
const TARGET_TX = "0x6986ef859269514db84091cedddf30441e5af09a30819be1da51d4e1a929ee1f";
const REGISTRY_ADDRESS = "0xB97f1EABb2A68ef8c885D363431C4bBD74Fda12a";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
    console.log(`--- TX INSPECTION: ${TARGET_TX} ---`);
    const client = createPublicClient({
        chain: base,
        transport: http()
    });

    try {
        const tx = await client.getTransaction({ hash: TARGET_TX });
        const receipt = await client.getTransactionReceipt({ hash: TARGET_TX });

        console.log(`\n1. TRANSACTION DETAILS`);
        console.log(`- From: ${tx.from}`);
        console.log(`- To: ${tx.to}`);
        console.log(`- Registry Address: ${REGISTRY_ADDRESS.toLowerCase()}`);

        let interactionType = "UNKNOWN";
        if (tx.to && tx.to.toLowerCase() === REGISTRY_ADDRESS.toLowerCase()) {
            console.log(`✅ SENT TO REGISTRY`);
            interactionType = "CONTRACT_CALL";
        } else if (tx.to && tx.to.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
            console.log(`⚠️ SENT TO USDC CONTRACT (Likely Transfer or Approve)`);
            interactionType = "USDC_INTERACTION";
        } else {
            console.log(`⚠️ SENT TO UNKNOWN ADDRESS: ${tx.to}`);
            interactionType = "OTHER";
        }

        console.log(`\n2. STATUS`);
        console.log(`- Status: ${receipt.status} (${receipt.status === 'success' ? 'Success' : 'Reverted'})`);

        console.log(`\n3. LOGS (${receipt.logs.length})`);

        // Decode ScoreSubmitted logs if any
        // Event signature: ScoreSubmitted(address indexed player, uint256 score, bytes32 gameId, uint256 amount, uint256 timestamp)
        // Topic0: 0x... (hash of signature)

        const SCORE_TOPIC = "0x" + require('crypto').createHash('sha3').update('ScoreSubmitted(address,uint256,bytes32,uint256,uint256)').digest('hex'); // Wrong way to get topic in node without web3 lib, using viem parse instead

        receipt.logs.forEach((log, index) => {
            console.log(`  [Log ${index}] From: ${log.address}`);
            if (log.address.toLowerCase() === REGISTRY_ADDRESS.toLowerCase()) {
                console.log(`    -> EMITTED BY REGISTRY!`);
            } else if (log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
                console.log(`    -> EMITTED BY USDC (Transfer/Approval)`);
            }
        });

    } catch (e) {
        console.error("Error fetching TX:", e);
    }
    console.log("\n--- INSPECTION END ---");
}

main();
