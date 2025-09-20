import ExcelJS from 'exceljs';
import { ExtractedReceiptData } from './textract-service';

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

export class ExcelProcessor {
  private static readonly EXPENSE_CATEGORIES = {
    'HOTEL/MOTEL': { column: 'F' },      // Column F
    'MEALS': { column: 'G' },            // Column G  
    'ENTERTAINMENT': { column: 'H' },    // Column H
    'TRANSPORT/AIR-RAIL': { column: 'J' }, // Column J
    'COMPUTER SUPPLIES': { column: 'K' }, // Column K
    'CELL PHONE': { column: 'L' },        // Column L
    'GAS': { column: 'M' },               // Column M
    'COPIES': { column: 'N' },            // Column N
    'DUES': { column: 'O' },              // Column O
    'POSTAGE': { column: 'P' },           // Column P
    'OFFICE SUPPLIES': { column: 'Q' },   // Column Q
    'MISC': { column: 'R' }               // Column R
  };

  private static readonly DATA_START_ROW = 10;  // Row 10 in 1-based indexing
  private static readonly DATA_END_ROW = 37;    // Row 37 in 1-based indexing  
  private static readonly MAX_RECEIPTS = 28;

  static async processExpenseReport(data: ExpenseReportData): Promise<Buffer> {
    console.log('[ExcelProcessor] Starting Excel expense report processing');
    console.log('[ExcelProcessor] Employee:', data.employeeName);
    console.log('[ExcelProcessor] Receipt count:', data.receipts.length);

    // Load the Excel template
    const workbook = new ExcelJS.Workbook();
    const templateBuffer = await this.readExcelTemplate();
    
    try {
      // Load with options to handle merged cells properly
      // @ts-expect-error - Buffer type mismatch between Node and ExcelJS types
      await workbook.xlsx.load(templateBuffer, {
        ignoreNodes: ['dataValidations'] // Ignore validations that might cause issues
      } as Parameters<typeof workbook.xlsx.load>[1]);
    } catch (loadError) {
      console.error('[ExcelProcessor] Error loading template, trying alternative approach:', loadError);
      // If normal loading fails, try reading as a buffer
      const workbookAlt = new ExcelJS.Workbook();
      await workbookAlt.xlsx.readFile('/Users/morganhondros/Documents/Morgo/MorgoExpense/Expense Report.xlsx');
      return this.processWithWorkbook(workbookAlt, data);
    }
    
    console.log('[ExcelProcessor] Excel template loaded successfully');
    
    return this.processWithWorkbook(workbook, data);
  }

  private static async processWithWorkbook(workbook: ExcelJS.Workbook, data: ExpenseReportData): Promise<Buffer> {
    // Get the first worksheet
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('No worksheet found in Excel template');
    }
    
    console.log('[ExcelProcessor] Processing worksheet');

    // Add employee name (Row 4, Column A)
    worksheet.getCell('A4').value = data.employeeName;
    console.log('[ExcelProcessor] Added employee name to A4');

    // Add week ending date if provided (Row 4, Column P) 
    if (data.weekEndingDate) {
      worksheet.getCell('P4').value = data.weekEndingDate;
      console.log('[ExcelProcessor] Added week ending date to P4');
    }

    // Sort receipts by date (oldest first for chronological order)
    const sortedReceipts = this.sortReceiptsByDate(data.receipts);
    console.log('[ExcelProcessor] Sorted receipts chronologically');

    // Check if we need to add rows for more than 28 receipts
    // Note: Currently disabled due to merged cell conflicts in template
    // TODO: Handle dynamic row insertion with merged cells
    if (sortedReceipts.length > this.MAX_RECEIPTS) {
      console.warn(`[ExcelProcessor] Warning: ${sortedReceipts.length} receipts exceeds max of ${this.MAX_RECEIPTS}. Only first ${this.MAX_RECEIPTS} will be processed.`);
      // Limit to max receipts for now
      sortedReceipts.splice(this.MAX_RECEIPTS);
    }

