'use client';

import { useState } from 'react';
import { ExtractedReceiptData } from '@/lib/textract-service';
import ReceiptModal from './ReceiptModal';

interface ReceiptEntry {
  id: string;
  data: ExtractedReceiptData;
  timestamp: Date;
  originalImage?: {
    file: File;
    dataUrl: string;
  };
}

interface ReceiptTableProps {
  receipts: ReceiptEntry[];
  onDataChange: (receiptId: string, newData: ExtractedReceiptData) => void;
  onRemoveReceipt: (receiptId: string) => void;
}

export default function ReceiptTable({ receipts, onDataChange, onRemoveReceipt }: ReceiptTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReceiptImage, setSelectedReceiptImage] = useState<{ id: string; imageUrl: string } | null>(null);

  const expenseCategories = [
    'HOTEL/MOTEL',
    'MEALS',
    'ENTERTAINMENT',
    'TRANSPORT/AIR-RAIL', 
    'COMPUTER SUPPLIES',
    'CELL PHONE',
    'GAS',
    'COPIES',
    'DUES',
    'POSTAGE',
    'OFFICE SUPPLIES',
    'MISC'
  ];

  const handleCellEdit = (receiptId: string, field: keyof ExtractedReceiptData, value: string) => {
    const receipt = receipts.find(r => r.id === receiptId);
    if (receipt) {
      const newData = { ...receipt.data, [field]: value };
      onDataChange(receiptId, newData);
    }
  };

  const handleCellClick = (cellId: string) => {
    setEditingCell(cellId);
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleViewReceipt = (receipt: ReceiptEntry) => {
    if (receipt.originalImage?.dataUrl) {
      setSelectedReceiptImage({
        id: receipt.id,
        imageUrl: receipt.originalImage.dataUrl
      });
      setModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedReceiptImage(null);
  };

  const formatCurrency = (amount?: string) => {
    if (!amount) return '';
    // Remove any non-numeric characters except decimal point
    const cleanAmount = amount.replace(/[^\d.-]/g, '');
    return cleanAmount ? `$${cleanAmount}` : amount;
  };

  // Convert date from display format (MM/DD/YYYY) to input format (YYYY-MM-DD)
  const formatDateForInput = (dateStr: string): string => {
    if (!dateStr) return '';
    // Try to parse various date formats
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      // Assume MM/DD/YYYY or MM-DD-YYYY
      const [month, day, year] = parts;
      const paddedMonth = month.padStart(2, '0');
      const paddedDay = day.padStart(2, '0');
      const fullYear = year.length === 2 ? `20${year}` : year;
      return `${fullYear}-${paddedMonth}-${paddedDay}`;
    }
    return dateStr;
  };

  // Convert date from input format (YYYY-MM-DD) to display format (MM/DD/YYYY)
  const formatDateFromInput = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Desktop Table View - Hidden on Mobile */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Receipt Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Merchant
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Purpose of Trip/Expenditure <span className="text-amber-600 font-bold">*</span>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category <span className="text-amber-600 font-bold">*</span>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {receipts.map((receipt, index) => (
              <tr key={receipt.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 text-sm text-gray-900">
                  {editingCell === `${receipt.id}-date` ? (
                    <input
                      type="date"
                      value={formatDateForInput(receipt.data.date || '')}
                      onChange={(e) => handleCellEdit(receipt.id, 'date', formatDateFromInput(e.target.value))}
                      onBlur={handleCellBlur}
                      onKeyPress={(e) => e.key === 'Enter' && handleCellBlur()}
                      className="w-full p-1 border border-gray-300 rounded text-gray-900 text-sm"
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() => handleCellClick(`${receipt.id}-date`)}
                      className="cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[1.5rem]"
                      title="Click to edit receipt date"
                    >
                      {receipt.data.date || (
                        <span className="text-gray-400 italic">Click to add date</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                  {editingCell === `${receipt.id}-merchant` ? (
                    <input
                      type="text"
                      value={receipt.data.merchant || ''}
                      onChange={(e) => handleCellEdit(receipt.id, 'merchant', e.target.value)}
                      onBlur={handleCellBlur}
                      onKeyPress={(e) => e.key === 'Enter' && handleCellBlur()}
                      className="w-full p-1 border border-gray-300 rounded text-gray-900 text-sm"
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() => handleCellClick(`${receipt.id}-merchant`)}
                      className="cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[1.5rem] truncate"
                      title={receipt.data.merchant || "Click to edit"}
                    >
                      {receipt.data.merchant || (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                  {editingCell === `${receipt.id}-description` ? (
                    <input
                      type="text"
                      value={receipt.data.description || ''}
                      onChange={(e) => handleCellEdit(receipt.id, 'description', e.target.value)}
                      onBlur={handleCellBlur}
                      onKeyPress={(e) => e.key === 'Enter' && handleCellBlur()}
                      className="w-full p-1 border border-gray-300 rounded text-gray-900 text-sm"
                      placeholder="Enter purpose of trip/expenditure"
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() => handleCellClick(`${receipt.id}-description`)}
                      className={`cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[1.5rem] ${
                        !receipt.data.description ? 'bg-amber-50 border border-amber-200' : ''
                      }`}
                      title="Click to edit (Required)"
                    >
                      {receipt.data.description || (
                        <span className="text-amber-600 italic font-medium">Required: Click to add purpose</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {editingCell === `${receipt.id}-total` ? (
                    <input
                      type="text"
                      value={receipt.data.total || ''}
                      onChange={(e) => handleCellEdit(receipt.id, 'total', e.target.value)}
                      onBlur={handleCellBlur}
                      onKeyPress={(e) => e.key === 'Enter' && handleCellBlur()}
                      className="w-full p-1 border border-gray-300 rounded text-gray-900 text-sm"
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() => handleCellClick(`${receipt.id}-total`)}
                      className="cursor-pointer hover:bg-gray-100 p-1 rounded min-h-[1.5rem] font-medium"
                      title="Click to edit"
                    >
                      {receipt.data.total ? formatCurrency(receipt.data.total) : (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  <select
                    value={receipt.data.category || ''}
                    onChange={(e) => handleCellEdit(receipt.id, 'category', e.target.value)}
                    className={`w-full p-1 border rounded text-gray-900 text-sm bg-white ${
                      !receipt.data.category 
                        ? 'border-amber-400 bg-amber-50 text-amber-700 font-medium' 
                        : 'border-gray-300'
                    }`}
                  >
                    <option value="" className="text-amber-700 font-medium">Required: Select Category</option>
                    {expenseCategories.map((category) => (
                      <option key={category} value={category} className="text-gray-900 font-normal">
                        {category}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    {/* View Receipt Button */}
                    <button
                      onClick={() => handleViewReceipt(receipt)}
                      disabled={!receipt.originalImage?.dataUrl}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        receipt.originalImage?.dataUrl
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      title={receipt.originalImage?.dataUrl ? "View receipt image" : "Image not available"}
                    >
                      👁️ View
                    </button>
                    {/* Remove Button */}
                    <button
                      onClick={() => onRemoveReceipt(receipt.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      title="Remove receipt"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View - Visible on Mobile Only */}
      <div className="md:hidden space-y-2 p-2">
        {receipts.map((receipt, index) => (
          <div key={receipt.id} className="p-4 rounded-lg bg-white border-2 border-gray-300">
            {/* Action Buttons */}
            <div className="flex justify-end mb-3">
              <div className="flex space-x-2">
                {/* View Receipt Button */}
                <button
                  onClick={() => handleViewReceipt(receipt)}
                  disabled={!receipt.originalImage?.dataUrl}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    receipt.originalImage?.dataUrl
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  title={receipt.originalImage?.dataUrl ? "View receipt image" : "Image not available"}
                >
                  👁️ View
                </button>
                {/* Remove Button */}
                <button
                  onClick={() => onRemoveReceipt(receipt.id)}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                  title="Remove receipt"
                >
                  🗑️ Remove
                </button>
              </div>
            </div>
            
            {/* Receipt Fields */}
            <div className="space-y-3">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Date</label>
                {editingCell === `${receipt.id}-date` ? (
                  <input
                    type="date"
                    defaultValue={formatDateForInput(receipt.data.date || '')}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    onBlur={(e) => {
                      handleCellEdit(receipt.id, 'date', formatDateFromInput(e.target.value));
                      handleCellBlur();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={() => handleCellClick(`${receipt.id}-date`)}
                    className="p-2 border border-transparent rounded-md cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors text-black"
                  >
                    {receipt.data.date || <span className="text-gray-400">Click to edit</span>}
                  </div>
                )}
              </div>

              {/* Merchant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Merchant</label>
                {editingCell === `${receipt.id}-merchant` ? (
                  <input
                    type="text"
                    defaultValue={receipt.data.merchant || ''}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    onBlur={(e) => {
                      handleCellEdit(receipt.id, 'merchant', e.target.value);
                      handleCellBlur();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={() => handleCellClick(`${receipt.id}-merchant`)}
                    className="p-2 border border-transparent rounded-md cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors text-black"
                  >
                    {receipt.data.merchant || <span className="text-gray-400">Click to edit</span>}
                  </div>
                )}
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose of Trip/Expenditure <span className="text-amber-600 font-bold">*</span>
                </label>
                {editingCell === `${receipt.id}-description` ? (
                  <input
                    type="text"
                    defaultValue={receipt.data.description || ''}
                    className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black ${
                      !receipt.data.description?.trim() 
                        ? 'border-amber-400 bg-amber-50' 
                        : 'border-gray-300'
                    }`}
                    onBlur={(e) => {
                      handleCellEdit(receipt.id, 'description', e.target.value);
                      handleCellBlur();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={() => handleCellClick(`${receipt.id}-description`)}
                    className={`p-2 border border-transparent rounded-md cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors text-black ${
                      !receipt.data.description?.trim() 
                        ? 'bg-amber-50' 
                        : ''
                    }`}
                  >
                    {receipt.data.description || <span className="text-gray-400">Click to add purpose (required)</span>}
                  </div>
                )}
              </div>

              {/* Total */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                {editingCell === `${receipt.id}-total` ? (
                  <input
                    type="text"
                    defaultValue={receipt.data.total || ''}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    onBlur={(e) => {
                      handleCellEdit(receipt.id, 'total', e.target.value);
                      handleCellBlur();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={() => handleCellClick(`${receipt.id}-total`)}
                    className="p-2 border border-transparent rounded-md cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors font-medium text-black"
                  >
                    {formatCurrency(receipt.data.total) || <span className="text-gray-400">Click to edit</span>}
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-amber-600 font-bold">*</span>
                </label>
                <select
                  value={receipt.data.category || ''}
                  onChange={(e) => handleCellEdit(receipt.id, 'category', e.target.value)}
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black ${
                    !receipt.data.category?.trim() 
                      ? 'border-amber-400 bg-amber-50' 
                      : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a category (required)</option>
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {receipts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No receipts scanned yet. Upload a receipt to get started!</p>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedReceiptImage && (
        <ReceiptModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          imageUrl={selectedReceiptImage.imageUrl}
          receiptId={selectedReceiptImage.id}
        />
      )}
    </div>
  );
}