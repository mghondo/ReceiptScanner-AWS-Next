'use client';

import { useState } from 'react';
import { ExtractedReceiptData } from '@/lib/textract-service';

interface ReceiptEntry {
  id: string;
  data: ExtractedReceiptData;
  timestamp: Date;
}

interface ReceiptTableProps {
  receipts: ReceiptEntry[];
  onDataChange: (receiptId: string, newData: ExtractedReceiptData) => void;
  onRemoveReceipt: (receiptId: string) => void;
}

export default function ReceiptTable({ receipts, onDataChange, onRemoveReceipt }: ReceiptTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);

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

  const formatCurrency = (amount?: string) => {
    if (!amount) return '';
    // Remove any non-numeric characters except decimal point
    const cleanAmount = amount.replace(/[^\d.-]/g, '');
    return cleanAmount ? `$${cleanAmount}` : amount;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                #
              </th>
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
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{receipts.length - index}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {editingCell === `${receipt.id}-date` ? (
                    <input
                      type="text"
                      value={receipt.data.date || ''}
                      onChange={(e) => handleCellEdit(receipt.id, 'date', e.target.value)}
                      onBlur={handleCellBlur}
                      onKeyPress={(e) => e.key === 'Enter' && handleCellBlur()}
                      className="w-full p-1 border border-gray-300 rounded text-gray-900 text-sm"
                      placeholder="Receipt date"
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
                  <button
                    onClick={() => onRemoveReceipt(receipt.id)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                    title="Remove receipt"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {receipts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No receipts scanned yet. Upload a receipt to get started!</p>
        </div>
      )}
    </div>
  );
}