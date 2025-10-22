"use client";

export default function Footer() {
  return (
    <footer className="bg-black bg-opacity-20 py-8 text-center text-gray-500">
      <p>&copy; 2025 PYLend. All rights reserved.</p>
      <div className="flex justify-center space-x-4 mt-4">
        <a href="#" className="hover:text-white">Twitter</a>
        <a href="#" className="hover:text-white">Discord</a>
        <a href="#" className="hover:text-white">Docs</a>
      </div>
    </footer>
  );
}
