'use client';

import { jsPDF } from 'jspdf';
import { ExtractedReceiptData } from './textract-service';

interface ReceiptEntry {
  id: string;
  data: ExtractedReceiptData;
  timestamp: Date;
  originalImage?: {
    file: File;
    dataUrl: string;
  };
}

interface PDFOptions {
  employeeName: string;
  receipts: ReceiptEntry[];
}

export class PDFGenerator {
  static async generateReceiptsPDF(options: PDFOptions): Promise<Blob> {
    console.log('[PDFGenerator] Starting PDF generation');
    console.log('[PDFGenerator] Employee:', options.employeeName);
    console.log('[PDFGenerator] Receipts:', options.receipts.length);

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;

    // Title page
    pdf.setFontSize(24);
    pdf.text(options.employeeName, pageWidth / 2, 40, { align: 'center' });
    
    pdf.setFontSize(18);
    pdf.text('Expense Report', pageWidth / 2, 65, { align: 'center' });
    
    pdf.setFontSize(14);
    const currentDate = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    pdf.text(currentDate, pageWidth / 2, 85, { align: 'center' });

    console.log('[PDFGenerator] Title page complete, starting receipts processing');
    console.log(`[PDFGenerator] Current page count before receipts: ${pdf.getNumberOfPages()}`);

    // Sort receipts by date (exact same logic as Excel generator)
    const sortedReceipts = [...options.receipts].sort((a, b) => {
      if (!a.data.date && !b.data.date) return 0;
      if (!a.data.date) return 1; // receipts without dates go to end
      if (!b.data.date) return -1;
      const dateA = new Date(a.data.date);
      const dateB = new Date(b.data.date);
      return dateA.getTime() - dateB.getTime();
    });
    
    console.log('[PDFGenerator] Receipts sorted by date');

    for (let i = 0; i < sortedReceipts.length; i++) {
      const receipt = sortedReceipts[i];
      
      if (!receipt.originalImage) {
        console.warn(`[PDFGenerator] No image data for receipt ${receipt.id}`);
        continue;
      }

      // Add new page BEFORE processing receipt content
      pdf.addPage();
      console.log(`[PDFGenerator] Added new page, current page count: ${pdf.getNumberOfPages()}`);
      
      console.log(`[PDFGenerator] Adding receipt ${i + 1}/${sortedReceipts.length}`);

      try {
        // Simple receipt info header - just the 3 key fields
        pdf.setFontSize(12);
        let yPos = 30;
        
        // Merchant
        if (receipt.data.merchant) {
          pdf.text(`Merchant: ${receipt.data.merchant}`, margin, yPos);
          yPos += 15;
        }
        
        // Date  
        if (receipt.data.date) {
          pdf.text(`Date: ${receipt.data.date}`, margin, yPos);
          yPos += 15;
        }
        
        // Amount
        if (receipt.data.total) {
          pdf.text(`Amount: ${receipt.data.total}`, margin, yPos);
          yPos += 15;
        }

        // Add the receipt image
        const imageYStart = yPos + 10;
        const maxImageHeight = pageHeight - imageYStart - margin;
        const maxImageWidth = pageWidth - (margin * 2);

        // Load image to get dimensions
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // Calculate scaling to fit the page
            const aspectRatio = img.width / img.height;
            let imageWidth = maxImageWidth;
            let imageHeight = imageWidth / aspectRatio;

            // If image is too tall, scale by height instead
            if (imageHeight > maxImageHeight) {
              imageHeight = maxImageHeight;
              imageWidth = imageHeight * aspectRatio;
            }

            // Center the image
            const imageX = (pageWidth - imageWidth) / 2;
            const imageY = imageYStart;

            // Add image to PDF
            pdf.addImage(
              receipt.originalImage!.dataUrl,
              'JPEG',
              imageX,
              imageY,
              imageWidth,
              imageHeight
            );

            resolve();
          };
          img.onerror = reject;
          img.src = receipt.originalImage.dataUrl;
        });

      } catch (error) {
        console.error(`[PDFGenerator] Error adding receipt ${i + 1}:`, error);
        // Add error message instead of image
        pdf.setFontSize(12);
        pdf.text('Error loading receipt image', pageWidth / 2, pageHeight / 2, { align: 'center' });
      }
    }

    console.log('[PDFGenerator] PDF generation complete');
    
    // Return PDF as blob
    const pdfBlob = pdf.output('blob');
    return pdfBlob;
  }

  static downloadPDF(pdfBlob: Blob, employeeName: string) {
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const sanitizedName = employeeName.replace(/[^a-zA-Z0-9]/g, '_');
    const easternTime = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    
    link.download = `receipts_${sanitizedName}_${easternTime}.pdf`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('[PDFGenerator] PDF download initiated');
  }
}