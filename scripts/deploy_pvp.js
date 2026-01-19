const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying PvPRegistry with account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

    const PvPRegistry = await hre.ethers.getContractFactory("PvPRegistry");
    const registry = await PvPRegistry.deploy();

    await registry.waitForDeployment();

    const address = await registry.getAddress();
    console.log("PvPRegistry deployed to:", address);

    // Verification
    console.log("Waiting for 6 block confirmations to ensure propagation...");
    await registry.deploymentTransaction().wait(6);

    console.log("Verifying contract on Basescan...");
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [],
        });
    } catch (e) {
        console.log("Verification failed:", e);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
