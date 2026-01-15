const hre = require("hardhat");

async function main() {
    console.log("Deploying GMRegistry...");

    const GMRegistry = await hre.ethers.getContractFactory("GMRegistry");
    const gm = await GMRegistry.deploy();

    await gm.waitForDeployment();

    const address = await gm.getAddress();
    console.log(`GMRegistry deployed to: ${address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
