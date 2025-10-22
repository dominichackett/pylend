
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
}

interface LoanRowProps {
  loan: LoanData;
  collateralSymbol: string;
  priceFeedData: Record<string, number>;
  prevPriceFeedDataRef: React.MutableRefObject<Record<string, number>>;
}

const LoanRow: React.FC<LoanRowProps> = React.memo(({ loan, collateralSymbol, priceFeedData, prevPriceFeedDataRef }) => {
  console.log(`Rendering LoanRow for loanId: ${loan.loanId}`);

  const currentPrice = loan.priceFeedId ? priceFeedData[loan.priceFeedId] : undefined;
  const prevPrice = loan.priceFeedId ? prevPriceFeedDataRef.current[loan.priceFeedId] : undefined;

  const calculateHealthFactor = useCallback(() => {
    if (!loan.collateralDecimals || !loan.liquidationThreshold || currentPrice === undefined || currentPrice === 0) return 0;

    const collateralAmount = Number(formatUnits(BigInt(loan.collateralAmount), loan.collateralDecimals));
    const borrowedAmount = Number(formatUnits(BigInt(loan.borrowedAmount), 6)); // Assuming PYUSD has 6 decimals
    const liquidationThreshold = loan.liquidationThreshold / 10000; // Convert basis points to ratio

    // Health Factor = (Collateral Value * Liquidation Threshold) / Borrowed Amount
    const collateralValue = collateralAmount * currentPrice;
    if (borrowedAmount === 0) return Infinity; // Avoid division by zero

    return (collateralValue * liquidationThreshold) / borrowedAmount;
  }, [loan, currentPrice]);

  const healthFactor = calculateHealthFactor();

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
      <td className="p-4"><span className={priceColorClass}>{currentPrice !== undefined ? `${currentPrice.toFixed(2)}` : "Loading..."}</span></td>
      <td className="p-4">{formatUnits(BigInt(loan.borrowedAmount), 6)} PYUSD</td>
      <td className="p-4 text-green-500">{healthFactor !== undefined && healthFactor !== 0 ? healthFactor.toFixed(2) : "N/A"}</td>
      <td className="p-4">
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Manage</button>
      </td>
    </tr>
  );
});

export default LoanRow;
