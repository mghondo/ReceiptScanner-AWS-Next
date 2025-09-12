# Receipt Scanner MVP

A Next.js application that uses AWS Textract to extract data from receipt images. Upload receipts and get structured data including merchant name, total amount, date, tax, and line items.

## Features

- 📁 **File Upload**: Drag & drop interface for receipt images (JPG, PNG, PDF)
- 🔍 **OCR Processing**: AWS Textract Analyze Expense API integration
- ✏️ **Editable Results**: Review and edit extracted data
- 💾 **JSON Export**: Export extracted data as JSON
- ☁️ **AWS S3**: Temporary file storage during processing
- 🎨 **Modern UI**: Clean, responsive interface built with Tailwind CSS

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- AWS Account with:
  - IAM user with Textract and S3 permissions
  - S3 bucket for temporary file storage

### 2. AWS Configuration

#### Create IAM Policy
Create an IAM policy with the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "textract:AnalyzeExpense"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

#### Create IAM User
1. Create a new IAM user
2. Attach the policy created above
3. Generate access keys for programmatic access

#### Create S3 Bucket
1. Create an S3 bucket in your preferred region
2. Note the bucket name for configuration

### 3. Environment Setup

1. Copy the environment variables:
```bash
cp .env.local .env.local.example
```

2. Update `.env.local` with your AWS credentials:
```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-receipt-bucket-name

# Next.js
NEXT_PUBLIC_AWS_REGION=us-east-1
```

### 4. Installation & Development

Install dependencies:
```bash
npm install
```

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload Receipt**: Drag and drop a receipt image or PDF, or click to select a file
2. **Processing**: The app uploads to S3, processes with Textract, then cleans up the temporary file
3. **Review Data**: Edit the extracted data in the form fields
4. **Export**: Click "Export JSON" to download the structured data

## Supported File Types

- **Images**: JPG, JPEG, PNG (max 5MB)
- **Documents**: PDF (max 5MB)

## Project Structure

```
src/
├── app/
│   ├── api/analyze-receipt/route.ts    # API endpoint for receipt processing
│   ├── layout.tsx                      # Root layout
│   └── page.tsx                        # Main application page
├── components/
│   ├── FileUpload.tsx                  # Drag & drop file upload component
│   └── ReceiptResults.tsx              # Editable results display
└── lib/
    ├── aws-config.ts                   # AWS SDK configuration
    ├── s3-service.ts                   # S3 upload/delete operations
    └── textract-service.ts             # Textract expense analysis
```

## Error Handling

The application includes comprehensive error handling for:
- Invalid file types or sizes
- AWS credential issues
- Network connectivity problems
- Textract processing failures
- S3 upload/download errors

## Security Notes

- Files are temporarily stored in S3 and automatically deleted after processing
- AWS credentials are never exposed to the client
- File uploads are validated for type and size
- No authentication required for this MVP

## Limitations

- Maximum file size: 5MB
- Supports common receipt formats but accuracy may vary
- Requires AWS credentials and S3 bucket setup
- No persistent data storage (MVP only)

## Next Steps

For production use, consider adding:
- User authentication
- Database storage for receipt history
- Batch processing capabilities
- Advanced OCR validation
- Mobile app support
