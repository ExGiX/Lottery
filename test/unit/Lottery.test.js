const { developmentChains, networkConfig } = require('../../helper-hardhat.config');
const { network, ethers } = require("hardhat");
const { assert, expect } = require('chai');

!developmentChains.includes(network.name) ? describe.skip : describe("Lottery Unit Tests", () => {
    let lottery, lotteryContract, vrfCoordinatorV2Mock, entranceFee, interval, deployer, player;

    beforeEach(async () => {
        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        player = accounts[1];
        await deployments.fixture(["mocks", "lottery"]);
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        lotteryContract = await ethers.getContract("Lottery");
        lottery = lotteryContract.connect(deployer);
        entranceFee = await lottery.entranceFee();
        interval = await lottery.interval();
    })

    describe("constructor", () => {
        it("initializes the lottery contract correctly", async () => {
            const lotteryState = (await lottery.lotteryState()).toString();
            assert.equal(lotteryState, "0");
            assert.equal(interval.toString(), networkConfig[network.config.chainId]["interval"]);
        })
    })

    describe("etner lottery", () => {
        it("doesn't allow entrance when lottery is not opened", async () => {
            await lottery.enterLottery({ value: entranceFee });

            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.request({ method: "evm_mine", params: [] });
            await lottery.performUpkeep([]);
            await expect(lottery.enterLottery({ value: entranceFee })).to.be.revertedWith(
                "Lottery__NOT_OPENED"
            );
        })
        it("records player when they enter", async () => {
            await lottery.enterLottery({ value: entranceFee });
            const contractPlayer = await lottery.players(0);
            assert.equal(deployer.address, contractPlayer);
        })
        it("emits event on enter", async () => {
            await expect(lottery.enterLottery({ value: entranceFee })).to.emit(
                lottery,
                "LotteryEnter"
            );
        })
    })

    describe("checkUpkeep", () => {
        it("returns false if peope haven't send any ETH", async () => {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.request({ method: "evm_mine", params: [] });
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x");
            assert(!upkeepNeeded)
        })
        it("returns false if lottery isn't open", async () => {
            await lottery.enterLottery({ value: entranceFee });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.request({ method: "evm_mine", params: [] });
            // change status to calculating
            await lottery.performUpkeep([]);
            const lotteryState = await lottery.lotteryState();
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x");
            assert.equal(lotteryState.toString() == "1", upkeepNeeded == false);
        })
        it("returns false if enough time hasn't passed", async () => {
            await lottery.enterLottery({ value: entranceFee });
            await network.provider.send("evm_increaseTime", [interval.toNumber() - 10]);
            await network.provider.request({ method: "evm_mine", params: [] });
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x");
            assert(!upkeepNeeded);
        })
        it("returns true if enough time has passes, has players, eth, and is open", async () => {
            await lottery.enterLottery({ value: entranceFee });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.request({ method: "evm_mine", params: [] });
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x");
            assert(upkeepNeeded);
        })
    })

    describe("performUpkeep", () => {
        it("can only run if checkupkeep is true", async () => {
            await lottery.enterLottery({ value: entranceFee });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.request({ method: "evm_mine", params: [] });
            const tx = await lottery.performUpkeep("0x");
            assert(tx);
        })
        it("reverts if checkup is false", async () => {
            await expect(lottery.performUpkeep("0x")).to.be.revertedWith("Lottery__UpkeepNotNeeded");
        })
        it("updates the lottery state and miet requestId", async () => {
            await lottery.enterLottery({ value: entranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.request({ method: "evm_mine", params: [] });
            const txResponse = await lottery.performUpkeep("0x");
            const txReceipt = await txResponse.wait(1);
            const lotteryState = await lottery.lotteryState();
            const requestId = txReceipt.events[1].args.requestId;
            assert(requestId.toNumber() > 0);
            assert(lotteryState === 1);
        })
    })

    describe("fullfillRandomWords", () => {
        beforeEach(async () => {
            await lottery.enterLottery({ value: entranceFee });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.request({ method: "evm_mine", params: [] });
        })
        it("can only be called after perfomupkeep", async () => {
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0), lottery.address).to.be.reverted;
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1), lottery.address).to.be.reverted;
        })
    })

})