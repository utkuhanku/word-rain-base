const { createPublicClient, http, toFunctionSelector } = require('viem');
const { base } = require('viem/chains');

// Config
const TARGET_TX = "0x4c0f05b40317425b77c2be9e5c8a3a5dab32fc39ecd209e422973493258adc5c";

async function main() {
    console.log(`--- TX INPUT ANALYSIS: ${TARGET_TX} ---`);
    const client = createPublicClient({
        chain: base,
        transport: http()
    });

    try {
        const tx = await client.getTransaction({ hash: TARGET_TX });
        console.log(`Input Data: ${tx.input.slice(0, 50)}...`);

        // Signatures
        const TRANSFER_SELECTOR = "0xa9059cbb"; // transfer(address,uint256)
        const SUBMIT_SCORE_SELECTOR = toFunctionSelector("submitScore(uint256,bytes32)");
        const EXECUTE_SELECTOR = "0xb61d27f6"; // execute (ERC-4337 loop) - typical for smart wallets? Or EntryPoint handleOps?
        // Actually Smart Wallets send to EntryPoint "handleOps".

        console.log(`submitScore Selector: ${SUBMIT_SCORE_SELECTOR}`);

        if (tx.input.startsWith(TRANSFER_SELECTOR)) {
            console.log("🚨 TYPE: Raw USDC Transfer (transfer)");
        } else if (tx.input.startsWith(SUBMIT_SCORE_SELECTOR)) {
            console.log("✅ TYPE: Contract Call (submitScore)");
        } else {
            console.log(`ℹ️ TYPE: Other / Smart Wallet Bundle`);
            // Try to find the selector INSIDE the calldata (common in bundles)
            if (tx.input.includes(SUBMIT_SCORE_SELECTOR.slice(2))) {
                console.log("   -> FOUND submitScore selector inside calldata! (Batched/wrapped)");
            } else if (tx.input.includes(TRANSFER_SELECTOR.slice(2))) {
                console.log("   -> FOUND transfer selector inside calldata! (Wrapped raw transfer)");
            }
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
