'use client'
import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { LendingPoolABI, lendingPoolAddress } from "../../lib/contracts";
import Header from "../components/Header";
import Footer from "../components/Footer";

interface TokenInfo {
  token: string;
  symbol: string;
  priceFeedId: string;
  threshold: number;
  decimals: number;
}

export default function Borrow() {
  const publicClient = usePublicClient();
  const [approvedCollateral, setApprovedCollateral] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [borrowAPY, setBorrowAPY] = useState<string | null>(null);
  const [selectedCollateralToken, setSelectedCollateralToken] = useState<string>("");
  const [collateralAmountInput, setCollateralAmountInput] = useState<string>("");
  const [borrowAmountInput, setBorrowAmountInput] = useState<string>("");
  const [maxBorrowAmount, setMaxBorrowAmount] = useState<bigint | null>(null);

  useEffect(() => {
    const fetchApprovedCollateralAndBorrowRate = async () => {
      try {
        setLoading(true);
        // Fetch approved collateral
        const collateralResponse = await fetch('/api/gettoken');
        if (!collateralResponse.ok) {
          throw new Error('Failed to fetch approved collateral');
        }
        const collateralData: TokenInfo[] = await collateralResponse.json();
        setApprovedCollateral(collateralData);

        // Fetch borrow APY
        try {
          const rate = await publicClient.readContract({
            address: lendingPoolAddress,
            abi: LendingPoolABI,
            functionName: "getCurrentBorrowRate",
          });
          setBorrowAPY(Number(formatUnits(rate as bigint, 18)).toFixed(4));
        } catch (contractError: any) {
          console.error("Error calling getCurrentBorrowRate:", contractError);
          console.error("Lending Pool Address:", lendingPoolAddress);
          console.error("Public Client Chain ID:", publicClient.chain.id);
          setError(`Failed to fetch borrow APY: ${contractError.message || contractError}`);
        }

      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchApprovedCollateralAndBorrowRate();
  }, [publicClient]);

  useEffect(() => {
    const fetchMaxBorrowAmount = async () => {
      console.log("Fetching max borrow amount...");
      console.log("selectedCollateralToken:", selectedCollateralToken);
      console.log("collateralAmountInput:", collateralAmountInput);

      if (!selectedCollateralToken || !collateralAmountInput || isNaN(parseFloat(collateralAmountInput))) {
        setMaxBorrowAmount(null);
        console.log("Skipping fetch: missing collateral token, invalid amount, or zero.");
        return;
      }

      try {
        const collateralTokenInfo = approvedCollateral.find(token => token.token === selectedCollateralToken);
        if (!collateralTokenInfo) {
          console.error("Selected collateral token info not found.", selectedCollateralToken);
          throw new Error("Selected collateral token not found.");
        }
        console.log("Collateral token info:", collateralTokenInfo);

        // Convert collateralAmountInput to the smallest unit based on token decimals
        const amountFloat = parseFloat(collateralAmountInput);
        // The previous check `isNaN(amountFloat) || amountFloat <= 0` is now redundant here due to the earlier check
        // but keeping `amountFloat <= 0` for logical correctness if input can be 0 after parsing.
        if (amountFloat <= 0) {
          console.log("Invalid collateral amount (zero or negative).");
          setMaxBorrowAmount(null);
          return;
        }
        const collateralAmountBigInt = parseUnits(collateralAmountInput, collateralTokenInfo.decimals);
        console.log("Collateral amount (BigInt):", collateralAmountBigInt);

        const maxAmount = await publicClient.readContract({
          address: lendingPoolAddress,
          abi: LendingPoolABI,
          functionName: "getMaxBorrowAmount",
          args: [selectedCollateralToken as Address, collateralAmountBigInt],
        });
        console.log("Max borrow amount from contract:", maxAmount);
        setMaxBorrowAmount(maxAmount as bigint);
      } catch (err: any) {
        console.error("Error fetching max borrow amount:", err);
        setMaxBorrowAmount(null);
        // Optionally, set an error state for max borrow amount fetching
      }
    };
    fetchMaxBorrowAmount();
  }, [selectedCollateralToken, collateralAmountInput, approvedCollateral, publicClient]);

  if (loading) {
    return (
      <div className="font-sans flex flex-col flex-grow min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-10 flex-grow text-white text-center">
          <p>Loading collateral assets...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="font-sans flex flex-col flex-grow min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-10 flex-grow text-white text-center">
          <p className="text-red-500">Error: {error}</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="font-sans flex flex-col flex-grow min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-10 flex-grow">
        <h2 className="text-3xl font-bold mb-8 text-center">Borrow PYUSD</h2>

        <div className="max-w-lg mx-auto bg-[#2F2F2F] p-8 rounded-lg text-white">
          <form>
            <div className="mb-4">
              <label htmlFor="collateralAsset" className="block text-gray-400 mb-2">Collateral Asset</label>
              <select
                id="collateralAsset"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4"
                value={selectedCollateralToken}
                onChange={(e) => setSelectedCollateralToken(e.target.value)}
              >
                <option value="">Select Collateral</option>
                {approvedCollateral.map((tokenInfo) => (
                  <option key={tokenInfo.token} value={tokenInfo.token}>
                    {tokenInfo.symbol}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="collateralAmount" className="block text-gray-400 mb-2">Collateral Amount</label>
              <input
                type="number"
                id="collateralAmount"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4"
                value={collateralAmountInput}
                onChange={(e) => setCollateralAmountInput(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="borrowAmount" className="block text-gray-400 mb-2">Borrow Amount (PYUSD)</label>
              <input
                type="number"
                id="borrowAmount"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4"
                value={borrowAmountInput}
                onChange={(e) => setBorrowAmountInput(e.target.value)}
              />
              {maxBorrowAmount !== null && (
                <p className="text-gray-400 text-sm mt-2">
                  Max Borrowable: {formatUnits(maxBorrowAmount, 6)} PYUSD
                </p>
              )}
              {borrowAmountInput && maxBorrowAmount !== null && parseFloat(borrowAmountInput) > parseFloat(formatUnits(maxBorrowAmount, 6)) && (
                <p className="text-red-500 text-sm mt-2">Borrow amount exceeds maximum borrowable amount.</p>
              )}
            </div>

            <hr className="my-8 border-gray-700" />

            <div className="mb-4">
              <h4 className="text-xl font-bold mb-2">Transaction Summary</h4>
              <div className="flex justify-between">
                <p className="text-gray-400">Borrow APY:</p>
                <p>{borrowAPY !== null ? `${(parseFloat(borrowAPY) * 100).toFixed(2)}%` : "Loading..."}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-400">Health Factor:</p>
                <p className="text-green-500">2.5</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-400">Liquidation Price:</p>
                <p>$1,000</p>
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-full">Borrow PYUSD</button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
