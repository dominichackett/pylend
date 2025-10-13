import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
    plugins: [hardhatNodeTestRunner,hardhatNetworkHelpers],
   
};



export default config;
