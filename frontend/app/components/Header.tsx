import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="flex justify-between items-center p-4 border-b border-gray-800 bg-black bg-opacity-20">
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
          <Image
            src="/pylend-logo.svg" // Placeholder for PYLend logo
            alt="PYLend Logo"
            width={40}
            height={40}
          />
          <h1 className="text-2xl font-bold ml-2">PYLend</h1>
        </Link>
      </div>
      <nav className="hidden md:flex gap-8">
        <Link href="/markets" className="hover:text-blue-400">Markets</Link>
        <Link href="/dashboard" className="hover:text-blue-400">Dashboard</Link>
        <Link href="/borrow" className="hover:text-blue-400">Borrow</Link>
        <Link href="/repay" className="hover:text-blue-400">Repay</Link>
        <Link href="/supply" className="hover:text-blue-400">Supply</Link>
        <Link href="/withdraw" className="hover:text-blue-400">Withdraw</Link>
        <Link href="/liquidations" className="hover:text-blue-400">Liquidations</Link>
        <Link href="/admin" className="hover:text-blue-400">Admin</Link>
      </nav>
      <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
        Connect Wallet
      </button>
    </header>
  );
}
