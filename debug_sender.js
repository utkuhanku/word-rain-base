const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

const TARGET_TX = "0x4c0f05b40317425b77c2be9e5c8a3a5dab32fc39ecd209e422973493258adc5c";

async function main() {
    const client = createPublicClient({ chain: base, transport: http() });
    const tx = await client.getTransaction({ hash: TARGET_TX });
    const receipt = await client.getTransactionReceipt({ hash: TARGET_TX });

    console.log(`TX: ${TARGET_TX}`);
    console.log(`FROM: ${tx.from}`);
    console.log(`TO: ${tx.to}`);
    // Check logs for Transfer 'from' in case 'tx.from' is a Bundler/EntryPoint
    const transferLog = receipt.logs.find(l =>
        l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" && // Transfer
        l.address.toLowerCase() === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase() // USDC
    );

    if (transferLog) {
        // Topic 1 is 'from' (padded)
        const payer = "0x" + transferLog.topics[1].slice(26);
        console.log(`REAL PAYER (from Transfer Log): ${payer}`);
    }
}

main();
