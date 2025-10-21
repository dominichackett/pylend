import Header from "../components/Header";
import Footer from "../components/Footer";

export default function Withdraw() {
  return (
    <div className="font-sans flex flex-col flex-grow min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-10 flex-grow">
        <h2 className="text-3xl font-bold mb-8 text-center">Withdraw Assets</h2>

        <div className="max-w-lg mx-auto bg-black bg-opacity-30 p-8 rounded-lg text-white">
          <form>
            <div className="mb-4">
              <label htmlFor="withdrawAsset" className="block text-gray-400 mb-2">Select Asset to Withdraw</label>
              <select id="withdrawAsset" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4">
                <option>WETH</option>
                <option>WBTC</option>
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="withdrawAmount" className="block text-gray-400 mb-2">Withdraw Amount</label>
              <input type="number" id="withdrawAmount" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" />
            </div>

            <hr className="my-8 border-gray-700" />

            <div className="mb-4">
              <h4 className="text-xl font-bold mb-2">Transaction Summary</h4>
              <div className="flex justify-between">
                <p className="text-gray-400">Interest Earned:</p>
                <p className="text-green-400">$100</p>
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-full">Withdraw Asset</button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
