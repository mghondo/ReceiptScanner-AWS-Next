'use client';

import { useDropzone } from 'react-dropzone';
import { useState } from 'react';
import { ImageValidator } from '@/lib/image-validator';
import { ImageConverter } from '@/lib/image-converter';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onMultipleFilesSelect: (files: File[]) => void;
  isUploading?: boolean;
}

interface ConversionStatus {
  isConverting: boolean;
  format?: string;
  message?: string;
}

export default function FileUpload({ onFileSelect, onMultipleFilesSelect, isUploading = false }: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [conversionStatus, setConversionStatus] = useState<ConversionStatus>({ isConverting: false });

  const handleMultipleFiles = async (files: File[]) => {
    console.log(`[FileUpload] Processing ${files.length} files`);
    
    if (files.length > 10) {
      const proceed = confirm(
        `You've selected ${files.length} files. For best performance, we recommend processing 10 or fewer files at a time.\n\nDo you want to continue anyway?`
      );
      if (!proceed) return;
    }
    
    // Process each file through the same conversion logic as single files
    const processedFiles: File[] = [];
    const errors: string[] = [];
    
    setConversionStatus({ 
      isConverting: true, 
      message: `Processing ${files.length} files...` 
    });
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[FileUpload] Converting file ${i + 1}/${files.length}: ${file.name}`);
      
      try {
        // Apply the same conversion logic as single files
        const conversionResult = await ImageConverter.convertToJPEG(file);
        
        if (conversionResult.originalFormat && conversionResult.originalFormat !== 'jpeg' && conversionResult.originalFormat !== 'png') {
          if (!conversionResult.success) {
            console.error(`[FileUpload] Conversion failed for ${file.name}:`, conversionResult.error);
            errors.push(`${file.name}: Conversion failed - ${conversionResult.error}`);
            continue;
          }
        }
        
        const processedFile = conversionResult.file || file;
        
        // Validate the processed file
        const validationResult = await ImageValidator.validateImage(processedFile);
        
        if (!validationResult.isValid) {
          console.error(`[FileUpload] Validation failed for ${file.name}:`, validationResult.errors);
          errors.push(`${file.name}: ${validationResult.errors.join(', ')}`);
          continue;
        }
        
        processedFiles.push(processedFile);
        
      } catch (error) {
        console.error(`[FileUpload] Error processing ${file.name}:`, error);
        errors.push(`${file.name}: Processing error`);
      }
    }
    
    setConversionStatus({ isConverting: false });
    
    if (errors.length > 0) {
      setValidationWarnings(errors);
      alert(`Some files failed to process:\n${errors.join('\n')}\n\nSuccessful files will still be processed.`);
    }
    
    if (processedFiles.length > 0) {
      onMultipleFilesSelect(processedFiles);
    }
  };

  const handleFileProcessing = async (file: File) => {
    setValidationWarnings([]);
    
    console.log(`[FileUpload] Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);
    
    // Start spinner immediately for any file processing
    setConversionStatus({ 
      isConverting: true, 
      message: 'Processing image...' 
    });
    
    // Attempt to convert mobile formats to JPEG
    const conversionResult = await ImageConverter.convertToJPEG(file);
    
    console.log(`[FileUpload] Conversion result:`, {
      success: conversionResult.success,
      originalFormat: conversionResult.originalFormat,
      newFormat: conversionResult.format,
      hasConvertedFile: !!conversionResult.file,
      convertedFileName: conversionResult.file?.name,
      convertedFileType: conversionResult.file?.type,
      convertedFileSize: conversionResult.file?.size
    });
    
    // Handle conversion results
    if (conversionResult.originalFormat && conversionResult.originalFormat !== 'jpeg' && conversionResult.originalFormat !== 'png') {
      if (!conversionResult.success) {
        setConversionStatus({ isConverting: false });
        setValidationWarnings([`Cannot convert ${ImageConverter.getFormatDisplayName(conversionResult.originalFormat)} format. ${conversionResult.error || 'Please convert manually.'}`]);
        return;
      }
      
      if (conversionResult.file) {
        setValidationWarnings([`${ImageConverter.getFormatDisplayName(conversionResult.originalFormat)} image successfully converted to JPEG`]);
      }
    }
    
    const processedFile = conversionResult.file || file;
    
    console.log(`[FileUpload] Final processed file:`, {
      name: processedFile.name,
      type: processedFile.type,
      size: processedFile.size,
      isOriginalFile: processedFile === file,
      isConvertedFile: processedFile === conversionResult.file
    });
    
    // Client-side validation
    try {
      const validationResult = await ImageValidator.validateImage(processedFile);
      
      if (!validationResult.isValid) {
        setValidationWarnings(validationResult.errors);
        alert(`Image validation failed:\n${validationResult.errors.join('\n')}`);
        return;
      }
      
      if (validationResult.warnings.length > 0) {
        setValidationWarnings(validationResult.warnings);
      }
      
      // Set preview for images
      if (processedFile.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(processedFile);
        setPreview(previewUrl);
      } else {
        setPreview(null);
      }
      
      console.log(`[FileUpload] Calling onFileSelect with:`, {
        name: processedFile.name,
        type: processedFile.type,
        size: processedFile.size
      });
      
      // Stop the conversion spinner before passing to parent
      setConversionStatus({ isConverting: false });
      
      // Pass the processed file to parent component
      onFileSelect(processedFile);
      
    } catch (error) {
      console.error('Validation error:', error);
      setConversionStatus({ isConverting: false });
      setValidationWarnings(['Error validating image. Please try another file.']);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'],
      'application/pdf': ['.pdf']
    },
    multiple: true,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 1) {
        // Single file - use existing logic
        const file = acceptedFiles[0];
        await handleFileProcessing(file);
      } else if (acceptedFiles.length > 1) {
        // Multiple files - pass to parent for batch processing
        await handleMultipleFiles(acceptedFiles);
      }
    }
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} disabled={isUploading || conversionStatus.isConverting} />
        
        {conversionStatus.isConverting ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
            <p className="mt-2 text-sm text-gray-600">
              {conversionStatus.message || 'Converting image...'}
            </p>
          </div>
        ) : isUploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600">Processing receipt...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg
              className="w-12 h-12 text-gray-400 mb-4"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            
            {isDragActive ? (
              <p className="text-lg text-blue-600">Drop the receipt(s) here...</p>
            ) : (
              <div>
                <p className="text-lg text-gray-600 mb-2">
                  Drag & drop receipt(s) here, or click to select
                </p>
                <p className="text-sm text-gray-500 mb-1">
                  Supports JPG, PNG, PDF, HEIC (iPhone), and WebP (Android)
                </p>
                <p className="text-xs text-blue-600 font-medium">
                  💡 Select multiple files at once for batch processing! (Recommended: 10 or fewer)
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Mobile formats will be automatically converted to JPEG
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Validation warnings commented out - keeping for potential future use
      {validationWarnings.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-semibold text-yellow-800 mb-1">Validation Warnings:</p>
          <ul className="text-sm text-yellow-700 space-y-1">
            {validationWarnings.map((warning, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2">⚠️</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      */}
      
      {/* Preview removed to save space - focusing on table view */}
    </div>
  );
}