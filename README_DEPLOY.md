# Deployment Instructions for Netlify

Your Next.js expense tracking application is now ready for deployment to Netlify!

## What's Been Configured

1. **Next.js Configuration** - Optimized for Netlify deployment with API routes support
2. **Netlify Configuration** (`netlify.toml`) - Configured with the Next.js plugin
3. **Build Settings** - Production build is ready with all TypeScript errors fixed

## Deployment Steps

### Option 1: Deploy from Git Repository

1. Push your code to GitHub/GitLab/Bitbucket:
   ```bash
   git add .
   git commit -m "Prepare for Netlify deployment"
   git push origin main
   ```

2. Go to [Netlify](https://app.netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect your Git provider and select your repository
5. Netlify will auto-detect the build settings from `netlify.toml`
6. Click "Deploy site"

### Option 2: Manual Deploy (Drag & Drop)

1. Build the project locally:
   ```bash
   npm run build
   ```

2. Install Netlify CLI (if not already installed):
   ```bash
   npm install -g netlify-cli
   ```

3. Deploy to Netlify:
   ```bash
   netlify deploy --prod --dir=.next
   ```

### Option 3: Direct CLI Deploy (Recommended)

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Initialize and deploy:
   ```bash
   netlify init
   netlify deploy --prod
   ```

## Environment Variables

If you have AWS credentials configured in your `.env.local` file, you'll need to add them to Netlify:

1. Go to your site settings on Netlify
2. Navigate to "Environment variables"
3. Add the following variables (if applicable):
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - Any other environment variables from `.env.local`

## Build Configuration

The `netlify.toml` file already includes:
- Node.js version 20
- Next.js plugin for optimal performance
- Security headers
- Build command and publish directory

## Important Notes

- The application uses Next.js API routes for server-side functionality
- Netlify's Next.js plugin automatically handles serverless function deployment
- The build output is approximately 289 KB for the main bundle
- All images are optimized using Next.js Image component

## Verify Deployment

After deployment, your site will be available at:
- `https://[your-site-name].netlify.app`

Test the following features:
1. Receipt upload and OCR processing
2. Excel report generation
3. Mileage tracking
4. CSV export functionality

## Support

If you encounter any issues during deployment:
1. Check the build logs in Netlify dashboard
2. Ensure all environment variables are properly set
3. Verify that the Node.js version matches (20.x)