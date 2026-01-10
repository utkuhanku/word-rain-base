const { createPublicClient, http, toFunctionSelector } = require('viem');
const { base } = require('viem/chains');

// Config
const TARGET_TX = "0x4c0f05b40317425b77c2be9e5c8a3a5dab32fc39ecd209e422973493258adc5c";
const REGISTRY_ADDRESS = "0xB97f1EABb2A68ef8c885D363431C4bBD74Fda12a";

async function main() {
    console.log(`--- FORENSICS: ${TARGET_TX} ---`);
    const client = createPublicClient({
        chain: base,
        transport: http()
    });

    try {
        const tx = await client.getTransaction({ hash: TARGET_TX });
        const receipt = await client.getTransactionReceipt({ hash: TARGET_TX });

        console.log(`Status: ${receipt.status} (${receipt.status === 'success' ? '✅ SUCCESS' : '❌ REVERTED'})`);
        console.log(`To: ${tx.to}`);

        // Selector Check
        const SUBMIT_SCORE_SELECTOR = "0xdef8315a"; // submitScore
        const TRANSFER_SELECTOR = "0xa9059cbb"; // transfer

        console.log("\n[INPUT DATA ANALYSIS]");
        if (tx.input.includes(SUBMIT_SCORE_SELECTOR.slice(2))) {
            console.log("✅ FOUND 'submitScore' selector in data!");
        } else if (tx.input.includes(TRANSFER_SELECTOR.slice(2))) {
            console.log("⚠️ FOUND 'transfer' selector in data (Raw Transfer).");
        } else {
            console.log("❓ Unknown Selector / Smart Wallet Bundle");
        }

        console.log("\n[EVENT LOGS ANALYSIS]");
        let foundScoreEvent = false;
        receipt.logs.forEach((log, i) => {
            console.log(`Log ${i} Address: ${log.address}`);
            if (log.address.toLowerCase() === REGISTRY_ADDRESS.toLowerCase()) {
                console.log("  ✅ EMITTED BY REGISTRY (0xB97...12a)");
                foundScoreEvent = true;
            }
        });

        if (foundScoreEvent) {
            console.log("\n✅ CONCLUSION: Valid Score Submission. Logic Issue likely in Frontend Fetching.");
        } else {
            console.log("\n❌ CONCLUSION: No Score Event. Transaction did not record score.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
