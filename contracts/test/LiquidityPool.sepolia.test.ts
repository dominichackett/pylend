import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { describe, it, beforeEach } from "node:test";
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
        return response.data.map((item: any) => `0x${item}`);
    } catch (error) {
        console.error("Error fetching price data from Hermes:", error);
        throw error;
    }
}

describe("PyLend - LendingPool on Sepolia with Real Pyth Oracle", function () {
    let publicClient: PublicClient;
    let deployer: WalletClient;
    let alice: WalletClient;
    let bob: WalletClient;

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

    beforeEach(async function () {
        console.log("\n🌐 Connecting to Sepolia testnet...");
        
        // Setup Sepolia clients
        publicClient = createPublicClient({
            chain: sepolia,
            transport: http(SEPOLIA_RPC_URL),
        });

        // Setup wallet accounts
        const deployerAccount = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
        const aliceAccount = privateKeyToAccount(process.env.ALICE_PRIVATE_KEY as Hex);
        const bobAccount = privateKeyToAccount(process.env.BOB_PRIVATE_KEY as Hex);

        deployer = createWalletClient({
            account: deployerAccount,
            chain: sepolia,
            transport: http(SEPOLIA_RPC_URL),
        });

        alice = createWalletClient({
            account: aliceAccount,
            chain: sepolia,
            transport: http(SEPOLIA_RPC_URL),
        });

        bob = createWalletClient({
            account: bobAccount,
            chain: sepolia,
            transport: http(SEPOLIA_RPC_URL),
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

        console.log("✅ Setup complete!\n");
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
        it("Should fetch real ETH/USD price from Pyth Network", async function () {
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
        });

        it("Should calculate correct max borrow with real prices", async function () {
            console.log("\n💰 Calculating max borrow amount with REAL ETH price...");

            const collateralAmount = parseUnits("1", WETH_DECIMALS); // 1 WETH

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
            console.log(`💵 Max borrow for 1 WETH: $${maxBorrowFormatted} PYUSD`);
            console.log(`📊 This is based on REAL market ETH price!`);

            // Should be realistic (ETH is typically $2000-4000)
            // With 150% collateral ratio, max borrow should be ~67% of ETH value
            expect(maxBorrow).to.be.greaterThan(parseUnits("1000", PYUSD_DECIMALS)); // > $1000
            expect(maxBorrow).to.be.lessThan(parseUnits("5000", PYUSD_DECIMALS)); // < $5000
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
            // Check PYUSD token details
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
            console.log(`🔗 Etherscan: https://sepolia.etherscan.io/address/${PYUSD_SEPOLIA}`);

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
            console.log(`🔗 Etherscan: https://sepolia.etherscan.io/address/${WETH_SEPOLIA}`);

            expect(decimals).to.equal(WETH_DECIMALS);
        });
    });

    describe("Approved Collateral Management", function () {
        it("Should verify PYUSD is the lending token", async function () {
            const pyusdToken = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "pyusdToken",
            }) as Address;

            console.log("\n📋 Lending Configuration:");
            console.log("  💵 Lending Token (PYUSD):", pyusdToken);
            console.log("  ℹ️  Users deposit PYUSD to earn interest");
            
            expect(pyusdToken.toLowerCase()).to.equal(PYUSD_SEPOLIA.toLowerCase());
        });

        it("Should verify WETH is approved as collateral", async function () {
            const collateralConfig = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "approvedCollateral",
                args: [WETH_SEPOLIA],
            }) as any[];

            const isApproved = collateralConfig[0];
            const priceFeedId = collateralConfig[1];
            const liquidationThreshold = collateralConfig[2];
            const decimals = collateralConfig[3];

            console.log("\n📊 WETH Collateral Configuration:");
            console.log("  ✅ Approved:", isApproved);
            console.log("  📍 Price Feed ID:", priceFeedId);
            console.log("  ⚠️  Liquidation Threshold:", Number(liquidationThreshold) / 100 + "%");
            console.log("  🔢 Decimals:", decimals);
            console.log("  💡 Users can borrow PYUSD using WETH as collateral");

            expect(isApproved).to.be.true;
            expect(liquidationThreshold).to.equal(15000n); // 150%
            expect(priceFeedId).to.equal(ETH_USD_FEED_ID);
        });

        it("Should allow owner to add new collateral token", async function () {
            console.log("\n🔧 Testing: Adding new collateral token...");
            
            // Mock token address for testing
            const mockToken = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address;
            
            const addCollateralHash = await deployer.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "addCollateral",
                args: [
                    mockToken,
                    BTC_USD_FEED_ID,
                    14000n, // 140% liquidation threshold
                    8       // 8 decimals (like BTC)
                ],
            });
            
            const receipt = await publicClient.waitForTransactionReceipt({ 
                hash: addCollateralHash 
            });
            
            console.log("✅ New collateral added!");
            console.log("🔗 TX:", `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);
            
            // Verify it was added
            const config = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "approvedCollateral",
                args: [mockToken],
            }) as any[];
            
            expect(config[0]).to.be.true; // isApproved
            expect(config[2]).to.equal(14000n); // liquidationThreshold
        });

        it("Should allow owner to remove collateral token", async function () {
            const mockToken = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address;
            
            // First add it
            await deployer.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "addCollateral",
                args: [mockToken, BTC_USD_FEED_ID, 14000n, 8],
            });
            
            // Then remove it
            const removeHash = await deployer.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "removeCollateral",
                args: [mockToken],
            });
            
            const receipt = await publicClient.waitForTransactionReceipt({ hash: removeHash });
            console.log("✅ Collateral removed successfully");
            console.log("🔗 TX:", `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);
            
            // Verify it was removed
            const config = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "approvedCollateral",
                args: [mockToken],
            }) as any[];
            
            expect(config[0]).to.be.false; // isApproved = false
        });

        it("Should reject unsupported collateral token", async function () {
            const unsupportedToken = "0x1234567890123456789012345678901234567890" as Address;
            
            try {
                await publicClient.readContract({
                    address: lendingPool.address,
                    abi: lendingPool.abi,
                    functionName: "getMaxBorrowAmount",
                    args: [unsupportedToken, parseUnits("1", 18)],
                });
                
                expect.fail("Should have rejected unsupported token");
            } catch (error: any) {
                console.log("✅ Correctly rejected unsupported collateral token");
                expect(error.message).to.include("Collateral not approved");
            }
        });

        it("Should not allow non-owner to add collateral", async function () {
            const mockToken = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address;
            
            try {
                await alice.writeContract({
                    address: lendingPool.address,
                    abi: lendingPool.abi,
                    functionName: "addCollateral",
                    args: [mockToken, BTC_USD_FEED_ID, 14000n, 8],
                });
                
                expect.fail("Should have rejected non-owner");
            } catch (error: any) {
                console.log("✅ Correctly rejected non-owner attempt");
                expect(error.message).to.include("Ownable");
            }
        });
    });

    describe("Deposit Functionality", function () {
        it("Should allow Alice to deposit 10 PYUSD", async function () {
            const depositAmount = parseUnits("10", PYUSD_DECIMALS); // 10 PYUSD

            // Check Alice's PYUSD balance
            const balance = await publicClient.readContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "balanceOf",
                args: [alice.account.address],
            }) as bigint;

            console.log(`💰 Alice's PYUSD balance: ${formatUnits(balance, PYUSD_DECIMALS)} PYUSD`);

            if (balance < depositAmount) {
                console.log("⚠️  Skipping: Alice needs at least 10 PYUSD. Mint some first.");
                this.skip();
                return;
            }

            // Approve
            console.log("✅ Approving 10 PYUSD...");
            const approveHash = await alice.writeContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });

            // Deposit
            console.log("💵 Depositing 10 PYUSD to pool...");
            const depositHash = await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });

            console.log("✅ Deposit successful!");
            console.log(`   Deposited: 10 PYUSD`);
            console.log(`🔗 TX: https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);

            // Check deposit
            const deposit = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposits",
                args: [alice.account.address],
            }) as any[];

            expect(deposit[0]).to.equal(depositAmount);
            console.log(`✅ Pool shows: ${formatUnits(deposit[0], PYUSD_DECIMALS)} PYUSD deposited`);
        });
    });

    describe("Borrow Functionality", function () {
        it("Should allow Bob to borrow with 0.05 WETH collateral", async function () {
            // First, Alice deposits 10 PYUSD for liquidity
            const depositAmount = parseUnits("10", PYUSD_DECIMALS); // 10 PYUSD
            
            // Check if Alice has enough PYUSD
            const aliceBalance = await publicClient.readContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "balanceOf",
                args: [alice.account.address],
            }) as bigint;

            if (aliceBalance < depositAmount) {
                console.log("⚠️  Skipping: Alice needs at least 10 PYUSD");
                this.skip();
                return;
            }

            // Alice deposits
            console.log("\n💵 Step 1: Alice deposits 10 PYUSD for liquidity...");
            const approveHash1 = await alice.writeContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "approve",
                args: [lendingPool.address, depositAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash1 });

            const depositHash = await alice.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "deposit",
                args: [depositAmount],
            });
            const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
            console.log("✅ Alice deposited 10 PYUSD");
            console.log(`🔗 TX: https://sepolia.etherscan.io/tx/${depositReceipt.transactionHash}`);

            // Update prices
            console.log("\n📊 Step 2: Fetching real ETH price from Pyth...");
            const priceUpdateData = await fetchPriceUpdateData([
                ETH_USD_FEED_ID.slice(2)
            ]);
            const updateFee = await publicClient.readContract({
                address: priceOracle.address,
                abi: priceOracle.abi,
                functionName: "getUpdateFee",
                args: [priceUpdateData],
            }) as bigint;

            const priceUpdateTx = await deployer.writeContract({
                address: priceOracle.address,
                abi: priceOracle.abi,
                functionName: "updatePriceFeeds",
                args: [priceUpdateData],
                value: updateFee,
            });
            await publicClient.waitForTransactionReceipt({ hash: priceUpdateTx });
            console.log("✅ Price updated with real market data");

            // Calculate how much Bob can borrow with 0.05 WETH
            const collateralAmount = parseUnits("0.05", WETH_DECIMALS); // 0.05 WETH
            const maxBorrow = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getMaxBorrowAmount",
                args: [WETH_SEPOLIA, collateralAmount],
            }) as bigint;

            console.log(`\n💡 With 0.05 WETH collateral:`);
            console.log(`   Max borrow: ${formatUnits(maxBorrow, PYUSD_DECIMALS)} PYUSD`);
            console.log(`   (Based on real ETH price with 150% collateral ratio)`);

            // Bob borrows a safe amount (less than max)
            const borrowAmount = maxBorrow / 2n; // Borrow 50% of max for safety
            console.log(`   Bob will borrow: ${formatUnits(borrowAmount, PYUSD_DECIMALS)} PYUSD`);

            const bobWethBalance = await publicClient.readContract({
                address: WETH_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "balanceOf",
                args: [bob.account.address],
            }) as bigint;

            if (bobWethBalance < collateralAmount) {
                console.log("⚠️  Skipping: Bob needs at least 0.05 WETH");
                this.skip();
                return;
            }

            // Approve collateral
            console.log("\n🔐 Step 3: Bob approves 0.05 WETH as collateral...");
            const approveHash2 = await bob.writeContract({
                address: WETH_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "approve",
                args: [lendingPool.address, collateralAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash2 });
            console.log("✅ Collateral approved");

            // Borrow
            console.log("\n💰 Step 4: Bob borrows PYUSD using WETH collateral...");
            const borrowHash = await bob.writeContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "borrow",
                args: [borrowAmount, WETH_SEPOLIA, collateralAmount],
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash: borrowHash });

            console.log("\n✅ Borrow successful!");
            console.log(`   Collateral: 0.05 WETH`);
            console.log(`   Borrowed: ${formatUnits(borrowAmount, PYUSD_DECIMALS)} PYUSD`);
            console.log(`🔗 TX: https://sepolia.etherscan.io/tx/${receipt.transactionHash}`);

            // Verify Bob received PYUSD
            const bobPyusdBalance = await publicClient.readContract({
                address: PYUSD_SEPOLIA,
                abi: MockERC20Artifact.abi,
                functionName: "balanceOf",
                args: [bob.account.address],
            }) as bigint;

            console.log(`\n💵 Bob's new PYUSD balance: ${formatUnits(bobPyusdBalance, PYUSD_DECIMALS)} PYUSD`);

            expect(receipt.status).to.equal("success");
            expect(bobPyusdBalance).to.be.greaterThan(0n);
        });

        it("Should show loan details after borrowing", async function () {
            // Get Bob's active loans
            const activeLoans = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "getUserActiveLoans",
                args: [bob.account.address],
            }) as bigint[];

            if (activeLoans.length === 0) {
                console.log("⚠️  No active loans found. Run borrow test first.");
                this.skip();
                return;
            }

            console.log(`\n📋 Bob has ${activeLoans.length} active loan(s):`);

            // Get details of first loan
            const loanId = activeLoans[0];
            const loan = await publicClient.readContract({
                address: lendingPool.address,
                abi: lendingPool.abi,
                functionName: "loans",
                args: [loanId],
            }) as any[];

            console.log(`\n🏦 Loan #${loanId} Details:`);
            console.log(`   Borrower: ${loan[1]}`);
            console.log(`   Borrowed: ${formatUnits(loan[2], PYUSD_DECIMALS)} PYUSD`);
            console.log(`   Collateral Token: ${loan[3]}`);
            console.log(`   Collateral Amount: ${formatUnits(loan[4], WETH_DECIMALS)} WETH`);
            console.log(`   Interest Rate: ${Number(loan[5]) / 100}% APR`);
            console.log(`   Status: ${loan[9] === 0 ? 'ACTIVE' : loan[9] === 1 ? 'REPAID' : 'LIQUIDATED'}`);

            expect(loan[1].toLowerCase()).to.equal(bob.account.address.toLowerCase());
        });
    });
});

