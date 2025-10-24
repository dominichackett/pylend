'use client';
import { useState, useEffect, useCallback, useRef } from "react";
import React from "react";
import { formatUnits, createPublicClient, http, Address, parseUnits } from "viem";
import { sepolia } from 'viem/chains';
import { HermesClient } from "@pythnetwork/hermes-client";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";

import Header from "../components/Header";
import Footer from "../components/Footer";
import LoanRow from "./LoanRow";
import AlertDialog from "../components/AlertDialog";
import { getShortErrorMessage } from "../../lib/errors";
import { lendingPoolAddress, lendingPoolABI, PYUSD_ADDRESS, ERC20_ABI } from "../../lib/contracts";

export default function Liquidations() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [loans, setLoans] = useState<LoanData[]>([]);
  const [tokenInfoMap, setTokenInfoMap] = useState<Record<string, TokenInfo>>({});
  const [priceFeedData, setPriceFeedData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevPriceFeedDataRef = useRef<Record<string, number>>({});

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");

  const openDialog = (title: string, message: string) => {
    setDialogTitle(title);
    setDialogMessage(message);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  useEffect(() => {
    prevPriceFeedDataRef.current = priceFeedData;
  }, [priceFeedData]);

  const viemPublicClient = React.useMemo(() => createPublicClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  }), []);

  const ERC20_ABI_DECIMALS = [
    {
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        const response = await fetch('/api/gettoken');
        if (!response.ok) {
          throw new Error('Failed to fetch token data');
        }
        const data: TokenInfo[] = await response.json();
        const infoMap: Record<string, TokenInfo> = {};

        for (const tokenData of data) {
          let decimals = tokenData.decimals;
          if (decimals === undefined) {
            try {
              decimals = await viemPublicClient.readContract({
                address: tokenData.token as Address,
                abi: ERC20_ABI_DECIMALS,
                functionName: "decimals",
              });
            } catch (decimalError) {
              console.warn(`Could not fetch decimals for token ${tokenData.token}:`, decimalError);
              decimals = 18; // Default to 18 if unable to fetch
            }
          }
          infoMap[tokenData.token.toLowerCase()] = { ...tokenData, decimals, priceFeedId: tokenData.priceFeedId };
        }
        setTokenInfoMap(infoMap);
      } catch (err) {
        console.error("Error fetching token symbols/info:", err);
      }
    };
    fetchTokenData();
  }, [viemPublicClient]);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (Object.keys(tokenInfoMap).length === 0) return;

    const setupPythStream = async () => {
      const hermesClient = new HermesClient("https://hermes.pyth.network");

      const priceIdsRaw = Object.values(tokenInfoMap).map(info => info.priceFeedId);
      const priceIds = Array.from(new Set(priceIdsRaw.filter(id => typeof id === 'string' && id !== null)));

      const formattedPriceIds = priceIds.map(id => id.startsWith("0x") ? id.substring(2) : id);

      if (formattedPriceIds.length === 0) return;

      const newEventSource = await hermesClient.getPriceUpdatesStream(formattedPriceIds);
      eventSourceRef.current = newEventSource;

      newEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        data.parsed.forEach((priceFeed: any) => {
          const priceId = `0x${priceFeed.id}`;
          console.log(`Raw price for ${priceId}: price=${priceFeed.price.price}, expo=${priceFeed.price.expo}`);
          const price = Number(formatUnits(BigInt(priceFeed.price.price), Math.abs(priceFeed.price.expo)));
          console.log(`Parsed price for ${priceId}: ${price}`);

          setPriceFeedData(prevPriceFeedData => ({
            ...prevPriceFeedData,
            [priceId]: price,
          }));
        });
      };

      newEventSource.onerror = (error) => {
        console.error("Error receiving Pyth price updates:", error);
        newEventSource.close();
      };
    };

    setupPythStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [tokenInfoMap]);

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/getallloans');

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch loans');
        }

        const data = await response.json();
        const fetchedLoans: LoanData[] = data.data.LendingPool_LoanCreated || [];
        console.log("Fetched Loans:", fetchedLoans);

        const enrichedLoans = fetchedLoans.map(loan => {
          const info = tokenInfoMap[loan.collateralToken.toLowerCase()];
          const currentPrice = priceFeedData[info?.priceFeedId] || 0; // Use info?.priceFeedId directly
          const healthFactor = calculateHealthFactor(loan, currentPrice);
          const liquidationPrice = calculateLiquidationPrice(loan);

          const enrichedLoan = {
            ...loan,
            priceFeedId: info?.priceFeedId,
            collateralDecimals: info?.decimals,
            liquidationThreshold: info?.threshold,
            healthFactor,
            liquidationPrice,
          };
          console.log("Enriched Loan:", enrichedLoan);
          return enrichedLoan;
        });
        console.log("Enriched Loans (after health factor calculation):", enrichedLoans);

        setLoans(enrichedLoans);
      } catch (err: any) {
        console.error("Error fetching loans:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (Object.keys(tokenInfoMap).length > 0) {
      fetchLoans();
    }
  }, [tokenInfoMap]);

  const calculateHealthFactor = useCallback((loan: LoanData, currentPrice: number) => {
    if (!loan.collateralDecimals || !loan.liquidationThreshold || currentPrice === 0) return 0;

    const collateralAmount = Number(formatUnits(BigInt(loan.collateralAmount), loan.collateralDecimals));
    const borrowedAmount = Number(formatUnits(BigInt(loan.borrowedAmount), 6)); // Assuming PYUSD has 6 decimals
    const liquidationThreshold = loan.liquidationThreshold / 10000; // Convert basis points to ratio

    const collateralValue = collateralAmount * currentPrice;
    if (borrowedAmount === 0) return Infinity;

    const healthFactor = (collateralValue * liquidationThreshold) / borrowedAmount;
    console.log(`Loan ${loan.loanId}: collateralAmount=${collateralAmount}, borrowedAmount=${borrowedAmount}, currentPrice=${currentPrice}, liquidationThreshold=${liquidationThreshold}, healthFactor=${healthFactor}`);
    return healthFactor;
  }, []);

  const calculateLiquidationPrice = useCallback((loan: LoanData) => {
    if (!loan.collateralDecimals || !loan.liquidationThreshold) return 0;

    const collateralAmount = Number(formatUnits(BigInt(loan.collateralAmount), loan.collateralDecimals));
    const borrowedAmount = Number(formatUnits(BigInt(loan.borrowedAmount), 6)); // Assuming PYUSD has 6 decimals
    const liquidationThreshold = loan.liquidationThreshold / 10000; // Convert basis points to ratio

    if (collateralAmount === 0) return 0;

    return borrowedAmount / (collateralAmount * liquidationThreshold);
  }, []);

  const filteredLoans = loans
    .map(loan => {
      const currentPrice = loan.priceFeedId ? priceFeedData[loan.priceFeedId] : 0;
      const healthFactor = calculateHealthFactor(loan, currentPrice);
      const liquidationPrice = calculateLiquidationPrice(loan);
      return { ...loan, healthFactor, liquidationPrice };
    })
    .filter(loan => loan.healthFactor < 10.1 && loan.healthFactor > 0);

  console.log("Token Info Map:", tokenInfoMap);
  console.log("Price Feed Data:", priceFeedData);
  console.log("Filtered Loans:", filteredLoans);

  const handleLiquidate = useCallback(async (loan: LoanData) => {
    if (!walletClient || !address || !publicClient) {
      openDialog("Wallet Not Connected", "Please connect your wallet.");
      return;
    }

    if (!loan.priceFeedId) {
      openDialog("Missing Price Feed ID", "Price feed ID not available for this loan's collateral.");
      return;
    }

    try {
      // 1. Get liquidationEngine address
      const liquidationEngineAddress = await publicClient.readContract({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "liquidationEngine",
      }) as Address;

      if (liquidationEngineAddress === "0x0000000000000000000000000000000000000000") {
        openDialog("Configuration Error", "Liquidation engine not set in LendingPool.");
        return;
      }

      // 2. Approve PYUSD for liquidationEngine
      const amountToRepay = BigInt(loan.borrowedAmount); // Assuming borrowedAmount is in smallest units

      // Check current allowance
      const currentAllowance = await publicClient.readContract({
        address: PYUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, liquidationEngineAddress],
      }) as bigint;

      if (currentAllowance < amountToRepay) {
        openDialog("Approval Required", "Approving PYUSD for liquidation engine...");
        const { request } = await publicClient.simulateContract({
          account: address,
          address: PYUSD_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [liquidationEngineAddress, amountToRepay],
        });
        const approveHash = await walletClient.writeContract(request);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        openDialog("Approval Successful", "PYUSD approved!");
      }

      // 3. Fetch Pyth price update data
      openDialog("Fetching Price Data", "Fetching Pyth price update data...");
      const response = await fetch(`/api/getpythprice?priceFeedId=${loan.priceFeedId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch price data from Pyth API.');
      }
      const { priceUpdateData } = await response.json();

      if (!priceUpdateData || priceUpdateData.length === 0) {
        openDialog("Price Data Error", "Failed to get Pyth price update data.");
        return;
      }

      // 4. Call liquidate on LendingPool
      openDialog("Liquidating Loan", "Liquidating loan...");
      const { request } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "liquidate",
        args: [BigInt(loan.loanId), priceUpdateData],
        value: parseUnits("0.001", 18), // Sending a small amount of ETH, adjust if needed
      });
      const liquidateHash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: liquidateHash });
      openDialog("Liquidation Successful", "Loan liquidated successfully!");

      // Refresh loans after liquidation
      setLoading(true);
      // Re-fetch loans to update the list
      // This will trigger the useEffect that fetches loans
    } catch (err: any) {
      console.error("Liquidation failed:", err);
      openDialog("Liquidation Failed", getShortErrorMessage(err.message));
    }
  }, [walletClient, address, publicClient, tokenInfoMap]);

  return (
    <div className="font-sans flex flex-col flex-grow min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-10 flex-grow">
        <h2 className="text-3xl font-bold mb-8 text-center">Liquidations</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-black bg-opacity-30 rounded-lg">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="p-4">Loan ID</th>
                <th className="p-4">Collateral</th>
                <th className="p-4">Collateral Amount</th>
                <th className="p-4">Current Price</th>
                <th className="p-4">Debt</th>
                <th className="p-4">Health Factor</th>
                <th className="p-4">Liquidation Price</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="text-white">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-400">No loans available for liquidation.</td>
                </tr>
              ) : (
                filteredLoans.map((loan) => {
                    const collateralSymbol = tokenInfoMap[loan.collateralToken.toLowerCase()]?.symbol || loan.collateralToken;
                    return (
                      <LoanRow
                        key={loan.loanId}
                        loan={loan}
                        collateralSymbol={collateralSymbol}
                        priceFeedData={priceFeedData}
                        prevPriceFeedDataRef={prevPriceFeedDataRef}
                        onLiquidate={handleLiquidate}
                      />
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Footer />
      <AlertDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        title={dialogTitle}
        message={dialogMessage}
      />
    </div>
  );
}
