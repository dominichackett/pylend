import Header from "../components/Header";
import Footer from "../components/Footer";

export default function Supply() {
  return (
    <div className="text-white font-sans">
      <Header />

      <main className="container mx-auto px-4 py-10">
        <h2 className="text-3xl font-bold mb-8 text-center">Supply Assets</h2>

        <div className="max-w-lg mx-auto bg-black bg-opacity-30 p-8 rounded-lg">
          <form>
            <div className="mb-4">
              <label htmlFor="supplyAsset" className="block text-gray-400 mb-2">Select Asset to Supply</label>
              <select id="supplyAsset" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4">
                <option>WETH</option>
                <option>WBTC</option>
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="supplyAmount" className="block text-gray-400 mb-2">Supply Amount</label>
              <input type="number" id="supplyAmount" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" />
            </div>

            <hr className="my-8 border-gray-700" />

            <div className="mb-4">
              <h4 className="text-xl font-bold mb-2">Transaction Summary</h4>
              <div className="flex justify-between">
                <p className="text-gray-400">Supply APY:</p>
                <p className="text-green-400">2.5%</p>
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-full">Supply Asset</button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
