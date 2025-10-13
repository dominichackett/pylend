// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

contract P2PLendingPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct Loan {
        uint256 id;
        address borrower;
        address lender;
        uint256 pyusdAmount;
        address collateralToken;
        uint256 collateralAmount;
        bytes32 priceFeedId;
        uint256 interestRate;
        uint256 duration;
        uint256 createdAt;
        uint256 fundedAt;
        Status status;
    }

    enum Status {
        PENDING,
        ACTIVE,
        REPAID,
        LIQUIDATED
    }

    IPyth public pyth;
    address public pyusdToken;

    mapping(address => bool) public isApprovedCollateral;
    mapping(address => bytes32) public collateralPriceFeedIds;
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId;

    uint256 public constant LIQUIDATION_THRESHOLD = 150; // 150%

    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 pyusdAmount, address collateralToken, uint256 collateralAmount, uint256 interestRate, uint256 duration);
    event LoanFunded(uint256 indexed loanId, address indexed lender);
    event PaymentMade(uint256 indexed loanId, uint256 amount);
    event LoanRepaid(uint256 indexed loanId);
    event LoanLiquidated(uint256 indexed loanId, address indexed liquidator, uint256 collateralLiquidated);
    event CollateralApproved(address indexed token, bytes32 indexed priceFeedId);
    event CollateralRemoved(address indexed token);

    constructor(address _pyth, address _pyusdToken) Ownable(msg.sender) {
        pyth = IPyth(_pyth);
        pyusdToken = _pyusdToken;
    }

    function addApprovedCollateral(address tokenAddress, bytes32 priceFeedId) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        require(priceFeedId != 0, "Invalid price feed ID");
        isApprovedCollateral[tokenAddress] = true;
        collateralPriceFeedIds[tokenAddress] = priceFeedId;
        emit CollateralApproved(tokenAddress, priceFeedId);
    }

    function removeApprovedCollateral(address tokenAddress) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        isApprovedCollateral[tokenAddress] = false;
        delete collateralPriceFeedIds[tokenAddress];
        emit CollateralRemoved(tokenAddress);
    }

    function createLoan(uint256 pyusdAmount, address collateralToken, uint256 collateralAmount, uint256 duration, uint256 interestRate) external nonReentrant {
        require(isApprovedCollateral[collateralToken], "Collateral not approved");
        require(pyusdAmount > 0, "Loan amount must be positive");
        require(collateralAmount > 0, "Collateral amount must be positive");

        bytes32 priceFeedId = collateralPriceFeedIds[collateralToken];
        uint256 collateralValue = getCollateralValue(collateralToken, collateralAmount, priceFeedId);
        require(collateralValue >= (pyusdAmount * LIQUIDATION_THRESHOLD) / 100, "Insufficient collateral");

        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);

        loans[nextLoanId] = Loan({
            id: nextLoanId,
            borrower: msg.sender,
            lender: address(0),
            pyusdAmount: pyusdAmount,
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            priceFeedId: priceFeedId,
            interestRate: interestRate,
            duration: duration,
            createdAt: block.timestamp,
            fundedAt: 0,
            status: Status.PENDING
        });

        emit LoanCreated(nextLoanId, msg.sender, pyusdAmount, collateralToken, collateralAmount, interestRate, duration);
        nextLoanId++;
    }

    function fundLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == Status.PENDING, "Loan not pending");

        loan.lender = msg.sender;
        loan.status = Status.ACTIVE;
        loan.fundedAt = block.timestamp;

        IERC20(pyusdToken).safeTransferFrom(msg.sender, loan.borrower, loan.pyusdAmount);

        emit LoanFunded(loanId, msg.sender);
    }

    function repayLoan(uint256 loanId, uint256 amount) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == Status.ACTIVE, "Loan not active");
        require(msg.sender == loan.borrower, "Only borrower can repay");

        uint256 totalOwed = calculateTotalOwed(loanId);
        require(amount <= totalOwed, "Repayment exceeds amount owed");

        IERC20(pyusdToken).safeTransferFrom(msg.sender, loan.lender, amount);

        emit PaymentMade(loanId, amount);

        if (amount == totalOwed) {
            loan.status = Status.REPAID;
            IERC20(loan.collateralToken).safeTransfer(loan.borrower, loan.collateralAmount);
            emit LoanRepaid(loanId);
        }
    }

    function liquidate(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == Status.ACTIVE, "Loan not active");

        uint256 collateralValue = getCollateralValue(loan.collateralToken, loan.collateralAmount, loan.priceFeedId);
        uint256 totalOwed = calculateTotalOwed(loanId);

        require(collateralValue < (totalOwed * LIQUIDATION_THRESHOLD) / 100, "Collateral ratio not met");

        loan.status = Status.LIQUIDATED;
        IERC20(loan.collateralToken).safeTransfer(msg.sender, loan.collateralAmount);

        emit LoanLiquidated(loanId, msg.sender, loan.collateralAmount);
    }

    function addCollateral(uint256 loanId, uint256 amount) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == Status.ACTIVE, "Loan not active");
        require(msg.sender == loan.borrower, "Only borrower can add collateral");
        require(amount > 0, "Amount must be positive");

        IERC20(loan.collateralToken).safeTransferFrom(msg.sender, address(this), amount);
        loan.collateralAmount += amount;
    }

    function getCollateralValue(address tokenAddress, uint256 amount, bytes32 priceFeedId) public view returns (uint256) {
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceFeedId);
        uint256 priceValue = uint256(int256(price.price));
        if (price.expo >= 0) {
            return priceValue * (10**uint256(int256(price.expo))) * amount;
        } else {
            return (priceValue * amount) / (10**uint256(int256(-price.expo)));
        }
    }

    function calculateTotalOwed(uint256 loanId) public view returns (uint256) {
        Loan storage loan = loans[loanId];
        if (loan.status != Status.ACTIVE) {
            return 0;
        }
        uint256 timeElapsed = block.timestamp - loan.fundedAt;
        uint256 interest = (loan.pyusdAmount * loan.interestRate * timeElapsed) / (100 * 365 days);
        return loan.pyusdAmount + interest;
    }
}