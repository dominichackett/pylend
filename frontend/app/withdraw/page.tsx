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

export default function Withdraw() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: pyusdBalanceData, refetch: refetchPyusdBalance } = useBalance({
    address: address,
    token: PYUSD_CONTRACT_ADDRESS,
  });
  const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [totalDepositWithInterest, setTotalDepositWithInterest] = useState<number | null>(null);
  const [userPyusdBalance, setUserPyusdBalance] = useState<number | null>(null);
  const [withdrawAmountInput, setWithdrawAmountInput] = useState("");
  const [withdrawAmountError, setWithdrawAmountError] = useState<string | null>(null);

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
    }
  }, [isConfirmed, refetchPyusdBalance, fetchUserDepositInfo]);

  useEffect(() => {
    fetchUserDepositInfo();
  }, [fetchUserDepositInfo]);

  const handleWithdraw = async () => {
    if (!address || parseFloat(withdrawAmountInput) <= 0) return;

    const amountToWithdraw = parseUnits(withdrawAmountInput, 6); // PYUSD has 6 decimals

    try {
      await writeContract({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: 'withdraw',
        args: [amountToWithdraw],
      });
    } catch (err: any) {
      openDialog("Error", getShortErrorMessage(err.message));
    }
  };

  return (
    <div className="font-sans flex flex-col flex-grow min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-10 flex-grow">
        <h2 className="text-3xl font-bold mb-8 text-center">Withdraw PYUSD</h2>

        <div className="max-w-lg mx-auto bg-black bg-opacity-30 p-8 rounded-lg text-white">
          <form>
            <div className="mb-4">
              <label htmlFor="withdrawAmount" className="block text-gray-400 mb-2">Withdraw Amount (PYUSD)</label>
              <input
                type="number"
                id="withdrawAmount"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4"
                value={withdrawAmountInput}
                onChange={(e) => {
                  const amount = e.target.value;
                  setWithdrawAmountInput(amount);
                  if (totalDepositWithInterest !== null && parseFloat(amount) > totalDepositWithInterest) {
                    setWithdrawAmountError("Withdraw amount cannot be greater than your total deposit.");
                  } else {
                    setWithdrawAmountError(null);
                  }
                }}
              />
              {withdrawAmountError && <p className="text-red-500 text-sm mt-2">{withdrawAmountError}</p>}
              {userPyusdBalance !== null && (
                <p className="text-gray-400 text-sm mt-2">Your Wallet Balance: {userPyusdBalance.toFixed(2)} PYUSD</p>
              )}
              {totalDepositWithInterest !== null && (
                <p className="text-gray-400 text-sm mt-2">Your Total Deposit: {totalDepositWithInterest.toFixed(2)} PYUSD</p>
              )}
            </div>

            <hr className="my-8 border-gray-700" />

            <div className="mb-4">
              <h4 className="text-xl font-bold mb-2">Transaction Summary</h4>
              <div className="flex justify-between">
                <p className="text-gray-400">Your Total Deposit:</p>
                <p>{totalDepositWithInterest !== null ? `${totalDepositWithInterest.toFixed(2)} PYUSD` : "N/A"}</p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleWithdraw}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-full disabled:bg-gray-500"
                disabled={!withdrawAmountInput || parseFloat(withdrawAmountInput) <= 0 || !!withdrawAmountError || isPending}
              >
                Withdraw PYUSD
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