import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({
    chain: base,
    transport: http()
});

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const RECIPIENT = "0x6edd22E9792132614dD487aC6434dec3709b79A8".toLowerCase();

const hashes = [
    "0xc16c23dcfb0ba3e701e3e9224a130a6721c73f319edceb530a7dcb9efb7cf1d1",
    "0xfee4607afa0ed2bc9b1b15c5082f49a3cd52dab0ed5503ce2874bb2e6a4134e8"
];

async function check() {
    console.log("Checking Transactions...");
    for (const hash of hashes) {
        console.log(`\n--- Hash: ${hash} ---`);
        try {
            const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
            console.log(`Status: ${receipt.status}`);

            // Filter logs for USDC Transfer
            const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

            // We need to parse logs manually or find the matching one
            // Transfer topic[0] = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
            const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

            const logs = receipt.logs.filter(l =>
                l.address.toLowerCase() === USDC_ADDRESS &&
                l.topics[0] === transferTopic
            );

            if (logs.length === 0) {
                console.log("No USDC Transfer logs found.");
                continue;
            }

            for (const log of logs) {
                // Decode topics (indexed params)
                // topic[1] = from, topic[2] = to
                const from = `0x${log.topics[1]?.slice(26)}`.toLowerCase();
                const to = `0x${log.topics[2]?.slice(26)}`.toLowerCase();
                const value = BigInt(log.data);

                console.log(`Transfer:`);
                console.log(`  From: ${from}`);
                console.log(`  To:   ${to}`);
                console.log(`  Val:  ${formatUnits(value, 6)} USDC`);

                if (to === RECIPIENT) {
                    console.log("  MATCH: RECIPIENT is correct dest.");
                    if (value >= BigInt(150000)) {
                        console.log("  MATCH: Amount >= 0.15 USDC");
                    } else {
                        console.log("  FAIL: Amount too low.");
                    }
                } else {
                    console.log(`  FAIL: Recipient ${to} is not ${RECIPIENT}`);
                }
            }

        } catch (e) {
            console.error("Error:", e);
        }
    }
}

check();
