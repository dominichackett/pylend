import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { describe, it, before } from "node:test";
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    PublicClient, 
    WalletClient, 
    parseUnits, 
    formatUnits, 
    Hex, 
    parseEther,
    Address
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";
import axios from 'axios';

// Import contract artifacts
import LendingPoolArtifact from "../artifacts/contracts/LendingPool.sol/LendingPool.json";
import PriceOracleArtifact from "../artifacts/contracts/PriceOracle.sol/PriceOracle.json";
import InterestRateModelArtifact from "../artifacts/contracts/InterestRateModel.sol/InterestRateModel.json";
import LiquidationEngineArtifact from "../artifacts/contracts/LiquidationEngine.sol/LiquidationEngine.json";
import PoolTokenArtifact from "../artifacts/contracts/PoolToken.sol/PoolToken.json";
import MockERC20Artifact from "../artifacts/contracts/test/MockERC20.sol/MockERC20.json";

use(chaiAsPromised);

// Sepolia Network Configuration
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";

// Increase timeout for testnet operations
const TESTNET_TIMEOUT = 120000; // 120 seconds

// Real Pyth Oracle on Sepolia
const PYTH_CONTRACT_SEPOLIA = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21" as Address;

// Your deployed testnet tokens
const PYUSD_SEPOLIA = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9" as Address;
const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" as Address;

// Real Price Feed IDs from Pyth Network
const ETH_USD_FEED_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as Hex;
const BTC_USD_FEED_ID = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" as Hex;

const PYUSD_DECIMALS = 6;
const WETH_DECIMALS = 18;

// Hermes API endpoint for real-time price updates
const HERMES_API = "https://hermes.pyth.network";

/**
 * Fetch real-time price update data from Pyth Hermes
 */
async function fetchPriceUpdateData(priceIds: string[]): Promise<string[]> {
    try {
        const response = await axios.get(`${HERMES_API}/api/latest_vaas`, {
            params: {
                ids: priceIds
            }
        });
        
        // Response is: ["UE5BVQ..."] (array of base64 strings)
        // Convert each base64 string to hex with 0x prefix
        return response.data.map((base64String: string) => {
            const buffer = Buffer.from(base64String, 'base64');
            return `0x${buffer.toString('hex')}`;
        });
    } catch (error) {
        console.error("Error fetching price data from Hermes:", error);
        throw error;
    }
}

