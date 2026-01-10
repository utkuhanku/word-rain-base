const { createPublicClient, http, parseAbiItem } = require('viem');
const { base } = require('viem/chains');

// Config
const REGISTRY_ADDRESS = "0xB97f1EABb2A68ef8c885D363431C4bBD74Fda12a";
const TARGET_ADDRESS = "0x6edd22E9792132614dD487aC6434dec3709b79A8"; // Treasury

async function main() {
    console.log("--- DEBUG START ---");
    const client = createPublicClient({
        chain: base,
        transport: http()
    });

    try {
        const currentBlock = await client.getBlockNumber();
        console.log("Current Block:", currentBlock.toString());

        // Scan only last 50,000 blocks (approx 24h) to ensure RPC safety
        const fromBlock = currentBlock - 50000n;

        console.log(`Scanning from ${fromBlock} to ${currentBlock}...`);

        const logs = await client.getLogs({
            address: REGISTRY_ADDRESS,
            event: parseAbiItem('event ScoreSubmitted(address indexed player, uint256 score, bytes32 gameId, uint256 amount, uint256 timestamp)'),
            fromBlock: fromBlock,
            toBlock: 'latest'
        });

        console.log(`Total Events Found: ${logs.length}`);

        if (logs.length > 0) {
            console.log("Latest Events:");
            logs.slice(-5).forEach(log => {
                console.log(`- Player: ${log.args.player}, Block: ${log.blockNumber}`);
            });

            // Check specifically for target
            const targetLogs = logs.filter(l => l.args.player.toLowerCase() === TARGET_ADDRESS.toLowerCase());
            if (targetLogs.length > 0) {
                console.log(`✅ MATCH FOUND for ${TARGET_ADDRESS}!`);
            } else {
                console.log(`❌ NO MATCH for ${TARGET_ADDRESS}.`);
            }
        } else {
            console.log("No events found. Contract might be empty or wrong block range.");
        }

    } catch (e) {
        console.error("RPC Error:", e);
    }
    console.log("--- DEBUG END ---");
}

main();
