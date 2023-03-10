const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat.config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let VRFCoordinatorV2Address, subscriptionId, VRFCoordinatorV2Mock;
    const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30");

    if (developmentChains.includes(network.name)) {
        VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        VRFCoordinatorV2Address = VRFCoordinatorV2Mock.address;
        const transactionResponse = await VRFCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);
        subscriptionId = transactionReceipt.events[0].args.subId;
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);

    } else {
        VRFCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = network.config[chainId]["subscriptionId"];
    }

    const args = [
        VRFCoordinatorV2Address,
        networkConfig[chainId]["gasLane"],
        subscriptionId,
        networkConfig[chainId]["callbackGasLimit"],
        networkConfig[chainId]["interval"],
        networkConfig[chainId]["entranceFee"],
    ];
    const lottery = await deploy("Lottery", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmation: network.config.blockConfirmation || 1
    });
    
    if(developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        await VRFCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address);
    }


}

module.exports.tags = ["all", "lottery"]