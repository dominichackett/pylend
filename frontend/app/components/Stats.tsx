
"use client";
import React, { useEffect, useState } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { sepolia } from "viem/chains";
import { lendingPoolAddress, lendingPoolABI } from "@/lib/contracts";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
});

const Stats = () => {
  const [totalLiquidity, setTotalLiquidity] = useState<string>("0");
  const [totalBorrowed, setTotalBorrowed] = useState<string>("0");
  const [totalBadDebt, setTotalBadDebt] = useState<string>("0");
  const [loanCount, setLoanCount] = useState<string>("0");
  const [borrowRate, setBorrowRate] = useState<string>("0");

  useEffect(() => {
    const fetchStats = async () => {
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

        setTotalLiquidity(formatUnits(liquidity as bigint, 6));
        setTotalBorrowed(formatUnits(borrowed as bigint, 6));
        setTotalBadDebt(formatUnits(badDebt as bigint, 6));
        setLoanCount((loans as bigint).toString());
        setBorrowRate(rate.toString());
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-white mb-8">
      <div className="bg-black bg-opacity-30 p-4 rounded-lg text-center">
        <h3 className="text-gray-400">Total Liquidity</h3>
        <p className="text-2xl font-bold">${parseFloat(totalLiquidity).toFixed(2)}</p>
      </div>
      <div className="bg-black bg-opacity-30 p-4 rounded-lg text-center">
        <h3 className="text-gray-400">Total Borrowed</h3>
        <p className="text-2xl font-bold">${parseFloat(totalBorrowed).toFixed(2)}</p>
      </div>
      <div className="bg-black bg-opacity-30 p-4 rounded-lg text-center">
        <h3 className="text-gray-400">Total Bad Debt</h3>
        <p className="text-2xl font-bold">${parseFloat(totalBadDebt).toFixed(2)}</p>
      </div>
      <div className="bg-black bg-opacity-30 p-4 rounded-lg text-center">
        <h3 className="text-gray-400">Loan Count</h3>
        <p className="text-2xl font-bold">{loanCount}</p>
      </div>
      <div className="bg-black bg-opacity-30 p-4 rounded-lg text-center">
        <h3 className="text-gray-400">Current Borrow Rate</h3>
        <p className="text-2xl font-bold">{(parseFloat(borrowRate) / 100).toFixed(2)}%</p>
      </div>
    </div>
  );
};

export default Stats;
