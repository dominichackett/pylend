'use client';

import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "./ConnectButton";
import { useAccount } from 'wagmi';
import { usePathname } from 'next/navigation';

export default function Header() {
  const { isConnected } = useAccount();
  const pathname = usePathname();

  const getLinkClass = (href: string) => {
    return `hover:text-blue-400 ${pathname === href ? 'text-blue-500' : ''}`;
  };

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
        <Link href="/markets" className={getLinkClass('/markets')}>Markets</Link>
        {isConnected && (
          <>
            <Link href="/dashboard" className={getLinkClass('/dashboard')}>Dashboard</Link>
            <Link href="/borrow" className={getLinkClass('/borrow')}>Borrow</Link>
            <Link href="/repay" className={getLinkClass('/repay')}>Repay</Link>
            <Link href="/supply" className={getLinkClass('/supply')}>Supply</Link>
            <Link href="/withdraw" className={getLinkClass('/withdraw')}>Withdraw</Link>
            <Link href="/liquidations" className={getLinkClass('/liquidations')}>Liquidations</Link>
            <Link href="/admin" className={getLinkClass('/admin')}>Admin</Link>
          </>
        )}
      </nav>
      <ConnectButton />
    </header>
  );
}
