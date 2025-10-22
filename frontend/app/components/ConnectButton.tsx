'use client';

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { useState } from 'react';
import { sepolia } from 'wagmi/chains';

export function ConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const chainId = useChainId();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyToClipboard = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setIsDropdownOpen(false);
    }
  };

  if (isConnected) {
    return (
      <div className="relative flex items-center space-x-2">
        {chain && chain.id !== sepolia.id && (
          <div className="bg-yellow-500 text-white text-sm px-3 py-1 rounded-full">
            Wrong Network! Please switch to Sepolia.
            <button
              onClick={() => switchChain({ chainId: sepolia.id })}
              className="ml-2 underline"
            >
              Switch
            </button>
          </div>
        )}
        <div className="relative">
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="cursor-pointer bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full">
            {truncateAddress(address!)} ({chain?.name || 'Unknown Network'})
          </button>
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-red-600 rounded-lg shadow-lg py-2">
              <button onClick={copyToClipboard} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-red-700">Copy Address</button>
              <button onClick={() => disconnect()} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-red-700">Disconnect</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => connect({ connector: connectors[0] })} className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
      Connect Wallet
    </button>
  );
}
