const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

// Robust RPCs
const RPCS = ["https://base.llamarpc.com", "https://1rpc.io/base", "https://base.meowrpc.com"];
const client = createPublicClient({
    chain: base,
    transport: http(RPCS[0])
});

const { parseAbiItem } = require('viem');
const REGISTRY_ADDRESS = "0x9Dc0EC4618506538AF41fbBd2c1340cb25675108";
const PLAYER = "0xBAEa28106C6d5b9fd8459A811CAF4b3Eb49af616";

async function main() {
    console.log(`Searching for logs for ${PLAYER} on ${REGISTRY_ADDRESS}...`);
    const currentBlock = await client.getBlockNumber();
    const fromBlock = 40600000n; // Scan wide

    const logs = await client.getLogs({
        address: REGISTRY_ADDRESS,
        event: parseAbiItem('event ScoreSubmitted(address indexed player, uint256 score, uint256 timestamp)'),
        args: { player: PLAYER },
        fromBlock: fromBlock,
        toBlock: 'latest'
    });

    if (logs.length > 0) {
        logs.forEach(log => {
            console.log(`FOUND EVENT! Block: ${log.blockNumber}, Tx: ${log.transactionHash}`);
        });
    } else {
        console.log("No events found for this player on the NEW contract.");
    }
}

main();
