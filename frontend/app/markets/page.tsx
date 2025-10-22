'use client'
import { HermesClient } from "@pythnetwork/hermes-client";
import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { formatUnits, createPublicClient, http, Address } from "viem";
import { sepolia } from 'viem/chains';

import Header from "../components/Header";
import Footer from "../components/Footer";
import Image from "next/image";

interface TokenInfo {
  token: string;
  symbol: string;
  priceFeedId: string;
  threshold: number;
  decimals: number;
}

export default function Markets() {
  const [approvedCollateral, setApprovedCollateral] = useState<TokenInfo[]>([]);
  const [tokenInfoMap, setTokenInfoMap] = useState<Record<string, TokenInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceFeedData, setPriceFeedData] = useState<Record<string, number>>({}); // priceFeedId -> price
  const prevPriceFeedDataRef = useRef<Record<string, number>>({}); // priceFeedId -> previous price
  const eventSourceRef = useRef<EventSource | null>(null);

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

  // Effect to update prevPriceFeedDataRef after priceFeedData changes
  useEffect(() => {
    prevPriceFeedDataRef.current = priceFeedData;
  }, [priceFeedData]);

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
    const fetchApprovedCollateral = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/gettoken');
        if (!response.ok) {
          throw new Error('Failed to fetch approved collateral');
        }
        const data: TokenInfo[] = await response.json();
        const infoMap: Record<string, TokenInfo> = {};

        for (const tokenData of data) {
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
        setApprovedCollateral(data);
        setTokenInfoMap(infoMap);
      } catch (err: any) {
        console.error("Error fetching approved collateral:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchApprovedCollateral();
  }, []);

  if (loading) {
    return (
      <div className="font-sans flex flex-col flex-grow min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-10 flex-grow text-white text-center">
          <p>Loading approved collateral...</p>
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

      {/* Markets Table */}
      <main className="container mx-auto px-4 py-10 flex-grow">
        <h2 className="text-3xl font-bold mb-8 text-center">Approved Collateral Markets</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-black bg-opacity-30 rounded-lg">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="p-4">Asset</th>
                <th className="p-4">Threshold</th>
                <th className="p-4">Current Price</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="text-white">
              {approvedCollateral.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-400">No approved collateral found.</td>
                </tr>
              ) : (
                approvedCollateral.map((tokenInfo) => (
                  <tr key={tokenInfo.token} className="border-b border-gray-800 hover:bg-black hover:bg-opacity-20">
                    <td className="p-4 flex items-center">
                      {/* Assuming you might want to display a logo based on symbol later */}
                      {tokenInfo.symbol}
                    </td>
                    <td className="p-4">{tokenInfo.threshold / 100}%</td>
                    <td className="p-4">
                      {priceFeedData[tokenInfo.priceFeedId] !== undefined ? (
                        (() => {
                          const currentPrice = priceFeedData[tokenInfo.priceFeedId];
                          const prevPrice = prevPriceFeedDataRef.current[tokenInfo.priceFeedId];
                          let priceColorClass = "text-white"; // Default color

                          if (prevPrice !== undefined) {
                            const currentPriceString = currentPrice.toFixed(2);
                            const prevPriceString = prevPrice.toFixed(2);

                            if (currentPriceString > prevPriceString) {
                              priceColorClass = "text-green-500"; // Price increased
                            } else if (currentPriceString < prevPriceString) {
                              priceColorClass = "text-red-500"; // Price decreased
                            }
                          }

                          return <span className={priceColorClass}>${currentPrice.toFixed(2)}</span>;
                        })()
                      ) : (
                        "Loading..."
                      )}
                    </td>
                    <td className="p-4">
                      <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      <Footer />
    </div>
  );
}