import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { describe, it, beforeEach } from "node:test";
import { createPublicClient, createWalletClient, http, PublicClient, WalletClient, Account } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';

// We'll need to get the contract artifacts to deploy them manually
import P2PLendingPoolArtifact from "../artifacts/contracts/P2PLendingPool.sol/P2PLendingPool.json";
import MockERC20Artifact from "../artifacts/contracts/test/MockERC20.sol/MockERC20.json";
import MockPythArtifact from "../artifacts/contracts/test/MockPyth.sol/MockPyth.json";

use(chaiAsPromised);

describe("P2PLendingPool", function () {
  let publicClient: PublicClient;
  let owner: WalletClient;
  let borrower: WalletClient;
  let lender: WalletClient;
  let liquidator: WalletClient;

  let setup: { p2pLendingPoolContract: { address: `0x${string}`; abi: any; }; pythContract: { address: `0x${string}`; abi: any; }; pyusdTokenContract: { address: `0x${string}`; abi: any; }; collateralTokenContract: { address: `0x${string}`; abi: any; }; owner: WalletClient; borrower: WalletClient; lender: WalletClient; liquidator: WalletClient; publicClient: PublicClient; };

  beforeEach(async () => {
    publicClient = createPublicClient({
      chain: hardhat,
      transport: http(),
    });

    // Hardhat's default accounts

    const [ownerAddress, borrowerAddress, lenderAddress, liquidatorAddress] = await publicClient.request({
      method: "eth_accounts",
    });

    owner = createWalletClient({
      account: ownerAddress,
      chain: hardhat,
      transport: http(),
    });
    borrower = createWalletClient({
      account: borrowerAddress,
      chain: hardhat,
      transport: http(),
    });
    lender = createWalletClient({
      account: lenderAddress,
      chain: hardhat,
      transport: http(),
    });
    liquidator = createWalletClient({
      account: liquidatorAddress,
      chain: hardhat,
      transport: http(),
    });

    // Deploy MockPyth
    const pythHash = await owner.deployContract({
      abi: MockPythArtifact.abi,
      bytecode: MockPythArtifact.bytecode as `0x${string}`,
      args: [],
    });
    const pyth = await publicClient.waitForTransactionReceipt({ hash: pythHash });
    const pythContract = {
      address: pyth.contractAddress!,
      abi: MockPythArtifact.abi,
    };

    // Deploy MockERC20 (PYUSD)
    const pyusdTokenHash = await owner.deployContract({
      abi: MockERC20Artifact.abi,
      bytecode: MockERC20Artifact.bytecode as `0x${string}`,
      args: ["PYUSD", "PYUSD"],
    });
    const pyusdToken = await publicClient.waitForTransactionReceipt({ hash: pyusdTokenHash });
    const pyusdTokenContract = {
      address: pyusdToken.contractAddress!,
      abi: MockERC20Artifact.abi,
    };

    // Deploy MockERC20 (wETH)
    const collateralTokenHash = await owner.deployContract({
      abi: MockERC20Artifact.abi,
      bytecode: MockERC20Artifact.bytecode as `0x${string}`,
      args: ["wETH", "wETH"],
    });
    const collateralToken = await publicClient.waitForTransactionReceipt({ hash: collateralTokenHash });
    const collateralTokenContract = {
      address: collateralToken.contractAddress!,
      abi: MockERC20Artifact.abi,
    };

    // Deploy P2PLendingPool
    const p2pLendingPoolHash = await owner.deployContract({
      abi: P2PLendingPoolArtifact.abi,
      bytecode: P2PLendingPoolArtifact.bytecode as `0x${string}`,
      args: [pythContract.address, pyusdTokenContract.address],
    });
    const p2pLendingPool = await publicClient.waitForTransactionReceipt({ hash: p2pLendingPoolHash });
    const p2pLendingPoolContract = {
      address: p2pLendingPool.contractAddress!,
      abi: P2PLendingPoolArtifact.abi,
    };

    // Add collateral
    const priceFeedId = "0x0100000000000000000000000000000000000000000000000000000000000000";
    await owner.writeContract({
      address: p2pLendingPoolContract.address,
      abi: p2pLendingPoolContract.abi,
      functionName: "addApprovedCollateral",
      args: [collateralTokenContract.address, priceFeedId],
    });
    await owner.writeContract({
      address: pythContract.address,
      abi: pythContract.abi,
      functionName: "setPrice",
      args: [priceFeedId, 2000n * 10n ** 8n, -8],
    });

    // Mint tokens
    await owner.writeContract({
      address: collateralTokenContract.address,
      abi: collateralTokenContract.abi,
      functionName: "mint",
      args: [borrower.account.address, 10n * 10n ** 18n],
    });
    await owner.writeContract({
      address: pyusdTokenContract.address,
      abi: pyusdTokenContract.abi,
      functionName: "mint",
      args: [lender.account.address, 10000n * 10n ** 18n],
    });
    await owner.writeContract({
      address: pyusdTokenContract.address,
      abi: pyusdTokenContract.abi,
      functionName: "mint",
      args: [borrower.account.address, 10000n * 10n ** 18n],
    });

    setup = { p2pLendingPoolContract, pythContract, pyusdTokenContract, collateralTokenContract, owner, borrower, lender, liquidator, publicClient };
  });

  describe("Deployment", function () {
    it("Should set the right owner", async () => {
      const { p2pLendingPoolContract, owner } = setup;
      expect((await publicClient.readContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "owner",
      })).toLowerCase()).to.equal(owner.account.address.toLowerCase());
    });
  });

  describe("Collateral Management", function () {
    it("Should allow the owner to add approved collateral", async () => {
      const { p2pLendingPoolContract, owner } = setup;
      const tokenAddress = "0x0000000000000000000000000000000000000001";
      const priceFeedId = "0x0200000000000000000000000000000000000000000000000000000000000000";
      await owner.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "addApprovedCollateral",
        args: [tokenAddress, priceFeedId],
      });
      expect(await publicClient.readContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "isApprovedCollateral",
        args: [tokenAddress],
      })).to.be.true;
    });

    it("Should not allow non-owner to add approved collateral", async () => {
      const { p2pLendingPoolContract, borrower } = setup;
      const tokenAddress = "0x0000000000000000000000000000000000000001";
      const priceFeedId = "0x0200000000000000000000000000000000000000000000000000000000000000";
      await expect(borrower.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "addApprovedCollateral",
        args: [tokenAddress, priceFeedId],
      })).to.be.rejectedWith("Internal error");
    });
  });

  describe("Loan Creation", function () {
    it("Should allow a user to create a loan", async () => {
      const { p2pLendingPoolContract, collateralTokenContract, borrower } = setup;
      const pyusdAmount = 1000n * 10n ** 18n;
      const collateralAmount = 1n * 10n ** 18n;
      const duration = 30 * 24 * 60 * 60; // 30 days
      const interestRate = 500; // 5%

      await borrower.writeContract({
        address: collateralTokenContract.address,
        abi: collateralTokenContract.abi,
        functionName: "approve",
        args: [p2pLendingPoolContract.address, collateralAmount],
      });
      await borrower.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "createLoan",
        args: [pyusdAmount, collateralTokenContract.address, collateralAmount, duration, interestRate],
      });

      const loan = await publicClient.readContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "loans",
        args: [0],
      });
      expect(loan[1].toLowerCase()).to.equal(borrower.account.address.toLowerCase());
      expect(loan[3]).to.equal(pyusdAmount);
    });
  });

  describe("Loan Funding", function () {
    it("Should allow a lender to fund a loan", async () => {
      const { p2pLendingPoolContract, pyusdTokenContract, collateralTokenContract, borrower, lender } = setup;
      const pyusdAmount = 1000n * 10n ** 18n;
      const collateralAmount = 1n * 10n ** 18n;
      const duration = 30 * 24 * 60 * 60; // 30 days
      const interestRate = 500; // 5%

      await borrower.writeContract({
        address: collateralTokenContract.address,
        abi: collateralTokenContract.abi,
        functionName: "approve",
        args: [p2pLendingPoolContract.address, collateralAmount],
      });
      await borrower.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "createLoan",
        args: [pyusdAmount, collateralTokenContract.address, collateralAmount, duration, interestRate],
      });

      await lender.writeContract({
        address: pyusdTokenContract.address,
        abi: pyusdTokenContract.abi,
        functionName: "approve",
        args: [p2pLendingPoolContract.address, pyusdAmount],
      });
      await lender.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "fundLoan",
        args: [0],
      });

      const loan = await publicClient.readContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "loans",
        args: [0],
      });
      expect(loan[2].toLowerCase()).to.equal(lender.account.address.toLowerCase());
      expect(loan[11]).to.equal(1); // ACTIVE
    });
  });

  describe("Loan Repayment", function () {
    it("Should allow a borrower to repay a loan", async () => {
      const { p2pLendingPoolContract, pyusdTokenContract, collateralTokenContract, borrower, lender } = setup;
      const pyusdAmount = 1000n * 10n ** 18n;
      const collateralAmount = 1n * 10n ** 18n;
      const duration = 30 * 24 * 60 * 60; // 30 days
      const interestRate = 500; // 5%

      await borrower.writeContract({
        address: collateralTokenContract.address,
        abi: collateralTokenContract.abi,
        functionName: "approve",
        args: [p2pLendingPoolContract.address, collateralAmount],
      });
      await borrower.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "createLoan",
        args: [pyusdAmount, collateralTokenContract.address, collateralAmount, duration, interestRate],
      });

      await lender.writeContract({
        address: pyusdTokenContract.address,
        abi: pyusdTokenContract.abi,
        functionName: "approve",
        args: [p2pLendingPoolContract.address, pyusdAmount],
      });
      await lender.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "fundLoan",
        args: [0],
      });

      // Advance time to accrue interest
      console.log("block.timestamp before increaseTime:", (await publicClient.getBlock()).timestamp);
      await publicClient.request({ method: 'evm_increaseTime', params: [365 * 24 * 60 * 60] }); // 365 days (1 year)
      await publicClient.request({ method: 'evm_mine' });
      console.log("block.timestamp after increaseTime and mine:", (await publicClient.getBlock()).timestamp);

      const loanDetails = await publicClient.readContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "loans",
        args: [0],
      });
      const fundedAt = loanDetails[9]; // fundedAt is at index 9
      const currentTimestamp = (await publicClient.getBlock()).timestamp;
      const timeElapsed = currentTimestamp - fundedAt;
      const _interestRate = loanDetails[7]; // interestRate is at index 7
      const _pyusdAmount = loanDetails[3]; // pyusdAmount is at index 3

      const expectedInterest = (_pyusdAmount * _interestRate * timeElapsed) / (100n * 365n * 24n * 60n * 60n);
      const expectedTotalOwed = _pyusdAmount + expectedInterest;

      await borrower.writeContract({
        address: pyusdTokenContract.address,
        abi: pyusdTokenContract.abi,
        functionName: "approve",
        args: [p2pLendingPoolContract.address, expectedTotalOwed],
      });
      await borrower.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "repayLoan",
        args: [0, expectedTotalOwed],
      });

      const loan = await publicClient.readContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "loans",
        args: [0],
      });
      expect(loan[11]).to.equal(2); // REPAID
    });
  });

  describe("Loan Liquidation", function () {
    it("Should allow a liquidator to liquidate a loan", async () => {
      const { p2pLendingPoolContract, pythContract, pyusdTokenContract, collateralTokenContract, borrower, lender, liquidator, owner } = setup;
      const pyusdAmount = 1500n * 10n ** 18n;
      const collateralAmount = 2n * 10n ** 18n;
      const duration = 30 * 24 * 60 * 60; // 30 days
      const interestRate = 500; // 5%

      await borrower.writeContract({
        address: collateralTokenContract.address,
        abi: collateralTokenContract.abi,
        functionName: "approve",
        args: [p2pLendingPoolContract.address, collateralAmount],
      });
      await borrower.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "createLoan",
        args: [pyusdAmount, collateralTokenContract.address, collateralAmount, duration, interestRate],
      });

      await lender.writeContract({
        address: pyusdTokenContract.address,
        abi: pyusdTokenContract.abi,
        functionName: "approve",
        args: [p2pLendingPoolContract.address, pyusdAmount],
      });
      await lender.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "fundLoan",
        args: [0],
      });

      // Drop collateral value
      const priceFeedId = "0x0100000000000000000000000000000000000000000000000000000000000000";
      await owner.writeContract({
        address: pythContract.address,
        abi: pythContract.abi,
        functionName: "setPrice",
        args: [priceFeedId, 1000n * 10n ** 8n, -8],
      });

      await liquidator.writeContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "liquidate",
        args: [0],
      });

      const loan = await publicClient.readContract({
        address: p2pLendingPoolContract.address,
        abi: p2pLendingPoolContract.abi,
        functionName: "loans",
        args: [0],
      });
      expect(loan[11]).to.equal(3); // LIQUIDATED
    });
  });
});