
'use client'
import React from 'react';
import { formatUnits } from "viem";

interface LoanData {
  id: string;
  borrowedAmount: string;
  borrower: string;
  collateralAmount: string;
  collateralToken: string;
  interestRate: string;
  loanId: string;
  timestamp: string;
  priceFeedId?: string;
  collateralDecimals?: number;
  liquidationThreshold?: number;
}

interface LoanRowProps {
  loan: LoanData;
  collateralSymbol: string;
}

const LoanRow: React.FC<LoanRowProps> = React.memo(({ loan, collateralSymbol }) => {
  console.log(`Rendering LoanRow for loanId: ${loan.loanId}`);
  const { currentPrice, healthFactor } = loan;
  return (
    <tr className="border-b border-gray-800">
      <td className="p-4">{loan.loanId}</td>
      <td className="p-4">{collateralSymbol}</td>
      <td className="p-4">{loan.collateralDecimals !== undefined ? formatUnits(BigInt(loan.collateralAmount), loan.collateralDecimals) : "N/A"}</td>
      <td className="p-4">{currentPrice !== undefined ? `${currentPrice.toFixed(2)}` : "Loading..."}</td>
      <td className="p-4">{formatUnits(BigInt(loan.borrowedAmount), 6)} PYUSD</td>
      <td className="p-4 text-green-500">{healthFactor !== undefined && healthFactor !== 0 ? healthFactor.toFixed(2) : "N/A"}</td>
      <td className="p-4">
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Manage</button>
      </td>
    </tr>
  );
});

export default LoanRow;
