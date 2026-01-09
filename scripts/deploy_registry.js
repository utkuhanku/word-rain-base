const hre = require("hardhat");

async function main() {
    console.log("Deploying ScoreRegistry...");

    // 1. Get Signer
    const [deployer] = await hre.ethers.getSigners();
    if (!deployer) {
        throw new Error("No deployer account found. Check .env PRIVATE_KEY");
    }
    console.log("Account:", deployer.address);

    // 2. Deploy
    const ScoreRegistry = await hre.ethers.getContractFactory("ScoreRegistry");
    const registry = await ScoreRegistry.deploy();

    await registry.waitForDeployment();

    const address = await registry.getAddress();
    console.log("-----------------------------------------");
    console.log("ScoreRegistry Deployed to:", address);
    console.log("-----------------------------------------");
    console.log("NEXT STEPS:");
    console.log("1. Add NEXT_PUBLIC_SCORE_REGISTRY_ADDRESS=" + address + " to your .env");
    console.log("2. Verify contract if needed: npx hardhat verify --network base " + address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
