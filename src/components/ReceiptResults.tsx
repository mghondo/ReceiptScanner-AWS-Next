'use client';

import { useState } from 'react';
import { ExtractedReceiptData } from '@/lib/textract-service';

interface ReceiptResultsProps {
  data: ExtractedReceiptData;
  onDataChange: (data: ExtractedReceiptData) => void;
  onExport: () => void;
}

export default function ReceiptResults({ data, onDataChange, onExport }: ReceiptResultsProps) {
  const [editableData, setEditableData] = useState<ExtractedReceiptData>(data);

  const handleFieldChange = (field: keyof ExtractedReceiptData, value: string) => {
    const newData = { ...editableData, [field]: value };
    setEditableData(newData);
    onDataChange(newData);
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...(editableData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    const newData = { ...editableData, items: newItems };
    setEditableData(newData);
    onDataChange(newData);
  };

  const addItem = () => {
    const newItems = [...(editableData.items || []), { description: '', price: '', quantity: '' }];
    const newData = { ...editableData, items: newItems };
    setEditableData(newData);
    onDataChange(newData);
  };

  const removeItem = (index: number) => {
    const newItems = editableData.items?.filter((_, i) => i !== index) || [];
    const newData = { ...editableData, items: newItems };
    setEditableData(newData);
    onDataChange(newData);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Extracted Receipt Data</h2>
        {/* Export button hidden - using "Export All" at app level */}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Purpose of Trip/Expenditure <span className="text-amber-600 font-bold">*</span>
        </label>
        <input
          type="text"
          value={editableData.description || ''}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
            !editableData.description 
              ? 'border-amber-400 bg-amber-50' 
              : 'border-gray-300'
          }`}
          placeholder="Required: Enter purpose of trip/expenditure (e.g., Client meeting, Office supplies purchase, etc.)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Merchant Name
            </label>
            <input
              type="text"
              value={editableData.merchant || ''}
              onChange={(e) => handleFieldChange('merchant', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Enter merchant name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Amount
            </label>
            <input
              type="text"
              value={editableData.total || ''}
              onChange={(e) => handleFieldChange('total', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Enter total amount"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="text"
              value={editableData.date || ''}
              onChange={(e) => handleFieldChange('date', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Enter date"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Amount
            </label>
            <input
              type="text"
              value={editableData.tax || ''}
              onChange={(e) => handleFieldChange('tax', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Enter tax amount"
            />
          </div>

          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subtotal
            </label>
            <input
              type="text"
              value={editableData.subtotal || ''}
              onChange={(e) => handleFieldChange('subtotal', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Enter subtotal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="text"
              value={editableData.phone || ''}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Enter phone number"
            />
          </div> */}
        </div>
      </div>

      {/* <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address
        </label>
        <textarea
          value={editableData.address || ''}
          onChange={(e) => handleFieldChange('address', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          placeholder="Enter address"
          rows={2}
        />
      </div> */}

      {/* <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Line Items</h3>
          <button
            onClick={addItem}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            Add Item
          </button>
        </div>

        {editableData.items && editableData.items.length > 0 ? (
          <div className="space-y-3">
            {editableData.items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded">
                <input
                  type="text"
                  value={item.description || ''}
                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  placeholder="Item description"
                  className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
                <input
                  type="text"
                  value={item.quantity || ''}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  placeholder="Quantity"
                  className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
                <input
                  type="text"
                  value={item.price || ''}
                  onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                  placeholder="Price"
                  className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
                <button
                  onClick={() => removeItem(index)}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            No line items detected. Click &quot;Add Item&quot; to add items manually.
          </p>
        )}
      </div> */}
    </div>
  );
}