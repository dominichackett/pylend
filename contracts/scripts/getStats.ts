
import { createPublicClient, http, formatUnits } from "viem";
import { sepolia } from "viem/chains";
import { lendingPoolABI, lendingPoolAddress } from "../../frontend/lib/contracts";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
});

async function getStats() {
  try {
    const [
      liquidity,
      borrowed,
      badDebt,
      loans,
      rate,
    ] = await Promise.all([
      publicClient.readContract({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "totalLiquidity",
      }),
      publicClient.readContract({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "totalBorrowed",
      }),
      publicClient.readContract({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "totalBadDebt",
      }),
      publicClient.readContract({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "loanCounter",
      }),
      publicClient.readContract({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "getCurrentBorrowRate",
      }),
    ]);

    console.log("Total Liquidity:", formatUnits(liquidity as bigint, 18));
    console.log("Total Borrowed:", formatUnits(borrowed as bigint, 18));
    console.log("Total Bad Debt:", formatUnits(badDebt as bigint, 18));
    console.log("Loan Count:", (loans as bigint).toString());
    console.log("Current Borrow Rate:", formatUnits(rate as bigint, 18));
  } catch (error) {
    console.error("Error fetching stats:", error);
  }
}

getStats();
