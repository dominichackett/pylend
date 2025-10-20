import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { describe, it, before, beforeEach } from "node:test";
import { createPublicClient, createWalletClient, http, PublicClient, WalletClient, parseEther, parseUnits, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import "dotenv/config";

// We'll need to get the contract artifacts to deploy them manually
import LiquidityPoolArtifact from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import MockERC20Artifact from "../artifacts/contracts/test/MockERC20.sol/MockERC20.json"; // Using MockERC20 for token interactions

use(chaiAsPromised);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0) {
            console.warn(`Retrying after error: ${(error as Error).message}. Retries left: ${retries}`);
            await sleep(delay);
            return retry(fn, retries - 1, delay * 2);
        } else {
            throw error;
        }
    }
}

describe("LiquidityPool - Sepolia", function () {
    let publicClient: PublicClient;
    let owner: WalletClient;
    let addr1: WalletClient;

    let liquidityPoolContract: any;
    let wethContract: any;
    let pyusdContract: any;

    const PYTH_ORACLE_ADDRESS = process.env.PYTH_ORACLE_ADDRESS as Hex;
    const WETH_TOKEN_ADDRESS = process.env.WETH_TOKEN as Hex;
    const PYUSD_TOKEN_ADDRESS = process.env.PYUSD_TOKEN as Hex;

    before(async () => {
        publicClient = createPublicClient({
            chain: sepolia,
            transport: http(`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`),
        });

        const ownerAccount = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
        owner = createWalletClient({
            account: ownerAccount,
            chain: sepolia,
            transport: http(`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`),
        });

        // Assuming addr1 is another account funded on Sepolia for testing
        // For simplicity, we'll use the owner account as addr1 for now, or you can configure another PRIVATE_KEY
        addr1 = owner; 

        console.log("Deploying LiquidityPool...");
        // Deploy LiquidityPool
        const liquidityPoolHash = await owner.deployContract({
            abi: LiquidityPoolArtifact.abi,
            bytecode: LiquidityPoolArtifact.bytecode as Hex,
            args: [PYTH_ORACLE_ADDRESS],
        });
        const liquidityPoolReceipt = await publicClient.waitForTransactionReceipt({ 
            hash: liquidityPoolHash,
            confirmations: 2  // Wait for 2 confirmations
        });
        liquidityPoolContract = {
            address: liquidityPoolReceipt.contractAddress!,
            abi: LiquidityPoolArtifact.abi,
        };

        console.log("PYTH_ORACLE_ADDRESS:", PYTH_ORACLE_ADDRESS);
        console.log("WETH_TOKEN_ADDRESS:", WETH_TOKEN_ADDRESS);
        console.log("PYUSD_TOKEN_ADDRESS:", PYUSD_TOKEN_ADDRESS);
        console.log("LiquidityPool Contract Address:", liquidityPoolContract.address);

        // Add WETH as supported asset and wait for confirmation
        console.log("Adding WETH as supported asset...");
        const wethTxHash = await owner.writeContract({
            address: liquidityPoolContract.address,
            abi: liquidityPoolContract.abi,
            functionName: "addSupportedAsset",
            args: [WETH_TOKEN_ADDRESS],
        });
        await publicClient.waitForTransactionReceipt({ 
            hash: wethTxHash,
            confirmations: 2
        });
        
        const wethSupported = await publicClient.readContract({
            address: liquidityPoolContract.address,
            abi: liquidityPoolContract.abi,
            functionName: "supportedAssets",
            args: [WETH_TOKEN_ADDRESS],
        });
        console.log("WETH supported:", wethSupported);

        // Add PYUSD as supported asset and wait for confirmation
        console.log("Adding PYUSD as supported asset...");
        const pyusdTxHash = await owner.writeContract({
            address: liquidityPoolContract.address,
            abi: liquidityPoolContract.abi,
            functionName: "addSupportedAsset",
            args: [PYUSD_TOKEN_ADDRESS],
        });
        await publicClient.waitForTransactionReceipt({ 
            hash: pyusdTxHash,
            confirmations: 2
        });
        
        const pyusdSupported = await publicClient.readContract({
            address: liquidityPoolContract.address,
            abi: liquidityPoolContract.abi,
            functionName: "supportedAssets",
            args: [PYUSD_TOKEN_ADDRESS],
        });
        console.log("PYUSD supported:", pyusdSupported);

        // Initialize WETH and PYUSD contract objects for interaction
        wethContract = {
            address: WETH_TOKEN_ADDRESS,
            abi: MockERC20Artifact.abi, // Assuming WETH has a standard ERC20 ABI, using MockERC20 ABI for simplicity
        };
        pyusdContract = {
            address: PYUSD_TOKEN_ADDRESS,
            abi: MockERC20Artifact.abi, // Assuming PYUSD has a standard ERC20 ABI, using MockERC20 ABI for simplicity
        };

        // Approve LiquidityPool to spend WETH from owner (large amount for all tests)
        console.log("Approving WETH...");
        const wethApproveTxHash = await owner.writeContract({
            address: wethContract.address,
            abi: wethContract.abi,
            functionName: "approve",
            args: [liquidityPoolContract.address, parseEther("10")], // Increased approval
        });
        await publicClient.waitForTransactionReceipt({ hash: wethApproveTxHash });

        // Approve LiquidityPool to spend PYUSD from owner (large amount for all tests)
        console.log("Approving PYUSD...");
        const pyusdApproveTxHash = await owner.writeContract({
            address: pyusdContract.address,
            abi: pyusdContract.abi,
            functionName: "approve",
            args: [liquidityPoolContract.address, parseUnits("100000", 6)], // Increased approval
        });
        await publicClient.waitForTransactionReceipt({ hash: pyusdApproveTxHash });

        console.log("Setup complete!");
    });

    describe("Deployment and Asset Setup", function () {
        it("Should set the right owner", async function () {
            expect((await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "owner",
            })).toLowerCase()).to.equal(owner.account.address.toLowerCase());
        });

        it("Should have WETH as a supported asset", async function () {
            expect(await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "supportedAssets",
                args: [WETH_TOKEN_ADDRESS],
            })).to.be.true;
        });

        it("Should have PYUSD as a supported asset", async function () {
            expect(await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "supportedAssets",
                args: [PYUSD_TOKEN_ADDRESS],
            })).to.be.true;
        });
    });

    describe("Deposit and Withdraw with Real Tokens", function () {
        it("Should allow depositing WETH", async function () {
            const depositAmount = parseEther("0.001");
            
            const txHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "deposit",
                args: [WETH_TOKEN_ADDRESS, depositAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash });

            const balance = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBalances",
                args: [owner.account.address, WETH_TOKEN_ADDRESS],
            });
            
            // Balance should be at least what we deposited (accounting for previous tests)
            expect(balance).to.be.greaterThanOrEqual(depositAmount);
        });

        it("Should allow withdrawing WETH", async function () {
            // Get balance BEFORE this test's actions
            const balanceBefore = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBalances",
                args: [owner.account.address, WETH_TOKEN_ADDRESS],
            }) as bigint;

            const withdrawAmount = parseEther("0.0005");
            const withdrawTxHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "withdraw",
                args: [WETH_TOKEN_ADDRESS, withdrawAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: withdrawTxHash });

            const balanceAfter = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBalances",
                args: [owner.account.address, WETH_TOKEN_ADDRESS],
            }) as bigint;

            // Balance should decrease by exactly the withdraw amount
            expect(balanceAfter).to.equal(balanceBefore - withdrawAmount);
        });

        it("Should allow depositing PYUSD", async function () {
            const depositAmount = parseUnits("1", 6);
            
            const txHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "deposit",
                args: [PYUSD_TOKEN_ADDRESS, depositAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash });

            const balance = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBalances",
                args: [owner.account.address, PYUSD_TOKEN_ADDRESS],
            });
            
            expect(balance).to.be.greaterThanOrEqual(depositAmount);
        });

        it("Should allow withdrawing PYUSD", async function () {
            // Get balance BEFORE this test's actions
            const balanceBefore = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBalances",
                args: [owner.account.address, PYUSD_TOKEN_ADDRESS],
            }) as bigint;

            const withdrawAmount = parseUnits("0.5", 6);
            const withdrawTxHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "withdraw",
                args: [PYUSD_TOKEN_ADDRESS, withdrawAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: withdrawTxHash });

            const balanceAfter = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBalances",
                args: [owner.account.address, PYUSD_TOKEN_ADDRESS],
            }) as bigint;

            // Balance should decrease by exactly the withdraw amount
            expect(balanceAfter).to.equal(balanceBefore - withdrawAmount);
        });
    });

    describe("Borrow and Repay with Real Tokens", function () {
        beforeEach(async function () {
            // Ensure owner has deposited enough WETH and PYUSD to allow borrowing
            // Using smaller amounts to conserve testnet tokens
            const wethDepositAmount = parseEther("0.005");  // Reduced from 0.01
            const wethDepositTxHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "deposit",
                args: [WETH_TOKEN_ADDRESS, wethDepositAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: wethDepositTxHash });

            const pyusdDepositAmount = parseUnits("5", 6);  // Reduced from 10
            const pyusdDepositTxHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "deposit",
                args: [PYUSD_TOKEN_ADDRESS, pyusdDepositAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: pyusdDepositTxHash });
        });

        it("Should allow borrowing WETH", async function () {
            const borrowAmount = parseEther("0.001");
            const txHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "borrow",
                args: [WETH_TOKEN_ADDRESS, borrowAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash });

            const borrowed = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBorrows",
                args: [owner.account.address, WETH_TOKEN_ADDRESS],
            });
            
            // Should be at least the amount we just borrowed (may have previous borrows)
            expect(borrowed).to.be.greaterThanOrEqual(borrowAmount);
        });

        it("Should allow repaying WETH", async function () {
            const borrowAmount = parseEther("0.001");
            const borrowTxHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "borrow",
                args: [WETH_TOKEN_ADDRESS, borrowAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: borrowTxHash });

            // Get borrow balance AFTER borrowing, BEFORE repayment
            const borrowedBefore = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBorrows",
                args: [owner.account.address, WETH_TOKEN_ADDRESS],
            }) as bigint;

            const repayAmount = parseEther("0.0005");
            // Approve LiquidityPool to spend WETH from owner for repayment
           /* const approveTxHash = await owner.writeContract({
                address: wethContract.address,
                abi: wethContract.abi,
                functionName: "approve",
                args: [liquidityPoolContract.address, repayAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
            */
            const repayTxHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "repay",
                args: [WETH_TOKEN_ADDRESS, repayAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: repayTxHash });

            const borrowedAfter = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBorrows",
                args: [owner.account.address, WETH_TOKEN_ADDRESS],
            }) as bigint;

            // Borrow balance should decrease by exactly the repay amount
            expect(borrowedAfter).to.equal(borrowedBefore - repayAmount);
        });

        it("Should allow borrowing PYUSD", async function () {
            const borrowAmount = parseUnits("1", 6);
            const txHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "borrow",
                args: [PYUSD_TOKEN_ADDRESS, borrowAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash });

            const borrowed = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBorrows",
                args: [owner.account.address, PYUSD_TOKEN_ADDRESS],
            });
            
            expect(borrowed).to.be.greaterThanOrEqual(borrowAmount);
        });

        it("Should allow repaying PYUSD", async function () {
            const borrowAmount = parseUnits("1", 6);
            const borrowTxHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "borrow",
                args: [PYUSD_TOKEN_ADDRESS, borrowAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: borrowTxHash });

            // Get borrow balance AFTER borrowing, BEFORE repayment
            const borrowedBefore = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBorrows",
                args: [owner.account.address, PYUSD_TOKEN_ADDRESS],
            }) as bigint;

            const repayAmount = parseUnits("0.5", 6);
            // Approve LiquidityPool to spend PYUSD from owner for repayment
            /*const approveTxHash = await owner.writeContract({
                address: pyusdContract.address,
                abi: pyusdContract.abi,
                functionName: "approve",
                args: [liquidityPoolContract.address, repayAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
            */
            const repayTxHash = await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "repay",
                args: [PYUSD_TOKEN_ADDRESS, repayAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: repayTxHash });

            const borrowedAfter = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBorrows",
                args: [owner.account.address, PYUSD_TOKEN_ADDRESS],
            }) as bigint;

            // Borrow balance should decrease by exactly the repay amount
            expect(borrowedAfter).to.equal(borrowedBefore - repayAmount);
        });
    });
});