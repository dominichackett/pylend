'use client'
import { useState, useEffect, useRef, useCallback } from "react";
import { usePublicClient, useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits, Address } from "viem";
import { HermesClient } from "@pythnetwork/hermes-client";
import { LendingPoolABI, lendingPoolAddress } from "../../lib/contracts";
import { erc20ABI } from "../../lib/erc20";
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
  const { address: account } = useAccount();
  const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [approvedCollateral, setApprovedCollateral] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [borrowAPY, setBorrowAPY] = useState<string | null>(null);
  const [selectedCollateralToken, setSelectedCollateralToken] = useState<string>("");
  const [collateralAmountInput, setCollateralAmountInput] = useState<string>("");
  const [borrowAmountInput, setBorrowAmountInput] = useState<string>("");
  const [maxBorrowAmount, setMaxBorrowAmount] = useState<bigint | null>(null);
  const [priceFeedData, setPriceFeedData] = useState<Record<string, number>>({}); // priceFeedId -> price
  const prevPriceFeedDataRef = useRef<Record<string, number>>({}); // priceFeedId -> previous price
  const [currentCollateralPrice, setCurrentCollateralPrice] = useState<number | null>(null);
  const [healthFactor, setHealthFactor] = useState<string | null>(null);
  const [liquidationPrice, setLiquidationPrice] = useState<string | null>(null);
  const [collateralBalance, setCollateralBalance] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);

  // Effect to update prevPriceFeedDataRef after priceFeedData changes
  useEffect(() => {
    prevPriceFeedDataRef.current = priceFeedData;
  }, [priceFeedData]);

  // Calculate Health Factor
  const calculateHealthFactorValue = useCallback(() => {
    const collateralTokenInfo = approvedCollateral.find(token => token.token === selectedCollateralToken);
    if (!collateralTokenInfo || currentCollateralPrice === null || !collateralAmountInput || !borrowAmountInput) {
      setHealthFactor(null);
      return;
    }

    try {
      const collateralAmountFloat = parseFloat(collateralAmountInput);
      const borrowAmountFloat = parseFloat(borrowAmountInput);

      if (isNaN(collateralAmountFloat) || collateralAmountFloat <= 0 || isNaN(borrowAmountFloat) || borrowAmountFloat <= 0) {
        setHealthFactor(null);
        return;
      }

      // Convert liquidation threshold from basis points to a ratio
      const liquidationThresholdRatio = collateralTokenInfo.threshold / 10000;

      // Collateral Value = collateralAmount (human-readable) * currentCollateralPrice
      const collateralValue = collateralAmountFloat * currentCollateralPrice;

      // Health Factor = (Collateral Value * Liquidation Threshold Ratio) / Borrowed Amount
      if (borrowAmountFloat === 0) {
        setHealthFactor("Infinity"); // Or handle as appropriate for UI
        return;
      }

      const calculatedHF = (collateralValue * liquidationThresholdRatio) / borrowAmountFloat;
      setHealthFactor(calculatedHF.toFixed(2));

    } catch (e) {
      console.error("Error calculating health factor:", e);
      setHealthFactor(null);
    }
  }, [collateralAmountInput, borrowAmountInput, currentCollateralPrice, selectedCollateralToken, approvedCollateral]);

  // Calculate Liquidation Price
  const calculateLiquidationPriceValue = useCallback(() => {
    const collateralTokenInfo = approvedCollateral.find(token => token.token === selectedCollateralToken);
    if (!collateralTokenInfo || !collateralAmountInput || !borrowAmountInput) {
      setLiquidationPrice(null);
      return;
    }

    try {
      const collateralAmountFloat = parseFloat(collateralAmountInput);
      const borrowAmountFloat = parseFloat(borrowAmountInput);

      if (isNaN(collateralAmountFloat) || collateralAmountFloat <= 0 || isNaN(borrowAmountFloat) || borrowAmountFloat <= 0) {
        setLiquidationPrice(null);
        return;
      }

      // Convert liquidation threshold from basis points to a ratio
      const liquidationThresholdRatio = collateralTokenInfo.threshold / 10000;

      // Rearrange Health Factor formula for Liquidation Price
      // Health Factor = (Collateral Value * Liquidation Threshold Ratio) / Borrowed Amount
      // 1 = (Collateral Amount * Liquidation Price * Liquidation Threshold Ratio) / Borrowed Amount
      // Liquidation Price = Borrowed Amount / (Collateral Amount * Liquidation Threshold Ratio)

      if (collateralAmountFloat === 0 || liquidationThresholdRatio === 0) {
        setLiquidationPrice("0.00"); // Or handle as appropriate for UI
        return;
      }

      const calculatedLP = borrowAmountFloat / (collateralAmountFloat * liquidationThresholdRatio);
      setLiquidationPrice(calculatedLP.toFixed(2));

    } catch (e) {
      console.error("Error calculating liquidation price:", e);
      setLiquidationPrice(null);
    }
  }, [collateralAmountInput, borrowAmountInput, selectedCollateralToken, approvedCollateral]);

  // Effect to fetch and stream Pyth prices for the selected collateral
  useEffect(() => {
    if (!selectedCollateralToken || approvedCollateral.length === 0) {
      setCurrentCollateralPrice(null);
      return;
    }

    const collateralTokenInfo = approvedCollateral.find(token => token.token === selectedCollateralToken);
    if (!collateralTokenInfo || !collateralTokenInfo.priceFeedId) {
      setCurrentCollateralPrice(null);
      return;
    }

    const setupPythStream = async () => {
      const hermesClient = new HermesClient("https://hermes.pyth.network");
      const priceId = collateralTokenInfo.priceFeedId;
      const formattedPriceId = priceId.startsWith("0x") ? priceId.substring(2) : priceId;

      const newEventSource = await hermesClient.getPriceUpdatesStream([formattedPriceId]);
      const eventSourceRef = { current: newEventSource }; // Use a ref to hold EventSource

      newEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        data.parsed.forEach((priceFeed: any) => {
          const receivedPriceId = `0x${priceFeed.id}`;
          if (receivedPriceId === priceId) {
            const price = Number(formatUnits(BigInt(priceFeed.price.price), Math.abs(priceFeed.price.expo)));
            setPriceFeedData(prev => ({ ...prev, [receivedPriceId]: price }));
            setCurrentCollateralPrice(price);
          }
        });
      };

      newEventSource.onerror = (error) => {
        console.error("Error receiving Pyth price updates:", error);
        newEventSource.close();
      };

      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
      };
    };

    setupPythStream();
  }, [selectedCollateralToken, approvedCollateral]);

  // Effect to trigger health factor and liquidation price calculations
  useEffect(() => {
    calculateHealthFactorValue();
    calculateLiquidationPriceValue();
  }, [calculateHealthFactorValue, calculateLiquidationPriceValue]);

  useEffect(() => {
    const fetchCollateralBalance = async () => {
      if (!selectedCollateralToken || !account) {
        setCollateralBalance(null);
        return;
      }

      try {
        const collateralTokenInfo = approvedCollateral.find(token => token.token === selectedCollateralToken);
        if (!collateralTokenInfo) return;

        const balance = await publicClient.readContract({
          address: selectedCollateralToken as Address,
          abi: erc20ABI,
          functionName: 'balanceOf',
          args: [account],
        });

        setCollateralBalance(formatUnits(balance as bigint, collateralTokenInfo.decimals));
      } catch (err) {
        console.error("Error fetching collateral balance:", err);
        setCollateralBalance(null);
      }
    };

    fetchCollateralBalance();
  }, [selectedCollateralToken, account, publicClient, approvedCollateral]);

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

  const handleApprove = async () => {
    const collateralTokenInfo = approvedCollateral.find(token => token.token === selectedCollateralToken);
    if (!collateralTokenInfo || !collateralAmountInput) return;

    const amountToApprove = parseUnits(collateralAmountInput, collateralTokenInfo.decimals);

    writeContract({
      address: selectedCollateralToken as Address,
      abi: erc20ABI,
      functionName: 'approve',
      args: [lendingPoolAddress, amountToApprove],
    });
  };

  const handleBorrow = async () => {
    const collateralTokenInfo = approvedCollateral.find(token => token.token === selectedCollateralToken);
    if (!collateralTokenInfo || !collateralAmountInput || !borrowAmountInput) return;

    const collateralAmount = parseUnits(collateralAmountInput, collateralTokenInfo.decimals);
    const borrowAmount = parseUnits(borrowAmountInput, 6); // PYUSD has 6 decimals

    writeContract({
      address: lendingPoolAddress,
      abi: LendingPoolABI,
      functionName: 'borrow',
      args: [borrowAmount, selectedCollateralToken as Address, collateralAmount],
    });
  };

  useEffect(() => {
    if (isConfirmed) {
      setIsApproved(true);
    }
  }, [isConfirmed]);

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
 
            <div className="mb-4">
              <label htmlFor="collateralAsset" className="block text-gray-400 mb-2">Collateral Asset</label>
              <select
                id="collateralAsset"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4"
                value={selectedCollateralToken}
                onChange={(e) => {
                  setSelectedCollateralToken(e.target.value);
                  setIsApproved(false); // Reset approval status on token change
                }}
              >
                <option value="">Select Collateral</option>
                {approvedCollateral.map((tokenInfo) => (
                  <option key={tokenInfo.token} value={tokenInfo.token}>
                    {tokenInfo.symbol}
                  </option>
                ))}
              </select>
              {collateralBalance !== null && (
                <p className="text-gray-400 text-sm mt-2">Balance: {collateralBalance}</p>
              )}
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
                <p className={healthFactor && parseFloat(healthFactor) < 1.1 ? "text-red-500" : "text-green-500"}>
                  {healthFactor !== null ? healthFactor : "N/A"}
                </p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-400">Liquidation Price:</p>
                <p>{liquidationPrice !== null ? `$${liquidationPrice}` : "N/A"}</p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleApprove}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-full disabled:bg-gray-500"
                disabled={!selectedCollateralToken || !collateralAmountInput || isApproved}
              >
                {isApproved ? "Approved" : "Approve"}
              </button>
              <button
                type="button"
                onClick={handleBorrow}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-full disabled:bg-gray-500"
                disabled={!isApproved || !borrowAmountInput}
              >
                Borrow PYUSD
              </button>
            </div>

            {isPending && <div className="text-center mt-4">Transaction in progress...</div>}
            {isConfirming && <div className="text-center mt-4">Waiting for confirmation...</div>}
            {isConfirmed && <div className="text-center mt-4 text-green-500">Transaction successful!</div>}
            {writeError && <div className="text-center mt-4 text-red-500">Error: {writeError.message}</div>}

        </div>
      </main>

      <Footer />
    </div>
  );
}
