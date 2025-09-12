import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, AWS_CONFIG } from './aws-config';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  key: string;
  bucket: string;
}

export class S3Service {
  static async uploadFile(file: File): Promise<UploadResult> {
    const fileExtension = file.name.split('.').pop() || 'bin';
    const key = `receipts/${uuidv4()}.${fileExtension}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: AWS_CONFIG.s3BucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    try {
      await s3Client.send(command);
      return {
        key,
        bucket: AWS_CONFIG.s3BucketName,
      };
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error('Failed to upload file to S3');
    }
  }

  static async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: AWS_CONFIG.s3BucketName,
      Key: key,
    });

    try {
      await s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw new Error('Failed to delete file from S3');
    }
  }
}