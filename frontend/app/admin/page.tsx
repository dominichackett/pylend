"use client";
import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseEther, formatEther, pad, toHex } from "viem";

import Header from "../components/Header";
import Footer from "../components/Footer";

import AlertDialog from "../components/AlertDialog";
import { lendingPoolAddress, lendingPoolABI } from "../../lib/contracts";

export default function Admin() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [tokenAddress, setTokenAddress] = useState("");
  const [priceFeedId, setPriceFeedId] = useState("");
  const [liquidationThreshold, setLiquidationThreshold] = useState("");
  const [decimals, setDecimals] = useState("");
  const [newPlatformFee, setNewPlatformFee] = useState("");

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

  const { data: paused, refetch: refetchPaused } = useReadContract({
    address: lendingPoolAddress,
    abi: lendingPoolABI,
    functionName: "paused",
  });
  console.log("Paused Status:", paused);
  const { data: currentPlatformFee, refetch: refetchPlatformFee } = useReadContract({
    address: lendingPoolAddress,
    abi: lendingPoolABI,
    functionName: "platformFee",
  });
  console.log("Current Platform Fee:", currentPlatformFee);

  useEffect(() => {
    refetchPaused();
    refetchPlatformFee();
  }, [refetchPaused, refetchPlatformFee, paused, currentPlatformFee]);
  const handleAddCollateral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await writeContractAsync({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "addCollateral",
        args: [tokenAddress, priceFeedId, BigInt(Number(liquidationThreshold) * 100), Number(decimals)],
      });
      openDialog("Success", "Collateral added successfully!");
    } catch (err: any) {
      openDialog("Error", getShortErrorMessage(err.message));
    }
  };

  const handleSetPlatformFee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await writeContractAsync({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "setPlatformFee",
        args: [BigInt(newPlatformFee)],
      });
      openDialog("Success", "Platform fee set successfully!");
    } catch (err: any) {
      openDialog("Error", getShortErrorMessage(err.message));
    }
  };

  const handlePause = async () => {
    try {
      await writeContractAsync({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "pause",
      });
      openDialog("Success", "Contract paused successfully!");
    } catch (err: any) {
      openDialog("Error", getShortErrorMessage(err.message));
    }
  };

  const handleUnpause = async () => {
    try {
      await writeContractAsync({
        address: lendingPoolAddress,
        abi: lendingPoolABI,
        functionName: "unpause",
      });
      openDialog("Success", "Contract unpaused successfully!");
    } catch (err: any) {
      openDialog("Error", getShortErrorMessage(err.message));
    }
  };

  return (
    <div className="font-sans flex flex-col flex-grow min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-10 flex-grow">
        <h2 className="text-3xl font-bold mb-8 text-center">Admin Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-black bg-opacity-30 p-8 rounded-lg text-white">
            <h3 className="text-2xl font-bold mb-4">Add New Collateral</h3>
            <form onSubmit={handleAddCollateral}>
              <div className="mb-4">
                <label htmlFor="tokenAddress" className="block text-gray-400 mb-2">Token Address</label>
                <input type="text" id="tokenAddress" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} />
              </div>
              <div className="mb-4">
                <label htmlFor="priceFeedId" className="block text-gray-400 mb-2">Price Feed ID</label>
                <input type="text" id="priceFeedId" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" value={priceFeedId} onChange={(e) => setPriceFeedId(e.target.value)} />
              </div>
              <div className="mb-4">
                <label htmlFor="liquidationThreshold" className="block text-gray-400 mb-2">Liquidation Threshold (%)</label>
                <input type="number" id="liquidationThreshold" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" value={liquidationThreshold} onChange={(e) => setLiquidationThreshold(e.target.value)} />
              </div>
              <div className="mb-4">
                <label htmlFor="decimals" className="block text-gray-400 mb-2">Token Decimals</label>
                <input type="number" id="decimals" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" value={decimals} onChange={(e) => setDecimals(e.target.value)} />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Add Collateral</button>
            </form>
          </div>

          <div className="bg-black bg-opacity-30 p-8 rounded-lg text-white">
            <h3 className="text-2xl font-bold mb-4">Contract Settings</h3>
            <form onSubmit={handleSetPlatformFee}>
              <div className="mb-4">
                <label htmlFor="platformFee" className="block text-gray-400 mb-2">Current Platform Fee (%)</label>
                <input type="text" id="platformFee" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" readOnly value={currentPlatformFee ? `${Number(currentPlatformFee) / 100}%` : "Loading..."} />

                <label htmlFor="newPlatformFee" className="block text-gray-400 mb-2 mt-4">New Platform Fee (%)</label>
                <input type="number" id="newPlatformFee" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" placeholder="Enter new platform fee" value={newPlatformFee} onChange={(e) => setNewPlatformFee(e.target.value)} />

              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Set Fee</button>
            </form>

            <hr className="my-8 border-gray-700" />

            <div>
              <h4 className="text-xl font-bold mb-4">Contract Status</h4>
              <div className="flex items-center justify-between">
                <p className="text-gray-400">Contract is currently: {paused ? <span className="text-red-500">Paused</span> : <span className="text-green-500">Active</span>}</p>
                {paused ? (
                  <button onClick={handleUnpause} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full">Unpause Contract</button>
                ) : (
                  <button onClick={handlePause} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full">Pause Contract</button>
                )}
              </div>
            </div>
          </div>
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