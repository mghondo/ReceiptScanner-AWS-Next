export interface ConversionResult {
  success: boolean;
  file?: File;
  format?: string;
  error?: string;
  originalFormat?: string;
}

export class ImageConverter {
  /**
   * Converts various mobile image formats to JPEG
   */
  static async convertToJPEG(file: File): Promise<ConversionResult> {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    
    // Detect format from file extension or MIME type
    const format = this.detectFormat(fileName, fileType);
    
    console.log(`[ImageConverter] Detected format: ${format} for file: ${file.name}`);
    
    try {
      // Handle HEIC/HEIF conversion
      if (format === 'heic' || format === 'heif') {
        return await this.convertHEICToJPEG(file);
      }
      
      // Handle WebP conversion
      if (format === 'webp') {
        return await this.convertWebPToJPEG(file);
      }
      
      // Already JPEG or PNG - no conversion needed
      if (format === 'jpeg' || format === 'jpg' || format === 'png') {
        return {
          success: true,
          file: file,
          format: format,
          originalFormat: format
        };
      }
      
      // Unsupported format
      return {
        success: false,
        error: `Unsupported format: ${format}`,
        originalFormat: format
      };
      
    } catch (error) {
      console.error('[ImageConverter] Conversion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Conversion failed',
        originalFormat: format
      };
    }
  }
  
  /**
   * Detect image format from filename and MIME type
   */
  private static detectFormat(fileName: string, mimeType: string): string {
    console.log(`[ImageConverter] detectFormat() called with fileName: "${fileName}", mimeType: "${mimeType}"`);
    
    const lowerFileName = fileName.toLowerCase();
    const lowerMimeType = mimeType.toLowerCase();
    
    console.log(`[ImageConverter] Checking extensions against: "${lowerFileName}"`);
    
    // Check file extension first (case-insensitive)
    if (lowerFileName.endsWith('.heic') || lowerFileName.endsWith('.heif')) {
      console.log(`[ImageConverter] Detected format: heic (by extension)`);
      return 'heic';
    }
    if (lowerFileName.endsWith('.webp')) {
      console.log(`[ImageConverter] Detected format: webp (by extension)`);
      return 'webp';
    }
    if (lowerFileName.endsWith('.jpg') || lowerFileName.endsWith('.jpeg')) {
      console.log(`[ImageConverter] Detected format: jpeg (by extension)`);
      return 'jpeg';
    }
    if (lowerFileName.endsWith('.png')) {
      console.log(`[ImageConverter] Detected format: png (by extension)`);
      return 'png';
    }
    
    console.log(`[ImageConverter] No extension match, checking MIME type: "${lowerMimeType}"`);
    
    // Check MIME type (case-insensitive)
    if (lowerMimeType.includes('heic') || lowerMimeType.includes('heif')) {
      console.log(`[ImageConverter] Detected format: heic (by MIME type)`);
      return 'heic';
    }
    if (lowerMimeType.includes('webp')) {
      console.log(`[ImageConverter] Detected format: webp (by MIME type)`);
      return 'webp';
    }
    if (lowerMimeType.includes('jpeg') || lowerMimeType.includes('jpg')) {
      console.log(`[ImageConverter] Detected format: jpeg (by MIME type)`);
      return 'jpeg';
    }
    if (lowerMimeType.includes('png')) {
      console.log(`[ImageConverter] Detected format: png (by MIME type)`);
      return 'png';
    }
    
    console.log(`[ImageConverter] No format detected, defaulting to unknown`);
    // Default to unknown
    return 'unknown';
  }
  
  /**
   * Convert HEIC/HEIF to JPEG using heic2any
   */
  private static async convertHEICToJPEG(file: File): Promise<ConversionResult> {
    try {
      console.log('[ImageConverter] Converting HEIC to JPEG...');
      
      // Dynamically import to avoid SSR issues
      const heic2any = (await import('heic2any')).default;
      
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.92 // High quality for receipts
      });
      
      // heic2any might return an array or single blob
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      
      // Create new file with .jpg extension
      const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      const convertedFile = new File([blob], newFileName, { 
        type: 'image/jpeg' 
      });
      
      console.log('[ImageConverter] HEIC conversion successful');
      
      return {
        success: true,
        file: convertedFile,
        format: 'jpeg',
        originalFormat: 'heic'
      };
      
    } catch (error) {
      console.error('[ImageConverter] HEIC conversion failed:', error);
      throw error;
    }
  }
  
  /**
   * Convert WebP to JPEG using Canvas API
   */
  private static async convertWebPToJPEG(file: File): Promise<ConversionResult> {
    return new Promise((resolve, reject) => {
      console.log('[ImageConverter] Converting WebP to JPEG...');
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          try {
            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Failed to get canvas context');
            }
            
            // Draw white background (for transparency handling)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw image
            ctx.drawImage(img, 0, 0);
            
            // Convert to blob
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Failed to convert WebP to JPEG'));
                  return;
                }
                
                // Create new file with .jpg extension
                const newFileName = file.name.replace(/\.webp$/i, '.jpg');
                const convertedFile = new File([blob], newFileName, { 
                  type: 'image/jpeg' 
                });
                
                console.log('[ImageConverter] WebP conversion successful');
                
                resolve({
                  success: true,
                  file: convertedFile,
                  format: 'jpeg',
                  originalFormat: 'webp'
                });
              },
              'image/jpeg',
              0.92 // High quality for receipts
            );
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load WebP image'));
        };
        
        img.src = e.target?.result as string;
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read WebP file'));
      };
      
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Get user-friendly format name
   */
  static getFormatDisplayName(format: string): string {
    const formatNames: Record<string, string> = {
      'heic': 'HEIC (iPhone)',
      'heif': 'HEIF (iPhone)',
      'webp': 'WebP',
      'jpeg': 'JPEG',
      'jpg': 'JPEG',
      'png': 'PNG',
      'pdf': 'PDF',
      'unknown': 'Unknown'
    };
    
    return formatNames[format.toLowerCase()] || format.toUpperCase();
  }
}