describe("PyLend - LendingPool on Sepolia with Real Pyth Oracle", function () {
    // Set longer timeout for all tests in this suite (testnet is slow)

    let publicClient: PublicClient;
    let deployer: WalletClient;
    let alice: WalletClient;
    let bob: WalletClient;

    // Contract instances (deployed once, shared across all tests)
    let lendingPool: { address: Address; abi: any };
    let priceOracle: { address: Address; abi: any };
    let interestModel: { address: Address; abi: any };
    let liquidationEngine: { address: Address; abi: any };
    let poolToken: { address: Address; abi: any };

    // Test configuration
    console.log("\n" + "=".repeat(60));
    console.log("🧪 PyLend Sepolia Test Configuration");
    console.log("=".repeat(60));
    console.log("📊 Test Amounts:");
    console.log("   Alice deposits: 10 PYUSD");
    console.log("   Bob collateral: 0.05 WETH");
    console.log("   Bob borrows: ~50% of max (calculated from real ETH price)");
    console.log("\n🌐 Network: Ethereum Sepolia Testnet");
    console.log("🔮 Oracle: Real Pyth Network");
    console.log("💰 Tokens: Your deployed PYUSD & WETH");
    console.log("=".repeat(60) + "\n");

    // Deploy contracts ONCE before all tests
    before(async function () {
        console.log("\n🌐 Connecting to Sepolia testnet...");
        
        // Setup Sepolia clients
        publicClient = createPublicClient({
            chain: sepolia,
            transport: http(SEPOLIA_RPC_URL, {
                timeout: 60_000, // 60 second timeout per request
                retryCount: 3,   // Retry failed requests 3 times
            }),
        });

        // Setup wallet accounts
        const deployerAccount = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
        const aliceAccount = privateKeyToAccount(process.env.ALICE_PRIVATE_KEY as Hex);
        const bobAccount = privateKeyToAccount(process.env.BOB_PRIVATE_KEY as Hex);

        deployer = createWalletClient({
            account: deployerAccount,
            chain: sepolia,
            transport: http(SEPOLIA_RPC_URL, {
                timeout: 60_000,
                retryCount: 3,
            }),
        });

        alice = createWalletClient({
            account: aliceAccount,
            chain: sepolia,
            transport: http(SEPOLIA_RPC_URL, {
                timeout: 60_000,
                retryCount: 3,
            }),
        });

        bob = createWalletClient({
            account: bobAccount,
            chain: sepolia,
            transport: http(SEPOLIA_RPC_URL, {
                timeout: 60_000,
                retryCount: 3,
            }),
        });

        console.log("🔑 Deployer:", deployer.account.address);
        console.log("👤 Alice:", alice.account.address);
        console.log("👤 Bob:", bob.account.address);

        // Check balances
        const deployerBalance = await publicClient.getBalance({ 
            address: deployer.account.address 
        });
        console.log(`💰 Deployer balance: ${formatUnits(deployerBalance, 18)} ETH`);

        if (deployerBalance < parseEther("0.05")) {
            console.warn("⚠️  Warning: Low ETH balance. Get testnet ETH from https://faucets.chain.link/sepolia");
        }

        // Deploy InterestRateModel
        console.log("\n📝 Deploying InterestRateModel...");
        const interestModelHash = await deployer.deployContract({
            abi: InterestRateModelArtifact.abi,
            bytecode: InterestRateModelArtifact.bytecode as Hex,
            args: [
                200n,    // 2% base rate
                1000n,   // 10% multiplier
                10000n,  // 100% jump multiplier
                8000n    // 80% kink
            ],
        });
        const interestModelReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: interestModelHash 
        });
        interestModel = {
            address: interestModelReceipt.contractAddress!,
            abi: InterestRateModelArtifact.abi,
        };
        console.log("✅ InterestRateModel:", interestModel.address);

        // Deploy PriceOracle with REAL Pyth contract
        console.log("📝 Deploying PriceOracle (using real Pyth on Sepolia)...");
        const oracleHash = await deployer.deployContract({
            abi: PriceOracleArtifact.abi,
            bytecode: PriceOracleArtifact.bytecode as Hex,
            args: [PYTH_CONTRACT_SEPOLIA],
        });
        const oracleReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: oracleHash 
        });
        priceOracle = {
            address: oracleReceipt.contractAddress!,
            abi: PriceOracleArtifact.abi,
        };
        console.log("✅ PriceOracle:", priceOracle.address);

        // Deploy LendingPool
        console.log("📝 Deploying LendingPool...");
        const poolHash = await deployer.deployContract({
            abi: LendingPoolArtifact.abi,
            bytecode: LendingPoolArtifact.bytecode as Hex,
            args: [
                PYUSD_SEPOLIA,
                priceOracle.address,
                interestModel.address,
                deployer.account.address // treasury
            ],
        });
        const poolReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: poolHash 
        });
        lendingPool = {
            address: poolReceipt.contractAddress!,
            abi: LendingPoolArtifact.abi,
        };
        console.log("✅ LendingPool:", lendingPool.address);

        // Deploy LiquidationEngine
        console.log("📝 Deploying LiquidationEngine...");
        const liquidationHash = await deployer.deployContract({
            abi: LiquidationEngineArtifact.abi,
            bytecode: LiquidationEngineArtifact.bytecode as Hex,
            args: [
                lendingPool.address,
                priceOracle.address,
                PYUSD_SEPOLIA
            ],
        });
        const liquidationReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: liquidationHash 
        });
        liquidationEngine = {
            address: liquidationReceipt.contractAddress!,
            abi: LiquidationEngineArtifact.abi,
        };
        console.log("✅ LiquidationEngine:", liquidationEngine.address);

        // Deploy PoolToken
        console.log("📝 Deploying PoolToken...");
        const poolTokenHash = await deployer.deployContract({
            abi: PoolTokenArtifact.abi,
            bytecode: PoolTokenArtifact.bytecode as Hex,
            args: ["PyLend PYUSD", "pyPYUSD", PYUSD_SEPOLIA],
        });
        const poolTokenReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: poolTokenHash 
        });
        poolToken = {
            address: poolTokenReceipt.contractAddress!,
            abi: PoolTokenArtifact.abi,
        };
        console.log("✅ PoolToken:", poolToken.address);

        // Connect contracts
        console.log("\n🔗 Connecting contracts...");
        const setLiquidationEngineHash = await deployer.writeContract({
            address: lendingPool.address,
            abi: lendingPool.abi,
            functionName: "setLiquidationEngine",
            args: [liquidationEngine.address],
        });
        await publicClient.waitForTransactionReceipt({ hash: setLiquidationEngineHash });

        const setLendingPoolHash = await deployer.writeContract({
            address: poolToken.address,
            abi: poolToken.abi,
            functionName: "setLendingPool",
            args: [lendingPool.address],
        });
        await publicClient.waitForTransactionReceipt({ hash: setLendingPoolHash });

        // Add WETH as approved collateral (150% threshold)
        console.log("🔗 Adding WETH as collateral...");
        const addCollateralHash = await deployer.writeContract({
            address: lendingPool.address,
            abi: lendingPool.abi,
            functionName: "addCollateral",
            args: [WETH_SEPOLIA, ETH_USD_FEED_ID, 15000n, WETH_DECIMALS],
        });
        await publicClient.waitForTransactionReceipt({ hash: addCollateralHash });

        console.log("\n✅ All contracts deployed and configured!");
        console.log("\n📋 Deployed Contract Addresses:");
        console.log("   InterestRateModel:", interestModel.address);
        console.log("   PriceOracle:", priceOracle.address);
        console.log("   LendingPool:", lendingPool.address);
        console.log("   LiquidationEngine:", liquidationEngine.address);
        console.log("   PoolToken:", poolToken.address);
        console.log("\n🎯 Contracts deployed ONCE and will be reused for all tests\n");
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const poolOwner = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "owner",
            }) as Address;
            
            expect(poolOwner.toLowerCase()).to.equal(
                deployer.account.address.toLowerCase()
            );
        });

        it("Should set the correct PYUSD token", async function () {
            const pyusdToken = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "pyusdToken",
            }) as Address;
            
            expect(pyusdToken.toLowerCase()).to.equal(
                PYUSD_SEPOLIA.toLowerCase()
            );
        });

        it("Should connect to real Pyth oracle", async function () {
            const oracle = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "priceOracle",
            }) as Address;
            
            expect(oracle.toLowerCase()).to.equal(
                priceOracle.address.toLowerCase()
            );
        });
    });

    describe("Real Pyth Price Feeds", function () {
  /*      it("Should fetch real ETH/USD price from Pyth Network", async function () {
            console.log("\n📊 Fetching REAL ETH/USD price from Pyth Hermes API...");
            
            // Fetch price update data from Hermes
            const priceUpdateData = await fetchPriceUpdateData([
                ETH_USD_FEED_ID.slice(2) // Remove 0x prefix for API
            ]);

            console.log("📡 Received", priceUpdateData.length, "price update(s)");

            // Get update fee required by Pyth
            const updateFee = await publicClient.readContract({
                address: priceOracle.address,
                abi: priceOracle.abi,
                functionName: "getUpdateFee",
                args: [priceUpdateData],
            }) as bigint;

            console.log("💸 Pyth update fee:", formatUnits(updateFee, 18), "ETH");

            // Update price and get value for 1 ETH
            const ethAmount = parseUnits("1", WETH_DECIMALS);
            const txHash = await deployer.writeContract({
                address: priceOracle.address,
                abi: priceOracle.abi,
                functionName: "getValueUSD",
                args: [
                    ETH_USD_FEED_ID,
                    ethAmount,
                    WETH_DECIMALS,
                    priceUpdateData
                ],
                value: updateFee,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
            console.log("✅ Price update successful!");
            console.log("🔗 TX:", `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);

            expect(receipt.status).to.equal("success");
        });*/

        it("Should calculate correct max borrow with real prices", async function () {
            console.log("\n💰 Calculating max borrow amount with REAL ETH price...");

            const collateralAmount = parseUnits(".05", WETH_DECIMALS); // 0.05 WETH

            // Fetch latest price
            const priceUpdateData = await fetchPriceUpdateData([
                ETH_USD_FEED_ID.slice(2)
            ]);

            const updateFee = await publicClient.readContract({
                address: priceOracle.address,
                abi: priceOracle.abi,
                functionName: "getUpdateFee",
                args: [priceUpdateData],
            }) as bigint;

            // Update prices first
            const updateTx = await deployer.writeContract({
                address: priceOracle.address,
                abi: priceOracle.abi,
                functionName: "updatePriceFeeds",
                args: [priceUpdateData],
                value: updateFee,
            });
            await publicClient.waitForTransactionReceipt({ hash: updateTx });

            // Now get max borrow (uses cached price from above)
            const maxBorrow = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getMaxBorrowAmount",
                args: [WETH_SEPOLIA, collateralAmount],
            }) as bigint;

            const maxBorrowFormatted = formatUnits(maxBorrow, PYUSD_DECIMALS);
            console.log(`💵 Max borrow for 0.05 WETH: $${maxBorrowFormatted} PYUSD`);
            console.log(`📊 This is based on REAL market ETH price!`);

            // With 0.05 WETH and reasonable ETH prices ($2000-4000)
            // Max borrow should be reasonable
            expect(maxBorrow).to.be.greaterThan(parseUnits("50", PYUSD_DECIMALS)); // > $50
            expect(maxBorrow).to.be.lessThan(parseUnits("200", PYUSD_DECIMALS)); // < $200
        });

        it("Should get current pool rates", async function () {
            const borrowRate = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getCurrentBorrowRate",
            }) as bigint;

            const supplyRate = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getCurrentSupplyRate",
            }) as bigint;

            console.log(`📈 Current Borrow APR: ${Number(borrowRate) / 100}%`);
            console.log(`📉 Current Supply APR: ${Number(supplyRate) / 100}%`);

            expect(borrowRate).to.be.greaterThan(0n);
        });
    });

    describe("Token Integration", function () {
        it("Should interact with real PYUSD testnet token", async function () {
            const name = await publicClient.readContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "name",
            }) as string;

            const decimals = await publicClient.readContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "decimals",
            }) as number;

            console.log(`🪙 Token Name: ${name}`);
            console.log(`🔢 Decimals: ${decimals}`);
            console.log(`📍 Address: ${PYUSD_SEPOLIA}`);

            expect(decimals).to.equal(PYUSD_DECIMALS);
        });

        it("Should interact with real WETH testnet token", async function () {
            const name = await publicClient.readContract({
                address: WETH_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "name",
            }) as string;

            const decimals = await publicClient.readContract({
                address: WETH_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "decimals",
            }) as number;

            console.log(`🪙 Token Name: ${name}`);
            console.log(`🔢 Decimals: ${decimals}`);
            console.log(`📍 Address: ${WETH_SEPOLIA}`);

            expect(decimals).to.equal(WETH_DECIMALS);
        });
    });

    describe("Approved Collateral Management", function () {
        it("Should verify WETH is approved as collateral", async function () {
            const collateralConfig = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "approvedCollateral",
                args: [WETH_SEPOLIA],
            }) as any[];

            const isApproved = collateralConfig[0];
            const liquidationThreshold = collateralConfig[2];

            console.log("\n📊 WETH Collateral Configuration:");
            console.log("  ✅ Approved:", isApproved);
            console.log("  ⚠️  Liquidation Threshold:", Number(liquidationThreshold) / 100 + "%");

            expect(isApproved).to.be.true;
            expect(liquidationThreshold).to.equal(15000n);
        });
    });

    describe("Deposit Functionality", function () {
        it("Should allow Alice to deposit 10 PYUSD", async function () {
            const depositAmount = parseUnits("10", PYUSD_DECIMALS);

            const balance = await publicClient.readContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "balanceOf",
                args: [alice.account.address],
            }) as bigint;

            console.log(`💰 Alice's PYUSD balance: ${formatUnits(balance, PYUSD_DECIMALS)} PYUSD`);

            if (balance < depositAmount) {
                console.log("⚠️  Skipping: Alice needs at least 10 PYUSD");
                this.skip();
                return;
            }

            const approveHash = await alice.writeContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });

            const depositHash = await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });

            console.log("✅ Deposit successful! Deposited: 10 PYUSD");
            console.log(`🔗 TX: https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);

            const deposit = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposits",
                args: [alice.account.address],
            }) as any[];

            expect(deposit[0]).to.equal(depositAmount);
        });
    });

    describe("Borrow Functionality", function () {
        it("Should allow Bob to borrow 30 PYUSD against WETH collateral", async function () {
            const depositAmount = parseUnits("50", PYUSD_DECIMALS); // Alice deposits 50 PYUSD
            const collateralAmount = parseUnits("0.05", WETH_DECIMALS); // Bob deposits 0.05 WETH
            const borrowAmount = parseUnits("30", PYUSD_DECIMALS); // Bob borrows 30 PYUSD

            // 1. Alice deposits PYUSD to provide liquidity
            console.log("\n\n-- Borrow Test: Alice deposits 50 PYUSD --");
            const aliceBalance = await publicClient.readContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "balanceOf",
                args: [alice.account.address],
            }) as bigint;

            if (aliceBalance < depositAmount) {
                console.log("⚠️  Skipping: Alice needs at least 50 PYUSD");
                this.skip();
                return;
            }

            const approveDepositHash = await alice.writeContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveDepositHash });

            const depositLpHash = await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: depositLpHash });
            console.log("✅ Alice deposited 50 PYUSD into the pool");

            // 2. Bob borrows 30 PYUSD
            console.log("\n-- Borrow Test: Bob borrows 30 PYUSD --");
            const bobBalanceBefore = await publicClient.readContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "balanceOf",
                args: [bob.account.address],
            }) as bigint;

            const borrowHash = await bob.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "borrow",
                args: [borrowAmount,WETH_SEPOLIA, collateralAmount],
            });
            const borrowReceipt = await publicClient.waitForTransactionReceipt({ hash: borrowHash });

            console.log("✅ Bob borrowed 30 PYUSD successfully!");
            console.log(`🔗 TX: https://sepolia.etherscan.io/tx/${borrowReceipt.transactionHash}`);

            // 3. Verify balances
            const bobBalanceAfter = await publicClient.readContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "balanceOf",
                args: [bob.account.address],
            }) as bigint;

            expect(bobBalanceAfter).to.gt(bobBalanceBefore);
        });

        it("Should allow Bob to repay his loan", async function () {
            const activeLoans = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getUserActiveLoans",
                args: [bob.account.address],
            }) as bigint[];

            const loanId = activeLoans[0];
            const loan = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "loans",
                args: [loanId],
            }) as any[];

            const borrowedAmount = loan[2];

            // Approve PYUSD spending
            const approveHash = await bob.writeContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "approve",
                args: [lendingPool.address, borrowedAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });

            // Repay the loan
            const repayHash = await bob.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "repay",
                args: [loanId, borrowedAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: repayHash });

            const activeLoansAfter = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getUserActiveLoans",
                args: [bob.account.address],
            }) as bigint[];

            expect(activeLoansAfter.length).to.equal(0);
        });
    });
});