import hre from "hardhat";
import { parseEther, Hex } from "viem";

async function main() {
    const [deployer] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    console.log("Deploying contracts with the account:", deployer.account.address);

    const PYTH_ORACLE_ADDRESS = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21"; // Provided Pyth oracle address on Ethereum Sepolia

    // Deploy LiquidityPool
    const LiquidityPoolContract = await hre.viem.deployContract("LiquidityPool", [PYTH_ORACLE_ADDRESS]);
    const liquidityPoolAddress = LiquidityPoolContract.address;
    console.log("LiquidityPool deployed to:", liquidityPoolAddress);

    // TODO: Add a real supported asset (e.g., USDC, WETH) and its corresponding Pyth price feed ID.
    // Example:
    // const USDC_ADDRESS = "0x..."; // Replace with actual USDC address on Sepolia
    // const USDC_PYTH_PRICE_ID = "0x..."; // Replace with actual Pyth price feed ID for USDC
    // await LiquidityPoolContract.write.addSupportedAsset([USDC_ADDRESS]);
    // console.log("USDC added as supported asset in LiquidityPool");

    console.log("Deployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });