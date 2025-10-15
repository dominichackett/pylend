// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LiquidationEngine
 * @notice Handles loan liquidations for PyLend
 * @dev Manages liquidation logic, rewards, and collateral distribution
 */
contract LiquidationEngine is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ STATE VARIABLES ============

    /// @notice Address of lending pool
    address public lendingPool;

    /// @notice Price oracle contract
    IPriceOracle public priceOracle;

    /// @notice PYUSD token address
    address public immutable pyusdToken;

    /// @notice Liquidation bonus for liquidators (5% = 500 basis points)
    uint256 public liquidationBonus = 500;

    /// @notice Minimum profit for liquidation to be worthwhile (in PYUSD, 6 decimals)
    uint256 public minLiquidationProfit = 10e6; // $10

    /// @notice Total liquidations executed
    uint256 public totalLiquidations;

    /// @notice Total collateral liquidated (in USD)
    uint256 public totalCollateralLiquidated;

    // ============ STRUCTS ============

    struct LiquidationResult {
        uint256 collateralSeized;
        uint256 debtRepaid;
        uint256 liquidatorReward;
        uint256 poolReturn;
    }

    // ============ EVENTS ============

    event LiquidationExecuted(
        uint256 indexed loanId,
        address indexed liquidator,
        address indexed borrower,
        uint256 debtRepaid,
        uint256 collateralSeized,
        uint256 liquidatorReward,
        uint256 timestamp
    );

    event LiquidationBonusUpdated(uint256 oldBonus, uint256 newBonus);
    event MinProfitUpdated(uint256 oldMin, uint256 newMin);

    // ============ ERRORS ============

    error OnlyLendingPool();
    error LoanNotLiquidatable();
    error InsufficientCollateralValue();
    error LiquidationNotProfitable();

    // ============ CONSTRUCTOR ============

    /**
     * @notice Initialize liquidation engine
     * @param _lendingPool Address of lending pool
     * @param _priceOracle Address of price oracle
     * @param _pyusdToken Address of PYUSD token
     */
    constructor(
        address _lendingPool,
        address _priceOracle,
        address _pyusdToken
    ) {
        require(_lendingPool != address(0), "Invalid lending pool");
        require(_priceOracle != address(0), "Invalid oracle");
        require(_pyusdToken != address(0), "Invalid PYUSD");

        lendingPool = _lendingPool;
        priceOracle = IPriceOracle(_priceOracle);
        pyusdToken = _pyusdToken;
    }

    // ============ MODIFIERS ============

    modifier onlyPool() {
        if (msg.sender != lendingPool) revert OnlyLendingPool();
        _;
    }

    // ============ MAIN FUNCTIONS ============

    /**
     * @notice Execute liquidation for an under-collateralized loan
     * @param loanId ID of the loan
     * @param loan Loan struct from lending pool
     * @param collateralConfig Collateral configuration
     * @param priceUpdateData Pyth price update data
     */
    function liquidate(
        uint256 loanId,
        LoanStruct memory loan,
        CollateralConfig memory collateralConfig,
        bytes[] calldata priceUpdateData
    ) external payable onlyPool nonReentrant {
        // Update price and get collateral value
        uint256 collateralValueUSD = priceOracle.getValueUSD{value: msg.value}(
            collateralConfig.priceFeedId,
            loan.collateralAmount,
            collateralConfig.decimals,
            priceUpdateData
        );

        // Calculate total debt (principal + interest)
        uint256 totalDebt = loan.borrowedAmount + loan.accruedInterest;

        // Check if loan is actually under-collateralized
        uint256 collateralRatio = (collateralValueUSD * 10000) / totalDebt;
        if (collateralRatio >= collateralConfig.liquidationThreshold) {
            revert LoanNotLiquidatable();
        }

        // Execute liquidation
        LiquidationResult memory result = _executeLiquidation(
            loan,
            totalDebt,
            collateralValueUSD
        );

        // Update global stats
        totalLiquidations++;
        totalCollateralLiquidated += collateralValueUSD;

        emit LiquidationExecuted(
            loanId,
            tx.origin, // Original caller (liquidator)
            loan.borrower,
            result.debtRepaid,
            result.collateralSeized,
            result.liquidatorReward,
            block.timestamp
        );
    }

    /**
     * @notice Check if liquidation would be profitable
     * @param loanId Loan ID
     * @param loan Loan struct
     * @param collateralConfig Collateral config
     * @return bool True if profitable to liquidate
     * @return uint256 Expected profit in PYUSD
     */
    function isLiquidationProfitable(
        uint256 loanId,
        LoanStruct memory loan,
        CollateralConfig memory collateralConfig
    ) external view returns (bool, uint256) {
        // Get collateral value (view mode)
        uint256 collateralValueUSD = priceOracle.getValueUSDView(
            collateralConfig.priceFeedId,
            loan.collateralAmount,
            collateralConfig.decimals
        );

        uint256 totalDebt = loan.borrowedAmount + loan.accruedInterest;

        // Check if under-collateralized
        uint256 ratio = (collateralValueUSD * 10000) / totalDebt;
        if (ratio >= collateralConfig.liquidationThreshold) {
            return (false, 0);
        }

        // Calculate liquidator reward
        uint256 rewardAmount = (loan.collateralAmount * liquidationBonus) / 10000;
        uint256 rewardValueUSD = (rewardAmount * collateralValueUSD) / loan.collateralAmount;

        // Profit = reward value - gas costs (estimated)
        // We estimate gas costs as ~$5 for simplicity
        uint256 estimatedGasCost = 5e6; // $5 in 6 decimals
        
        if (rewardValueUSD > estimatedGasCost) {
            uint256 profit = rewardValueUSD - estimatedGasCost;
            return (profit >= minLiquidationProfit, profit);
        }

        return (false, 0);
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @notice Execute the liquidation logic
     * @param loan Loan struct
     * @param totalDebt Total debt amount
     * @param collateralValueUSD Collateral value in USD
     * @return result Liquidation result
     */
    function _executeLiquidation(
        LoanStruct memory loan,
        uint256 totalDebt,
        uint256 collateralValueUSD
    ) internal returns (LiquidationResult memory result) {
        // Calculate liquidator reward (5% of collateral)
        uint256 liquidatorReward = (loan.collateralAmount * liquidationBonus) / 10000;
        uint256 remainingCollateral = loan.collateralAmount - liquidatorReward;

        // Liquidator must pay the debt in PYUSD to receive collateral
        IERC20(pyusdToken).safeTransferFrom(tx.origin, lendingPool, totalDebt);

        // Transfer liquidator reward (5% bonus)
        IERC20(loan.collateralToken).safeTransfer(tx.origin, liquidatorReward);

        // Transfer remaining collateral to liquidator
        // (This is their profit: they pay debt, get all collateral)
        IERC20(loan.collateralToken).safeTransfer(tx.origin, remainingCollateral);

        // Notify lending pool that debt was repaid
        ILendingPool(lendingPool).onLiquidationComplete(totalDebt);

        return LiquidationResult({
            collateralSeized: loan.collateralAmount,
            debtRepaid: totalDebt,
            liquidatorReward: liquidatorReward,
            poolReturn: totalDebt
        });
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Calculate potential liquidation rewards
     * @param collateralAmount Amount of collateral
     * @param collateralValueUSD Value in USD
     * @param debt Total debt
     * @return liquidatorReward Reward for liquidator
     * @return profit Expected profit
     */
    function calculateLiquidationRewards(
        uint256 collateralAmount,
        uint256 collateralValueUSD,
        uint256 debt
    ) external view returns (
        uint256 liquidatorReward,
        uint256 profit
    ) {
        liquidatorReward = (collateralAmount * liquidationBonus) / 10000;
        
        // Liquidator pays debt, receives all collateral
        // Profit = collateral value - debt - gas costs
        if (collateralValueUSD > debt) {
            uint256 grossProfit = collateralValueUSD - debt;
            uint256 estimatedGasCost = 5e6; // $5
            profit = grossProfit > estimatedGasCost ? grossProfit - estimatedGasCost : 0;
        } else {
            profit = 0;
        }
    }

    /**
     * @notice Get liquidation statistics
     * @return Total liquidations, total value liquidated
     */
    function getLiquidationStats() external view returns (
        uint256,
        uint256
    ) {
        return (totalLiquidations, totalCollateralLiquidated);
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Update liquidation bonus
     * @param _liquidationBonus New bonus in basis points
     */
    function setLiquidationBonus(uint256 _liquidationBonus) external onlyOwner {
        require(_liquidationBonus <= 1000, "Bonus too high (max 10%)");
        uint256 oldBonus = liquidationBonus;
        liquidationBonus = _liquidationBonus;
        emit LiquidationBonusUpdated(oldBonus, _liquidationBonus);
    }

    /**
     * @notice Update minimum liquidation profit
     * @param _minProfit New minimum profit (6 decimals)
     */
    function setMinLiquidationProfit(uint256 _minProfit) external onlyOwner {
        uint256 oldMin = minLiquidationProfit;
        minLiquidationProfit = _minProfit;
        emit MinProfitUpdated(oldMin, _minProfit);
    }

    /**
     * @notice Update lending pool address
     * @param _lendingPool New lending pool address
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        require(_lendingPool != address(0), "Invalid address");
        lendingPool = _lendingPool;
    }

    /**
     * @notice Update price oracle
     * @param _priceOracle New oracle address
     */
    function setPriceOracle(address _priceOracle) external onlyOwner {
        require(_priceOracle != address(0), "Invalid address");
        priceOracle = IPriceOracle(_priceOracle);
    }

    // ============ EMERGENCY FUNCTIONS ============

    /**
     * @notice Emergency withdraw tokens (only owner)
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // Allow contract to receive ETH for Pyth updates
    receive() external payable {}
}

// ============ INTERFACES ============

interface ILendingPool {
    function onLiquidationComplete(uint256 debtRepaid) external;
}

interface IPriceOracle {
    function getValueUSD(
        bytes32 priceFeedId,
        uint256 tokenAmount,
        uint8 tokenDecimals,
        bytes[] calldata priceUpdateData
    ) external payable returns (uint256);

    function getValueUSDView(
        bytes32 priceFeedId,
        uint256 tokenAmount,
        uint8 tokenDecimals
    ) external view returns (uint256);
}

// ============ STRUCT DEFINITIONS ============

struct LoanStruct {
    uint256 id;
    address borrower;
    uint256 borrowedAmount;
    address collateralToken;
    uint256 collateralAmount;
    uint256 interestRate;
    uint256 borrowedAt;
    uint256 lastInterestUpdate;
    uint256 accruedInterest;
    uint8 status; // 0=ACTIVE, 1=REPAID, 2=LIQUIDATED
}

struct CollateralConfig {
    bool isApproved;
    bytes32 priceFeedId;
    uint256 liquidationThreshold;
    uint8 decimals;
}

/**
 * LIQUIDATION FLOW:
 * 
 * 1. Loan becomes under-collateralized (ratio < 150%)
 *    Example: ETH drops from $2500 to $2000
 *    Collateral: 1 ETH = $2000
 *    Debt: 1500 PYUSD
 *    Ratio: $2000 / $1500 = 133% < 150%
 * 
 * 2. Liquidator calls liquidate()
 *    - Pays 1500 PYUSD to pool (covers debt)
 *    - Receives 1 ETH worth $2000
 *    - Gets 5% bonus: 0.05 ETH extra = $100
 *    - Net profit: $2000 - $1500 = $500
 * 
 * 3. Pool made whole
 *    - Received 1500 PYUSD back
 *    - No bad debt
 *    - All lenders protected
 * 
 * 4. Stats updated
 *    - totalLiquidations++
 *    - totalCollateralLiquidated += $2000
 */