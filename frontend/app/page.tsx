import Header from "./components/Header";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <div className="text-white font-sans relative" style={{
        backgroundImage: `url('/bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}>
      <div className="absolute inset-0 bg-black opacity-50 z-0"></div>
      <div className="relative z-10"> {/* New container for content */} 
        <Header />

        {/* Hero Section */}
        <main className="flex flex-col items-center justify-center min-h-screen text-center p-8">
          <h2 className="text-5xl font-bold mb-4" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>Borrow PYUSD with Your Crypto</h2>
          <p className="text-lg text-gray-300 mb-8" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
            PYLend is a decentralized lending platform that allows you to borrow PYUSD using your WETH, WBTC, and other approved collateral.
          </p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full text-lg">
            Borrow Now
          </button>
        </main>

        {/* Features Section */}
        <section className="py-20 bg-black bg-opacity-20">
          <div className="container mx-auto px-4">
            <h3 className="text-3xl font-bold text-center mb-12">Key Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-black bg-opacity-30 p-8 rounded-lg text-center">
                <h4 className="text-2xl font-bold mb-4">Borrow PYUSD</h4>
                <p className="text-gray-400">
                  Borrow PYUSD against your crypto assets at competitive interest rates.
                </p>
              </div>
              <div className="bg-black bg-opacity-30 p-8 rounded-lg text-center">
                <h4 className="text-2xl font-bold mb-4">Supply Collateral</h4>
                <p className="text-gray-400">
                  Supply your WETH, WBTC, and other approved assets as collateral to earn interest.
                </p>
              </div>
              <div className="bg-black bg-opacity-30 p-8 rounded-lg text-center">
                <h4 className="text-2xl font-bold mb-4">View Dashboard</h4>
                <p className="text-gray-400">
                  Track your loans, collateral, and interest rates in our easy-to-use dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div> {/* End of new container */} 
    </div>
  );
}