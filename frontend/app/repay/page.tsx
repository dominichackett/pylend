"use client";

import { useState, useEffect } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { HermesClient } from "@pythnetwork/hermes-client";
import { formatUnits, parseUnits, Address } from "viem";
import { LendingPoolABI, lendingPoolAddress } from "../../lib/contracts";
import { erc20ABI } from "../../lib/erc20";

// TODO: Replace with actual PYUSD contract address
const PYUSD_CONTRACT_ADDRESS: Address = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"; // Assuming USDC as PYUSD

interface Loan {
  id: string;
  borrowedAmount: number;
  collateralAmount: number;
  collateralToken: string;
  interestRate: number;
  loanId: number;
  timestamp: number;
}

interface TokenInfo {
  token: string;
  symbol: string;
  priceFeedId: string;
  threshold: number;
  decimals: number;
}

export default function Repay() {
  const { address } = useAccount();
  const { data: pyusdBalanceData } = useBalance({
    address: address,
    token: PYUSD_CONTRACT_ADDRESS,
  });
  const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [newHealthFactor, setNewHealthFactor] = useState<number | null>(null);
  const [collateralTokenPrice, setCollateralTokenPrice] = useState<number | null>(null);
  const [isCollateralPriceLoading, setIsCollateralPriceLoading] = useState<boolean>(false);
  const [displayRemainingDebt, setDisplayRemainingDebt] = useState<number | null>(null);
  const [collateralTokenInfo, setCollateralTokenInfo] = useState<TokenInfo | null>(null);
  const [repayAmountError, setRepayAmountError] = useState<string | null>(null);
  const [userPyusdBalance, setUserPyusdBalance] = useState<number | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(false);

  useEffect(() => {
    console.log("Current address from useAccount:", address);
    if (address) {
      console.log("Fetching loans with borrowerAddress:", address);
      fetch("/api/getloans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ borrowerAddress: address }),
      })
        .then((res) => {
          console.log("Response from /api/getloans:", res);
          return res.json();
        })
        .then((data) => {
          console.log("Parsed data from /api/getloans:", data);
          if (data && data.data && data.data.LendingPool_LoanCreated) {
            setLoans(data.data.LendingPool_LoanCreated);
            console.log("Fetched loans (LendingPool_LoanCreated):", data.data.LendingPool_LoanCreated);
            if (data.data.LendingPool_LoanCreated.length > 0) {
              setSelectedLoan(data.data.LendingPool_LoanCreated[0]);
              setDisplayRemainingDebt(data.data.LendingPool_LoanCreated[0].borrowedAmount / 1000000);
              console.log("Initial selected loan:", data.data.LendingPool_LoanCreated[0]);
              console.log("Initial display remaining debt:", data.data.LendingPool_LoanCreated[0].borrowedAmount / 1000000);
            }
          }
        });
    }
  }, [address]);

  useEffect(() => {
    console.log("Loans state updated:", loans);
  }, [loans]);

  useEffect(() => {
    if (isConfirmed) {
      setIsApproved(true);
      console.log("isApproved set to true after transaction confirmation.");
    }
  }, [isConfirmed]);

  const handleApprove = async () => {
    console.log("handleApprove called.");
    if (!address || !selectedLoan || repayAmount <= 0) {
      console.log("handleApprove: Pre-conditions not met.", { address, selectedLoan, repayAmount });
      return;
    }

    const amountToApprove = parseUnits(repayAmount.toString(), 6); // PYUSD has 6 decimals
    console.log("handleApprove: Approving with arguments:", {
      tokenAddress: PYUSD_CONTRACT_ADDRESS,
      spenderAddress: lendingPoolAddress,
      amount: amountToApprove.toString(), // Log as string for readability
    });

    try {
      await writeContract({
        address: PYUSD_CONTRACT_ADDRESS,
        abi: erc20ABI,
        functionName: 'approve',
        args: [lendingPoolAddress, amountToApprove],
      });
    } catch (err) {
      console.error("Error initiating approve transaction:", err);
    }
  };

  const handleRepay = async () => {
    if (!address || !selectedLoan || repayAmount <= 0) return;

    const amountToRepay = parseUnits(repayAmount.toString(), 6); // PYUSD has 6 decimals

    console.log("handleRepay: Repaying with arguments:", {
      loanId: selectedLoan.loanId,
      amount: amountToRepay.toString(),
    });

    try {
      await writeContract({
        address: lendingPoolAddress,
        abi: LendingPoolABI,
        functionName: 'repay',
        args: [selectedLoan.loanId, amountToRepay],
      });
    } catch (err) {
      console.error("Error initiating repay transaction:", err);
    }
  };

  const handleLoanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    console.log("Loan selection changed to:", e.target.value);
    const loan = loans.find((l) => l.id === e.target.value);
    console.log("Found loan:", loan);
    if (loan) {
      setSelectedLoan(loan);
      setRepayAmount(0); // Reset repay amount when a new loan is selected
      setDisplayRemainingDebt(loan.borrowedAmount / 1000000); // Set initial remaining debt
      console.log("New selected loan (after setSelectedLoan):");
      console.log("New initial display remaining debt (after setDisplayRemainingDebt):");
    }
  };


  useEffect(() => {
    console.log("Selected loan changed:", selectedLoan);
    if (selectedLoan) {
      setIsCollateralPriceLoading(true);
      setCollateralTokenPrice(null); // Reset price when loan changes
      setCollateralTokenInfo(null); // Reset token info when loan changes

      // First, fetch TokenInfo from /api/gettoken
      fetch("/api/gettoken")
        .then((res) => res.json())
        .then((tokens: TokenInfo[]) => {
          const normalizedCollateralToken = selectedLoan.collateralToken.toLowerCase();
          const info = tokens.find(t => t.token.toLowerCase() === normalizedCollateralToken);
          if (info) {
            setCollateralTokenInfo(info);
            const hermesClient = new HermesClient("https://hermes.pyth.network");
            const priceId = info.priceFeedId;
            const formattedPriceId = priceId.startsWith("0x") ? priceId.substring(2) : priceId;
            console.log("Attempting to fetch price from Pyth for formattedPriceId:", formattedPriceId);

            hermesClient.getLatestPriceUpdates([formattedPriceId])
              .then((response) => {
                console.log("Raw response from HermesClient:", response);
                if (response && response.parsed && response.parsed.length > 0) {
                  const priceFeed = response.parsed[0];
                  const price = Number(formatUnits(BigInt(priceFeed.price.price), Math.abs(priceFeed.price.expo)));
                  setCollateralTokenPrice(price);
                  console.log("Fetched collateral token price from Pyth:", price);
                } else {
                  console.log("Pyth price not found for priceId:", priceId);
                  setCollateralTokenPrice(null);
                }
              })
              .catch((error) => {
                console.error("Error fetching price from Pyth:", error);
                setCollateralTokenPrice(null);
              })
              .finally(() => {
                setIsCollateralPriceLoading(false);
              });
          } else {
            console.log("Collateral TokenInfo not found for token address:", selectedLoan.collateralToken);
            setCollateralTokenInfo(null);
            setCollateralTokenPrice(null);
            setIsCollateralPriceLoading(false);
          }
        })
        .catch((error) => {
          console.error("Error fetching TokenInfo:", error);
          setCollateralTokenInfo(null);
          setCollateralTokenPrice(null);
          setIsCollateralPriceLoading(false);
        });
    } else {
      setCollateralTokenInfo(null);
      setCollateralTokenPrice(null);
      setIsCollateralPriceLoading(false);
    }
  }, [selectedLoan]);



          return (

    

            <div className="font-sans flex flex-col flex-grow min-h-screen">

    

              <Header />

    

        

    

              <main className="container mx-auto px-4 py-10 flex-grow">

    

                <h2 className="text-3xl font-bold mb-8 text-center">Repay Loan</h2>

    

        

    

                <div className="max-w-lg mx-auto bg-black bg-opacity-30 p-8 rounded-lg text-white">

    

                  <form>

    

                    <div className="mb-4">

    

                      <label htmlFor="loan" className="block text-gray-400 mb-2">Select Loan to Repay</label>

    

                      <select id="loan" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" onChange={handleLoanChange} value={selectedLoan?.id || ""}>

    

                        {console.log("Select element rendering with value:", selectedLoan?.id || "")}

    

                        {loans.map((loan) => (

    

                          <option key={loan.id} value={loan.id}>

    

                            Loan ID: {loan.loanId} - {loan.borrowedAmount / 1000000} PYUSD

    

                          </option>

    

                        ))}

    

                      </select>

    

                    </div>

    

                    <div className="mb-4">

    

                      <label htmlFor="repayAmount" className="block text-gray-400 mb-2">Repay Amount (PYUSD)</label>

    

                      <input type="number" id="repayAmount" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" value={repayAmount} onChange={(e) => {

    

                        const amount = parseFloat(e.target.value);

    

                        console.log("Repay amount input changed to:", amount);

    

                        setRepayAmount(amount);

    

        

    

                        if (selectedLoan && amount > (selectedLoan.borrowedAmount / 1000000)) {

    

                          setRepayAmountError("Repay amount cannot be greater than the total loan amount.");

    

                        } else if (userPyusdBalance !== null && amount > userPyusdBalance) {

    

                          setRepayAmountError("Insufficient PYUSD balance.");

    

                        } else {

    

                          setRepayAmountError(null);

    

                        }

    

                        console.log("Repay amount state after setRepayAmount:", amount);

    

                      }}/>

    

                      {repayAmountError && <p className="text-red-500 text-sm mt-2">{repayAmountError}</p>}

    

                      {userPyusdBalance !== null && (

    

                        <p className="text-gray-400 text-sm mt-2">Your PYUSD Balance: {userPyusdBalance.toFixed(2)}</p>

    

                      )}

    

                    </div>

    

        

    

                    <hr className="my-8 border-gray-700" />

    

        

    

                    <div className="mb-4">

    

                      <h4 className="text-xl font-bold mb-2">Transaction Summary</h4>

    

                      <div className="flex justify-between">

    

                        <p className="text-gray-400">Remaining Debt:</p>

    

                        <p>{displayRemainingDebt !== null ? displayRemainingDebt.toFixed(2) : "0"} PYUSD</p>

    

                      </div>

    

                      <div className="flex justify-between">

    

                        <p className="text-gray-400">New Health Factor:</p>

    

                        <p className="text-green-500">

    

                          {console.log("New Health Factor rendering:", newHealthFactor)}

    

                          {isCollateralPriceLoading ? "Loading..." :

    

                           newHealthFactor !== null ? newHealthFactor.toFixed(2) : "N/A"}

    

                        </p>

    

                      </div>

    

                    </div>

    

        

    

                    <div className="flex space-x-4">

    

                      <button

    

                        type="button"

    

                        onClick={handleApprove}

    

                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-full disabled:bg-gray-500"

    

                        disabled={!repayAmount || repayAmount <= 0 || !!repayAmountError || isPending || isApproved}

    

                      >

    

                        {isApproved ? "Approved" : "Approve"}

    

                      </button>

    

                      <button

    

                        type="button"

    

                        onClick={handleRepay}

    

                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-full disabled:bg-gray-500"

    

                        disabled={!isApproved || !repayAmount || repayAmount <= 0 || !!repayAmountError || isPending}

    

                      >

    

                        Repay Loan

    

                      </button>

    

                    </div>

    

        

    

                    {isPending && <div className="text-center mt-4">Transaction in progress...</div>}

    

                    {isConfirming && <div className="text-center mt-4">Waiting for confirmation...</div>}

    

                    {isConfirmed && <div className="text-center mt-4 text-green-500">Transaction successful!</div>}

    

                    {writeError && <div className="text-center mt-4 text-red-500">Error: {writeError.message}</div>}

    

                  </form>

    

                </div>

    

              </main>

    

        

    

              <Footer />

    

            </div>

    

          );

    

        }

    

      

    
