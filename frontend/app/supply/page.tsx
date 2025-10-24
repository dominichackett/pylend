'use client';

import { useState, useEffect, useCallback } from "react";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { formatUnits, parseUnits, Address } from "viem";
import { lendingPoolABI, lendingPoolAddress } from "../../lib/contracts";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { erc20ABI } from "../../lib/erc20";
import AlertDialog from "../components/AlertDialog";

const PYUSD_CONTRACT_ADDRESS: Address = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"; // PYUSD Contract Address

export default function Supply() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  console.log("publicClient:", publicClient);
  const { data: pyusdBalanceData, refetch: refetchPyusdBalance } = useBalance({
    address: address,
    token: PYUSD_CONTRACT_ADDRESS,
  });
  const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [supplyAmountInput, setSupplyAmountInput] = useState<string>("");
  const [userPyusdBalance, setUserPyusdBalance] = useState<number | null>(null);
  const [supplyAmountError, setSupplyAmountError] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [supplyAPY, setSupplyAPY] = useState<string | null>(null);
  const [totalDepositWithInterest, setTotalDepositWithInterest] = useState<number | null>(null);
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));

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

  const fetchSupplyAPY = useCallback(async () => {
    console.log("fetchSupplyAPY, publicClient:", publicClient);
    if (!publicClient) return;
    try {
      const rate = await publicClient.readContract({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "getCurrentSupplyRate",
      });
      setSupplyAPY(Number(rate)/10000);
    } catch (contractError: any) {
      console.error("Error calling getCurrentSupplyRate:", contractError);
      setSupplyAPY(null);
    }
  }, [publicClient]);

  const fetchUserDepositInfo = useCallback(async () => {
    if (!address || !publicClient) {
      setTotalDepositWithInterest(null);
      return;
    }

    try {
      // Fetch user's total deposit with interest
      const totalDeposit = await publicClient.readContract({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "getDepositWithInterest",
        args: [address],
      });
      setTotalDepositWithInterest(parseFloat(formatUnits(totalDeposit as bigint, 6))); // Assuming PYUSD has 6 decimals

    } catch (err) {
      console.error("Error fetching user deposit info:", err);
      setTotalDepositWithInterest(null);
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (pyusdBalanceData) {
      setUserPyusdBalance(parseFloat(formatUnits(pyusdBalanceData.value, pyusdBalanceData.decimals)));
    }
  }, [pyusdBalanceData]);

  useEffect(() => {
    if (isConfirmed) {
      // Refetch user's PYUSD balance
      refetchPyusdBalance();
      // Refetch user's deposit info
      fetchUserDepositInfo();
      // Refetch supply APY (if dynamic)
      fetchSupplyAPY();
    }
  }, [isConfirmed, refetchPyusdBalance, fetchUserDepositInfo, fetchSupplyAPY]);

  useEffect(() => {
    const fetchAllowance = async () => {
      if (!address || !publicClient || parseFloat(supplyAmountInput) <= 0) {
        setAllowance(BigInt(0));
        setIsApproved(false);
        return;
      }

      try {
        const currentAllowance = await publicClient.readContract({
          address: PYUSD_CONTRACT_ADDRESS,
          abi: erc20ABI,
          functionName: 'allowance',
          args: [address, lendingPoolAddress],
        });
        setAllowance(currentAllowance as bigint);
        const amountToSupplyBigInt = parseUnits(supplyAmountInput, 6);
        setIsApproved(currentAllowance >= amountToSupplyBigInt);
      } catch (err) {
        console.error("Error fetching allowance:", err);
        setAllowance(BigInt(0));
        setIsApproved(false);
      }
    };
    fetchAllowance();
  }, [address, publicClient, supplyAmountInput, isConfirmed]); // isConfirmed to re-check after approval tx

  useEffect(() => {
    console.log("useEffect fetchSupplyAPY, publicClient:", publicClient);
    if (publicClient) {
      fetchSupplyAPY();
    }
  }, [fetchSupplyAPY, publicClient]);

  useEffect(() => {
    fetchUserDepositInfo();
  }, [fetchUserDepositInfo]);

  const handleApprove = async () => {
    if (!address || parseFloat(supplyAmountInput) <= 0) return;

    const amountToApprove = parseUnits(supplyAmountInput, 6); // PYUSD has 6 decimals

    try {
      await writeContract({
        address: PYUSD_CONTRACT_ADDRESS,
        abi: erc20ABI,
        functionName: 'approve',
        args: [lendingPoolAddress, amountToApprove],
      });
    } catch (err: any) {
      openDialog("Error", getShortErrorMessage(err.message));
    }
  };

  const handleSupply = async () => {
    if (!address || parseFloat(supplyAmountInput) <= 0) return;

    const amountToSupply = parseUnits(supplyAmountInput, 6); // PYUSD has 6 decimals

    try {
      await writeContract({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: 'deposit',
        args: [ amountToSupply],
      });
    } catch (err: any) {
      openDialog("Error", getShortErrorMessage(err.message));
    }
  };

  return (
    <div className="font-sans flex flex-col flex-grow min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-10 flex-grow">
        <h2 className="text-3xl font-bold mb-8 text-center">Supply PYUSD</h2>

        <div className="max-w-lg mx-auto bg-black bg-opacity-30 p-8 rounded-lg text-white">
          <form>
            <div className="mb-4">
              <label htmlFor="supplyAmount" className="block text-gray-400 mb-2">Supply Amount (PYUSD)</label>
              <input
                type="number"
                id="supplyAmount"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4"
                value={supplyAmountInput}
                onChange={(e) => {
                  const amount = e.target.value;
                  setSupplyAmountInput(amount);
                  setIsApproved(false); // Reset approval status when amount changes
                  if (userPyusdBalance !== null && parseFloat(amount) > userPyusdBalance) {
                    setSupplyAmountError("Insufficient PYUSD balance.");
                  } else {
                    setSupplyAmountError(null);
                  }
                }}
              />
              {supplyAmountError && <p className="text-red-500 text-sm mt-2">{supplyAmountError}</p>}
              {userPyusdBalance !== null && (
                <p className="text-gray-400 text-sm mt-2">Your PYUSD Balance: {userPyusdBalance.toFixed(2)}</p>
              )}
            </div>

            <hr className="my-8 border-gray-700" />

            <div className="mb-4">
              <h4 className="text-xl font-bold mb-2">Transaction Summary</h4>
              <div className="flex justify-between">
                <p className="text-gray-400">Supply APY:</p>
                <p className="text-green-400">{supplyAPY !== null ? `${(parseFloat(supplyAPY) * 100).toFixed(2)}%` : "Loading..."}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-400">Your Total Deposit:</p>
                <p>{totalDepositWithInterest !== null ? `${totalDepositWithInterest.toFixed(2)} PYUSD` : "N/A"}</p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleApprove}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-full disabled:bg-gray-500"
                disabled={!supplyAmountInput || parseFloat(supplyAmountInput) <= 0 || !!supplyAmountError || isPending || isApproved}
              >
                {isApproved ? "Approved" : "Approve"}
              </button>
              <button
                type="button"
                onClick={handleSupply}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-full disabled:bg-gray-500"
                disabled={!isApproved || !supplyAmountInput || parseFloat(supplyAmountInput) <= 0 || !!supplyAmountError || isPending}
              >
                Supply PYUSD
              </button>
            </div>

            {isPending && <div className="text-center mt-4">Transaction in progress...</div>}
            {isConfirming && <div className="text-center mt-4">Waiting for confirmation...</div>}
            {isConfirmed && <div className="text-center mt-4 text-green-500">Transaction successful!</div>}
            
          </form>
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
