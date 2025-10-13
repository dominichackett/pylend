// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MockPyth is IPyth {
    mapping(bytes32 => PythStructs.Price) public prices;

    function getPriceUnsafe(bytes32 id) public view returns (PythStructs.Price memory) {
        return prices[id];
    }

    function setPrice(bytes32 id, int64 price, int32 expo) public {
        prices[id] = PythStructs.Price(price, 0, expo, uint64(block.timestamp));
    }

    function getPriceNoOlderThan(bytes32 id, uint age) public view returns (PythStructs.Price memory) {
        if (block.timestamp - prices[id].publishTime > age) {
            revert("Price is too old");
        }
        return prices[id];
    }

    function getEmaPriceUnsafe(bytes32) public view returns (PythStructs.Price memory) {
        revert("EMA price not available in mock");
    }

    function getEmaPriceNoOlderThan(bytes32, uint) public view returns (PythStructs.Price memory) {
        revert("EMA price not available in mock");
    }

    function updatePriceFeeds(bytes[] calldata) public payable {}

    function updatePriceFeedsIfNecessary(bytes[] calldata, bytes32[] calldata, uint64[] calldata) public payable {}

    function getUpdateFee(bytes[] calldata) public view returns (uint) {
        return 0;
    }

    function getTwapUpdateFee(bytes[] calldata) public view returns (uint) {
        return 0;
    }

    function parsePriceFeedUpdates(bytes[] calldata, bytes32[] calldata, uint64, uint64) public payable returns (PythStructs.PriceFeed[] memory) {
        revert("Not implemented in mock");
    }

    function parsePriceFeedUpdatesWithConfig(bytes[] calldata, bytes32[] calldata, uint64, uint64, bool, bool, bool) public payable returns (PythStructs.PriceFeed[] memory, uint64[] memory) {
        revert("Not implemented in mock");
    }

    function parseTwapPriceFeedUpdates(bytes[] calldata, bytes32[] calldata) public payable returns (PythStructs.TwapPriceFeed[] memory) {
        revert("Not implemented in mock");
    }

    function parsePriceFeedUpdatesUnique(bytes[] calldata, bytes32[] calldata, uint64, uint64) public payable returns (PythStructs.PriceFeed[] memory) {
        revert("Not implemented in mock");
    }
}