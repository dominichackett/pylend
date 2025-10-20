import Header from "../components/Header";
import Footer from "../components/Footer";
import Image from "next/image";

const markets = [
  {
    asset: "WETH",
    logo: "/weth-logo.svg", // Placeholder
    totalSupplied: "10,000",
    totalBorrowed: "5,000",
    supplyApy: "2.5%",
    borrowApy: "3.5%",
  },
  {
    asset: "WBTC",
    logo: "/wbtc-logo.svg", // Placeholder
    totalSupplied: "500",
    totalBorrowed: "200",
    supplyApy: "1.8%",
    borrowApy: "2.9%",
  },
  // Add more assets here
];

export default function Markets() {
  return (
    <div className="text-white font-sans">
      <Header />

      {/* Markets Table */}
      <main className="container mx-auto px-4 py-10">
        <h2 className="text-3xl font-bold mb-8 text-center">Markets</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-black bg-opacity-30 rounded-lg">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="p-4">Asset</th>
                <th className="p-4">Total Supplied</th>
                <th className="p-4">Total Borrowed</th>
                <th className="p-4">Supply APY</th>
                <th className="p-4">Borrow APY</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market) => (
                <tr key={market.asset} className="border-b border-gray-800 hover:bg-black hover:bg-opacity-20">
                  <td className="p-4 flex items-center">
                    <Image
                      src={market.logo}
                      alt={`${market.asset} logo`}
                      width={32}
                      height={32}
                      className="mr-4"
                    />
                    {market.asset}
                  </td>
                  <td className="p-4">{market.totalSupplied}</td>
                  <td className="p-4">{market.totalBorrowed}</td>
                  <td className="p-4 text-green-400">{market.supplyApy}</td>
                  <td className="p-4 text-red-400">{market.borrowApy}</td>
                  <td className="p-4">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
                      Details
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
