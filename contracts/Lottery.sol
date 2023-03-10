// SPDX-Liense-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Lottery__NOT_OPENED();
error Lottery__notEnoughETHSend();
error Lottery__UpkeepNotNeeded();
error Lottery__TransferFailed();

contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    event LotteryEnter(address indexed player);
    event RequestLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed recentWinner);

    // Chainlink variables

    VRFCoordinatorV2Interface private immutable vrfCoordinator;
    bytes32 private immutable gasLane;
    uint64 private immutable subscribtionId;
    uint32 private immutable callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;
    uint16 private constant REUQEST_CONFIRMATION = 3;

    // Lottery variables

    uint256 public entranceFee;
    address payable[] public players;
    address public recentWinner;
    LotteryState public lotteryState;
    uint256 public lastTimestamp;
    uint256 public interval;

    constructor(
        address vrfCoordinatorV2,
        bytes32 _gasLane,
        uint64 _subscriptionId,
        uint32 _callbackGasLimit,
        uint256 _interval,
        uint256 _entranceFee
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        gasLane = _gasLane;
        subscribtionId = _subscriptionId;
        callbackGasLimit = _callbackGasLimit;
        lotteryState = LotteryState.OPEN;
        lastTimestamp = block.timestamp;
        interval = _interval;
        entranceFee = _entranceFee;
    }

    function enterLottery() public payable {
        if (msg.value < entranceFee) {
            revert Lottery__notEnoughETHSend();
        }
        if (lotteryState != LotteryState.OPEN) {
            revert Lottery__NOT_OPENED();
        }
        players.push(payable(msg.sender));
        emit LotteryEnter(msg.sender);
    }

    /**
     * @dev This is the function that Chainlink Keeper nodes call
     * they look for the `upkeepNeeded` to return true.
     * 1. The time interval passes between lottery runs
     * 2. Lottery is open
     * 3. The contract has ETH
     * 4. Impicity, your subscribtion is funded with LINK
     */

    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isOpen = (LotteryState.OPEN == lotteryState);
        bool timePasses = ((block.timestamp - lastTimestamp) > interval);
        bool hasPlayers = players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && timePasses && hasPlayers && hasBalance);
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Lottery__UpkeepNotNeeded();
        }

        lotteryState = LotteryState.CALCULATING;
        uint256 requestId = vrfCoordinator.requestRandomWords(
            gasLane,
            subscribtionId,
            REUQEST_CONFIRMATION,
            callbackGasLimit,
            NUM_WORDS
        );
        emit RequestLotteryWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randWords
    ) internal override {
        uint256 indexOfWinner = randWords[0] % players.length;
        address payable _recentWinner = players[indexOfWinner];
        recentWinner = _recentWinner;
        players = new address payable[](0);
        lotteryState = LotteryState.OPEN;
        lastTimestamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery__TransferFailed();
        }

        emit WinnerPicked(_recentWinner);
    }
}
