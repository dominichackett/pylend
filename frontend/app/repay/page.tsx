import Header from "../components/Header";
import Footer from "../components/Footer";

export default function Repay() {
  return (
    <div className="text-white font-sans">
      <Header />

      <main className="container mx-auto px-4 py-10">
        <h2 className="text-3xl font-bold mb-8 text-center">Repay Loan</h2>

        <div className="max-w-lg mx-auto bg-black bg-opacity-30 p-8 rounded-lg">
          <form>
            <div className="mb-4">
              <label htmlFor="loan" className="block text-gray-400 mb-2">Select Loan to Repay</label>
              <select id="loan" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4">
                <option>Loan ID: 12345 - 10 WETH</option>
                <option>Loan ID: 67890 - 0.5 WBTC</option>
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="repayAmount" className="block text-gray-400 mb-2">Repay Amount (PYUSD)</label>
              <input type="number" id="repayAmount" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" />
            </div>

            <hr className="my-8 border-gray-700" />

            <div className="mb-4">
              <h4 className="text-xl font-bold mb-2">Transaction Summary</h4>
              <div className="flex justify-between">
                <p className="text-gray-400">Remaining Debt:</p>
                <p>10,000 PYUSD</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-400">New Health Factor:</p>
                <p className="text-green-500">3.0</p>
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-full">Repay Loan</button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
