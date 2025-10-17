// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/interfaces.sol";

/**
 * @title LendingPool
 * @notice Main lending pool contract for PyLend
 * @dev Manages liquidity pool, loans, deposits, and withdrawals
 */
contract LendingPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ============ STATE VARIABLES ============

    /// @notice PYUSD token address
    address public immutable pyusdToken;

    /// @notice Price oracle contract
    IPriceOracle public priceOracle;

    /// @notice Interest rate model contract
    IInterestRateModel public interestRateModel;

    /// @notice Liquidation engine contract
    ILiquidationEngine public liquidationEngine;

    /// @notice Total PYUSD deposited in pool
    uint256 public totalLiquidity;

    /// @notice Total PYUSD borrowed from pool
    uint256 public totalBorrowed;

    /// @notice Total bad debt accumulated from liquidations
    uint256 public totalBadDebt;

    /// @notice Loan counter for unique IDs
    uint256 public loanCounter;

    /// @notice Platform fee in basis points (1% = 100)
    uint256 public platformFee = 100;

    /// @notice Treasury address for fees
    address public treasury;

    /// @notice Lender deposits: lender => deposit info
    mapping(address => Deposit) public deposits;

    /// @notice Loans: loanId => Loan
    mapping(uint256 => Loan) public loans;

    /// @notice Approved collateral tokens
    mapping(address => CollateralConfig) public approvedCollateral;

    /// @notice User's active loan IDs
    mapping(address => uint256[]) public userLoans;

    // ============ STRUCTS ============

    struct Deposit {
        uint256 amount;           // Principal deposited
        uint256 lastUpdateTime;   // Last interest calculation time
        uint256 accruedInterest;  // Accumulated interest
    }

    struct Loan {
        uint256 id;
        address borrower;
        uint256 borrowedAmount;
        address collateralToken;
        uint256 collateralAmount;
        uint256 interestRate;      // APR in basis points at time of borrow
        uint256 borrowedAt;
        uint256 lastInterestUpdate;
        uint256 accruedInterest;
        LoanStatus status;
    }

    enum LoanStatus {
        ACTIVE,
        REPAID,
        LIQUIDATED
    }

    // Note: CollateralConfig is imported from Interfaces.sol

    // ============ EVENTS ============

    event Deposited(address indexed lender, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed lender, uint256 amount, uint256 interest, uint256 timestamp);
    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 borrowedAmount,
        address collateralToken,
        uint256 collateralAmount,
        uint256 interestRate,
        uint256 timestamp
    );
    event LoanRepaid(uint256 indexed loanId, uint256 amount, uint256 remainingDebt, uint256 timestamp);
    event LoanFullyRepaid(uint256 indexed loanId, uint256 totalRepaid, uint256 timestamp);
    event LoanLiquidated(uint256 indexed loanId, address indexed liquidator, uint256 debtPaid, uint256 timestamp);
    event CollateralAdded(address indexed token, bytes32 priceFeedId, uint256 threshold);
    event CollateralRemoved(address indexed token);
    event PlatformFeeCollected(uint256 amount);

    // ============ CONSTRUCTOR ============

    constructor(
        address _pyusdToken,
        address _priceOracle,
        address _interestRateModel,
        address _treasury
    ) Ownable(msg.sender) {
        require(_pyusdToken != address(0), "Invalid PYUSD address");
        require(_priceOracle != address(0), "Invalid oracle address");
        require(_interestRateModel != address(0), "Invalid interest model");
        require(_treasury != address(0), "Invalid treasury");

        pyusdToken = _pyusdToken;
        priceOracle = IPriceOracle(_priceOracle);
        interestRateModel = IInterestRateModel(_interestRateModel);
        treasury = _treasury;
    }

    // ============ POOL DEPOSIT FUNCTIONS ============

    /**
     * @notice Deposit PYUSD into the lending pool to earn interest
     * @param amount Amount of PYUSD to deposit
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");

        // Update interest before changing deposit
        _updateDepositInterest(msg.sender);

        // Transfer PYUSD from lender
        IERC20(pyusdToken).safeTransferFrom(msg.sender, address(this), amount);

        // Update deposit
        deposits[msg.sender].amount += amount;
        deposits[msg.sender].lastUpdateTime = block.timestamp;
        totalLiquidity += amount;

        emit Deposited(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Withdraw PYUSD from the lending pool
     * @param amount Amount of principal to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        // Update interest before withdrawal
        _updateDepositInterest(msg.sender);

        Deposit storage userDeposit = deposits[msg.sender];
        require(userDeposit.amount >= amount, "Insufficient deposit");

        // Calculate total withdrawal (principal + interest)
        uint256 interestEarned = userDeposit.accruedInterest;
        uint256 totalWithdrawal = amount + interestEarned;

        // Check if pool has enough liquidity
        uint256 availableLiquidity = totalLiquidity - totalBorrowed;
        require(availableLiquidity >= totalWithdrawal, "Insufficient pool liquidity");

        // Update state
        userDeposit.amount -= amount;
        userDeposit.accruedInterest = 0;
        userDeposit.lastUpdateTime = block.timestamp;
        totalLiquidity -= amount;

        // Transfer PYUSD to lender
        IERC20(pyusdToken).safeTransfer(msg.sender, totalWithdrawal);

        emit Withdrawn(msg.sender, amount, interestEarned, block.timestamp);
    }

    /**
     * @notice Get total deposit balance including accrued interest
     * @param lender Address of the lender
     * @return Total balance (principal + interest)
     */
    function getDepositWithInterest(address lender) public view returns (uint256) {
        Deposit memory userDeposit = deposits[lender];
        if (userDeposit.amount == 0) return 0;

        uint256 pendingInterest = _calculatePendingInterest(lender);
        return userDeposit.amount + userDeposit.accruedInterest + pendingInterest;
    }

    // ============ BORROW FUNCTIONS ============

    /**
     * @notice Borrow PYUSD from the pool using approved collateral
     * @param amount Amount of PYUSD to borrow
     * @param collateralToken Address of collateral token
     * @param collateralAmount Amount of collateral to deposit
     */
    function borrow(
        uint256 amount,
        address collateralToken,
        uint256 collateralAmount
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(amount > 0, "Borrow amount must be > 0");
        require(collateralAmount > 0, "Collateral amount must be > 0");

        CollateralConfig memory config = approvedCollateral[collateralToken];
        require(config.isApproved, "Collateral not approved");

        // Check pool has enough liquidity
        uint256 availableLiquidity = totalLiquidity - totalBorrowed;
        require(availableLiquidity >= amount, "Insufficient pool liquidity");

        // Validate collateral is sufficient
        uint256 maxBorrow = getMaxBorrowAmount(collateralToken, collateralAmount);
        require(amount <= maxBorrow, "Insufficient collateral");

        // Transfer collateral from borrower
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);

        // Get current borrow rate
        uint256 currentRate = getCurrentBorrowRate();

        // Create loan
        uint256 loanId = loanCounter++;
        loans[loanId] = Loan({
            id: loanId,
            borrower: msg.sender,
            borrowedAmount: amount,
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            interestRate: currentRate,
            borrowedAt: block.timestamp,
            lastInterestUpdate: block.timestamp,
            accruedInterest: 0,
            status: LoanStatus.ACTIVE
        });

        userLoans[msg.sender].push(loanId);

        // Update pool state
        totalBorrowed += amount;

        // Collect platform fee
        uint256 fee = (amount * platformFee) / 10000;
        uint256 amountAfterFee = amount - fee;

        // Transfer PYUSD to borrower
        IERC20(pyusdToken).safeTransfer(msg.sender, amountAfterFee);

        // Transfer fee to treasury
        if (fee > 0) {
            IERC20(pyusdToken).safeTransfer(treasury, fee);
            emit PlatformFeeCollected(fee);
        }

        emit LoanCreated(
            loanId,
            msg.sender,
            amount,
            collateralToken,
            collateralAmount,
            currentRate,
            block.timestamp
        );

        return loanId;
    }

    /**
     * @notice Repay a loan partially or fully
     * @param loanId ID of the loan to repay
     * @param amount Amount of PYUSD to repay
     */
    function repay(uint256 loanId, uint256 amount) external nonReentrant {
        require(amount > 0, "Repay amount must be > 0");

        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(loan.borrower == msg.sender, "Not loan borrower");

        // Update accrued interest
        _updateLoanInterest(loanId);

        uint256 totalDebt = loan.borrowedAmount + loan.accruedInterest;
        require(amount <= totalDebt, "Repay amount exceeds debt");

        // Transfer PYUSD from borrower
        IERC20(pyusdToken).safeTransferFrom(msg.sender, address(this), amount);

        // Apply payment (interest first, then principal)
        if (amount >= loan.accruedInterest) {
            // Pay off all interest and some/all principal
            uint256 principalPayment = amount - loan.accruedInterest;
            loan.accruedInterest = 0;
            loan.borrowedAmount -= principalPayment;
            totalBorrowed -= principalPayment;
        } else {
            // Only paying interest
            loan.accruedInterest -= amount;
        }

        uint256 remainingDebt = loan.borrowedAmount + loan.accruedInterest;

        if (remainingDebt == 0) {
            // Loan fully repaid - return collateral
            loan.status = LoanStatus.REPAID;
            IERC20(loan.collateralToken).safeTransfer(msg.sender, loan.collateralAmount);
            emit LoanFullyRepaid(loanId, totalDebt, block.timestamp);
        } else {
            emit LoanRepaid(loanId, amount, remainingDebt, block.timestamp);
        }
    }

    // ============ LIQUIDATION FUNCTIONS ============

    /**
     * @notice Liquidate an under-collateralized loan
     * @param loanId ID of the loan to liquidate
     * @param priceUpdateData Pyth price update data
     */
    function liquidate(
        uint256 loanId,
        bytes[] calldata priceUpdateData
    ) external payable nonReentrant {
        require(address(liquidationEngine) != address(0), "Liquidation engine not set");
        
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");

        // Convert to LoanStruct for liquidation engine
        LoanStruct memory loanStruct = LoanStruct({
            id: loan.id,
            borrower: loan.borrower,
            borrowedAmount: loan.borrowedAmount,
            collateralToken: loan.collateralToken,
            collateralAmount: loan.collateralAmount,
            interestRate: loan.interestRate,
            borrowedAt: loan.borrowedAt,
            lastInterestUpdate: loan.lastInterestUpdate,
            accruedInterest: loan.accruedInterest,
            status: uint8(loan.status)
        });

        // Get collateral config
        CollateralConfig memory config = approvedCollateral[loan.collateralToken];

        // Delegate to liquidation engine
        liquidationEngine.liquidate{value: msg.value}(
            loanId,
            loanStruct,
            config,
            priceUpdateData
        );

        // Update state after liquidation
        loan.status = LoanStatus.LIQUIDATED;
        totalBorrowed -= loan.borrowedAmount;

        emit LoanLiquidated(loanId, msg.sender, loan.borrowedAmount + loan.accruedInterest, block.timestamp);
    }

    /**
     * @notice Check if a loan can be liquidated
     * @param loanId ID of the loan
     * @return bool True if loan is under-collateralized
     */
    function isLiquidatable(uint256 loanId) public view returns (bool) {
        Loan memory loan = loans[loanId];
        if (loan.status != LoanStatus.ACTIVE) return false;

        CollateralConfig memory config = approvedCollateral[loan.collateralToken];
        
        // Get collateral value (view function, no price update)
        uint256 collateralValue = priceOracle.getValueUSDView(
            config.priceFeedId,
            loan.collateralAmount,
            config.decimals
        );

        uint256 totalDebt = loan.borrowedAmount + _calculateLoanInterest(loan);
        uint256 ratio = (collateralValue * 10000) / totalDebt;

        return ratio < config.liquidationThreshold;
    }

    // ============ COLLATERAL MANAGEMENT ============

    /**
     * @notice Add approved collateral type (admin only)
     * @param token Address of collateral token
     * @param priceFeedId Pyth price feed ID
     * @param liquidationThreshold Liquidation threshold in basis points
     * @param decimals Token decimals
     */
    function addCollateral(
        address token,
        bytes32 priceFeedId,
        uint256 liquidationThreshold,
        uint8 decimals
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(liquidationThreshold > 10000, "Threshold must be > 100%");
        require(decimals <= 18, "Invalid decimals");

        approvedCollateral[token] = CollateralConfig({
            isApproved: true,
            priceFeedId: priceFeedId,
            liquidationThreshold: liquidationThreshold,
            decimals: decimals
        });

        emit CollateralAdded(token, priceFeedId, liquidationThreshold);
    }

    /**
     * @notice Remove approved collateral type (admin only)
     * @param token Address of collateral token
     */
    function removeCollateral(address token) external onlyOwner {
        approvedCollateral[token].isApproved = false;
        emit CollateralRemoved(token);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Calculate maximum borrow amount for given collateral
     * @param collateralToken Address of collateral token
     * @param collateralAmount Amount of collateral
     * @return Maximum PYUSD that can be borrowed
     */
    function getMaxBorrowAmount(
        address collateralToken,
        uint256 collateralAmount
    ) public view returns (uint256) {
        CollateralConfig memory config = approvedCollateral[collateralToken];
        require(config.isApproved, "Collateral not approved");

        uint256 collateralValue = priceOracle.getValueUSDView(
            config.priceFeedId,
            collateralAmount,
            config.decimals
        );

        // Max borrow = collateral value / liquidation threshold
        return (collateralValue * 10000) / config.liquidationThreshold;
    }

    /**
     * @notice Get current utilization rate of the pool
     * @return Utilization rate in basis points
     */
    function getUtilizationRate() public view returns (uint256) {
        return interestRateModel.getUtilizationRate(totalBorrowed, totalLiquidity);
    }

    /**
     * @notice Get current borrow APR
     * @return Borrow rate in basis points
     */
    function getCurrentBorrowRate() public view returns (uint256) {
        uint256 utilization = getUtilizationRate();
        return interestRateModel.getBorrowRate(utilization);
    }

    /**
     * @notice Get current supply APR
     * @return Supply rate in basis points
     */
    function getCurrentSupplyRate() public view returns (uint256) {
        uint256 utilization = getUtilizationRate();
        uint256 borrowRate = getCurrentBorrowRate();
        return interestRateModel.getSupplyRate(utilization, borrowRate);
    }

    /**
     * @notice Get total debt for a loan (principal + interest)
     * @param loanId Loan ID
     * @return Total debt amount
     */
    function getTotalDebt(uint256 loanId) public view returns (uint256) {
        Loan memory loan = loans[loanId];
        uint256 pendingInterest = _calculateLoanInterest(loan);
        return loan.borrowedAmount + loan.accruedInterest + pendingInterest;
    }

    /**
     * @notice Get all active loan IDs for a user
     * @param user User address
     * @return Array of loan IDs
     */
    function getUserActiveLoans(address user) external view returns (uint256[] memory) {
        uint256[] memory allLoans = userLoans[user];
        uint256 activeCount = 0;

        // Count active loans
        for (uint256 i = 0; i < allLoans.length; i++) {
            if (loans[allLoans[i]].status == LoanStatus.ACTIVE) {
                activeCount++;
            }
        }

        // Create array of active loans
        uint256[] memory activeLoans = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allLoans.length; i++) {
            if (loans[allLoans[i]].status == LoanStatus.ACTIVE) {
                activeLoans[index] = allLoans[i];
                index++;
            }
        }

        return activeLoans;
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Set liquidation engine contract
     * @param _liquidationEngine Address of liquidation engine
     */
    function setLiquidationEngine(address _liquidationEngine) external onlyOwner {
        require(_liquidationEngine != address(0), "Invalid address");
        liquidationEngine = ILiquidationEngine(_liquidationEngine);
    }

    /**
     * @notice Set platform fee
     * @param _platformFee Fee in basis points
     */
    function setPlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= 500, "Fee too high (max 5%)");
        platformFee = _platformFee;
    }

    /**
     * @notice Set treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    /**
     * @notice Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @notice Update accrued interest for a deposit
     * @param lender Address of lender
     */
    function _updateDepositInterest(address lender) internal {
        uint256 pendingInterest = _calculatePendingInterest(lender);
        if (pendingInterest > 0) {
            deposits[lender].accruedInterest += pendingInterest;
            deposits[lender].lastUpdateTime = block.timestamp;
        }
    }

    /**
     * @notice Calculate pending interest for a deposit
     * @param lender Address of lender
     * @return Pending interest amount
     */
    function _calculatePendingInterest(address lender) internal view returns (uint256) {
        Deposit memory userDeposit = deposits[lender];
        if (userDeposit.amount == 0) return 0;

        uint256 timeElapsed = block.timestamp - userDeposit.lastUpdateTime;
        if (timeElapsed == 0) return 0;

        uint256 supplyRate = getCurrentSupplyRate();
        
        // Interest = principal × rate × time / (365 days × 10000)
        return (userDeposit.amount * supplyRate * timeElapsed) / (365 days * 10000);
    }

    /**
     * @notice Update accrued interest for a loan
     * @param loanId Loan ID
     */
    function _updateLoanInterest(uint256 loanId) internal {
        Loan storage loan = loans[loanId];
        uint256 pendingInterest = _calculateLoanInterest(loan);
        
        if (pendingInterest > 0) {
            loan.accruedInterest += pendingInterest;
            loan.lastInterestUpdate = block.timestamp;
        }
    }

    /**
     * @notice Calculate pending interest for a loan
     * @param loan Loan struct
     * @return Pending interest amount
     */
    function _calculateLoanInterest(Loan memory loan) internal view returns (uint256) {
        if (loan.borrowedAmount == 0) return 0;

        uint256 timeElapsed = block.timestamp - loan.lastInterestUpdate;
        if (timeElapsed == 0) return 0;

        // Interest = principal × rate × time / (365 days × 10000)
        return (loan.borrowedAmount * loan.interestRate * timeElapsed) / (365 days * 10000);
    }

    /**
     * @notice Callback for liquidation engine to update pool state
     * @param debtRepaid Amount of debt paid back to pool
     */
    function onLiquidationComplete(uint256 debtRepaid) external {
        require(msg.sender == address(liquidationEngine), "Only liquidation engine");
        totalLiquidity += debtRepaid;
    }

    /**
     * @notice Emergency withdraw (only when paused)
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner whenPaused {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // Allow contract to receive ETH for Pyth price updates
    receive() external payable {}
}