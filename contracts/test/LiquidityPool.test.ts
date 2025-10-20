import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { describe, it, beforeEach } from "node:test";
import { createPublicClient, createWalletClient, http, PublicClient, WalletClient, Account } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import { parseEther, Hex } from "viem";

// We'll need to get the contract artifacts to deploy them manually
import LiquidityPoolArtifact from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import MockERC20Artifact from "../artifacts/contracts/test/MockERC20.sol/MockERC20.json";
import MockPythArtifact from "../artifacts/contracts/test/MockPyth.sol/MockPyth.json";

use(chaiAsPromised);

describe("LiquidityPool", function () {
    let publicClient: PublicClient;
    let owner: WalletClient;
    let addr1: WalletClient;
    let addr2: WalletClient;

    let liquidityPoolContract: any;
    let mockERC20Contract: any;
    let mockPythContract: any;

    const PYTH_PRICE_ID = "0x0100000000000000000000000000000000000000000000000000000000000000" as Hex;

    beforeEach(async () => {
        publicClient = createPublicClient({
            chain: hardhat,
            transport: http(),
        });

        const [ownerAddress, addr1Address, addr2Address] = await publicClient.request({
            method: "eth_accounts",
        });

        owner = createWalletClient({
            account: ownerAddress,
            chain: hardhat,
            transport: http(),
        });
        addr1 = createWalletClient({
            account: addr1Address,
            chain: hardhat,
            transport: http(),
        });
        addr2 = createWalletClient({
            account: addr2Address,
            chain: hardhat,
            transport: http(),
        });

        // Deploy MockERC20
        const mockERC20Hash = await owner.deployContract({
            abi: MockERC20Artifact.abi,
            bytecode: MockERC20Artifact.bytecode as Hex,
            args: ["TestToken", "TKN", 18],
        });
        const mockERC20Receipt = await publicClient.waitForTransactionReceipt({ hash: mockERC20Hash });
        mockERC20Contract = {
            address: mockERC20Receipt.contractAddress!,
            abi: MockERC20Artifact.abi,
        };

        // Deploy MockPyth
        const mockPythHash = await owner.deployContract({
            abi: MockPythArtifact.abi,
            bytecode: MockPythArtifact.bytecode as Hex,
            args: [],
        });
        const mockPythReceipt = await publicClient.waitForTransactionReceipt({ hash: mockPythHash });
        mockPythContract = {
            address: mockPythReceipt.contractAddress!,
            abi: MockPythArtifact.abi,
        };

        // Deploy LiquidityPool
        const liquidityPoolHash = await owner.deployContract({
            abi: LiquidityPoolArtifact.abi,
            bytecode: LiquidityPoolArtifact.bytecode as Hex,
            args: [mockPythContract.address],
        });
        const liquidityPoolReceipt = await publicClient.waitForTransactionReceipt({ hash: liquidityPoolHash });
        liquidityPoolContract = {
            address: liquidityPoolReceipt.contractAddress!,
            abi: LiquidityPoolArtifact.abi,
        };

        // Set a price in MockPyth
        await owner.writeContract({
            address: mockPythContract.address,
            abi: mockPythContract.abi,
            functionName: "setPrice",
            args: [PYTH_PRICE_ID, 10000000000n, -7],
        });

        // Add supported asset
        await owner.writeContract({
            address: liquidityPoolContract.address,
            abi: liquidityPoolContract.abi,
            functionName: "addSupportedAsset",
            args: [mockERC20Contract.address],
        });

        // Mint some tokens to addr1 and approve the pool
        await owner.writeContract({
            address: mockERC20Contract.address,
            abi: mockERC20Contract.abi,
            functionName: "mint",
            args: [addr1.account.address, parseEther("1000")],
        });
        await addr1.writeContract({
            address: mockERC20Contract.address,
            abi: mockERC20Contract.abi,
            functionName: "approve",
            args: [liquidityPoolContract.address, parseEther("1000")],
        });
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect((await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "owner",
            })).toLowerCase()).to.equal(owner.account.address.toLowerCase());
        });

        it("Should set the correct Pyth oracle address", async function () {
            expect((await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "pyth",
            })).toLowerCase()).to.equal(mockPythContract.address.toLowerCase());
        });
    });

    describe("Asset Management", function () {
        it("Should allow owner to add supported assets", async function () {
            expect(await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "supportedAssets",
                args: [mockERC20Contract.address],
            })).to.be.true;
        });

        it("Should not allow non-owner to add supported assets", async function () {
            await expect(addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "addSupportedAsset",
                args: [mockERC20Contract.address],
            })).to.be.rejected;
        });
    });

    describe("Deposit", function () {
        it("Should allow users to deposit assets", async function () {
            const depositAmount = parseEther("100");
            await addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "deposit",
                args: [mockERC20Contract.address, depositAmount],
            });

            expect(await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBalances",
                args: [addr1.account.address, mockERC20Contract.address],
            })).to.equal(depositAmount);

            const assetInfo = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "assetInformation",
                args: [mockERC20Contract.address],
            });
            expect(assetInfo[0]).to.equal(depositAmount); // Accessing totalLiquidity

            // Re-deposit to check event emission
            // await expect(addr1.writeContract({
            //     address: liquidityPoolContract.address,
            //     abi: liquidityPoolContract.abi,
            //     functionName: "deposit",
            //     args: [mockERC20Contract.address, depositAmount],
            // })).to.emit(liquidityPoolContract.address, "Deposited");
        });

        it("Should not allow deposit of unsupported assets", async function () {
            const unsupportedTokenHash = await owner.deployContract({
                abi: MockERC20Artifact.abi,
                bytecode: MockERC20Artifact.bytecode as Hex,
                args: ["Unsupported", "UNS", 18],
            });
            const unsupportedTokenReceipt = await publicClient.waitForTransactionReceipt({ hash: unsupportedTokenHash });
            const unsupportedTokenContract = {
                address: unsupportedTokenReceipt.contractAddress!,
                abi: MockERC20Artifact.abi,
            };

            await expect(addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "deposit",
                args: [unsupportedTokenContract.address, parseEther("10")],
            })).to.be.rejected;
        });
    });

    describe("Withdraw", function () {
        beforeEach(async function () {
            // Mint some tokens to addr1 and approve the pool
            await owner.writeContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "mint",
                args: [addr1.account.address, parseEther("1000")],
            });
            await addr1.writeContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "approve",
                args: [liquidityPoolContract.address, parseEther("1000")],
            });
            // Deposit some liquidity first
            await addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "deposit",
                args: [mockERC20Contract.address, parseEther("100")],
            });
        });

        it("Should allow users to withdraw their deposited assets", async function () {
            const withdrawAmount = parseEther("50");
            const initialBalance = await publicClient.readContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "balanceOf",
                args: [addr1.account.address],
            });

            await addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "withdraw",
                args: [mockERC20Contract.address, withdrawAmount],
            });

            expect(await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBalances",
                args: [addr1.account.address, mockERC20Contract.address],
            })).to.equal(parseEther("50"));

            const assetInfo = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "assetInformation",
                args: [mockERC20Contract.address],
            });
            expect(assetInfo[0]).to.equal(parseEther("50"));
            expect(await publicClient.readContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "balanceOf",
                args: [addr1.account.address],
            })).to.equal(initialBalance + withdrawAmount);

            // Re-withdraw to check event emission
            // await expect(addr1.writeContract({
            //     address: liquidityPoolContract.address,
            //     abi: liquidityPoolContract.abi,
            //     functionName: "withdraw",
            //     args: [mockERC20Contract.address, withdrawAmount],
            // })).to.emit(liquidityPoolContract.address, "Withdrawn");
        });

        it("Should not allow withdrawal of more than deposited", async function () {
            await expect(addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "withdraw",
                args: [mockERC20Contract.address, parseEther("300")],
            })).to.be.rejected;
        });

        it("Should not allow withdrawal of unsupported assets", async function () {
            const unsupportedTokenHash = await owner.deployContract({
                abi: MockERC20Artifact.abi,
                bytecode: MockERC20Artifact.bytecode as Hex,
                args: ["Unsupported", "UNS", 18],
            });
            const unsupportedTokenReceipt = await publicClient.waitForTransactionReceipt({ hash: unsupportedTokenHash });
            const unsupportedTokenContract = {
                address: unsupportedTokenReceipt.contractAddress!,
                abi: MockERC20Artifact.abi,
            };

            await expect(addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "withdraw",
                args: [unsupportedTokenContract.address, parseEther("10")],
            })).to.be.rejected;
        });
    });

    describe("Borrow", function () {
        beforeEach(async function () {
            // Mint some tokens to owner and approve the pool
            await owner.writeContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "mint",
                args: [owner.account.address, parseEther("1000")],
            });
            await owner.writeContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "approve",
                args: [liquidityPoolContract.address, parseEther("1000")],
            });
            // Deposit some liquidity first
            await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "deposit",
                args: [mockERC20Contract.address, parseEther("500")],
            });
        });

        it("Should allow users to borrow assets", async function () {
            const borrowAmount = parseEther("50");
            const initialBorrowerBalance = await publicClient.readContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "balanceOf",
                args: [addr1.account.address],
            });

            await addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "borrow",
                args: [mockERC20Contract.address, borrowAmount],
            });

            expect(await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBorrows",
                args: [addr1.account.address, mockERC20Contract.address],
            })).to.equal(borrowAmount);

            const assetInfo = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "assetInformation",
                args: [mockERC20Contract.address],
            });
            expect(assetInfo[1]).to.equal(borrowAmount); // Accessing totalBorrowed
            expect(await publicClient.readContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "balanceOf",
                args: [addr1.account.address],
            })).to.equal(initialBorrowerBalance + borrowAmount);

            // Re-borrow to check event emission
            // await expect(addr1.writeContract({
            //     address: liquidityPoolContract.address,
            //     abi: liquidityPoolContract.abi,
            //     functionName: "borrow",
            //     args: [mockERC20Contract.address, borrowAmount],
            // })).to.emit(liquidityPoolContract.address, "Borrowed");
        });

        it("Should not allow borrowing more than available liquidity", async function () {
            await expect(addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "borrow",
                args: [mockERC20Contract.address, parseEther("600")],
            })).to.be.rejected;
        });

        it("Should not allow borrowing of unsupported assets", async function () {
            const unsupportedTokenHash = await owner.deployContract({
                abi: MockERC20Artifact.abi,
                bytecode: MockERC20Artifact.bytecode as Hex,
                args: ["Unsupported", "UNS", 18],
            });
            const unsupportedTokenReceipt = await publicClient.waitForTransactionReceipt({ hash: unsupportedTokenHash });
            const unsupportedTokenContract = {
                address: unsupportedTokenReceipt.contractAddress!,
                abi: MockERC20Artifact.abi,
            };

            await expect(addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "borrow",
                args: [unsupportedTokenContract.address, parseEther("10")],
            })).to.be.rejected;
        });
    });

    describe("Repay", function () {
        beforeEach(async function () {
            // Mint some tokens to owner and approve the pool
            await owner.writeContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "mint",
                args: [owner.account.address, parseEther("1000")],
            });
            await owner.writeContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "approve",
                args: [liquidityPoolContract.address, parseEther("1000")],
            });
            // Deposit some liquidity first
            await owner.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "deposit",
                args: [mockERC20Contract.address, parseEther("500")],
            });

            // Addr1 borrows some assets
            await addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "borrow",
                args: [mockERC20Contract.address, parseEther("100")],
            });

            // Addr1 approves the pool to spend tokens for repayment
            await owner.writeContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "mint",
                args: [addr1.account.address, parseEther("100")], // Mint more for repayment
            });
            await addr1.writeContract({
                address: mockERC20Contract.address,
                abi: mockERC20Contract.abi,
                functionName: "approve",
                args: [liquidityPoolContract.address, parseEther("100")],
            });
        });

        it("Should allow users to repay their borrowed assets", async function () {
            const repayAmount = parseEther("50");
            const initialBorrow = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBorrows",
                args: [addr1.account.address, mockERC20Contract.address],
            });
            const assetInfo = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "assetInformation",
                args: [mockERC20Contract.address],
            });
            const initialPoolBorrowed = assetInfo[1];

            await addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "repay",
                args: [mockERC20Contract.address, repayAmount],
            });

            expect(await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "userBorrows",
                args: [addr1.account.address, mockERC20Contract.address],
            })).to.equal(initialBorrow - repayAmount);

            const updatedAssetInfo = await publicClient.readContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "assetInformation",
                args: [mockERC20Contract.address],
            });
            expect(updatedAssetInfo[1]).to.equal(initialPoolBorrowed - repayAmount);

            // Re-repay to check event emission
            // await expect(addr1.writeContract({
            //     address: liquidityPoolContract.address,
            //     abi: liquidityPoolContract.abi,
            //     functionName: "repay",
            //     args: [mockERC20Contract.address, repayAmount],
            // })).to.emit(liquidityPoolContract.address, "Repaid");
        });

        it("Should not allow repaying more than borrowed", async function () {
            await expect(addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "repay",
                args: [mockERC20Contract.address, parseEther("150")],
            })).to.be.rejected;
        });

        it("Should not allow repaying of unsupported assets", async function () {
            const unsupportedTokenHash = await owner.deployContract({
                abi: MockERC20Artifact.abi,
                bytecode: MockERC20Artifact.bytecode as Hex,
                args: ["Unsupported", "UNS", 18],
            });
            const unsupportedTokenReceipt = await publicClient.waitForTransactionReceipt({ hash: unsupportedTokenHash });
            const unsupportedTokenContract = {
                address: unsupportedTokenReceipt.contractAddress!,
                abi: MockERC20Artifact.abi,
            };

            await expect(addr1.writeContract({
                address: liquidityPoolContract.address,
                abi: liquidityPoolContract.abi,
                functionName: "repay",
                args: [unsupportedTokenContract.address, parseEther("10")],
            })).to.be.rejected;
        });
    });
});