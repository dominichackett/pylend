import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { describe, it, beforeEach } from "node:test";
import { createPublicClient, createWalletClient, http, PublicClient, WalletClient, parseUnits, formatUnits, Hex, parseEther } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

// Import contract artifacts
import LendingPoolArtifact from "../artifacts/contracts/LendingPool.sol/LendingPool.json";
import PriceOracleArtifact from "../artifacts/contracts/PriceOracle.sol/PriceOracle.json";
import InterestRateModelArtifact from "../artifacts/contracts/InterestRateModel.sol/InterestRateModel.json";
import LiquidationEngineArtifact from "../artifacts/contracts/LiquidationEngine.sol/LiquidationEngine.json";
import PoolTokenArtifact from "../artifacts/contracts/PoolToken.sol/PoolToken.json";
import MockERC20Artifact from "../artifacts/contracts/test/MockERC20.sol/MockERC20.json";
import MockPythArtifact from "../artifacts/contracts/test/MockPyth.sol/MockPyth.json";

use(chaiAsPromised);

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

        const [, , , liquidatorAddr] = await publicClient.request({
            method: "eth_accounts",
        });

        const ownerAccount = privateKeyToAccount(process.env.OWNER_PRIVATE_KEY as Hex);
        const aliceAccount = privateKeyToAccount(process.env.ALICE_PRIVATE_KEY as Hex);
        const bobAccount = privateKeyToAccount(process.env.BOB_PRIVATE_KEY as Hex);

        owner = createWalletClient({
            account: ownerAccount,
            chain: hardhat,
            transport: http(),
        });

        const accounts = await publicClient.request({
            method: "eth_accounts",
        });
        const sender = accounts[0];

        const walletClient = createWalletClient({
            account: sender,
            chain: hardhat,
            transport: http(),
        });

        alice = createWalletClient({
            account: aliceAccount,
            chain: hardhat,
            transport: http(),
        });

        bob = createWalletClient({
            account: bobAccount,
            chain: hardhat,
            transport: http(),
        });

        await walletClient.sendTransaction({
            to: owner.account.address,
            value: parseEther("100"),
        });

        await walletClient.sendTransaction({
            to: alice.account.address,
            value: parseEther("100"),
        });

        await walletClient.sendTransaction({
            to: bob.account.address,
            value: parseEther("100"),
        });


        // Deploy Mock PYUSD (6 decimals)
        const pyusdHash = await owner.deployContract({
            abi: MockERC20Artifact.abi,
            bytecode: MockERC20Artifact.bytecode as Hex,
            args: ["Mock PYUSD", "PYUSD", 6],
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
            args: ["Mock WETH", "WETH", 18],
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
        const INITIAL_BALANCE = parseUnits("1000", PYUSD_DECIMALS);
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
            const depositAmount = parseUnits("100", PYUSD_DECIMALS);

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
            const depositAmount = parseUnits("100", PYUSD_DECIMALS);

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
});