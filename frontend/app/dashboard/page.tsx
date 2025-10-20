import Header from "../components/Header";
import Footer from "../components/Footer";

const suppliedAssets = [
  {
    asset: "WETH",
    amount: "10",
    apy: "2.5%",
    value: "$15,000",
  },
  {
    asset: "WBTC",
    amount: "0.5",
    apy: "1.8%",
    value: "$20,000",
  },
];

const borrowedAssets = [
  {
    asset: "PYUSD",
    amount: "5,000",
    apy: "3.5%",
    value: "$5,000",
  },
];

const myLoans = [
  {
    loanId: "12345",
    collateral: "WETH",
    collateralAmount: "10",
    debt: "15,000 PYUSD",
    healthFactor: "1.5",
  },
];

export default function Dashboard() {
  return (
    <div className="text-white font-sans">
      <Header />

      <main className="container mx-auto px-4 py-10">
        <h2 className="text-3xl font-bold mb-8 text-center">My Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Supplied Assets */}
          <div className="bg-black bg-opacity-30 p-8 rounded-lg">
            <h3 className="text-2xl font-bold mb-4">Supplied Assets</h3>
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="p-4">Asset</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">APY</th>
                  <th className="p-4">Value</th>
                </tr>
              </thead>
              <tbody>
                {suppliedAssets.map((asset) => (
                  <tr key={asset.asset} className="border-b border-gray-800">
                    <td className="p-4">{asset.asset}</td>
                    <td className="p-4">{asset.amount}</td>
                    <td className="p-4 text-green-400">{asset.apy}</td>
                    <td className="p-4">{asset.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Borrowed Assets */}
          <div className="bg-black bg-opacity-30 p-8 rounded-lg">
            <h3 className="text-2xl font-bold mb-4">Borrowed Assets</h3>
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="p-4">Asset</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">APY</th>
                  <th className="p-4">Value</th>
                </tr>
              </thead>
              <tbody>
                {borrowedAssets.map((asset) => (
                  <tr key={asset.asset} className="border-b border-gray-800">
                    <td className="p-4">{asset.asset}</td>
                    <td className="p-4">{asset.amount}</td>
                    <td className="p-4 text-red-400">{asset.apy}</td>
                    <td className="p-4">{asset.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* My Loans */}
        <div className="bg-black bg-opacity-30 p-8 rounded-lg">
          <h3 className="text-2xl font-bold mb-4">My Loans</h3>
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="p-4">Loan ID</th>
                <th className="p-4">Collateral</th>
                <th className="p-4">Collateral Amount</th>
                <th className="p-4">Debt</th>
                <th className="p-4">Health Factor</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {myLoans.map((loan) => (
                <tr key={loan.loanId} className="border-b border-gray-800">
                  <td className="p-4">{loan.loanId}</td>
                  <td className="p-4">{loan.collateral}</td>
                  <td className="p-4">{loan.collateralAmount}</td>
                  <td className="p-4">{loan.debt}</td>
                  <td className="p-4 text-green-500">{loan.healthFactor}</td>
                  <td className="p-4">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Manage</button>
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