/*
 * ====================================
 * SEPOLIA TESTNET CONFIGURATION
 * ====================================
 * 
 * Network: Ethereum Sepolia Testnet
 * Chain ID: 11155111
 * 
 * Real Pyth Oracle: 0xDd24F84d36BF92C65F92307595335bdFab5Bbd21
 * PYUSD Token:      0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9
 * WETH Token:       0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
 * 
 * ====================================
 * APPROVED COLLATERAL MANAGEMENT
 * ====================================
 * 
 * Your LendingPool.sol already has built-in collateral management:
 * 
 * ✅ addCollateral(token, priceFeedId, threshold, decimals)
 *    - Adds new token as approved collateral
 *    - Only owner can call
 *    - Requires Pyth price feed ID
 * 
 * ✅ removeCollateral(token)
 *    - Removes token from approved collateral
 *    - Only owner can call
 * 
 * ✅ approvedCollateral mapping
 *    - Stores: isApproved, priceFeedId, liquidationThreshold, decimals
 *    - Checked before allowing borrows
 * 
 * Current Supported:
 * - Lending Token: PYUSD only (hardcoded)
 * - Collateral: WETH (can add more dynamically)
 * 
 * ====================================
 * SETUP INSTRUCTIONS
 * ====================================
 * 
 * 1. Create .env file:
 *    SEPOLIA_RPC_URL=https://rpc.sepolia.org
 *    DEPLOYER_PRIVATE_KEY=0x...
 *    ALICE_PRIVATE_KEY=0x...
 *    BOB_PRIVATE_KEY=0x...
 * 
 * 2. Get testnet ETH from faucets:
 *    - https://faucets.chain.link/sepolia
 *    - https://www.alchemy.com/faucets/ethereum-sepolia
 * 
 * 3. Ensure test accounts have tokens:
 *    - Alice needs PYUSD for deposits
 *    - Bob needs WETH for collateral
 *    - Use token mint functions if available
 * 
 * 4. Install dependencies:
 *    npm install axios
 * 
 * 5. Run tests:
 *    npm test
 * 
 * ====================================
 * WHAT THESE TESTS VERIFY
 * ====================================
 * 
 * ✅ Real Pyth Oracle Integration
 *    - Fetches live prices from Hermes API
 *    - Updates on-chain prices
 *    - Calculates borrow amounts with real market data
 * 
 * ✅ Token Support System
 *    - Verifies PYUSD as lending token
 *    - Checks WETH collateral configuration
 *    - Tests adding/removing collateral tokens
 *    - Validates owner-only access controls
 * 
 * ✅ Core Functionality
 *    - Deposits (Alice deposits PYUSD)
 *    - Borrows (Bob borrows using WETH)
 *    - Interest rate calculations
 *    - Real-time collateral valuations
 * 
 * ✅ Access Control
 *    - Only owner can add/remove collateral
 *    - Users can't manipulate approved tokens
 * 
 * ====================================
 * KEY DIFFERENCES FROM LOCAL TESTS
 * ====================================
 * 
 * Real Oracle:
 * - Uses actual Pyth contract on Sepolia
 * - Fetches real market prices
 * - Requires ETH for price update fees
 * 
 * Real Blockchain:
 * - Transactions take ~12 seconds
 * - Gas fees required
 * - Permanent testnet records
 * 
 * Real Tokens:
 * - Your deployed PYUSD and WETH
 * - Requires actual token balances
 * - Token transfers are real
 * 
 * ====================================
 * ADDING MORE COLLATERAL TOKENS
 * ====================================
 * 
 * To add BTC as collateral:
 * 
 * 1. Deploy/use BTC token on Sepolia
 * 2. Get BTC/USD price feed ID from Pyth docs
 * 3. Call addCollateral:
 *    lendingPool.addCollateral(
 *      btcAddress,
 *      "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
 *      14000,  // 140% liquidation threshold
 *      8       // BTC decimals
 *    )
 * 
 * Supported Price Feeds:
 * - ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
 * - BTC/USD: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
 * - Find more: https://pyth.network/developers/price-feed-ids
 * 
 * ====================================
 * TROUBLESHOOTING
 * ====================================
 * 
 * "Insufficient balance" errors:
 * - Mint tokens to test accounts
 * - Get more testnet ETH from faucets
 * 
 * "Price too old" errors:
 * - Pyth prices expire after 15 minutes
 * - Fetch fresh price data before transactions
 * 
 * "Collateral not approved" errors:
 * - Ensure token is added via addCollateral()
 * - Check approvedCollateral mapping
 * 
 * Slow tests:
 * - Normal on testnet (12s per block)
 * - Use local fork for faster development
 * 
 * ====================================
 * EXAMPLE WORKFLOWS
 * ====================================
 * 
 * Adding New Collateral:
 * 1. Deploy token or use existing
 * 2. Find Pyth price feed ID
 * 3. Call addCollateral() as owner
 * 4. Users can now borrow with that token
 * 
 * Emergency Pause:
 * 1. Call removeCollateral() to disable
 * 2. Users can't open new positions
 * 3. Existing positions remain active
 * 
 * Updating Thresholds:
 * 1. Remove old collateral config
 * 2. Add with new parameters
 * (Note: Consider adding updateCollateral() function)
 * 
 */