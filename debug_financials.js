const { createPublicClient, http, parseAbiItem } = require('viem');
const { base } = require('viem/chains');

// Config
const REGISTRY_ADDRESS = "0x9Dc0EC4618506538AF41fbBd2c1340cb25675108";
const ADMIN_WALLET = "0x6edd22E9792132614dD487aC6434dec3709b79A8"; // The address user is using
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
    console.log("--- FINANCIAL FORENSICS START ---");
    // Robust RPC
    const RPCS = ["https://base.llamarpc.com", "https://1rpc.io/base", "https://base.meowrpc.com"];
    const client = createPublicClient({
        chain: base,
        transport: http(RPCS[0])
    });

    try {
        const currentBlock = await client.getBlockNumber();
        console.log("Current Block:", currentBlock.toString());
        // Targeted Scan for known transaction
        const fromBlock = 40625100n;
        const toBlock = 40625200n;

        // 1. Check ScoreRegistry Events
        console.log(`\n1. Scanning ScoreRegistry (${REGISTRY_ADDRESS}) for ${ADMIN_WALLET}...`);
        const scoreLogs = await client.getLogs({
            address: REGISTRY_ADDRESS,
            event: parseAbiItem('event ScoreSubmitted(address indexed player, uint256 score, bytes32 gameId, uint256 amount, uint256 timestamp)'),
            args: { player: ADMIN_WALLET },
            fromBlock: fromBlock,
            toBlock: 'latest'
        });
        console.log(`> Score Events Found: ${scoreLogs.length}`);
        scoreLogs.forEach(log => console.log(`  - Block ${log.blockNumber}: Score ${log.args.score}`));


        // 2. Check USDC Transfers (Raw Payment Check)
        console.log(`\n2. Scanning USDC Transfers (${USDC_ADDRESS}) from ${ADMIN_WALLET}...`);
        const transferLogs = await client.getLogs({
            address: USDC_ADDRESS,
            event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
            args: {
                from: ADMIN_WALLET,
                to: ADMIN_WALLET // Self-transfer (since Recipient == User in this case)
            },
            fromBlock: fromBlock,
            toBlock: 'latest'
        });

        // Also check transfers to Recipient generally if they weren't self-transfers (unlikely if wallets match)
        // But let's check ANY outgoing USDC from this wallet > 0.14

        console.log(`> USDC Self-Transfers Found: ${transferLogs.length}`);
        transferLogs.forEach(log => console.log(`  - Block ${log.blockNumber}: ${Number(log.args.value) / 1e6} USDC`));

    } catch (e) {
        console.error("RPC Error:", e);
    }
    console.log("\n--- FINANCIAL FORENSICS END ---");
}

main();
