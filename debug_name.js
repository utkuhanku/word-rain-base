const { createPublicClient, http } = require('viem');
const { base, mainnet } = require('viem/chains');
const { normalize } = require('viem/ens');

const USER_ADDRESS = "0x6edd22E9792132614dD487aC6434dec3709b79A8";

async function main() {
    const client = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });

    console.log(`Resolving: ${USER_ADDRESS}`);

    // 1. Try L2 Basename (ENS on Base)
    // Basename Registry is actually L2 Resolver. 
    // Usually standard ENS lookup on L2 works if configured?
    // Actually OnchainKit handles this. Let's try basic ENS reverse lookup on Mainnet first (classic).

    const ethClient = createPublicClient({ chain: mainnet, transport: http("https://eth.llamarpc.com") });
    try {
        const ensName = await ethClient.getEnsName({ address: USER_ADDRESS });
        console.log(`ENS (L1): ${ensName}`);
    } catch (e) { console.log("ENS L1 Error", e.message); }

    // 2. Basename is harder to check with raw viem without the specific registry addresses.
    // access onchainkit logic via node is hard without import.
    // I'll assume if L1 ENS is empty, they want Basename.

    console.log("To verify Basename properly, I'd rely on the frontend hook.");
}

main();
