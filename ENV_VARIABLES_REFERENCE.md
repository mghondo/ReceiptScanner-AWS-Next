# Environment Variables Reference

## Files That Need Updated Environment Variables

### 1. `.env.local` (Main Configuration File)
This file contains all the environment variables. Update the placeholder values:

```bash
# AWS Configuration - NEW VALUES (UPDATE THESE)
AWS_ACCESS_KEY_ID=YOUR_NEW_ACCESS_KEY_HERE
AWS_SECRET_ACCESS_KEY=YOUR_NEW_SECRET_KEY_HERE
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=YOUR_NEW_BUCKET_NAME_HERE

# Next.js
NEXT_PUBLIC_AWS_REGION=us-east-1

# Google Places API - NEW VALUE (UPDATE THIS)
GOOGLE_PLACES_API_KEY=YOUR_NEW_GOOGLE_API_KEY_HERE
```

### 2. Files That Reference These Variables (No Changes Needed)
These files already properly reference the environment variables:

- `src/lib/aws-config.ts` - AWS configuration for Textract and S3
- `src/app/api/analyze-receipt/route.ts` - Uses AWS credentials for OCR
- `src/app/api/mileage/calculate/route.ts` - Uses Google API key for distance calculation
- `src/components/MileageEntry.tsx` - Uses Google API key for autocomplete

## Netlify Environment Variables
You need to add the MYNEW_ prefixed variables to Netlify:

1. Go to Netlify dashboard → Site settings → Environment variables
2. Add these MYNEW_ variables:
   - `MYNEW_AWS_ACCESS_KEY_ID`
   - `MYNEW_AWS_SECRET_ACCESS_KEY`
   - `MYNEW_AWS_REGION`
   - `MYNEW_AWS_S3_BUCKET_NAME`
   - `MYNEW_GOOGLE_PLACES_API_KEY`
   - `MYNEW_NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`
   - `MYNEW_NEXT_PUBLIC_AWS_REGION`

## Old Values (For Reference)
The old values have been commented out in `.env.local` and should be replaced with your new credentials.

## Required AWS Services
Your new AWS account needs these services configured:
1. **AWS Textract** - For OCR processing of receipts
2. **AWS S3** - For temporary file storage during processing
3. **Google Places API** - For mileage calculation and address autocomplete

## Testing
After updating the variables:
1. Test locally: `npm run dev`
2. Test receipt upload and OCR
3. Test mileage calculation
4. Deploy to Netlify: `netlify deploy --prod`