import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
//import hardhatNodeTestRunner from "@nomicfoundation/hardhat-network-helpers";
import "dotenv/config"
const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      type:"http",
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}` || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
 
};

export default config;

