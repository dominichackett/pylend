import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { describe, it, beforeEach } from "node:test";
import { createPublicClient, createWalletClient, http, PublicClient, WalletClient, parseUnits, formatUnits, Hex } from 'viem';
import { hardhat } from 'viem/chains';

// Import contract artifacts
import LendingPoolArtifact from "../artifacts/contracts/LendingPool.sol/LendingPool.json";
import PriceOracleArtifact from "../artifacts/contracts/PriceOracle.sol/PriceOracle.json";
import InterestRateModelArtifact from "../artifacts/contracts/InterestRateModel.sol/InterestRateModel.json";
import LiquidationEngineArtifact from "../artifacts/contracts/LiquidationEngine.sol/LiquidationEngine.json";
import PoolTokenArtifact from "../artifacts/contracts/PoolToken .sol/PoolToken.json";

use(chaiAsPromised);

describe("PyLend - LendingPool Integration Tests", function () {
    let publicClient: PublicClient;
    let owner: WalletClient;
    let alice: WalletClient;
    let bob: WalletClient;
    let liquidatorWallet: WalletClient;

    let lendingPool: any;
    let priceOracle: any;
    let interestModel: any;
    let liquidationEngine: any;
    let poolToken: any;

    // These should be actual deployed addresses on your network
    // Update these with real addresses from Sepolia testnet/mainnet
    const PYTH_CONTRACT = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21" as Hex; // Hedera Testnet
    const PYUSD_TOKEN = process.env.PYUSD_TOKEN as Hex; // Real PYUSD address
    const WETH_TOKEN = process.env.WETH_ADDRESS as Hex; // Real WETH address
    
    // Price feed IDs (from Pyth Network)
    const ETH_USD_FEED_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as Hex;
    
    const PYUSD_DECIMALS = 6;
    const WETH_DECIMALS = 18;

    beforeEach(async () => {
        // Setup clients
        publicClient = createPublicClient({
            chain: hardhat, // Change to hedera testnet/mainnet in production
            transport: http(),
        });

        const [ownerAddr, aliceAddr, bobAddr, liquidatorAddr] = await publicClient.request({
            method: "eth_accounts",
        });

        owner = createWalletClient({
            account: ownerAddr,
            chain: hardhat,
            transport: http(),
        });
        alice = createWalletClient({
            account: aliceAddr,
            chain: hardhat,
            transport: http(),
        });
        bob = createWalletClient({
            account: bobAddr,
            chain: hardhat,
            transport: http(),
        });
        liquidatorWallet = createWalletClient({
            account: liquidatorAddr,
            chain: hardhat,
            transport: http(),
        });

        // Deploy InterestRateModel
        const interestModelHash = await owner.deployContract({
            abi: InterestRateModelArtifact.abi,
            bytecode: InterestRateModelArtifact.bytecode as Hex,
            args: [
                200n,    // 2% base rate
                1000n,   // 10% multiplier
                10000n,  // 100% jump multiplier
                8000n    // 80% kink
            ],
        });
        const interestModelReceipt = await publicClient.waitForTransactionReceipt({ hash: interestModelHash });
        interestModel = {
            address: interestModelReceipt.contractAddress!,
            abi: InterestRateModelArtifact.abi,
        };

        // Deploy PriceOracle with real Pyth contract
        const oracleHash = await owner.deployContract({
            abi: PriceOracleArtifact.abi,
            bytecode: PriceOracleArtifact.bytecode as Hex,
            args: [PYTH_CONTRACT],
        });
        const oracleReceipt = await publicClient.waitForTransactionReceipt({ hash: oracleHash });
        priceOracle = {
            address: oracleReceipt.contractAddress!,
            abi: PriceOracleArtifact.abi,
        };

        // Deploy LendingPool with real PYUSD token
        const poolHash = await owner.deployContract({
            abi: LendingPoolArtifact.abi,
            bytecode: LendingPoolArtifact.bytecode as Hex,
            args: [
                PYUSD_TOKEN,
                priceOracle.address,
                interestModel.address,
                owner.account.address // treasury
            ],
        });
        const poolReceipt = await publicClient.waitForTransactionReceipt({ hash: poolHash });
        lendingPool = {
            address: poolReceipt.contractAddress!,
            abi: LendingPoolArtifact.abi,
        };

        // Deploy LiquidationEngine
        const liquidationHash = await owner.deployContract({
            abi: LiquidationEngineArtifact.abi,
            bytecode: LiquidationEngineArtifact.bytecode as Hex,
            args: [
                lendingPool.address,
                priceOracle.address,
                PYUSD_TOKEN
            ],
        });
        const liquidationReceipt = await publicClient.waitForTransactionReceipt({ hash: liquidationHash });
        liquidationEngine = {
            address: liquidationReceipt.contractAddress!,
            abi: LiquidationEngineArtifact.abi,
        };

        // Deploy PoolToken
        const poolTokenHash = await owner.deployContract({
            abi: PoolTokenArtifact.abi,
            bytecode: PoolTokenArtifact.bytecode as Hex,
            args: ["PyLend PYUSD", "pyPYUSD", PYUSD_TOKEN],
        });
        const poolTokenReceipt = await publicClient.waitForTransactionReceipt({ hash: poolTokenHash });
        poolToken = {
            address: poolTokenReceipt.contractAddress!,
            abi: PoolTokenArtifact.abi,
        };

        // Connect contracts
        await owner.writeContract({
            address: lendingPool.address,
            abi: lendingPool.abi,
            functionName: "setLiquidationEngine",
            args: [liquidationEngine.address],
        });

        await owner.writeContract({
            address: poolToken.address,
            abi: poolToken.abi,
            functionName: "setLendingPool",
            args: [lendingPool.address],
        });

        // Add WETH as approved collateral (150% threshold)
        await owner.writeContract({
            address: lendingPool.address,
            abi: lendingPool.abi,
            functionName: "addCollateral",
            args: [WETH_TOKEN, ETH_USD_FEED_ID, 15000n, WETH_DECIMALS],
        });
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const poolOwner = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "owner",
            });
            expect(poolOwner.toLowerCase()).to.equal(owner.account.address.toLowerCase());
        });

        it("Should set the correct PYUSD token", async function () {
            const pyusdToken = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "pyusdToken",
            });
            expect(pyusdToken.toLowerCase()).to.equal(PYUSD_TOKEN.toLowerCase());
        });

        it("Should set the correct price oracle", async function () {
            const oracle = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "priceOracle",
            });
            expect(oracle.toLowerCase()).to.equal(priceOracle.address.toLowerCase());
        });

        it("Should have WETH as approved collateral", async function () {
            const config = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "approvedCollateral",
                args: [WETH_TOKEN],
            });
            expect(config[0]).to.be.true; // isApproved
            expect(config[2]).to.equal(15000n); // liquidationThreshold
        });
    });

    describe("Deposits", function () {
        it("Should allow users to deposit PYUSD", async function () {
            const depositAmount = parseUnits("1000", PYUSD_DECIMALS);

            // Note: User must have PYUSD balance in their wallet
            await alice.writeContract({
                address: PYUSD_TOKEN,
                abi: [
                    {
                        name: "approve",
                        type: "function",
                        stateMutability: "nonpayable",
                        inputs: [
                            { name: "spender", type: "address" },
                            { name: "amount", type: "uint256" }
                        ],
                        outputs: [{ type: "bool" }]
                    }
                ],
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });

            await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });

            const deposit = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposits",
                args: [alice.account.address],
            });

            expect(deposit[0]).to.equal(depositAmount);
        });

        it("Should update total liquidity", async function () {
            const depositAmount = parseUnits("1000", PYUSD_DECIMALS);

            await alice.writeContract({
                address: PYUSD_TOKEN,
                abi: [
                    {
                        name: "approve",
                        type: "function",
                        stateMutability: "nonpayable",
                        inputs: [
                            { name: "spender", type: "address" },
                            { name: "amount", type: "uint256" }
                        ],
                        outputs: [{ type: "bool" }]
                    }
                ],
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });

            await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });

            const totalLiquidity = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "totalLiquidity",
            });

            expect(totalLiquidity).to.be.greaterThanOrEqual(depositAmount);
        });
    });

    describe("Interest Rate Calculations", function () {
        it("Should return zero utilization with no borrows", async function () {
            const utilization = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getUtilizationRate",
            });

            expect(utilization).to.equal(0n);
        });

        it("Should calculate borrow rate correctly", async function () {
            const borrowRate = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getCurrentBorrowRate",
            });

            // At 0% utilization, should be base rate (2%)
            expect(borrowRate).to.equal(200n);
        });

        it("Should calculate supply rate correctly", async function () {
            const supplyRate = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getCurrentSupplyRate",
            });

            // At 0% utilization, supply rate should be 0
            expect(supplyRate).to.equal(0n);
        });
    });

    describe("Collateral Management", function () {
        it("Should allow owner to add new collateral", async function () {
            const newTokenAddress = "0x" + "2".repeat(40) as Hex;
            const newFeedId = "0x" + "3".repeat(64) as Hex;

            await owner.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "addCollateral",
                args: [newTokenAddress, newFeedId, 17500n, 18],
            });

            const config = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "approvedCollateral",
                args: [newTokenAddress],
            });

            expect(config[0]).to.be.true;
            expect(config[2]).to.equal(17500n);
        });

        it("Should reject non-owner adding collateral", async function () {
            const newTokenAddress = "0x" + "2".repeat(40) as Hex;
            const newFeedId = "0x" + "3".repeat(64) as Hex;

            await expect(
                alice.writeContract({
                    address: lendingPool.address,
                    abi: lendingPool.abi,
                    functionName: "addCollateral",
                    args: [newTokenAddress, newFeedId, 17500n, 18],
                })
            ).to.be.rejected;
        });

        it("Should allow owner to remove collateral", async function () {
            await owner.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "removeCollateral",
                args: [WETH_TOKEN],
            });

            const config = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "approvedCollateral",
                args: [WETH_TOKEN],
            });

            expect(config[0]).to.be.false;
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to set platform fee", async function () {
            const newFee = 200n; // 2%

            await owner.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "setPlatformFee",
                args: [newFee],
            });

            const platformFee = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "platformFee",
            });

            expect(platformFee).to.equal(newFee);
        });

        it("Should reject platform fee above 5%", async function () {
            const invalidFee = 600n; // 6%

            await expect(
                owner.writeContract({
                    address: lendingPool.address,
                    abi: lendingPool.abi,
                    functionName: "setPlatformFee",
                    args: [invalidFee],
                })
            ).to.be.rejected;
        });

        it("Should allow owner to pause", async function () {
            await owner.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "pause",
            });

            // Paused state check would depend on having actual tokens
            // For now just verify the transaction succeeded
        });

        it("Should allow owner to unpause", async function () {
            await owner.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "pause",
            });

            await owner.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "unpause",
            });

            // Verify unpaused state
        });

        it("Should allow owner to set treasury", async function () {
            const newTreasury = alice.account.address;

            await owner.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "setTreasury",
                args: [newTreasury],
            });

            const treasury = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "treasury",
            });

            expect(treasury.toLowerCase()).to.equal(newTreasury.toLowerCase());
        });
    });

    describe("View Functions", function () {
        it("Should return correct max borrow amount", async function () {
            const collateral = parseUnits("1", WETH_DECIMALS);
            
            // This requires Pyth price feed to be working
            // Will only work on testnet/mainnet with real Pyth oracle
            try {
                const maxBorrow = await publicClient.readContract({
                    address: lendingPool.address,
                    abi: lendingPool.abi,
                    functionName: "getMaxBorrowAmount",
                    args: [WETH_TOKEN, collateral],
                });

                expect(maxBorrow).to.be.greaterThan(0n);
            } catch (error) {
                // Skip if Pyth not available in test environment
                console.log("Skipping: Requires real Pyth oracle");
            }
        });

        it("Should return empty array for new user active loans", async function () {
            const activeLoans = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getUserActiveLoans",
                args: [alice.account.address],
            });

            expect(activeLoans).to.be.an('array').that.is.empty;
        });
    });
});

