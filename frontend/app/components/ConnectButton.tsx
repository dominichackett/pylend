'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useState } from 'react';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
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
      <div className="relative">
        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="cursor-pointer bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full">
          {truncateAddress(address!)}
        </button>
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-red-600 rounded-lg shadow-lg py-2">
            <button onClick={copyToClipboard} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-red-700">Copy Address</button>
            <button onClick={() => disconnect()} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-red-700">Disconnect</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button onClick={() => connect({ connector: connectors[0] })} className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
      Connect Wallet
    </button>
  );
}
