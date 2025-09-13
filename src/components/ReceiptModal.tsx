'use client';

import { useEffect } from 'react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  receiptId: string;
}

export default function ReceiptModal({ isOpen, onClose, imageUrl, receiptId }: ReceiptModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Don't prevent background scrolling - let the page show through
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      onClick={onClose}
    >
      <div 
        className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent modal close when clicking on image
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Receipt image */}
        <div className="flex items-center justify-center max-h-[90vh]">
          <img
            src={imageUrl}
            alt={`Receipt ${receiptId}`}
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: '90vh' }}
          />
        </div>

        {/* Receipt ID label */}
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
          Receipt: {receiptId.slice(0, 8)}...
        </div>
      </div>
    </div>
  );
}