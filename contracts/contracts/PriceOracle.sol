// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PriceOracle
 * @notice Wrapper for Pyth Network price feeds
 * @dev Handles price feed updates and USD value calculations
 */
contract PriceOracle is Ownable {
    /// @notice Pyth contract instance
    IPyth public immutable pyth;

    /// @notice Maximum price age allowed (15 minutes)
    uint256 public constant MAX_PRICE_AGE = 15 minutes;

    // ============ EVENTS ============

    event PriceUpdated(bytes32 indexed priceFeedId, int64 price, uint64 timestamp);

    // ============ ERRORS ============

    error PriceTooOld();
    error InvalidPrice();
    error InvalidExpo();
    error InsufficientFee();

    // ============ CONSTRUCTOR ============

    /**
     * @notice Initialize PriceOracle with Pyth contract
     * @param _pyth Address of Pyth contract on Hedera
     */
    constructor(address _pyth) Ownable(msg.sender) {
        require(_pyth != address(0), "Invalid Pyth address");
        pyth = IPyth(_pyth);
    }

    // ============ MAIN FUNCTIONS ============

    /**
     * @notice Get USD value of token amount with price update
     * @param priceFeedId Pyth price feed ID
     * @param tokenAmount Amount of tokens
     * @param tokenDecimals Decimals of the token
     * @param priceUpdateData Price update data from Pyth API
     * @return USD value with 6 decimals (PYUSD standard)
     */
    function getValueUSD(
        bytes32 priceFeedId,
        uint256 tokenAmount,
        uint8 tokenDecimals,
        bytes[] calldata priceUpdateData
    ) external payable returns (uint256) {
        // Update price feeds
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        if (msg.value < fee) revert InsufficientFee();
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        // Get updated price (use getPriceUnsafe for latest price)
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceFeedId);
        
        // Validate price
        _validatePrice(price);

        // Calculate USD value
        return _calculateValue(tokenAmount, price, tokenDecimals);
    }

    /**
     * @notice Get USD value without updating price (view function)
     * @dev Use for simulations and estimates only
     * @param priceFeedId Pyth price feed ID
     * @param tokenAmount Amount of tokens
     * @param tokenDecimals Decimals of the token
     * @return USD value with 6 decimals
     */
    function getValueUSDView(
        bytes32 priceFeedId,
        uint256 tokenAmount,
        uint8 tokenDecimals
    ) external view returns (uint256) {
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceFeedId);
        
        // Note: In view mode, we can't enforce price freshness strictly
        // Calling contracts should be aware prices might be stale
        
        return _calculateValue(tokenAmount, price, tokenDecimals);
    }

    /**
     * @notice Get latest price for a feed
     * @param priceFeedId Pyth price feed ID
     * @return price Price data structure
     */
    function getPrice(bytes32 priceFeedId) external view returns (PythStructs.Price memory) {
        return pyth.getPriceUnsafe(priceFeedId);
    }

    /**
     * @notice Get price update fee
     * @param priceUpdateData Price update data array
     * @return Fee amount in native token (HBAR)
     */
    function getUpdateFee(bytes[] calldata priceUpdateData) external view returns (uint256) {
        return pyth.getUpdateFee(priceUpdateData);
    }

    /**
     * @notice Update multiple price feeds
     * @param priceUpdateData Array of price update data
     */
    function updatePriceFeeds(bytes[] calldata priceUpdateData) external payable {
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        if (msg.value < fee) revert InsufficientFee();
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @notice Calculate USD value from price and amount
     * @param tokenAmount Amount of tokens (in token decimals)
     * @param price Pyth price structure
     * @param tokenDecimals Token decimals
     * @return USD value with 6 decimals
     */
    function _calculateValue(
        uint256 tokenAmount,
        PythStructs.Price memory price,
        uint8 tokenDecimals
    ) internal pure returns (uint256) {
        // Pyth price format: price × 10^expo
        // Example: BTC price might be 4500000000000 with expo -8 = $45,000
        
        uint256 priceUint = uint256(uint64(price.price));
        int32 expo = price.expo;
        
        // We want result in 6 decimals (PYUSD standard)
        // Formula: (tokenAmount × price) / (10^tokenDecimals × 10^(-expo)) × 10^6
        
        if (expo >= 0) {
            // Positive expo (rare)
            uint256 expoMultiplier = 10 ** uint32(expo);
            return (tokenAmount * priceUint * expoMultiplier * 1e6) / (10 ** tokenDecimals);
        } else {
            // Negative expo (common case)
            uint256 expoDivisor = 10 ** uint32(-expo);
            return (tokenAmount * priceUint * 1e6) / (10 ** tokenDecimals * expoDivisor);
        }
    }

    /**
     * @notice Validate price data
     * @param price Pyth price structure
     */
    function _validatePrice(PythStructs.Price memory price) internal view {
        // Check price is positive
        if (price.price <= 0) revert InvalidPrice();
        
        // Check price is not too old
        uint256 priceAge = block.timestamp - price.publishTime;
        if (priceAge > MAX_PRICE_AGE) revert PriceTooOld();
        
        // Validate expo is reasonable (-18 to 18)
        if (price.expo < -18 || price.expo > 18) revert InvalidExpo();
    }

    /**
     * @notice Convert token amount to 18 decimals for calculation
     * @param amount Token amount
     * @param decimals Token decimals
     * @return Amount in 18 decimals
     */
    function _to18Decimals(uint256 amount, uint8 decimals) internal pure returns (uint256) {
        if (decimals == 18) return amount;
        if (decimals < 18) {
            return amount * (10 ** (18 - decimals));
        } else {
            return amount / (10 ** (decimals - 18));
        }
    }

    /**
     * @notice Check if price is fresh enough
     * @param priceFeedId Price feed ID
     * @return bool True if price is fresh
     */
    function isPriceFresh(bytes32 priceFeedId) external view returns (bool) {
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceFeedId);
        uint256 priceAge = block.timestamp - price.publishTime;
        return priceAge <= MAX_PRICE_AGE;
    }

    /**
     * @notice Get price age in seconds
     * @param priceFeedId Price feed ID
     * @return Age in seconds
     */
    function getPriceAge(bytes32 priceFeedId) external view returns (uint256) {
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceFeedId);
        return block.timestamp - price.publishTime;
    }

    // ============ UTILITY FUNCTIONS ============

    /**
     * @notice Withdraw stuck ETH (for Pyth update fees)
     */
    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @notice Allow contract to receive ETH for Pyth updates
     */
    receive() external payable {}
}

/**
 * USAGE EXAMPLE:
 * 
 * // Get Pyth price update data from API
 * const priceIds = ["0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"]; // ETH/USD
 * const priceUpdateData = await pythConnection.getPriceFeedsUpdateData(priceIds);
 * 
 * // Get USD value of 1 ETH
 * const fee = await oracle.getUpdateFee(priceUpdateData);
 * const value = await oracle.getValueUSD(
 *   ethPriceFeedId,
 *   parseEther("1"), // 1 ETH
 *   18, // ETH decimals
 *   priceUpdateData,
 *   { value: fee }
 * );
 * 
 * console.log("1 ETH =", formatUnits(value, 6), "USD");
 */