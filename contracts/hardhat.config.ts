import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-network-helpers";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  plugins: [hardhatNodeTestRunner, hardhatNetworkHelpers],
};

export default config;

