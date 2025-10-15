// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Interfaces
 * @notice All interfaces for PyLend contracts
 */

// ============ PRICE ORACLE INTERFACE ============

interface IPriceOracle {
    /**
     * @notice Get USD value with price update
     */
    function getValueUSD(
        bytes32 priceFeedId,
        uint256 tokenAmount,
        uint8 tokenDecimals,
        bytes[] calldata priceUpdateData
    ) external payable returns (uint256);

    /**
     * @notice Get USD value without update (view)
     */
    function getValueUSDView(
        bytes32 priceFeedId,
        uint256 tokenAmount,
        uint8 tokenDecimals
    ) external view returns (uint256);

    /**
     * @notice Get update fee
     */
    function getUpdateFee(bytes[] calldata priceUpdateData) external view returns (uint256);

    /**
     * @notice Update price feeds
     */
    function updatePriceFeeds(bytes[] calldata priceUpdateData) external payable;
}

// ============ INTEREST RATE MODEL INTERFACE ============

interface IInterestRateModel {
    /**
     * @notice Calculate borrow rate
     */
    function getBorrowRate(uint256 utilizationRate) external view returns (uint256);

    /**
     * @notice Calculate supply rate
     */
    function getSupplyRate(
        uint256 utilizationRate,
        uint256 borrowRate
    ) external view returns (uint256);

    /**
     * @notice Calculate utilization rate
     */
    function getUtilizationRate(
        uint256 totalBorrowed,
        uint256 totalLiquidity
    ) external view returns (uint256);

    /**
     * @notice Get all rates
     */
    function getRates(
        uint256 totalBorrowed,
        uint256 totalLiquidity
    ) external view returns (
        uint256 utilization,
        uint256 borrowRate,
        uint256 supplyRate
    );
}

// ============ LIQUIDATION ENGINE INTERFACE ============

interface ILiquidationEngine {
    /**
     * @notice Execute liquidation
     */
    function liquidate(
        uint256 loanId,
        LoanStruct memory loan,
        CollateralConfig memory collateralConfig,
        bytes[] calldata priceUpdateData
    ) external payable;

    /**
     * @notice Check if liquidation is profitable
     */
    function isLiquidationProfitable(
        uint256 loanId,
        LoanStruct memory loan,
        CollateralConfig memory collateralConfig
    ) external view returns (bool, uint256);

    /**
     * @notice Calculate liquidation rewards
     */
    function calculateLiquidationRewards(
        uint256 collateralAmount,
        uint256 collateralValueUSD,
        uint256 debt
    ) external view returns (
        uint256 liquidatorReward,
        uint256 profit
    );
}

// ============ LENDING POOL INTERFACE ============

interface ILendingPool {
    // Pool functions
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function getDepositWithInterest(address lender) external view returns (uint256);

    // Borrow functions
    function borrow(
        uint256 amount,
        address collateralToken,
        uint256 collateralAmount
    ) external returns (uint256);
    function repay(uint256 loanId, uint256 amount) external;

    // Liquidation
    function liquidate(uint256 loanId, bytes[] calldata priceUpdateData) external payable;
    function isLiquidatable(uint256 loanId) external view returns (bool);
    function onLiquidationComplete(uint256 debtRepaid) external;

    // View functions
    function getMaxBorrowAmount(
        address collateralToken,
        uint256 collateralAmount
    ) external view returns (uint256);
    function getUtilizationRate() external view returns (uint256);
    function getCurrentBorrowRate() external view returns (uint256);
    function getCurrentSupplyRate() external view returns (uint256);
    function getTotalDebt(uint256 loanId) external view returns (uint256);
    function getUserActiveLoans(address user) external view returns (uint256[] memory);

    // Structs
    function loans(uint256 loanId) external view returns (
        uint256 id,
        address borrower,
        uint256 borrowedAmount,
        address collateralToken,
        uint256 collateralAmount,
        uint256 interestRate,
        uint256 borrowedAt,
        uint256 lastInterestUpdate,
        uint256 accruedInterest,
        uint8 status
    );

    function approvedCollateral(address token) external view returns (
        bool isApproved,
        bytes32 priceFeedId,
        uint256 liquidationThreshold,
        uint8 decimals
    );
}

// ============ POOL TOKEN INTERFACE ============

interface IPoolToken {
    function mint(address account, uint256 amount) external;
    function burn(address account, uint256 amount) external;
    function accrueInterest(uint256 amount) external;
    
    function exchangeRate() external view returns (uint256);
    function toUnderlying(uint256 poolTokenAmount) external view returns (uint256);
    function fromUnderlying(uint256 underlyingAmount) external view returns (uint256);
    function balanceOfUnderlying(address account) external view returns (uint256);
}

// ============ SHARED STRUCTS ============

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

struct DepositStruct {
    uint256 amount;
    uint256 lastUpdateTime;
    uint256 accruedInterest;
}