'use client'
import { useState, useEffect, useCallback, useRef } from "react";
import React from "react";
import { useAccount } from "wagmi";
import { formatUnits, createPublicClient, http, Address } from "viem";
import { sepolia } from 'viem/chains';
import { HermesClient } from "@pythnetwork/hermes-client";

import Header from "../components/Header";
import Footer from "../components/Footer";
import LoanRow from "./LoanRow";

interface LoanData {
  id: string;
  borrowedAmount: string;
  borrower: string;
  collateralAmount: string;
  collateralToken: string;
  interestRate: string;
  loanId: string;
  timestamp: string;
  // Add priceFeedId and decimals for collateral token
  priceFeedId?: string;
  collateralDecimals?: number;
  liquidationThreshold?: number; // In basis points, e.g., 15000 for 150%
  currentPrice?: number;
  healthFactor?: number;
}

interface TokenInfo {
  token: string;
  symbol: string;
  priceFeedId: string;
  threshold: number;
  decimals: number;
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [loans, setLoans] = useState<LoanData[]>([]);
  const [tokenSymbols, setTokenSymbols] = useState<Record<string, string>>({});
  const [tokenInfoMap, setTokenInfoMap] = useState<Record<string, TokenInfo>>({});
  
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Viem public client for fetching token decimals
  const publicClient = React.useMemo(() => createPublicClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  }), []);

  // ERC20 ABI for fetching decimals
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

  // Effect to fetch token symbols and price feed IDs
  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        const response = await fetch('/api/gettoken');
        if (!response.ok) {
          throw new Error('Failed to fetch token data');
        }
        const data: TokenInfo[] = await response.json();
        const symbolsMap: Record<string, string> = {};
        const infoMap: Record<string, TokenInfo> = {};

        for (const tokenData of data) {
          console.log("tokenData from API:", tokenData);
          symbolsMap[tokenData.token.toLowerCase()] = tokenData.symbol;
          // Fetch decimals if not already available in tokenData (assuming gettoken API provides it)
          let decimals = tokenData.decimals;
          if (decimals === undefined) {
            try {
              decimals = await publicClient.readContract({
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
        console.log("infoMap before setTokenInfoMap:", infoMap);
        setTokenSymbols(symbolsMap);
        setTokenInfoMap(infoMap);
        console.log("tokenInfoMap after setTokenInfoMap:", infoMap);
      } catch (err) {
        console.error("Error fetching token symbols/info:", err);
      }
    };
    fetchTokenData();
  }, [publicClient]);

  // Function to calculate health factor
  const calculateHealthFactor = useCallback((loan: LoanData, currentPrice: number) => {
    if (!loan.collateralDecimals || !loan.liquidationThreshold || currentPrice === 0) return 0;

    const collateralAmount = Number(formatUnits(BigInt(loan.collateralAmount), loan.collateralDecimals));
    const borrowedAmount = Number(formatUnits(BigInt(loan.borrowedAmount), 6)); // Assuming PYUSD has 6 decimals
    const liquidationThreshold = loan.liquidationThreshold / 10000; // Convert basis points to ratio

    // Health Factor = (Collateral Value * Liquidation Threshold) / Borrowed Amount
    const collateralValue = collateralAmount * currentPrice;
    if (borrowedAmount === 0) return Infinity; // Avoid division by zero

    return (collateralValue * liquidationThreshold) / borrowedAmount;
  }, []);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Effect to subscribe to Pyth price feeds
  useEffect(() => {
    if (Object.keys(tokenInfoMap).length === 0) return;

    const setupPythStream = async () => {
      const hermesClient = new HermesClient("https://hermes.pyth.network");

      const priceIdsRaw = Object.values(tokenInfoMap).map(info => info.priceFeedId);
      const priceIds = Array.from(new Set(priceIdsRaw.filter(id => typeof id === 'string' && id !== null)));

      // Ensure priceIds are correctly formatted for subscription (remove 0x prefix)
      const formattedPriceIds = priceIds.map(id => id.startsWith("0x") ? id.substring(2) : id);

      if (formattedPriceIds.length === 0) return;

      const newEventSource = await hermesClient.getPriceUpdatesStream(formattedPriceIds);
      eventSourceRef.current = newEventSource;

      newEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        data.parsed.forEach((priceFeed: any) => {
          const priceId = `0x${priceFeed.id}`;
          const price = Number(formatUnits(BigInt(priceFeed.price.price), Math.abs(priceFeed.price.expo))); // Convert raw price to number

          setLoans(prevLoans => 
            prevLoans.map(loan => {
              if (loan.priceFeedId === priceId) {
                const currentPrice = price;
                const healthFactor = calculateHealthFactor(loan, currentPrice);
                return { ...loan, currentPrice, healthFactor };
              }
              return loan;
            })
          );
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
  }, [tokenInfoMap, calculateHealthFactor]);


  // Effect to fetch loans and update with real-time data
  useEffect(() => {
    const fetchLoans = async () => {
      if (!isConnected || !address) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch('/api/getloans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ borrowerAddress: address }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch loans');
        }

        const data = await response.json();
        const fetchedLoans: LoanData[] = data.data.LendingPool_LoanCreated || [];

        // Enrich loans with token info (priceFeedId, decimals, liquidationThreshold)
        const enrichedLoans = fetchedLoans.map(loan => {
          const info = tokenInfoMap[loan.collateralToken.toLowerCase()];
          return {
            ...loan,
            priceFeedId: info?.priceFeedId,
            collateralDecimals: info?.decimals,
            liquidationThreshold: info?.threshold,
          };
        });

        setLoans(enrichedLoans);
      } catch (err: any) {
        console.error("Error fetching loans:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch loans if tokenInfoMap is populated
    if (Object.keys(tokenInfoMap).length > 0) {
      fetchLoans();
    }
  }, [address, isConnected, tokenInfoMap]); // Depend on tokenInfoMap

  if (loading) {
    return (
      <div className="font-sans flex flex-col flex-grow min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-10 flex-grow text-white text-center">
          <p>Loading loans...</p>
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
        <h2 className="text-3xl font-bold mb-8 text-center">My Dashboard</h2>

        <div className="grid grid-cols-1 gap-8 mb-8">
          <div className="bg-black bg-opacity-30 p-8 rounded-lg text-white">
            <h3 className="text-2xl font-bold mb-4">My Loans</h3>
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="p-4">Loan ID</th>
                  <th className="p-4">Collateral</th>
                  <th className="p-4">Collateral Amount</th>
                  <th className="p-4">Current Price</th>
                  <th className="p-4">Debt</th>
                  <th className="p-4">Health Factor</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="text-white">
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-400">No loans found.</td>
                  </tr>
                ) : (
                  loans.map((loan) => {
                    const collateralSymbol = tokenSymbols[loan.collateralToken.toLowerCase()] || loan.collateralToken;

                    return (
                      <LoanRow
                        key={loan.loanId}
                        loan={loan}
                        collateralSymbol={collateralSymbol}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
