const { network, ethers } = require("hardhat");

const baseFee = ethers.utils.parseEther("0.25");
const gasPriceLink = 1e9;

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log, deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    if (chainId === 31337) {
        log("Local network detected! Deploying mocks...");
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [baseFee, gasPriceLink]
        });
    }

    log("Mocks deployed!");

}

module.exports.tags = ["all", "mocks"];
