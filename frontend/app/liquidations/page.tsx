import Header from "../components/Header";
import Footer from "../components/Footer";
import Image from "next/image";

const liquidations = [
  {
    loanId: "12345",
    collateral: "WETH",
    collateralAmount: "10",
    debt: "15,000 PYUSD",
    healthFactor: "0.95",
    liquidationPrice: "$1,500",
  },
  {
    loanId: "67890",
    collateral: "WBTC",
    collateralAmount: "0.5",
    debt: "20,000 PYUSD",
    healthFactor: "0.98",
    liquidationPrice: "$40,000",
  },
  // Add more liquidations here
];

export default function Liquidations() {
  return (
    <div className="font-sans flex flex-col flex-grow min-h-screen">
      <Header />

      {/* Liquidations Table */}
      <main className="container mx-auto px-4 py-10 flex-grow">
        <h2 className="text-3xl font-bold mb-8 text-center">Liquidations</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-black bg-opacity-30 rounded-lg">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="p-4">Loan ID</th>
                <th className="p-4">Collateral</th>
                <th className="p-4">Collateral Amount</th>
                <th className="p-4">Debt</th>
                <th className="p-4">Health Factor</th>
                <th className="p-4">Liquidation Price</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="text-white">
              {liquidations.map((liquidation) => (
                <tr key={liquidation.loanId} className="border-b border-gray-800 hover:bg-black hover:bg-opacity-20">
                  <td className="p-4">{liquidation.loanId}</td>
                  <td className="p-4">{liquidation.collateral}</td>
                  <td className="p-4">{liquidation.collateralAmount}</td>
                  <td className="p-4">{liquidation.debt}</td>
                  <td className="p-4 text-red-500">{liquidation.healthFactor}</td>
                  <td className="p-4">{liquidation.liquidationPrice}</td>
                  <td className="p-4">
                    <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full">
                      Liquidate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <Footer />
    </div>
  );
}
