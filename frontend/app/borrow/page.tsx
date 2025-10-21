import Header from "../components/Header";
import Footer from "../components/Footer";

export default function Borrow() {
  return (
    <div className="font-sans flex flex-col flex-grow min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-10 flex-grow">
        <h2 className="text-3xl font-bold mb-8 text-center">Borrow PYUSD</h2>

        <div className="max-w-lg mx-auto bg-[#2F2F2F] p-8 rounded-lg text-white">
          <form>
            <div className="mb-4">
              <label htmlFor="collateralAsset" className="block text-gray-400 mb-2">Collateral Asset</label>
              <select id="collateralAsset" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4">
                <option>WETH</option>
                <option>WBTC</option>
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="collateralAmount" className="block text-gray-400 mb-2">Collateral Amount</label>
              <input type="number" id="collateralAmount" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" />
            </div>
            <div className="mb-4">
              <label htmlFor="borrowAmount" className="block text-gray-400 mb-2">Borrow Amount (PYUSD)</label>
              <input type="number" id="borrowAmount" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" />
            </div>

            <hr className="my-8 border-gray-700" />

            <div className="mb-4">
              <h4 className="text-xl font-bold mb-2">Transaction Summary</h4>
              <div className="flex justify-between">
                <p className="text-gray-400">Borrow APY:</p>
                <p>3.5%</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-400">Health Factor:</p>
                <p className="text-green-500">2.5</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-400">Liquidation Price:</p>
                <p>$1,000</p>
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-full">Borrow PYUSD</button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
