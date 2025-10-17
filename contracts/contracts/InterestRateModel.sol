// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract InterestRateModel is Ownable {
    
    uint256 public baseRatePerYear;
    uint256 public multiplierPerYear;
    uint256 public jumpMultiplierPerYear;
    uint256 public kink;

    event InterestRateModelUpdated(
        uint256 baseRate,
        uint256 multiplier,
        uint256 jumpMultiplier,
        uint256 kink
    );

    constructor(
        uint256 _baseRatePerYear,
        uint256 _multiplierPerYear,
        uint256 _jumpMultiplierPerYear,
        uint256 _kink
    ) Ownable(msg.sender) {
        require(_kink <= 10000, "Kink must be <= 100%");
        require(_baseRatePerYear <= 5000, "Base rate too high");
        
        baseRatePerYear = _baseRatePerYear;
        multiplierPerYear = _multiplierPerYear;
        jumpMultiplierPerYear = _jumpMultiplierPerYear;
        kink = _kink;

        emit InterestRateModelUpdated(_baseRatePerYear, _multiplierPerYear, _jumpMultiplierPerYear, _kink);
    }

    function getBorrowRate(uint256 utilizationRate) public view returns (uint256) {
        require(utilizationRate <= 10000, "Invalid utilization");
        if (utilizationRate <= kink) {
            return baseRatePerYear + (utilizationRate * multiplierPerYear / 10000);
        } else {
            uint256 normalRate = baseRatePerYear + (kink * multiplierPerYear / 10000);
            uint256 excessUtilization = utilizationRate - kink;
            return normalRate + (excessUtilization * jumpMultiplierPerYear / 10000);
        }
    }

    function getSupplyRate(uint256 utilizationRate, uint256 borrowRate) public pure returns (uint256) {
        require(utilizationRate <= 10000, "Invalid utilization");
        return (borrowRate * utilizationRate) / 10000;
    }

    function getUtilizationRate(uint256 totalBorrowed, uint256 totalLiquidity) public pure returns (uint256) {
        if (totalBorrowed == 0 || totalLiquidity == 0) return 0;
        uint256 utilization = (totalBorrowed * 10000) / totalLiquidity;
        return utilization > 10000 ? 10000 : utilization;
    }

    function getRates(uint256 totalBorrowed, uint256 totalLiquidity) external view returns (
        uint256 utilization,
        uint256 borrowRate,
        uint256 supplyRate
    ) {
        utilization = getUtilizationRate(totalBorrowed, totalLiquidity);
        borrowRate = getBorrowRate(utilization);
        supplyRate = getSupplyRate(utilization, borrowRate);
    }

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

        emit InterestRateModelUpdated(_baseRatePerYear, _multiplierPerYear, _jumpMultiplierPerYear, _kink);
    }
}