    // Process each receipt and populate data
    let totalExpenses = 0;
    sortedReceipts.forEach((receipt, index) => {
      const rowNumber = this.DATA_START_ROW + index;
      console.log(`[ExcelProcessor] Processing receipt ${index + 1} at row ${rowNumber}`);

      // Column A: Date
      if (receipt.data.date) {
        worksheet.getCell(`A${rowNumber}`).value = this.formatDate(receipt.data.date);
      }

      // Column B: Location (Merchant) 
      if (receipt.data.merchant) {
        worksheet.getCell(`B${rowNumber}`).value = receipt.data.merchant;
      }

      // Column D: Purpose of Trip/Expenditure
      if (receipt.data.description) {
        worksheet.getCell(`D${rowNumber}`).value = receipt.data.description;
      }

      // Parse amount
      const amount = this.parseAmount(receipt.data.total);
      totalExpenses += amount;

      // Column for category-specific amount
      if (receipt.data.category && this.EXPENSE_CATEGORIES[receipt.data.category as keyof typeof this.EXPENSE_CATEGORIES]) {
        const categoryInfo = this.EXPENSE_CATEGORIES[receipt.data.category as keyof typeof this.EXPENSE_CATEGORIES];
        worksheet.getCell(`${categoryInfo.column}${rowNumber}`).value = amount;
        console.log(`[ExcelProcessor] Added $${amount} to ${receipt.data.category} column ${categoryInfo.column}${rowNumber}`);
      }

      // Column T: Total for this row
      worksheet.getCell(`T${rowNumber}`).value = amount;
    });

    // Update grand total in the totals row (Row 39, Column T)
    worksheet.getCell('T39').value = totalExpenses;
    console.log(`[ExcelProcessor] Added grand total: $${totalExpenses} to T39`);

    // Update summary section totals
    worksheet.getCell('L54').value = totalExpenses; // Total expenses
    worksheet.getCell('M57').value = totalExpenses; // Balance due employee

    console.log('[ExcelProcessor] Excel expense report processing complete');
    
    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private static async readExcelTemplate(): Promise<Buffer> {
    try {
      console.log('[ExcelProcessor] Fetching Excel template from /api/excel-template');
      const response = await fetch('/api/excel-template');
      console.log('[ExcelProcessor] Template fetch response status:', response.status);
      
      if (!response.ok) {
        console.error('[ExcelProcessor] Template fetch failed with status:', response.status);
        throw new Error(`Failed to load Excel template: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log('[ExcelProcessor] Template loaded successfully, buffer size:', buffer.length);
      return buffer;
    } catch (error) {
      console.error('[ExcelProcessor] Error reading template:', error);
      throw new Error(`Unable to load Excel template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static sortReceiptsByDate(receipts: ReceiptEntry[]): ReceiptEntry[] {
    return [...receipts].sort((a, b) => {
      // If no dates, maintain original order
      if (!a.data.date && !b.data.date) return 0;
      if (!a.data.date) return 1;
      if (!b.data.date) return -1;

      // Parse dates and sort chronologically (oldest first)
      const dateA = new Date(a.data.date);
      const dateB = new Date(b.data.date);
      return dateA.getTime() - dateB.getTime();
    });
  }

  private static insertAdditionalRows(worksheet: ExcelJS.Worksheet, additionalRows: number): void {
    console.log(`[ExcelProcessor] Inserting ${additionalRows} additional rows`);
    
    // Insert rows after row 37 (the last data row)
    const insertionPoint = this.DATA_END_ROW + 1;
    
    for (let i = 0; i < additionalRows; i++) {
      worksheet.insertRow(insertionPoint + i, []);
      const newRowNum = insertionPoint + i;
      
      // Copy formatting from the row above
      const sourceRow = worksheet.getRow(this.DATA_END_ROW);
      const newRow = worksheet.getRow(newRowNum);
      
      // Copy cell formatting for key columns
      ['A', 'B', 'C', 'D', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'].forEach(col => {
        const sourceCell = sourceRow.getCell(col);
        const newCell = newRow.getCell(col);
        
        // Copy formatting
        newCell.style = sourceCell.style;
        
        // Set default value for totals column
        if (col === 'T') {
          newCell.value = 0;
        }
      });
    }
  }

  private static parseAmount(amount?: string): number {
    if (!amount) return 0;
    // Remove all non-numeric characters except decimal point and negative sign
    const cleanAmount = amount.replace(/[^0-9.-]/g, '');
    return parseFloat(cleanAmount) || 0;
  }

  private static formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      // Return in MM/DD/YYYY format
      return date.toLocaleDateString('en-US');
    } catch (error) {
      // If date parsing fails, return original string
      return dateStr;
    }
  }

  static downloadExcel(excelBuffer: Buffer, employeeName: string): void {
    const blob = new Blob([new Uint8Array(excelBuffer)], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const sanitizedName = employeeName.replace(/[^a-zA-Z0-9]/g, '_');
    // Use US Eastern time for filename
    const easternTime = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    link.download = `expense_report_${sanitizedName}_${easternTime}.xlsx`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('[ExcelProcessor] Excel download initiated');
  }
}