import sizeOf from 'image-size';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    format?: string;
    width?: number;
    height?: number;
    size?: number;
    aspectRatio?: number;
  };
}

export class ImageValidator {
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly MIN_DIMENSION = 50;
  private static readonly MAX_DIMENSION = 10000;
  private static readonly MIN_RESOLUTION = 100 * 100; // 100x100 pixels minimum
  private static readonly RECOMMENDED_MIN_RESOLUTION = 300 * 300; // For quality warning
  
  // Magic bytes for file type verification - improved detection for mobile formats
  private static readonly MAGIC_BYTES = {
    jpeg: [0xFF, 0xD8], // Just FF D8 for JPEG start, third byte varies (JFIF=FF, EXIF=E0/E1)
    png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
    webp: [0x52, 0x49, 0x46, 0x46], // RIFF (WebP starts with RIFF....WEBP)
    heic: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], // HEIC ftypheic
  };

  /**
   * Validates an image file for Textract compatibility
   */
  static async validateImage(file: File): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: {
      format?: string;
      width?: number;
      height?: number;
      size?: number;
      aspectRatio?: number;
    } = {
      size: file.size,
      format: file.type,
    };

    // 1. Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 5MB`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
      return { isValid: false, errors, warnings, metadata };
    }

    // 2. Detect actual format using multiple methods
    let actualFormat: string | null = null;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    // Primary: Use image-size library (most reliable)
    try {
      const dimensions = sizeOf(buffer);
      actualFormat = dimensions.type || null;
      
      // Normalize format names
      if (actualFormat === 'jpg') actualFormat = 'jpeg';
      
      console.log(`Format detection via image-size: ${actualFormat}`);
      
    } catch (error) {
      console.warn('image-size detection failed:', error);
    }
    
    // Fallback: Magic bytes if image-size failed
    if (!actualFormat) {
      actualFormat = await this.verifyMagicBytesFromBuffer(buffer);
      console.log(`Format detection via magic bytes: ${actualFormat}`);
    }
    
    // Final result
    if (!actualFormat) {
      warnings.push('File format could not be verified. Processing will continue but may fail.');
      metadata.format = file.type; // Use claimed MIME type as fallback
    } else {
      metadata.format = actualFormat;
      console.log(`Final detected format: ${actualFormat}`);
      
      // Check if format is supported
      if (!['jpeg', 'png', 'pdf'].includes(actualFormat)) {
        if (actualFormat === 'heic') {
          warnings.push('HEIC format detected. File will be converted to JPEG.');
        } else {
          errors.push(`Unsupported file format: ${actualFormat}. Only JPEG, PNG, and PDF are supported.`);
        }
      }
    }

    // 3. For images (not PDFs), try to get dimensions but don't block on failure
    if (actualFormat && ['jpeg', 'png', 'heic'].includes(actualFormat)) {
      try {
        // Use the buffer we already have
        const dimensions = sizeOf(buffer);
        
        if (dimensions.width && dimensions.height) {
          metadata.width = dimensions.width;
          metadata.height = dimensions.height;
          metadata.aspectRatio = dimensions.width / dimensions.height;

          // Warn for extreme dimensions (don't block)
          if (dimensions.width < this.MIN_DIMENSION || dimensions.height < this.MIN_DIMENSION) {
            warnings.push(`Image dimensions (${dimensions.width}x${dimensions.height}) are small. Minimum recommended: 50x50px`);
          }

          if (dimensions.width > this.MAX_DIMENSION || dimensions.height > this.MAX_DIMENSION) {
            warnings.push(`Image dimensions (${dimensions.width}x${dimensions.height}) are very large. Maximum supported: 10000x10000px`);
          }

          // Check resolution for quality warnings
          const resolution = dimensions.width * dimensions.height;
          if (resolution < this.RECOMMENDED_MIN_RESOLUTION) {
            warnings.push(`Image resolution is low (${dimensions.width}x${dimensions.height}). For better OCR results, use higher resolution images.`);
          }

          // Check aspect ratio
          if (metadata.aspectRatio > 10 || metadata.aspectRatio < 0.1) {
            warnings.push(`Extreme aspect ratio detected (${metadata.aspectRatio.toFixed(2)}). This may affect OCR accuracy.`);
          }
        } else {
          warnings.push('Could not determine image dimensions. Processing will continue but results may vary.');
        }

      } catch (error) {
        console.warn('Error checking image dimensions:', error);
        warnings.push('Could not analyze image dimensions. This is usually not a problem for receipt scanning.');
      }
    }

    // 4. Additional PDF validation
    if (actualFormat === 'pdf') {
      // Basic PDF validation is done through magic bytes
      // Textract will handle more complex PDF validation
      metadata.format = 'pdf';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata
    };
  }

  /**
   * Verify the actual file format using magic bytes from buffer
   */
  private static verifyMagicBytesFromBuffer(buffer: Uint8Array): string | null {
    const bytes = buffer.slice(0, 16);

    // Check JPEG - improved detection
    if (this.matchesMagicBytes(bytes, this.MAGIC_BYTES.jpeg)) {
      return 'jpeg';
    }

    // Check PNG
    if (this.matchesMagicBytes(bytes, this.MAGIC_BYTES.png)) {
      return 'png';
    }

    // Check PDF
    if (this.matchesMagicBytes(bytes, this.MAGIC_BYTES.pdf)) {
      return 'pdf';
    }

    // Check WebP (RIFF....WEBP format)
    if (this.matchesMagicBytes(bytes, this.MAGIC_BYTES.webp) && bytes.length >= 12) {
      const webpBytes = Array.from(bytes.slice(8, 12));
      if (webpBytes.every((b, i) => b === [0x57, 0x45, 0x42, 0x50][i])) { // WEBP
        return 'webp';
      }
    }

    // Check HEIC (more complex check)
    if (bytes.length >= 12) {
      const ftypBytes = Array.from(bytes.slice(4, 8));
      const brandBytes = Array.from(bytes.slice(8, 12));
      
      if (ftypBytes.every((b, i) => b === [0x66, 0x74, 0x79, 0x70][i])) {
        const brand = String.fromCharCode(...brandBytes);
        if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') {
          return 'heic';
        }
      }
    }

    return null;
  }

  /**
   * Verify the actual file format using magic bytes (legacy method)
   */
  private static async verifyMagicBytes(file: File): Promise<string | null> {
    try {
      const buffer = await file.slice(0, 16).arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Check JPEG
      if (this.matchesMagicBytes(bytes, this.MAGIC_BYTES.jpeg)) {
        return 'jpeg';
      }

      // Check PNG
      if (this.matchesMagicBytes(bytes, this.MAGIC_BYTES.png)) {
        return 'png';
      }

      // Check PDF
      if (this.matchesMagicBytes(bytes, this.MAGIC_BYTES.pdf)) {
        return 'pdf';
      }

      // Check HEIC (more complex check)
      if (bytes.length >= 12) {
        const ftypBytes = Array.from(bytes.slice(4, 8));
        const brandBytes = Array.from(bytes.slice(8, 12));
        
        if (ftypBytes.every((b, i) => b === [0x66, 0x74, 0x79, 0x70][i])) {
          const brand = String.fromCharCode(...brandBytes);
          if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') {
            return 'heic';
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error reading file magic bytes:', error);
      return null;
    }
  }

  /**
   * Check if bytes match magic bytes pattern
   */
  private static matchesMagicBytes(bytes: Uint8Array, pattern: number[]): boolean {
    if (bytes.length < pattern.length) return false;
    return pattern.every((byte, index) => bytes[index] === byte);
  }

  // Removed custom dimension extraction - now using image-size library

  /**
   * Server-side validation for Next.js API routes
   */
  static async validateImageBuffer(buffer: Uint8Array): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const metadata: {
      format?: string;
      width?: number;
      height?: number;
      size?: number;
      aspectRatio?: number;
    } = {
      size: buffer.length,
    };

    // 1. Check file size
    if (buffer.length > this.MAX_FILE_SIZE) {
      errors.push(`File size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 5MB`);
    }

    if (buffer.length === 0) {
      errors.push('File is empty');
      return { isValid: false, errors, warnings, metadata };
    }

    // 2. Detect format using image-size then fallback to magic bytes
    let actualFormat: string | null = null;
    
    // Primary: Use image-size library (most reliable)
    try {
      const dimensions = sizeOf(buffer);
      actualFormat = dimensions.type || null;
      
      // Normalize format names
      if (actualFormat === 'jpg') actualFormat = 'jpeg';
      
      console.log(`[Server] Format detection via image-size: ${actualFormat}`);
      
    } catch (error) {
      console.warn('[Server] image-size detection failed:', error);
    }
    
    // Fallback: Magic bytes if image-size failed
    if (!actualFormat) {
      actualFormat = this.verifyMagicBytesFromBuffer(buffer);
      console.log(`[Server] Format detection via magic bytes: ${actualFormat}`);
    }
    
    // Final result
    if (!actualFormat) {
      warnings.push('File format could not be verified from magic bytes. Processing will continue.');
      actualFormat = 'unknown';
    } else {
      metadata.format = actualFormat;
      console.log(`[Server] Final detected format: ${actualFormat}`);
      
      if (!['jpeg', 'png', 'pdf'].includes(actualFormat)) {
        errors.push(`Unsupported file format: ${actualFormat}. Only JPEG, PNG, and PDF are supported.`);
      }
    }

    // 3. Try to get image dimensions for metadata (don't block on failure)
    if (actualFormat && ['jpeg', 'png'].includes(actualFormat)) {
      try {
        const dimensions = sizeOf(buffer);
        if (dimensions.width && dimensions.height) {
          metadata.width = dimensions.width;
          metadata.height = dimensions.height;
          metadata.aspectRatio = dimensions.width / dimensions.height;
          
          // Only warn for extreme cases
          if (dimensions.width > this.MAX_DIMENSION || dimensions.height > this.MAX_DIMENSION) {
            warnings.push(`Image dimensions (${dimensions.width}x${dimensions.height}) are very large. Processing may be slow.`);
          }
          
          if (dimensions.width < 50 || dimensions.height < 50) {
            warnings.push(`Image dimensions (${dimensions.width}x${dimensions.height}) are small. OCR results may vary.`);
          }
        }
      } catch (error) {
        console.warn('Server-side dimension check failed:', error);
        warnings.push('Could not determine image dimensions on server-side. This is usually not a problem.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata
    };
  }
}