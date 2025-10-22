'use client'
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";

import Header from "../components/Header";
import Footer from "../components/Footer";

interface LoanData {
  id: string;
  borrowedAmount: string;
  borrower: string;
  collateralAmount: string;
  collateralToken: string;
  interestRate: string;
  loanId: string;
  timestamp: string;
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [loans, setLoans] = useState<LoanData[]>([]);
  const [tokenSymbols, setTokenSymbols] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        const response = await fetch('/api/gettoken');
        if (!response.ok) {
          throw new Error('Failed to fetch token data');
        }
        const data = await response.json();
        const symbolsMap: Record<string, string> = {};
        data.forEach((token: any) => {
          symbolsMap[token.token.toLowerCase()] = token.symbol;
        });
        setTokenSymbols(symbolsMap);
      } catch (err) {
        console.error("Error fetching token symbols:", err);
        // Optionally set an error state for token symbols
      }
    };
    fetchTokenData();
  }, []); // Run once on component mount

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
        // Assuming the data structure is { data: { LendingPool_LoanCreated: [...] } }
        setLoans(data.data.LendingPool_LoanCreated || []);
      } catch (err: any) {
        console.error("Error fetching loans:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLoans();
  }, [address, isConnected]);

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
                  <th className="p-4">Debt</th>
                  <th className="p-4">Health Factor</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="text-white">
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-400">No loans found.</td>
                  </tr>
                ) : (
                  loans.map((loan) => (
                    <tr key={loan.loanId} className="border-b border-gray-800">
                      <td className="p-4">{loan.loanId}</td>
                      <td className="p-4">{tokenSymbols[loan.collateralToken.toLowerCase()] || loan.collateralToken}</td>
                      <td className="p-4">{formatUnits(BigInt(loan.collateralAmount), 18)}</td> {/* Assuming 18 decimals for collateral for now */}
                      <td className="p-4">{formatUnits(BigInt(loan.borrowedAmount), 6)} PYUSD</td> {/* Assuming PYUSD has 6 decimals */}
                      <td className="p-4 text-green-500">1.5</td> {/* Hardcoded as requested */}
                      <td className="p-4">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Manage</button>
                      </td>
                    </tr>
                  ))
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
