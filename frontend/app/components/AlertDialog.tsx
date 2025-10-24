'use client';
import React from 'react';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

const AlertDialog: React.FC<AlertDialogProps> = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex justify-center items-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialog;
