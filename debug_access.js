const { createPublicClient, http, parseAbiItem } = require('viem');
const { base } = require('viem/chains');

// Config
const REGISTRY_ADDRESS = "0xB97f1EABb2A68ef8c885D363431C4bBD74Fda12a";
const TARGET_ADDRESS = "0x6edd22E9792132614dD487aC6434dec3709b79A8";
const START_BLOCK = 24000000n; // Conservative guess

async function main() {
    const client = createPublicClient({
        chain: base,
        transport: http()
    });

    try {
        const block = await client.getBlockNumber();
        console.log("Current Block Height:", block.toString());

        console.log(`Scanning for ScoreSubmitted events for ${TARGET_ADDRESS} on ${REGISTRY_ADDRESS}...`);

        const logs = await client.getLogs({
            address: REGISTRY_ADDRESS,
            event: parseAbiItem('event ScoreSubmitted(address indexed player, uint256 score, bytes32 gameId, uint256 amount, uint256 timestamp)'),
            args: {
                player: TARGET_ADDRESS
            },
            fromBlock: block - 100000n, // Scan last 100k blocks
            toBlock: 'latest'
        });

        console.log("Events Found:", logs.length);
        if (logs.length > 0) {
            console.log("Last Event:", logs[logs.length - 1]);
        } else {
            console.log("No events found in recent history.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
