import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { describe, it, before } from "node:test";
import {
    createPublicClient,
    createWalletClient,
    http,
    PublicClient,
    WalletClient,
    Hex,
    Address
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

// Import contract artifacts
import InterestRateModelArtifact from "../artifacts/contracts/InterestRateModel.sol/InterestRateModel.json";
import LendingPoolArtifact from "../artifacts/contracts/LendingPool.sol/LendingPool.json";

use(chaiAsPromised);

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const INTEREST_RATE_MODEL_ADDRESS: Address = "0xb5b0d00bc1eb929549a6b79696fc0029f263d0dd";
// Assuming LendingPool address is known, if not, it would need to be fetched.
// For this test, we'll assume it's set as an environment variable or hardcoded for simplicity. 
// In a real scenario, you'd likely fetch it from a deployment script output.
const LENDING_POOL_ADDRESS: Address = "0x8e1207975db83b7f6ebdeef66e7693da07dfc123"; // Example address, replace with actual if different

describe("InterestRateModel - Set 4% Borrow Rate", function () {
    let publicClient: PublicClient;
    let deployer: WalletClient;

    before(async function () {
        publicClient = createPublicClient({
            chain: sepolia,
            transport: http(SEPOLIA_RPC_URL),
        });

        const deployerAccount = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
        deployer = createWalletClient({
            account: deployerAccount,
            chain: sepolia,
            transport: http(SEPOLIA_RPC_URL),
        });

        console.log("Deployer Address:", deployer.account.address);
    });

    it("Should set the borrow interest rate to a fixed 4%", async function () {
        // Parameters for a fixed 4% (400 basis points) interest rate
        const baseRatePerYear = 400n;
        const multiplierPerYear = 0n;
        const jumpMultiplierPerYear = 0n;
        const kink = 0n;

        // Interact with the deployed InterestRateModel contract
        const interestRateModelContract = {
            address: INTEREST_RATE_MODEL_ADDRESS,
            abi: InterestRateModelArtifact.abi,
        };

        // Verify the current borrow rate from the LendingPool before update
        const initialBorrowRate = await publicClient.readContract({
            address: LENDING_POOL_ADDRESS,
            abi: LendingPoolArtifact.abi,
            functionName: "getCurrentBorrowRate",
        }) as bigint;
        console.log("Initial Borrow Rate (basis points):", initialBorrowRate.toString());

        console.log("Updating InterestRateModel parameters...");
        const updateHash = await deployer.writeContract({
            address: interestRateModelContract.address,
            abi: interestRateModelContract.abi,
            functionName: "updateModel",
            args: [
                baseRatePerYear,
                multiplierPerYear,
                jumpMultiplierPerYear,
                kink,
            ],
        });
        await publicClient.waitForTransactionReceipt({ hash: updateHash });
        console.log("InterestRateModel updated. Transaction Hash:", updateHash);

        // Verify the new borrow rate from the LendingPool
        const currentBorrowRate = await publicClient.readContract({
            address: LENDING_POOL_ADDRESS,
            abi: LendingPoolArtifact.abi,
            functionName: "getCurrentBorrowRate",
        }) as bigint;

        console.log("Current Borrow Rate (basis points):", currentBorrowRate.toString());
        expect(currentBorrowRate).to.equal(baseRatePerYear);
    });
});
