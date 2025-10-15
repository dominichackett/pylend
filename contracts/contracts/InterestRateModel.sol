// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InterestRateModel
 * @notice Calculates interest rates based on pool utilization
 * @dev Uses a kinked interest rate model similar to Compound/Aave
 */
contract InterestRateModel is Ownable {
    
    // ============ STATE VARIABLES ============

    /// @notice Base interest rate (APR when utilization = 0)
    /// @dev In basis points (200 = 2%)
    uint256 public baseRatePerYear;

    /// @notice Interest rate slope below kink
    /// @dev In basis points (1000 = 10%)
    uint256 public multiplierPerYear;

    /// @notice Interest rate jump above kink
    /// @dev In basis points (10000 = 100%)
    uint256 public jumpMultiplierPerYear;

    /// @notice Utilization point where rate jumps
    /// @dev In basis points (8000 = 80%)
    uint256 public kink;

    // ============ EVENTS ============

    event InterestRateModelUpdated(
        uint256 baseRate,
        uint256 multiplier,
        uint256 jumpMultiplier,
        uint256 kink
    );

    // ============ CONSTRUCTOR ============

    /**
     * @notice Initialize interest rate model with default parameters
     * @param _baseRatePerYear Base APR in basis points
     * @param _multiplierPerYear Slope multiplier in basis points
     * @param _jumpMultiplierPerYear Jump multiplier in basis points
     * @param _kink Kink point in basis points
     */
    constructor(
        uint256 _baseRatePerYear,
        uint256 _multiplierPerYear,
        uint256 _jumpMultiplierPerYear,
        uint256 _kink
    ) {
        require(_kink <= 10000, "Kink must be <= 100%");
        require(_baseRatePerYear <= 5000, "Base rate too high");
        
        baseRatePerYear = _baseRatePerYear;
        multiplierPerYear = _multiplierPerYear;
        jumpMultiplierPerYear = _jumpMultiplierPerYear;
        kink = _kink;

        emit InterestRateModelUpdated(
            _baseRatePerYear,
            _multiplierPerYear,
            _jumpMultiplierPerYear,
            _kink
        );
    }

    // ============ MAIN FUNCTIONS ============

    /**
     * @notice Calculate borrow APR based on utilization
     * @param utilizationRate Pool utilization in basis points
     * @return Borrow APR in basis points
     */
    function getBorrowRate(uint256 utilizationRate) public view returns (uint256) {
        require(utilizationRate <= 10000, "Invalid utilization");

        if (utilizationRate <= kink) {
            // Below kink: baseRate + (utilization × multiplier)
            return baseRatePerYear + (utilizationRate * multiplierPerYear / 10000);
        } else {
            // Above kink: normalRate + (excessUtilization × jumpMultiplier)
            uint256 normalRate = baseRatePerYear + (kink * multiplierPerYear / 10000);
            uint256 excessUtilization = utilizationRate - kink;
            return normalRate + (excessUtilization * jumpMultiplierPerYear / 10000);
        }
    }

    /**
     * @notice Calculate supply APR (interest earned by lenders)
     * @param utilizationRate Pool utilization in basis points
     * @param borrowRate Current borrow APR
     * @return Supply APR in basis points
     */
    function getSupplyRate(
        uint256 utilizationRate,
        uint256 borrowRate
    ) public pure returns (uint256) {
        require(utilizationRate <= 10000, "Invalid utilization");
        
        // Supply rate = borrow rate × utilization rate
        // Lenders earn proportionally to how much is borrowed
        return (borrowRate * utilizationRate) / 10000;
    }

    /**
     * @notice Calculate utilization rate
     * @param totalBorrowed Total amount borrowed from pool
     * @param totalLiquidity Total liquidity in pool (available + borrowed)
     * @return Utilization rate in basis points
     */
    function getUtilizationRate(
        uint256 totalBorrowed,
        uint256 totalLiquidity
    ) public pure returns (uint256) {
        if (totalBorrowed == 0) {
            return 0;
        }

        if (totalLiquidity == 0) {
            return 0;
        }

        // Utilization = borrowed / (borrowed + available)
        // = borrowed / totalLiquidity
        uint256 utilization = (totalBorrowed * 10000) / totalLiquidity;
        
        // Cap at 100%
        return utilization > 10000 ? 10000 : utilization;
    }

    /**
     * @notice Get all interest rates for current state
     * @param totalBorrowed Total borrowed
     * @param totalLiquidity Total liquidity
     * @return utilization Utilization rate
     * @return borrowRate Borrow APR
     * @return supplyRate Supply APR
     */
    function getRates(
        uint256 totalBorrowed,
        uint256 totalLiquidity
    ) external view returns (
        uint256 utilization,
        uint256 borrowRate,
        uint256 supplyRate
    ) {
        utilization = getUtilizationRate(totalBorrowed, totalLiquidity);
        borrowRate = getBorrowRate(utilization);
        supplyRate = getSupplyRate(utilization, borrowRate);
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Update interest rate model parameters
     * @param _baseRatePerYear New base rate
     * @param _multiplierPerYear New multiplier
     * @param _jumpMultiplierPerYear New jump multiplier
     * @param _kink New kink point
     */
    function updateModel(
        uint256 _baseRatePerYear,
        uint256 _multiplierPerYear,
        uint256 _jumpMultiplierPerYear,
        uint256 _kink
    ) external onlyOwner {
        require(_kink <= 10000, "Kink must be <= 100%");
        require(_baseRatePerYear <= 5000, "Base rate too high");
        
        baseRatePerYear = _baseRatePerYear;
        multiplierPerYear = _multiplierPerYear;
        jumpMultiplierPerYear = _jumpMultiplierPerYear;
        kink = _kink;

        emit InterestRateModelUpdated(
            _baseRatePerYear,
            _multiplierPerYear,
            _jumpMultiplierPerYear,
            _kink
        );
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get model parameters
     * @return All model parameters
     */
    function getModelParameters() external view returns (
        uint256 _baseRatePerYear,
        uint256 _multiplierPerYear,
        uint256 _jumpMultiplierPerYear,
        uint256 _kink
    ) {
        return (
            baseRatePerYear,
            multiplierPerYear,
            jumpMultiplierPerYear,
            kink
        );
    }

    /**
     * @notice Simulate rates for given utilization
     * @param utilizationRate Utilization to simulate
     * @return borrowRate Borrow APR
     * @return supplyRate Supply APR
     */
    function simulateRates(uint256 utilizationRate) external view returns (
        uint256 borrowRate,
        uint256 supplyRate
    ) {
        borrowRate = getBorrowRate(utilizationRate);
        supplyRate = getSupplyRate(utilizationRate, borrowRate);
    }
}

/**
 * USAGE EXAMPLE:
 * 
 * Deploy with default parameters:
 * - Base Rate: 2% (200 basis points)
 * - Multiplier: 10% (1000 basis points)
 * - Jump Multiplier: 100% (10000 basis points)
 * - Kink: 80% (8000 basis points)
 * 
 * Interest Rate Curve:
 * 
 * APR
 *  │
 * 120%│                              ╱
 *     │                            ╱
 * 100%│                          ╱
 *     │                        ╱
 *  80%│                      ╱
 *     │                    ╱
 *  60%│                  ╱
 *     │                ╱
 *  40%│              ╱
 *     │            ╱
 *  20%│          ╱
 *     │        ╱
 *  10%│      ╱_______________
 *     │    ╱               (Kink at 80%)
 *   2%│___╱
 *     └────────────────────────────── Utilization
 *     0%  20%  40%  60%  80%  90%  100%
 * 
 * Below 80% utilization: Linear increase
 * Above 80% utilization: Sharp jump (discourages over-borrowing)
 */