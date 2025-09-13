'use client';

import { useState } from 'react';

interface MileageEntryData {
  id: string;
  date: string;
  startAddress: string;
  endAddress: string;
  businessPurpose: string;
  roundTrip: boolean;
  personalCommute: number;
  calculatedDistance: number;
  reimbursableDistance: number;
  reimbursableAmount: number;
  createdAt: Date;
}

interface MileageListProps {
  entries: MileageEntryData[];
  onRemoveEntry: (id: string) => void;
  onExport: () => void;
}

export default function MileageList({ entries, onRemoveEntry, onExport }: MileageListProps) {
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const toggleDetails = (id: string) => {
    setShowDetails(showDetails === id ? null : id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const totalReimbursableAmount = entries.reduce(
    (sum, entry) => sum + entry.reimbursableAmount,
    0
  );

  const totalReimbursableMiles = entries.reduce(
    (sum, entry) => sum + entry.reimbursableDistance,
    0
  );

  if (entries.length === 0) {
    return (
      <div className="text-center mt-12 text-gray-500">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <svg className="mx-auto h-24 w-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 6-3v13l-6 3-6-3z" />
          </svg>
          <h3 className="text-xl font-semibold mb-2">No Mileage Entries Yet</h3>
          <p className="text-gray-600">Add your first mileage entry using the form above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Mileage Entries ({entries.length})
            </h2>
            <p className="text-gray-600">
              Total: {totalReimbursableMiles.toFixed(1)} reimbursable miles
            </p>
          </div>
          <div className="text-right mt-4 md:mt-0">
            <p className="text-sm text-gray-600">Total Reimbursement</p>
            <p className="text-3xl font-bold text-blue-600">
              ${totalReimbursableAmount.toFixed(2)}
            </p>
            <button
              onClick={onExport}
              className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Export to Excel
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Table View - Hidden on Mobile */}
      <div className="hidden md:block bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Purpose
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Miles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                  {formatDate(entry.date)}
                </td>
                <td className="px-6 py-4 text-sm text-black">
                  <div className="max-w-xs truncate">
                    <span className="font-medium">From:</span> {entry.startAddress}
                  </div>
                  <div className="max-w-xs truncate text-gray-600">
                    <span className="font-medium">To:</span> {entry.endAddress}
                  </div>
                  {entry.roundTrip && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 mt-1">
                      Round Trip
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-black">
                  <div className="max-w-xs truncate">
                    {entry.businessPurpose}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                  <div>{entry.reimbursableDistance.toFixed(1)}</div>
                  {entry.personalCommute > 0 && (
                    <div className="text-xs text-gray-500">
                      ({entry.calculatedDistance.toFixed(1)} - {entry.personalCommute.toFixed(1)})
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                  ${entry.reimbursableAmount.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => onRemoveEntry(entry.id)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View - Visible on Mobile */}
      <div className="block md:hidden space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="bg-white rounded-lg shadow-lg border border-gray-200">
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-black">{formatDate(entry.date)}</h3>
                  <p className="text-sm text-gray-600 truncate">{entry.businessPurpose}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">${entry.reimbursableAmount.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">{entry.reimbursableDistance.toFixed(1)} miles</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => toggleDetails(entry.id)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {showDetails === entry.id ? 'Hide Details' : 'Show Details'}
                </button>
                <button
                  onClick={() => onRemoveEntry(entry.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>

              {showDetails === entry.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-black">From:</span>
                    <p className="text-gray-600">{entry.startAddress}</p>
                  </div>
                  <div>
                    <span className="font-medium text-black">To:</span>
                    <p className="text-gray-600">{entry.endAddress}</p>
                  </div>
                  <div className="flex justify-between text-black">
                    <span>Total Distance:</span>
                    <span>{entry.calculatedDistance.toFixed(1)} miles</span>
                  </div>
                  {entry.personalCommute > 0 && (
                    <div className="flex justify-between text-black">
                      <span>Personal Commute:</span>
                      <span>-{entry.personalCommute.toFixed(1)} miles</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium text-black">
                    <span>Reimbursable:</span>
                    <span>{entry.reimbursableDistance.toFixed(1)} miles</span>
                  </div>
                  {entry.roundTrip && (
                    <div className="flex justify-center mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        Round Trip
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}