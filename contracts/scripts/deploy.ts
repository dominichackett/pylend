import hre from "hardhat";

async function main() {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const unlockTime = BigInt(currentTimestampInSeconds + 60);

  const lockedAmount = hre.viem.parseGwei("1");

  const lock = await hre.viem.deployContract("Lock", [unlockTime], {
    value: lockedAmount,
  });

  console.log(
    `Lock with ${hre.viem.formatGwei(
      lockedAmount
    )} ETH and unlock timestamp ${unlockTime} deployed to ${lock.address}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});