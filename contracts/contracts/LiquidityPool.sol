// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./test/MockERC20.sol";
import "./test/MockPyth.sol";

contract LiquidityPool {
    address public immutable owner;
    MockPyth public immutable pyth;

    struct AssetInfo {
        uint256 totalLiquidity;
        uint256 totalBorrowed;
        // Add more fields for interest rate calculation, etc.
    }

    mapping(address => bool) public supportedAssets;
    mapping(address => AssetInfo) public assetInformation;
    mapping(address => mapping(address => uint256)) public userBalances; // user => asset => amount
    mapping(address => mapping(address => uint256)) public userBorrows; // user => asset => amount

    event AssetSupported(address indexed asset);
    event Deposited(address indexed user, address indexed asset, uint256 amount);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount);
    event Borrowed(address indexed user, address indexed asset, uint256 amount);
    event Repaid(address indexed user, address indexed asset, uint256 amount);

    constructor(address _pythAddress) {
        owner = msg.sender;
        pyth = MockPyth(_pythAddress);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    function addSupportedAsset(address _asset) public onlyOwner {
        require(_asset != address(0), "Invalid asset address");
        require(!supportedAssets[_asset], "Asset already supported");
        supportedAssets[_asset] = true;
        emit AssetSupported(_asset);
    }

    function deposit(address _asset, uint256 _amount) public {
        require(supportedAssets[_asset], "Asset not supported");
        require(_amount > 0, "Deposit amount must be greater than zero");

        MockERC20(_asset).transferFrom(msg.sender, address(this), _amount);

        userBalances[msg.sender][_asset] += _amount;
        assetInformation[_asset].totalLiquidity += _amount;

        emit Deposited(msg.sender, _asset, _amount);
    }

    function withdraw(address _asset, uint256 _amount) public {
        require(supportedAssets[_asset], "Asset not supported");
        require(_amount > 0, "Withdrawal amount must be greater than zero");
        require(userBalances[msg.sender][_asset] >= _amount, "Insufficient balance");
        // TODO: Add checks for borrowed amount and collateral ratio

        userBalances[msg.sender][_asset] -= _amount;
        assetInformation[_asset].totalLiquidity -= _amount;

        MockERC20(_asset).transfer(msg.sender, _amount);

        emit Withdrawn(msg.sender, _asset, _amount);
    }

    function borrow(address _asset, uint256 _amount) public {
        require(supportedAssets[_asset], "Asset not supported");
        require(_amount > 0, "Borrow amount must be greater than zero");
        require(assetInformation[_asset].totalLiquidity - assetInformation[_asset].totalBorrowed >= _amount, "Insufficient liquidity in pool");
        // TODO: Implement collateral check using Pyth oracle

        userBorrows[msg.sender][_asset] += _amount;
        assetInformation[_asset].totalBorrowed += _amount;

        MockERC20(_asset).transfer(msg.sender, _amount);

        emit Borrowed(msg.sender, _asset, _amount);
    }

    function repay(address _asset, uint256 _amount) public {
        require(supportedAssets[_asset], "Asset not supported");
        require(_amount > 0, "Repay amount must be greater than zero");
        require(userBorrows[msg.sender][_asset] > 0, "No outstanding borrow for this asset");
        require(_amount <= userBorrows[msg.sender][_asset], "Repay amount exceeds outstanding borrow");
        // TODO: Calculate and apply interest

        uint256 actualRepayAmount = _amount; // Placeholder, will include interest
        if (userBorrows[msg.sender][_asset] < actualRepayAmount) {
            actualRepayAmount = userBorrows[msg.sender][_asset];
        }

        MockERC20(_asset).transferFrom(msg.sender, address(this), actualRepayAmount);

        userBorrows[msg.sender][_asset] -= actualRepayAmount;
        assetInformation[_asset].totalBorrowed -= actualRepayAmount;

        emit Repaid(msg.sender, _asset, actualRepayAmount);
    }
}