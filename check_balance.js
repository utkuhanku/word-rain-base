const { createPublicClient, http, parseAbi } = require('viem');
const { base } = require('viem/chains');

const USER_ADDRESS = "0x6edd22E9792132614dD487aC6434dec3709b79A8";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
    // Robust RPCs
    const RPCS = ["https://base.llamarpc.com", "https://1rpc.io/base", "https://mainnet.base.org"];
    const client = createPublicClient({ chain: base, transport: http(RPCS[0]) });

    console.log(`Checking Balances for ${USER_ADDRESS}...`);

    // 1. Check ETH (Gas)
    const ethBalance = await client.getBalance({ address: USER_ADDRESS });
    console.log(`ETH Balance: ${Number(ethBalance) / 1e18} ETH`);

    // 2. Check USDC
    const usdcBalance = await client.readContract({
        address: USDC_ADDRESS,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [USER_ADDRESS]
    });
    console.log(`USDC Balance: ${Number(usdcBalance) / 1e6} USDC`);

    // 3. Check Allowance to Registry
    const REGISTRY_ADDRESS = "0x9Dc0EC4618506538AF41fbBd2c1340cb25675108";
    const allowance = await client.readContract({
        address: USDC_ADDRESS,
        abi: parseAbi(['function allowance(address, address) view returns (uint256)']),
        functionName: 'allowance',
        args: [USER_ADDRESS, REGISTRY_ADDRESS]
    });
    console.log(`Allowance to Registry: ${Number(allowance) / 1e6} USDC`);

    // Logic Check
    if (usdcBalance < 150000n) {
        console.log("❌ CRITICAL: Insufficient USDC (Need 0.15 USDC).");
    } else {
        console.log("✅ Funds OK.");
    }
}

main();
