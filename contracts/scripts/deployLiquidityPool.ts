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

    // Add WETH and PYUSD as supported assets
    const WETH_TOKEN = process.env.WETH_TOKEN as Hex;
    const PYUSD_TOKEN = process.env.PYUSD_TOKEN as Hex;

    if (WETH_TOKEN) {
        await LiquidityPoolContract.write.addSupportedAsset([WETH_TOKEN]);
        console.log("WETH added as supported asset in LiquidityPool");
    }

    if (PYUSD_TOKEN) {
        await LiquidityPoolContract.write.addSupportedAsset([PYUSD_TOKEN]);
        console.log("PYUSD added as supported asset in LiquidityPool");
    }

    console.log("Deployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });