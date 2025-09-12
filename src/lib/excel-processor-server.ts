import ExcelJS from 'exceljs';
import { ExtractedReceiptData } from './textract-service';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ReceiptEntry {
  id: string;
  data: ExtractedReceiptData;
  timestamp: Date;
}

interface ExpenseReportData {
  employeeName: string;
  receipts: ReceiptEntry[];
  weekEndingDate?: string;
}

export class ExcelProcessorServer {
  private static readonly EXPENSE_CATEGORIES = {
    'HOTEL/MOTEL': { column: 'F' },      
    'MEALS': { column: 'G' },            
    'ENTERTAINMENT': { column: 'H' },    
    'TRANSPORT/AIR-RAIL': { column: 'J' },
    'COMPUTER SUPPLIES': { column: 'K' }, 
    'CELL PHONE': { column: 'L' },        
    'GAS': { column: 'M' },               
    'COPIES': { column: 'N' },            
    'DUES': { column: 'O' },              
    'POSTAGE': { column: 'P' },           
    'OFFICE SUPPLIES': { column: 'Q' },   
    'MISC': { column: 'R' }               
  };

  private static readonly DATA_START_ROW = 10;
  private static readonly DATA_END_ROW = 37;
  private static readonly MAX_RECEIPTS = 28;

  static async processExpenseReport(data: ExpenseReportData): Promise<Buffer> {
    console.log('[ExcelProcessorServer] Starting Excel expense report processing');
    console.log('[ExcelProcessorServer] Employee:', data.employeeName);
    console.log('[ExcelProcessorServer] Receipt count:', data.receipts.length);

    // Create a new workbook and read the template directly from file system
    const workbook = new ExcelJS.Workbook();
    const templatePath = join(process.cwd(), '..', 'Expense Report.xlsx');
    
    console.log('[ExcelProcessorServer] Reading template from:', templatePath);
    
    try {
      // Read the file directly - this should handle merged cells better
      await workbook.xlsx.readFile(templatePath);
      console.log('[ExcelProcessorServer] Template loaded successfully');
    } catch (error) {
      console.error('[ExcelProcessorServer] Error loading template:', error);
      throw new Error(`Failed to load Excel template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Get the first worksheet
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('No worksheet found in Excel template');
    }

    console.log('[ExcelProcessorServer] Processing worksheet');

    // Add employee name (Row 4, Column A)
    try {
      const cellA4 = worksheet.getCell('A4');
      cellA4.value = data.employeeName;
      console.log('[ExcelProcessorServer] Added employee name to A4');
    } catch (e) {
      console.warn('[ExcelProcessorServer] Could not set A4, trying alternative approach');
      worksheet.getRow(4).getCell(1).value = data.employeeName;
    }

    // Add week ending date if provided (Row 4, Column P)
    if (data.weekEndingDate) {
      try {
        const cellP4 = worksheet.getCell('P4');
        cellP4.value = data.weekEndingDate;
        console.log('[ExcelProcessorServer] Added week ending date to P4');
      } catch (e) {
        console.warn('[ExcelProcessorServer] Could not set P4');
      }
    }

    // Sort receipts by date
    const sortedReceipts = this.sortReceiptsByDate(data.receipts);
    console.log('[ExcelProcessorServer] Sorted receipts chronologically');

    // Limit to max receipts to avoid row insertion issues
    if (sortedReceipts.length > this.MAX_RECEIPTS) {
      console.warn(`[ExcelProcessorServer] Warning: ${sortedReceipts.length} receipts exceeds max of ${this.MAX_RECEIPTS}. Only first ${this.MAX_RECEIPTS} will be processed.`);
      sortedReceipts.splice(this.MAX_RECEIPTS);
    }

    // Process each receipt
    let totalExpenses = 0;
    sortedReceipts.forEach((receipt, index) => {
      const rowNumber = this.DATA_START_ROW + index;
      console.log(`[ExcelProcessorServer] Processing receipt ${index + 1} at row ${rowNumber}`);

      try {
        // Column A: Date
        if (receipt.data.date) {
          worksheet.getRow(rowNumber).getCell(1).value = this.formatDate(receipt.data.date);
        }

        // Column B: Location (Merchant)
        if (receipt.data.merchant) {
          worksheet.getRow(rowNumber).getCell(2).value = receipt.data.merchant;
        }

        // Column D: Purpose of Trip/Expenditure
        if (receipt.data.description) {
          worksheet.getRow(rowNumber).getCell(4).value = receipt.data.description;
        }

        // Parse amount
        const amount = this.parseAmount(receipt.data.total);
        totalExpenses += amount;

        // Column for category-specific amount
        if (receipt.data.category && this.EXPENSE_CATEGORIES[receipt.data.category as keyof typeof this.EXPENSE_CATEGORIES]) {
          const categoryInfo = this.EXPENSE_CATEGORIES[receipt.data.category as keyof typeof this.EXPENSE_CATEGORIES];
          const colLetter = categoryInfo.column;
          worksheet.getCell(`${colLetter}${rowNumber}`).value = amount;
          console.log(`[ExcelProcessorServer] Added $${amount} to ${receipt.data.category} column ${colLetter}${rowNumber}`);
        }

        // Column T: Total for this row
        worksheet.getRow(rowNumber).getCell(20).value = amount; // Column T is the 20th column
      } catch (error) {
        console.error(`[ExcelProcessorServer] Error processing receipt ${index + 1}:`, error);
      }
    });

    // Update grand total in the totals row (Row 39, Column T)
    try {
      worksheet.getRow(39).getCell(20).value = totalExpenses;
      console.log(`[ExcelProcessorServer] Added grand total: $${totalExpenses} to T39`);
    } catch (e) {
      console.warn('[ExcelProcessorServer] Could not update grand total');
    }

    // Update summary section totals
    try {
      worksheet.getRow(54).getCell(12).value = totalExpenses; // L54
      worksheet.getRow(57).getCell(13).value = totalExpenses; // M57
    } catch (e) {
      console.warn('[ExcelProcessorServer] Could not update summary totals');
    }

    console.log('[ExcelProcessorServer] Excel expense report processing complete');

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private static sortReceiptsByDate(receipts: ReceiptEntry[]): ReceiptEntry[] {
    return [...receipts].sort((a, b) => {
      if (!a.data.date && !b.data.date) return 0;
      if (!a.data.date) return 1;
      if (!b.data.date) return -1;

      const dateA = new Date(a.data.date);
      const dateB = new Date(b.data.date);
      return dateA.getTime() - dateB.getTime();
    });
  }

  private static parseAmount(amount?: string): number {
    if (!amount) return 0;
    const cleanAmount = amount.replace(/[^0-9.-]/g, '');
    return parseFloat(cleanAmount) || 0;
  }

  private static formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US');
    } catch (error) {
      return dateStr;
    }
  }
}