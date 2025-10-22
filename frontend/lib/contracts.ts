import { Address } from "viem";

export const lendingPoolAddress: Address = "0x8e1207975db83b7f6ebdeef66e7693da07dfc123";

export const LendingPoolABI = [{
    "inputs": [
        {
            "internalType": "address",
            "name": "_pyusdToken",
            "type": "address"
        },
        {
            "internalType": "address",
            "name": "_priceOracle",
            "type": "address"
        },
        {
            "internalType": "address",
            "name": "_interestRateModel",
            "type": "address"
        },
        {
            "internalType": "address",
            "name": "_treasury",
            "type": "address"
        }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
}, {
    "inputs": [],
    "name": "EnforcedPause",
    "type": "error"
}, {
    "inputs": [],
    "name": "ExpectedPause",
    "type": "error"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "owner",
            "type": "address"
        }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "account",
            "type": "address"
        }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
}, {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "token",
            "type": "address"
        }
    ],
    "name": "SafeERC20FailedOperation",
    "type": "error"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": true,
            "internalType": "address",
            "name": "token",
            "type": "address"
        },
        {
            "indexed": false,
            "internalType": "bytes32",
            "name": "priceFeedId",
            "type": "bytes32"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "threshold",
            "type": "uint256"
        }
    ],
    "name": "CollateralAdded",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": true,
            "internalType": "address",
            "name": "token",
            "type": "address"
        }
    ],
    "name": "CollateralRemoved",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": true,
            "internalType": "address",
            "name": "lender",
            "type": "address"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
        }
    ],
    "name": "Deposited",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": true,
            "internalType": "uint256",
            "name": "loanId",
            "type": "uint256"
        },
        {
            "indexed": true,
            "internalType": "address",
            "name": "borrower",
            "type": "address"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "borrowedAmount",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "address",
            "name": "collateralToken",
            "type": "address"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "collateralAmount",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "interestRate",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
        }
    ],
    "name": "LoanCreated",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": true,
            "internalType": "uint256",
            "name": "loanId",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "totalRepaid",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
        }
    ],
    "name": "LoanFullyRepaid",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": true,
            "internalType": "uint256",
            "name": "loanId",
            "type": "uint256"
        },
        {
            "indexed": true,
            "internalType": "address",
            "name": "liquidator",
            "type": "address"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "debtPaid",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
        }
    ],
    "name": "LoanLiquidated",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": true,
            "internalType": "uint256",
            "name": "loanId",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "remainingDebt",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
        }
    ],
    "name": "LoanRepaid",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": true,
            "internalType": "address",
            "name": "previousOwner",
            "type": "address"
        },
        {
            "indexed": true,
            "internalType": "address",
            "name": "newOwner",
            "type": "address"
        }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": false,
            "internalType": "address",
            "name": "account",
            "type": "address"
        }
    ],
    "name": "Paused",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        }
    ],
    "name": "PlatformFeeCollected",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": false,
            "internalType": "address",
            "name": "account",
            "type": "address"
        }
    ],
    "name": "Unpaused",
    "type": "event"
}, {
    "anonymous": false,
    "inputs": [
        {
            "indexed": true,
            "internalType": "address",
            "name": "lender",
            "type": "address"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "interest",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
        }
    ],
    "name": "Withdrawn",
    "type": "event"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "token",
            "type": "address"
        },
        {
            "internalType": "bytes32",
            "name": "priceFeedId",
            "type": "bytes32"
        },
        {
            "internalType": "uint256",
            "name": "liquidationThreshold",
            "type": "uint256"
        },
        {
            "internalType": "uint8",
            "name": "decimals",
            "type": "uint8"
        }
    ],
    "name": "addCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "",
            "type": "address"
        }
    ],
    "name": "approvedCollateral",
    "outputs": [
        {
            "internalType": "bool",
            "name": "isApproved",
            "type": "bool"
        },
        {
            "internalType": "bytes32",
            "name": "priceFeedId",
            "type": "bytes32"
        },
        {
            "internalType": "uint256",
            "name": "liquidationThreshold",
            "type": "uint256"
        },
        {
            "internalType": "uint8",
            "name": "decimals",
            "type": "uint8"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        },
        {
            "internalType": "address",
            "name": "collateralToken",
            "type": "address"
        },
        {
            "internalType": "uint256",
            "name": "collateralAmount",
            "type": "uint256"
        }
    ],
    "name": "borrow",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        }
    ],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "",
            "type": "address"
        }
    ],
    "name": "deposits",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        },
        {
            "internalType": "uint256",
            "name": "lastUpdateTime",
            "type": "uint256"
        },
        {
            "internalType": "uint256",
            "name": "accruedInterest",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "token",
            "type": "address"
        },
        {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        }
    ],
    "name": "emergencyWithdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [],
    "name": "getCurrentBorrowRate",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "getCurrentSupplyRate",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "lender",
            "type": "address"
        }
    ],
    "name": "getDepositWithInterest",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "collateralToken",
            "type": "address"
        },
        {
            "internalType": "uint256",
            "name": "collateralAmount",
            "type": "uint256"
        }
    ],
    "name": "getMaxBorrowAmount",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "loanId",
            "type": "uint256"
        }
    ],
    "name": "getTotalDebt",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "user",
            "type": "address"
        }
    ],
    "name": "getUserActiveLoans",
    "outputs": [
        {
            "internalType": "uint256[]",
            "name": "",
            "type": "uint256[]"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "getUtilizationRate",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "interestRateModel",
    "outputs": [
        {
            "internalType": "contract IInterestRateModel",
            "name": "",
            "type": "address"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "loanId",
            "type": "uint256"
        }
    ],
    "name": "isLiquidatable",
    "outputs": [
        {
            "internalType": "bool",
            "name": "",
            "type": "bool"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "loanId",
            "type": "uint256"
        },
        {
            "internalType": "bytes[]",
            "name": "priceUpdateData",
            "type": "bytes[]"
        }
    ],
    "name": "liquidate",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
}, {
    "inputs": [],
    "name": "liquidationEngine",
    "outputs": [
        {
            "internalType": "contract ILiquidationEngine",
            "name": "",
            "type": "address"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "loanCounter",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "name": "loans",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
        },
        {
            "internalType": "address",
            "name": "borrower",
            "type": "address"
        },
        {
            "internalType": "uint256",
            "name": "borrowedAmount",
            "type": "uint256"
        },
        {
            "internalType": "address",
            "name": "collateralToken",
            "type": "address"
        },
        {
            "internalType": "uint256",
            "name": "collateralAmount",
            "type": "uint256"
        },
        {
            "internalType": "uint256",
            "name": "interestRate",
            "type": "uint256"
        },
        {
            "internalType": "uint256",
            "name": "borrowedAt",
            "type": "uint256"
        },
        {
            "internalType": "uint256",
            "name": "lastInterestUpdate",
            "type": "uint256"
        },
        {
            "internalType": "uint256",
            "name": "accruedInterest",
            "type": "uint256"
        },
        {
            "internalType": "enum LendingPool.LoanStatus",
            "name": "status",
            "type": "uint8"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "debtRepaid",
            "type": "uint256"
        }
    ],
    "name": "onLiquidationComplete",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [],
    "name": "owner",
    "outputs": [
        {
            "internalType": "address",
            "name": "",
            "type": "address"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [],
    "name": "paused",
    "outputs": [
        {
            "internalType": "bool",
            "name": "",
            "type": "bool"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "platformFee",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "priceOracle",
    "outputs": [
        {
            "internalType": "contract IPriceOracle",
            "name": "",
            "type": "address"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "pyusdToken",
    "outputs": [
        {
            "internalType": "address",
            "name": "",
            "type": "address"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "token",
            "type": "address"
        }
    ],
    "name": "removeCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "loanId",
            "type": "uint256"
        },
        {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        }
    ],
    "name": "repay",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "_liquidationEngine",
            "type": "address"
        }
    ],
    "name": "setLiquidationEngine",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "_platformFee",
            "type": "uint256"
        }
    ],
    "name": "setPlatformFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "_treasury",
            "type": "address"
        }
    ],
    "name": "setTreasury",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [],
    "name": "totalBadDebt",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "totalBorrowed",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "totalLiquidity",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "newOwner",
            "type": "address"
        }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [],
    "name": "treasury",
    "outputs": [
        {
            "internalType": "address",
            "name": "",
            "type": "address"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "address",
            "name": "",
            "type": "address"
        },
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "name": "userLoans",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}, {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "stateMutability": "payable",
    "type": "receive"
}];