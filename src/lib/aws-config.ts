import { TextractClient } from '@aws-sdk/client-textract';
import { S3Client } from '@aws-sdk/client-s3';

export const textractClient = new TextractClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const AWS_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  s3BucketName: process.env.AWS_S3_BUCKET_NAME!,
};