'use client'
import React, { useCallback } from 'react';
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
  healthFactor?: number;
  liquidationPrice?: number;
}

interface LoanRowProps {
  loan: LoanData;
  collateralSymbol: string;
  priceFeedData: Record<string, number>;
  prevPriceFeedDataRef: React.MutableRefObject<Record<string, number>>;
  onLiquidate: (loan: LoanData) => void;
}

const LoanRow: React.FC<LoanRowProps> = React.memo(({ loan, collateralSymbol, priceFeedData, prevPriceFeedDataRef, onLiquidate }) => {

  const currentPrice = loan.priceFeedId ? priceFeedData[loan.priceFeedId] : undefined;
  const prevPrice = loan.priceFeedId ? prevPriceFeedDataRef.current[loan.priceFeedId] : undefined;

  let priceColorClass = "text-white"; // Default color

  if (currentPrice !== undefined && prevPrice !== undefined) {
    if (currentPrice > prevPrice) {
      priceColorClass = "text-green-500"; // Price increased
    } else if (currentPrice < prevPrice) {
      priceColorClass = "text-red-500"; // Price decreased
    }
  }
  return (
    <tr className="border-b border-gray-800">
      <td className="p-4">{loan.loanId}</td>
      <td className="p-4">{collateralSymbol}</td>
      <td className="p-4">{loan.collateralDecimals !== undefined ? formatUnits(BigInt(loan.collateralAmount), loan.collateralDecimals) : "N/A"}</td>
      <td className="p-4"><span className={priceColorClass}>{currentPrice !== undefined ? `$${currentPrice.toFixed(2)}` : "Loading..."}</span></td>
      <td className="p-4">{formatUnits(BigInt(loan.borrowedAmount), 6)} PYUSD</td>
      <td className={`p-4 ${loan.healthFactor < 1 ? 'text-red-500' : 'text-yellow-500'}`}>{loan.healthFactor.toFixed(4)}</td>
      <td className="p-4">${loan.liquidationPrice.toFixed(2)}</td>
      <td className="p-4">
        <button
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full cursor-pointer"
          onClick={() => onLiquidate(loan)}
        >
          Liquidate
        </button>
      </td>
    </tr>
  );
});

export default LoanRow;
