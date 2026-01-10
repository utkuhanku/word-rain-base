const { createPublicClient, http, parseAbiItem } = require('viem');
const { base } = require('viem/chains');

const REGISTRY_ADDRESS = "0xB97f1EABb2A68ef8c885D363431C4bBD74Fda12a";

async function main() {
    const RPCS = ["https://base.llamarpc.com", "https://1rpc.io/base", "https://base-mainnet.public.blastapi.io"];
    const client = createPublicClient({ chain: base, transport: http(RPCS[0]) });
    const currentBlock = await client.getBlockNumber();
    console.log(`Checking Global Activity on ${REGISTRY_ADDRESS}`);

    // Scan last 100k blocks (2 days approx)
    const logs = await client.getLogs({
        address: REGISTRY_ADDRESS,
        event: parseAbiItem('event ScoreSubmitted(address indexed player, uint256 score, bytes32 gameId, uint256 amount, uint256 timestamp)'),
        fromBlock: currentBlock - 5000n,
        toBlock: 'latest'
    });

    console.log(`Total Events Found (Last 100k blocks): ${logs.length}`);
    logs.forEach(l => console.log(`- Player: ${l.args.player} | Score: ${l.args.score}`));
}

main();
