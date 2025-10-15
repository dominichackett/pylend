// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PoolToken
 * @notice Interest-bearing receipt token for PyLend deposits
 * @dev ERC20 token representing shares in the lending pool
 * Similar to Aave's aTokens or Compound's cTokens
 */
contract PoolToken is ERC20, ERC20Burnable, Ownable {
    
    // ============ STATE VARIABLES ============

    /// @notice Address of lending pool (only address that can mint/burn)
    address public lendingPool;

    /// @notice Underlying asset (PYUSD)
    address public immutable underlyingAsset;

    /// @notice Total interest earned by the pool
    uint256 public totalInterestEarned;

    // ============ EVENTS ============

    event LendingPoolUpdated(address indexed oldPool, address indexed newPool);
    event InterestAccrued(uint256 amount, uint256 timestamp);

    // ============ ERRORS ============

    error OnlyLendingPool();
    error InvalidLendingPool();
    error InvalidAsset();

    // ============ CONSTRUCTOR ============

    /**
     * @notice Initialize pool token
     * @param _name Token name (e.g., "PyLend PYUSD")
     * @param _symbol Token symbol (e.g., "pyPYUSD")
     * @param _underlyingAsset Address of underlying asset (PYUSD)
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _underlyingAsset
    ) ERC20(_name, _symbol) {
        if (_underlyingAsset == address(0)) revert InvalidAsset();
        underlyingAsset = _underlyingAsset;
    }

    // ============ MODIFIERS ============

    /**
     * @notice Only lending pool can call certain functions
     */
    modifier onlyPool() {
        if (msg.sender != lendingPool) revert OnlyLendingPool();
        _;
    }

    // ============ MAIN FUNCTIONS ============

    /**
     * @notice Mint pool tokens (called by lending pool on deposit)
     * @param account Address to mint to
     * @param amount Amount to mint
     */
    function mint(address account, uint256 amount) external onlyPool {
        _mint(account, amount);
    }

    /**
     * @notice Burn pool tokens (called by lending pool on withdrawal)
     * @param account Address to burn from
     * @param amount Amount to burn
     */
    function burn(address account, uint256 amount) external onlyPool {
        _burn(account, amount);
    }

    /**
     * @notice Record interest accrual
     * @param amount Interest amount earned
     */
    function accrueInterest(uint256 amount) external onlyPool {
        totalInterestEarned += amount;
        emit InterestAccrued(amount, block.timestamp);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get the exchange rate between pool tokens and underlying asset
     * @dev Exchange rate increases as interest accrues
     * @return Exchange rate (18 decimals)
     */
    function exchangeRate() public view returns (uint256) {
        uint256 totalSupply_ = totalSupply();
        if (totalSupply_ == 0) {
            return 1e18; // 1:1 ratio initially
        }

        // Total value = total supply + interest earned
        uint256 totalValue = totalSupply_ + totalInterestEarned;
        
        // Exchange rate = total value / total supply
        return (totalValue * 1e18) / totalSupply_;
    }

    /**
     * @notice Convert pool tokens to underlying amount
     * @param poolTokenAmount Amount of pool tokens
     * @return Underlying asset amount
     */
    function toUnderlying(uint256 poolTokenAmount) public view returns (uint256) {
        uint256 rate = exchangeRate();
        return (poolTokenAmount * rate) / 1e18;
    }

    /**
     * @notice Convert underlying amount to pool tokens
     * @param underlyingAmount Amount of underlying asset
     * @return Pool token amount
     */
    function fromUnderlying(uint256 underlyingAmount) public view returns (uint256) {
        uint256 rate = exchangeRate();
        return (underlyingAmount * 1e18) / rate;
    }

    /**
     * @notice Get balance in underlying asset for an account
     * @param account Address to check
     * @return Balance in underlying asset
     */
    function balanceOfUnderlying(address account) external view returns (uint256) {
        return toUnderlying(balanceOf(account));
    }

    /**
     * @notice Get total supply in underlying asset
     * @return Total supply in underlying asset
     */
    function totalSupplyUnderlying() external view returns (uint256) {
        return toUnderlying(totalSupply());
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Set lending pool address (only owner, one-time)
     * @param _lendingPool Address of lending pool
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        if (_lendingPool == address(0)) revert InvalidLendingPool();
        if (lendingPool != address(0)) revert InvalidLendingPool(); // Can only set once
        
        address oldPool = lendingPool;
        lendingPool = _lendingPool;
        
        emit LendingPoolUpdated(oldPool, _lendingPool);
    }

    // ============ OVERRIDES ============

    /**
     * @notice Override decimals to match underlying asset (6 for PYUSD)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @notice Disable transfers during initial setup
     * @dev Can be enabled by removing this override
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        
        // Allow minting and burning
        if (from == address(0) || to == address(0)) {
            return;
        }
        
        // Transfers are allowed (makes tokens tradeable)
        // Remove this check if you want non-transferable tokens
    }
}

/**
 * USAGE EXAMPLE:
 * 
 * User deposits 1000 PYUSD:
 * - Mint 1000 pyPYUSD tokens (1:1 initially)
 * 
 * After some time, interest accrues:
 * - Total interest earned: 100 PYUSD
 * - Exchange rate: (1000 + 100) / 1000 = 1.1
 * 
 * User wants to withdraw:
 * - Burns 1000 pyPYUSD
 * - Receives 1000 * 1.1 = 1100 PYUSD (principal + interest)
 * 
 * Benefits:
 * - Tokens automatically earn interest (no manual claiming)
 * - Transferable (can sell position to others)
 * - Composable (can be used in other DeFi protocols)
 */