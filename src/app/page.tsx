'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ReceiptTable from '@/components/ReceiptTable';
import { ExtractedReceiptData } from '@/lib/textract-service';
import { PDFGenerator } from '@/lib/pdf-generator';

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
  originalImage?: {
    file: File;
    dataUrl: string;
  };
}

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [employeeName, setEmployeeName] = useState('');
  const [generatedReport, setGeneratedReport] = useState<{excelBuffer: Buffer, fileName: string} | null>(null);
  const [hasEditsAfterGeneration, setHasEditsAfterGeneration] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);

  const handleMultipleFiles = async (files: File[]) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress({ current: 0, total: files.length, fileName: '' });

    console.log(`[MainPage] Processing ${files.length} files in batch`);

    const newReceipts: ReceiptEntry[] = [];
    const errors: string[] = [];

    // Files are already processed (HEIC converted, validated) by FileUpload component
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });
      
      try {
        console.log(`[MainPage] Processing file ${i + 1}/${files.length}: ${file.name}`);
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/analyze-receipt', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.error(`[MainPage] Server error for ${file.name}:`, result);
          errors.push(`${file.name}: ${result.error || 'Upload failed'}`);
          continue;
        }
        
        if (result.success && result.data) {
          // Create image data URL for PDF generation
          const imageDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
          
          const newReceipt: ReceiptEntry = {
            id: `${Date.now()}-${i}`,
            data: result.data,
            timestamp: new Date(),
            originalImage: {
              file: file,
              dataUrl: imageDataUrl
            }
          };
          newReceipts.push(newReceipt);
          console.log(`[MainPage] Successfully processed ${file.name}`);
        } else {
          console.error(`[MainPage] Processing failed for ${file.name}:`, result);
          errors.push(`${file.name}: ${result.error || 'Processing failed'}`);
        }
      } catch (err) {
        console.error(`[MainPage] Error processing ${file.name}:`, err);
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Add all successful receipts to the list
    if (newReceipts.length > 0) {
      setReceipts(prev => [...newReceipts, ...prev]);
    }

    // Show errors if any
    if (errors.length > 0) {
      setError({
        message: `${errors.length} file(s) failed to process`,
        details: errors.join('\n')
      });
    }

    setUploadProgress(null);
    setIsUploading(false);
    
    console.log(`[MainPage] Batch processing complete. Processed ${newReceipts.length}/${files.length} files successfully.`);
  };

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

      // Create image data URL for PDF generation
      const imageDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      
      // Add new receipt to the list (newest at top)
      const newReceipt: ReceiptEntry = {
        id: Date.now().toString(),
        data: result.data,
        timestamp: new Date(),
        originalImage: {
          file: file,
          dataUrl: imageDataUrl
        }
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
    
    // Mark that edits have been made after generation
    if (generatedReport) {
      setHasEditsAfterGeneration(true);
    }
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
    setGeneratedReport(null);
  };

  const handleDownloadReport = () => {
    if (!generatedReport) return;
    
    const blob = new Blob([generatedReport.excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = generatedReport.fileName;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('[MainPage] Excel download initiated');
  };

  const handleDownloadReceiptsPDF = async () => {
    if (receipts.length === 0 || !employeeName.trim()) return;
    
    console.log('[MainPage] Generating receipts PDF...');
    
    try {
      const pdfBlob = await PDFGenerator.generateReceiptsPDF({
        employeeName,
        receipts
      });
      
      PDFGenerator.downloadPDF(pdfBlob, employeeName);
      console.log('[MainPage] Receipts PDF download initiated');
    } catch (error) {
      console.error('[MainPage] Error generating receipts PDF:', error);
      setError({
        message: 'Failed to generate receipts PDF',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  const removeReceipt = (receiptId: string) => {
    setReceipts(prev => prev.filter(receipt => receipt.id !== receiptId));
    
    // Mark that edits have been made after generation
    if (generatedReport) {
      setHasEditsAfterGeneration(true);
    }
  };

  // Check if all receipts have required fields completed
  const areAllReceiptsComplete = () => {
    return receipts.length > 0 && 
           employeeName.trim() !== '' &&
           receipts.every(receipt => 
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

  const handleProcessExpenseReport = async () => {
    console.log('[MainPage] Processing expense report...');
    console.log('[MainPage] Employee name:', employeeName);
    console.log('[MainPage] Receipts count:', receipts.length);
    console.log('[MainPage] Receipts data:', receipts);
    
    try {
      console.log('[MainPage] Preparing expense report data');
      
      const expenseReportData = {
        employeeName,
        receipts,
        weekEndingDate: new Date().toLocaleDateString('en-US') // Current date as week ending
      };
      
      console.log('[MainPage] Expense report data prepared:', expenseReportData);
      console.log('[MainPage] Calling API to generate Excel');
      
      // Call the API endpoint to generate the Excel file on the server
      const response = await fetch('/api/generate-expense-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseReportData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to generate expense report');
      }
      
      // Get the Excel buffer from the response
      const excelBuffer = await response.arrayBuffer();
      console.log('[MainPage] Excel received from API, size:', excelBuffer.byteLength);
      
      console.log('[MainPage] Storing generated report for UI display');
      const sanitizedName = employeeName.replace(/[^a-zA-Z0-9]/g, '_');
      // Use US Eastern time for filename
      const easternTime = new Date().toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');
      const fileName = `expense_report_${sanitizedName}_${easternTime}.xlsx`;
      
      setGeneratedReport({
        excelBuffer: Buffer.from(excelBuffer),
        fileName
      });
      
      // Reset edit tracking since we just generated a fresh report
      setHasEditsAfterGeneration(false);
      
      console.log('[MainPage] Report generation completed and stored');
      
    } catch (error) {
      console.error('[MainPage] Error processing expense report:', error);
      console.error('[MainPage] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      setError({
        message: 'Failed to generate expense report',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Morgo Receipt Scanner MVP
            </h1>
            <p className="text-lg text-gray-600">
              Upload receipt images to extract data using AWS Textract
            </p>
            <p className="text-lg text-gray-600 bold mt-1">
              Recommended: 10 images or less at a time.
            </p>
          </header>

        <div className="mb-8">
          <FileUpload 
            onFileSelect={handleFileSelect} 
            onMultipleFilesSelect={handleMultipleFiles}
            isUploading={isUploading} 
          />
          
          {/* Upload Progress */}
          {uploadProgress && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">
                  Processing files: {uploadProgress.current} of {uploadProgress.total}
                </span>
                <span className="text-xs text-blue-600">
                  {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-blue-600">
                Current: {uploadProgress.fileName}
              </div>
            </div>
          )}
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

            {/* Employee Name Input */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee Name <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={employeeName}
                onChange={(e) => {
                  setEmployeeName(e.target.value);
                  // Mark that edits have been made after generation
                  if (generatedReport) {
                    setHasEditsAfterGeneration(true);
                  }
                }}
                className={`w-full max-w-md p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                  !employeeName.trim() 
                    ? 'border-amber-400 bg-amber-50' 
                    : 'border-gray-300'
                }`}
                placeholder="Enter employee name for expense report"
              />
            </div>
            
            <ReceiptTable
              receipts={receipts}
              onDataChange={handleDataChange}
              onRemoveReceipt={removeReceipt}
            />

            {/* Total and Process Button Section */}
            <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  {areAllReceiptsComplete() && (!generatedReport || hasEditsAfterGeneration) && (
                    <button
                      onClick={handleProcessExpenseReport}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      {hasEditsAfterGeneration ? 'Re-Process Expense Report' : 'Process Expense Report'}
                    </button>
                  )}
                  
                  {generatedReport && !hasEditsAfterGeneration && (
                    <div className="flex items-center space-x-4">
                      {/* Creative File Icon */}
                      <div className="flex items-center space-x-3 bg-green-50 px-4 py-3 rounded-lg border border-green-200">
                        <div className="relative">
                          {/* File Icon with CSV Badge */}
                          <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                          {/* Excel Badge */}
                          <div className="absolute -top-1 -right-1 bg-green-600 text-white text-xs px-1 py-0.5 rounded-full font-bold">
                            XLSX
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-800">Expense Report Generated</p>
                          <p className="text-xs text-green-600">{generatedReport.fileName}</p>
                        </div>
                      </div>
                      
                      {/* Download Button */}
                      <button
                        onClick={handleDownloadReport}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Download Excel</span>
                      </button>
                      
                      {/* Download PDF Button */}
                      <button
                        onClick={handleDownloadReceiptsPDF}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                        title="Download all receipt images as PDF"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>Download PDF of Receipts</span>
                      </button>
                    </div>
                  )}
                  
                  {generatedReport && hasEditsAfterGeneration && (
                    <div className="flex items-center space-x-4">
                      {/* Modified File Icon */}
                      <div className="flex items-center space-x-3 bg-amber-50 px-4 py-3 rounded-lg border border-amber-200">
                        <div className="relative">
                          <svg className="w-8 h-8 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                          {/* Modified Badge */}
                          <div className="absolute -top-1 -right-1 bg-amber-600 text-white text-xs px-1 py-0.5 rounded-full font-bold">
                            !
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-amber-800">Report Modified</p>
                          <p className="text-xs text-amber-600">Changes detected - re-process to update</p>
                        </div>
                      </div>
                      
                      {/* Download Previous Button */}
                      <button
                        onClick={handleDownloadReport}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                        title="Download previous version (before edits)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Download Old Excel</span>
                      </button>
                      
                      {/* Download PDF Button */}
                      <button
                        onClick={handleDownloadReceiptsPDF}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                        title="Download all receipt images as PDF"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>Download PDF of Receipts</span>
                      </button>
                    </div>
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
                    <span className="font-medium">Complete all required fields</span> (Employee Name, Purpose, and Category) to process the expense report.
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
