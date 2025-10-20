import Header from "../components/Header";
import Footer from "../components/Footer";

export default function Admin() {
  return (
    <div className="text-white font-sans">
      <Header />

      <main className="container mx-auto px-4 py-10">
        <h2 className="text-3xl font-bold mb-8 text-center">Admin Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Add New Collateral */}
          <div className="bg-black bg-opacity-30 p-8 rounded-lg">
            <h3 className="text-2xl font-bold mb-4">Add New Collateral</h3>
            <form>
              <div className="mb-4">
                <label htmlFor="tokenAddress" className="block text-gray-400 mb-2">Token Address</label>
                <input type="text" id="tokenAddress" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" />
              </div>
              <div className="mb-4">
                <label htmlFor="priceFeedId" className="block text-gray-400 mb-2">Price Feed ID</label>
                <input type="text" id="priceFeedId" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" />
              </div>
              <div className="mb-4">
                <label htmlFor="liquidationThreshold" className="block text-gray-400 mb-2">Liquidation Threshold (%)</label>
                <input type="number" id="liquidationThreshold" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Add Collateral</button>
            </form>
          </div>

          {/* Contract Settings */}
          <div className="bg-black bg-opacity-30 p-8 rounded-lg">
            <h3 className="text-2xl font-bold mb-4">Contract Settings</h3>
            <form>
              <div className="mb-4">
                <label htmlFor="platformFee" className="block text-gray-400 mb-2">Platform Fee (%)</label>
                <input type="number" id="platformFee" className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4" />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Set Fee</button>
            </form>

            <hr className="my-8 border-gray-700" />

            <div>
              <h4 className="text-xl font-bold mb-4">Contract Status</h4>
              <div className="flex items-center justify-between">
                <p className="text-gray-400">Contract is currently: <span className="text-green-500">Active</span></p>
                <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full">Pause Contract</button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