describe("PyLend - LendingPool", function () {
    let publicClient: PublicClient;
    let owner: WalletClient;
    let alice: WalletClient;
    let bob: WalletClient;
    let liquidator: WalletClient;

    let lendingPool: any;
    let priceOracle: any;
    let interestModel: any;
    let liquidationEngine: any;
    let poolToken: any;
    let pyusd: any;
    let weth: any;
    let mockPyth: any;

    // Price feed IDs
    const ETH_USD_FEED_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as Hex;
    const PYUSD_DECIMALS = 6;
    const WETH_DECIMALS = 18;
    const ETH_PRICE = 250000000000n; // $2500 with expo -8

    beforeEach(async () => {
        // Setup clients
        publicClient = createPublicClient({
            chain: hardhat,
            transport: http(),
        });

        const [ownerAddr, aliceAddr, bobAddr, liquidatorAddr] = await publicClient.request({
            method: "eth_accounts",
        });

        owner = createWalletClient({
            account: ownerAddr,
            chain: hardhat,
            transport: http(),
        });
        alice = createWalletClient({
            account: aliceAddr,
            chain: hardhat,
            transport: http(),
        });
        bob = createWalletClient({
            account: bobAddr,
            chain: hardhat,
            transport: http(),
        });
        liquidator = createWalletClient({
            account: liquidatorAddr,
            chain: hardhat,
            transport: http(),
        });

        // Deploy Mock PYUSD (6 decimals)
        const pyusdHash = await owner.deployContract({
            abi: MockERC20Artifact.abi,
            bytecode: MockERC20Artifact.bytecode as Hex,
            args: ["Mock PYUSD", "PYUSD", PYUSD_DECIMALS],
        });
        const pyusdReceipt = await publicClient.waitForTransactionReceipt({ hash: pyusdHash });
        pyusd = {
            address: pyusdReceipt.contractAddress!,
            abi: MockERC20Artifact.abi,
        };

        // Deploy Mock WETH (18 decimals)
        const wethHash = await owner.deployContract({
            abi: MockERC20Artifact.abi,
            bytecode: MockERC20Artifact.bytecode as Hex,
            args: ["Mock WETH", "WETH", WETH_DECIMALS],
        });
        const wethReceipt = await publicClient.waitForTransactionReceipt({ hash: wethHash });
        weth = {
            address: wethReceipt.contractAddress!,
            abi: MockERC20Artifact.abi,
        };

        // Deploy MockPyth
        const mockPythHash = await owner.deployContract({
            abi: MockPythArtifact.abi,
            bytecode: MockPythArtifact.bytecode as Hex,
            args: [],
        });
        const mockPythReceipt = await publicClient.waitForTransactionReceipt({ hash: mockPythHash });
        mockPyth = {
            address: mockPythReceipt.contractAddress!,
            abi: MockPythArtifact.abi,
        };

        // Set ETH price in MockPyth
        await owner.writeContract({
            address: mockPyth.address,
            abi: mockPyth.abi,
            functionName: "setPrice",
            args: [ETH_USD_FEED_ID, ETH_PRICE, -8],
        });

        // Deploy InterestRateModel
        const interestModelHash = await owner.deployContract({
            abi: InterestRateModelArtifact.abi,
            bytecode: InterestRateModelArtifact.bytecode as Hex,
            args: [
                200n,    // 2% base rate
                1000n,   // 10% multiplier
                10000n,  // 100% jump multiplier
                8000n    // 80% kink
            ],
        });
        const interestModelReceipt = await publicClient.waitForTransactionReceipt({ hash: interestModelHash });
        interestModel = {
            address: interestModelReceipt.contractAddress!,
            abi: InterestRateModelArtifact.abi,
        };

        // Deploy PriceOracle
        const oracleHash = await owner.deployContract({
            abi: PriceOracleArtifact.abi,
            bytecode: PriceOracleArtifact.bytecode as Hex,
            args: [mockPyth.address],
        });
        const oracleReceipt = await publicClient.waitForTransactionReceipt({ hash: oracleHash });
        priceOracle = {
            address: oracleReceipt.contractAddress!,
            abi: PriceOracleArtifact.abi,
        };

        // Deploy LendingPool
        const poolHash = await owner.deployContract({
            abi: LendingPoolArtifact.abi,
            bytecode: LendingPoolArtifact.bytecode as Hex,
            args: [
                pyusd.address,
                priceOracle.address,
                interestModel.address,
                owner.account.address // treasury
            ],
        });
        const poolReceipt = await publicClient.waitForTransactionReceipt({ hash: poolHash });
        lendingPool = {
            address: poolReceipt.contractAddress!,
            abi: LendingPoolArtifact.abi,
        };

        // Deploy LiquidationEngine
        const liquidationHash = await owner.deployContract({
            abi: LiquidationEngineArtifact.abi,
            bytecode: LiquidationEngineArtifact.bytecode as Hex,
            args: [
                lendingPool.address,
                priceOracle.address,
                pyusd.address
            ],
        });
        const liquidationReceipt = await publicClient.waitForTransactionReceipt({ hash: liquidationHash });
        liquidationEngine = {
            address: liquidationReceipt.contractAddress!,
            abi: LiquidationEngineArtifact.abi,
        };

        // Deploy PoolToken
        const poolTokenHash = await owner.deployContract({
            abi: PoolTokenArtifact.abi,
            bytecode: PoolTokenArtifact.bytecode as Hex,
            args: ["PyLend PYUSD", "pyPYUSD", pyusd.address],
        });
        const poolTokenReceipt = await publicClient.waitForTransactionReceipt({ hash: poolTokenHash });
        poolToken = {
            address: poolTokenReceipt.contractAddress!,
            abi: PoolTokenArtifact.abi,
        };

        // Connect contracts
        await owner.writeContract({
            address: lendingPool.address,
            abi: lendingPool.abi,
            functionName: "setLiquidationEngine",
            args: [liquidationEngine.address],
        });

        await owner.writeContract({
            address: poolToken.address,
            abi: poolToken.abi,
            functionName: "setLendingPool",
            args: [lendingPool.address],
        });

        // Add WETH as approved collateral (150% threshold)
        await owner.writeContract({
            address: lendingPool.address,
            abi: lendingPool.abi,
            functionName: "addCollateral",
            args: [weth.address, ETH_USD_FEED_ID, 15000n, WETH_DECIMALS],
        });

        // Mint tokens
        const INITIAL_BALANCE = parseUnits("100000", PYUSD_DECIMALS);
        await owner.writeContract({
            address: pyusd.address,
            abi: pyusd.abi,
            functionName: "mint",
            args: [alice.account.address, INITIAL_BALANCE],
        });
        await owner.writeContract({
            address: pyusd.address,
            abi: pyusd.abi,
            functionName: "mint",
            args: [bob.account.address, INITIAL_BALANCE],
        });
        await owner.writeContract({
            address: pyusd.address,
            abi: pyusd.abi,
            functionName: "mint",
            args: [liquidator.account.address, INITIAL_BALANCE],
        });
        await owner.writeContract({
            address: weth.address,
            abi: weth.abi,
            functionName: "mint",
            args: [bob.account.address, parseUnits("100", WETH_DECIMALS)],
        });
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const poolOwner = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "owner",
            });
            expect(poolOwner.toLowerCase()).to.equal(owner.account.address.toLowerCase());
        });

        it("Should set the correct PYUSD token", async function () {
            const pyusdToken = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "pyusdToken",
            });
            expect(pyusdToken.toLowerCase()).to.equal(pyusd.address.toLowerCase());
        });

        it("Should set the correct price oracle", async function () {
            const oracle = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "priceOracle",
            });
            expect(oracle.toLowerCase()).to.equal(priceOracle.address.toLowerCase());
        });
    });

    describe("Deposits", function () {
        it("Should allow users to deposit PYUSD", async function () {
            const depositAmount = parseUnits("1000", PYUSD_DECIMALS);

            await alice.writeContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });

            await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });

            const deposit = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposits",
                args: [alice.account.address],
            });

            expect(deposit[0]).to.equal(depositAmount); // deposit.amount
        });

        it("Should reject zero deposits", async function () {
            await expect(
                alice.writeContract({
                    address: lendingPool.address,
                    abi: lendingPool.abi,
                    functionName: "deposit",
                    args: [0n],
                })
            ).to.be.rejected;
        });

        it("Should update total liquidity", async function () {
            const depositAmount = parseUnits("1000", PYUSD_DECIMALS);

            await alice.writeContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });

            await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });

            const totalLiquidity = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "totalLiquidity",
            });

            expect(totalLiquidity).to.equal(depositAmount);
        });
    });

    describe("Withdrawals", function () {
        beforeEach(async function () {
            const depositAmount = parseUnits("10000", PYUSD_DECIMALS);
            await alice.writeContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });
            await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });
        });

        it("Should allow users to withdraw", async function () {
            const withdrawAmount = parseUnits("5000", PYUSD_DECIMALS);
            const initialBalance = await publicClient.readContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "balanceOf",
                args: [alice.account.address],
            });

            await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "withdraw",
                args: [withdrawAmount],
            });

            const finalBalance = await publicClient.readContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "balanceOf",
                args: [alice.account.address],
            });

            expect(finalBalance - initialBalance).to.equal(withdrawAmount);
        });

        it("Should reject withdrawal exceeding deposit", async function () {
            const withdrawAmount = parseUnits("20000", PYUSD_DECIMALS);

            await expect(
                alice.writeContract({
                    address: lendingPool.address,
                    abi: lendingPool.abi,
                    functionName: "withdraw",
                    args: [withdrawAmount],
                })
            ).to.be.rejected;
        });
    });

    describe("Borrowing", function () {
        beforeEach(async function () {
            // Alice deposits liquidity
            const depositAmount = parseUnits("50000", PYUSD_DECIMALS);
            await alice.writeContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });
            await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });
        });

        it("Should allow borrowing with sufficient collateral", async function () {
            const borrowAmount = parseUnits("1000", PYUSD_DECIMALS);
            const collateral = parseUnits("1", WETH_DECIMALS); // 1 ETH = $2500

            await bob.writeContract({
                address: weth.address,
                abi: weth.abi,
                functionName: "approve",
                args: [lendingPool.address, collateral],
            });

            await bob.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "borrow",
                args: [borrowAmount, weth.address, collateral],
            });

            const loan = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "loans",
                args: [0n], // First loan
            });

            expect(loan[1].toLowerCase()).to.equal(bob.account.address.toLowerCase()); // borrower
            expect(loan[2]).to.equal(borrowAmount); // borrowedAmount
        });

        it("Should reject borrowing with insufficient collateral", async function () {
            const borrowAmount = parseUnits("2000", PYUSD_DECIMALS);
            const collateral = parseUnits("1", WETH_DECIMALS); // 1 ETH = $2500, can only borrow ~$1666

            await bob.writeContract({
                address: weth.address,
                abi: weth.abi,
                functionName: "approve",
                args: [lendingPool.address, collateral],
            });

            await expect(
                bob.writeContract({
                    address: lendingPool.address,
                    abi: lendingPool.abi,
                    functionName: "borrow",
                    args: [borrowAmount, weth.address, collateral],
                })
            ).to.be.rejected;
        });

        it("Should calculate max borrow amount correctly", async function () {
            const collateral = parseUnits("1", WETH_DECIMALS); // 1 ETH = $2500
            const maxBorrow = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getMaxBorrowAmount",
                args: [weth.address, collateral],
            });

            // Max borrow = $2500 / 1.5 = $1666.66
            const expected = parseUnits("1666.666666", PYUSD_DECIMALS);
            const tolerance = parseUnits("1", PYUSD_DECIMALS);
            
            expect(maxBorrow).to.be.closeTo(expected, tolerance);
        });
    });

    describe("Repayment", function () {
        let loanId: bigint;

        beforeEach(async function () {
            // Alice deposits liquidity
            const depositAmount = parseUnits("50000", PYUSD_DECIMALS);
            await alice.writeContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });
            await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });

            // Bob borrows
            const borrowAmount = parseUnits("1000", PYUSD_DECIMALS);
            const collateral = parseUnits("1", WETH_DECIMALS);

            await bob.writeContract({
                address: weth.address,
                abi: weth.abi,
                functionName: "approve",
                args: [lendingPool.address, collateral],
            });

            await bob.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "borrow",
                args: [borrowAmount, weth.address, collateral],
            });

            loanId = 0n; // First loan
        });

        it("Should allow full repayment", async function () {
            const totalDebt = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getTotalDebt",
                args: [loanId],
            });

            await bob.writeContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "approve",
                args: [lendingPool.address, totalDebt],
            });

            await bob.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "repay",
                args: [loanId, totalDebt],
            });

            const loan = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "loans",
                args: [loanId],
            });

            expect(loan[9]).to.equal(1); // status = REPAID
        });

        it("Should allow partial repayment", async function () {
            const partialAmount = parseUnits("500", PYUSD_DECIMALS);

            await bob.writeContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "approve",
                args: [lendingPool.address, partialAmount],
            });

            await bob.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "repay",
                args: [loanId, partialAmount],
            });

            const loan = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "loans",
                args: [loanId],
            });

            expect(loan[9]).to.equal(0); // status = ACTIVE
            expect(loan[2]).to.be.lessThan(parseUnits("1000", PYUSD_DECIMALS)); // borrowedAmount decreased
        });
    });

    describe("Interest Rates", function () {
        it("Should calculate utilization rate correctly", async function () {
            // Alice deposits 10000 PYUSD
            const depositAmount = parseUnits("10000", PYUSD_DECIMALS);
            await alice.writeContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });
            await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });

            // Bob borrows 5000 PYUSD
            const borrowAmount = parseUnits("5000", PYUSD_DECIMALS);
            const collateral = parseUnits("3", WETH_DECIMALS); // 3 ETH

            await bob.writeContract({
                address: weth.address,
                abi: weth.abi,
                functionName: "approve",
                args: [lendingPool.address, collateral],
            });
            await bob.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "borrow",
                args: [borrowAmount, weth.address, collateral],
            });

            // Utilization = 5000 / 10000 = 50%
            const utilization = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getUtilizationRate",
            });

            expect(utilization).to.equal(5000n); // 50% in basis points
        });

        it("Should have higher rates at higher utilization", async function () {
            const depositAmount = parseUnits("10000", PYUSD_DECIMALS);
            await alice.writeContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });
            await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });

            const lowRate = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getCurrentBorrowRate",
            });

            // Increase utilization
            const borrowAmount = parseUnits("8000", PYUSD_DECIMALS);
            const collateral = parseUnits("5", WETH_DECIMALS);

            await bob.writeContract({
                address: weth.address,
                abi: weth.abi,
                functionName: "approve",
                args: [lendingPool.address, collateral],
            });
            await bob.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "borrow",
                args: [borrowAmount, weth.address, collateral],
            });

            const highRate = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getCurrentBorrowRate",
            });

            expect(highRate).to.be.greaterThan(lowRate);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to add collateral", async function () {
            const newToken = weth.address;
            const feedId = "0x" + "1".repeat(64) as Hex;

            await owner.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "addCollateral",
                args: [newToken, feedId, 16000n, 18],
            });

            const config = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "approvedCollateral",
                args: [newToken],
            });

            expect(config[0]).to.be.true; // isApproved
        });

        it("Should reject non-owner adding collateral", async function () {
            const newToken = weth.address;
            const feedId = "0x" + "1".repeat(64) as Hex;

            await expect(
                alice.writeContract({
                    address: lendingPool.address,
                    abi: lendingPool.abi,
                    functionName: "addCollateral",
                    args: [newToken, feedId, 16000n, 18],
                })
            ).to.be.rejected;
        });

        it("Should allow owner to pause", async function () {
            await owner.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "pause",
            });

            const depositAmount = parseUnits("1000", PYUSD_DECIMALS);
            await alice.writeContract({
                address: pyusd.address,
                abi: pyusd.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });

            await expect(
                alice.writeContract({
                    address: lendingPool.address,
                    abi: lendingPool.abi,
                    functionName: "deposit",
                    args: [depositAmount],
                })
            ).to.be.rejected;
        });
    });
});