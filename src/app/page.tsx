'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ReceiptTable from '@/components/ReceiptTable';
import { ExtractedReceiptData } from '@/lib/textract-service';

interface ErrorDetails {
  message: string;
  validationErrors?: string[];
  validationWarnings?: string[];
  details?: string;
  metadata?: {
    format?: string;
    width?: number;
    height?: number;
    size?: number;
    aspectRatio?: number;
  };
}

interface ReceiptEntry {
  id: string;
  data: ExtractedReceiptData;
  timestamp: Date;
}

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [error, setError] = useState<ErrorDetails | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    setError(null);

    console.log(`[MainPage] Received file from FileUpload:`, {
      name: file.name,
      type: file.type,
      size: file.size
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      console.log(`[MainPage] Uploading to server:`, {
        name: file.name,
        type: file.type,
        size: file.size
      });

      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle validation errors specially
        if (result.validationErrors) {
          setError({
            message: result.error || 'Image validation failed',
            validationErrors: result.validationErrors,
            validationWarnings: result.validationWarnings,
            details: result.details,
            metadata: result.validationMetadata || result.metadata
          });
        } else {
          setError({
            message: result.error || 'Failed to analyze receipt',
            details: result.details
          });
        }
        return;
      }

      // Add new receipt to the list (newest at top)
      const newReceipt: ReceiptEntry = {
        id: Date.now().toString(),
        data: result.data,
        timestamp: new Date()
      };
      setReceipts(prev => [newReceipt, ...prev]);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'An error occurred'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDataChange = (receiptId: string, newData: ExtractedReceiptData) => {
    setReceipts(prev => prev.map(receipt => 
      receipt.id === receiptId 
        ? { ...receipt, data: newData }
        : receipt
    ));
  };

  const handleExport = () => {
    if (receipts.length === 0) return;

    const allReceiptsData = receipts.map(receipt => ({
      id: receipt.id,
      timestamp: receipt.timestamp.toISOString(),
      ...receipt.data,
      rawData: undefined, // Don't include raw Textract data in export
    }));

    const dataStr = JSON.stringify(allReceiptsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetApp = () => {
    setReceipts([]);
    setError(null);
  };

  const removeReceipt = (receiptId: string) => {
    setReceipts(prev => prev.filter(receipt => receipt.id !== receiptId));
  };

  // Check if all receipts have required fields completed
  const areAllReceiptsComplete = () => {
    return receipts.length > 0 && receipts.every(receipt => 
      receipt.data.description && 
      receipt.data.description.trim() !== '' &&
      receipt.data.category && 
      receipt.data.category.trim() !== ''
    );
  };

  // Calculate total of all receipts
  const calculateTotal = () => {
    return receipts.reduce((total, receipt) => {
      const amount = parseFloat(receipt.data.total?.replace(/[^\d.-]/g, '') || '0');
      return total + amount;
    }, 0);
  };

  const handleProcessExpenseReport = () => {
    console.log('Processing expense report...');
    // TODO: Implement CSV generation logic
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Receipt Scanner MVP
            </h1>
            <p className="text-lg text-gray-600">
              Upload receipt images to extract data using AWS Textract
            </p>
          </header>

        <div className="mb-8">
          <FileUpload 
            onFileSelect={handleFileSelect} 
            isUploading={isUploading} 
          />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <h3 className="font-semibold mb-1">Error</h3>
            <p className="mb-2">{error.message}</p>
            
            {error.validationErrors && error.validationErrors.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 rounded">
                <p className="font-semibold text-sm mb-2">Validation Errors:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {error.validationErrors.map((err, index) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {error.validationWarnings && error.validationWarnings.length > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 rounded">
                <p className="font-semibold text-sm mb-2">Warnings:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {error.validationWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {error.details && (
              <div className="mt-3 p-3 bg-gray-50 rounded">
                <p className="font-semibold text-sm mb-1">Details:</p>
                <p className="text-sm">{error.details}</p>
              </div>
            )}
            
            {error.metadata && (
              <div className="mt-3 p-3 bg-gray-50 rounded">
                <p className="font-semibold text-sm mb-1">Image Information:</p>
                <div className="text-sm space-y-1">
                  {error.metadata.format && <p>Format: {error.metadata.format}</p>}
                  {error.metadata.width && <p>Dimensions: {error.metadata.width}x{error.metadata.height}px</p>}
                  {error.metadata.size && <p>Size: {(error.metadata.size / 1024 / 1024).toFixed(2)}MB</p>}
                </div>
              </div>
            )}
            
            <button
              onClick={resetApp}
              className="mt-3 text-sm underline hover:no-underline"
            >
              Try again with a different image
            </button>
          </div>
        )}

        {receipts.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">
                Scanned Receipts ({receipts.length})
              </h2>
              <div className="space-x-3">
                <button
                  onClick={resetApp}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <ReceiptTable
              receipts={receipts}
              onDataChange={handleDataChange}
              onRemoveReceipt={removeReceipt}
            />

            {/* Total and Process Button Section */}
            <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center">
                <div>
                  {areAllReceiptsComplete() && (
                    <button
                      onClick={handleProcessExpenseReport}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Process Expense Report
                    </button>
                  )}
                </div>
                
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${calculateTotal().toFixed(2)}
                  </p>
                </div>
              </div>
              
              {!areAllReceiptsComplete() && receipts.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-sm text-amber-700">
                    <span className="font-medium">Complete all required fields</span> (Purpose and Category) to process the expense report.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {receipts.length === 0 && !isUploading && !error && (
          <div className="text-center mt-12 text-gray-500">
            <h2 className="text-xl font-semibold mb-4">How it works:</h2>
            <ol className="space-y-2 text-left max-w-md mx-auto">
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
                Upload a receipt image (JPG, PNG) or PDF
              </li>
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
                AWS Textract extracts merchant, date, total, and items
              </li>
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
                Review and edit the extracted data
              </li>
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">4</span>
                Export the data as JSON
              </li>
            </ol>
          </div>
        )}
        </div>
      </div>
      
      <footer className="bg-blue-900 text-white py-6">
        <div className="text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} Morgo LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
