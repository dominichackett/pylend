import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PYLend - Decentralized Lending",
  description: "Borrow PYUSD with your crypto collateral.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
