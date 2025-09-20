import { NextRequest, NextResponse } from 'next/server';
import { TextractService } from '@/lib/textract-service';
import { S3Service } from '@/lib/s3-service';
import { ImageValidator } from '@/lib/image-validator';

export async function POST(request: NextRequest) {
  try {
    // Debug logging to check environment variables
    console.log('=== Environment Variables Debug ===');
    console.log('MYNEW_AWS_ACCESS_KEY_ID:', process.env.MYNEW_AWS_ACCESS_KEY_ID ? 'Found' : 'Missing');
    console.log('MYNEW_AWS_SECRET_ACCESS_KEY:', process.env.MYNEW_AWS_SECRET_ACCESS_KEY ? 'Found' : 'Missing');
    console.log('MYNEW_AWS_REGION:', process.env.MYNEW_AWS_REGION);
    console.log('MYNEW_AWS_S3_BUCKET_NAME:', process.env.MYNEW_AWS_S3_BUCKET_NAME);
    console.log('====================================');

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer for validation
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    // Comprehensive image validation
    console.log('=== Starting Image Validation ===');
    console.log('File name:', file.name);
    console.log('File type (claimed):', file.type);
    console.log('File size:', file.size, 'bytes');
    
    const validationResult = await ImageValidator.validateImageBuffer(buffer);
    
    console.log('Validation result:', {
      isValid: validationResult.isValid,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      metadata: validationResult.metadata
    });
    console.log('====================================');
    
    // Return validation errors if any
    if (!validationResult.isValid) {
      return NextResponse.json(
        { 
          error: 'Image validation failed',
          validationErrors: validationResult.errors,
          validationWarnings: validationResult.warnings,
          metadata: validationResult.metadata
        },
        { status: 400 }
      );
    }
    
    // Log warnings but continue processing
    if (validationResult.warnings.length > 0) {
      console.warn('Validation warnings:', validationResult.warnings);
    }

    let s3Object;
    let extractedData;

    try {
      console.log('Validation passed. Starting S3 upload...');
      // Create a new File object with the validated buffer to pass to S3
      const validatedFile = new File([buffer], file.name, { type: file.type });
      s3Object = await S3Service.uploadFile(validatedFile);
      console.log('S3 upload successful:', s3Object);
      
      console.log('Starting Textract analysis...');
      extractedData = await TextractService.analyzeExpense(s3Object);
      console.log('Textract analysis successful');
      
      console.log('Cleaning up S3 file...');
      await S3Service.deleteFile(s3Object.key);
      console.log('S3 cleanup successful');

      return NextResponse.json({
        success: true,
        data: extractedData
      });

    } catch (textractError: unknown) {
      console.error('=== Detailed Error Information ===');
      console.error('Error object:', textractError);
      
      if (textractError instanceof Error) {
        console.error('Error name:', textractError.name);
        console.error('Error message:', textractError.message);
        console.error('Error stack:', textractError.stack);
      }
      console.error('====================================');

      if (s3Object) {
        try {
          await S3Service.deleteFile(s3Object.key);
        } catch (cleanupError) {
          console.error('Error cleaning up S3 file:', cleanupError);
        }
      }

      if (textractError instanceof Error) {
        // Check for specific Textract errors
        if (textractError.message.includes('UnsupportedDocumentException')) {
          return NextResponse.json(
            { 
              error: 'Document format not supported by Textract',
              details: 'The image format or quality is not compatible with AWS Textract. Please ensure the image is clear and in JPEG, PNG, or PDF format.',
              validationMetadata: validationResult.metadata
            },
            { status: 400 }
          );
        }
        
        if (textractError.message.includes('credentials')) {
          return NextResponse.json(
            { error: 'AWS credentials not configured properly' },
            { status: 500 }
          );
        }
        
        if (textractError.message.includes('InvalidParameterException')) {
          return NextResponse.json(
            { 
              error: 'Invalid document parameters',
              details: 'The document does not meet Textract requirements. Check image dimensions and format.',
              validationMetadata: validationResult.metadata
            },
            { status: 400 }
          );
        }
      }

      return NextResponse.json(
        { 
          error: 'Failed to analyze receipt',
          details: textractError instanceof Error ? textractError.message : 'Unknown error occurred',
          validationMetadata: validationResult.metadata
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Receipt analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}