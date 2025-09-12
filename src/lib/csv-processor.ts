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

export class CSVProcessor {
  private static readonly EXPENSE_CATEGORIES = {
    'HOTEL/MOTEL': { column: 5, csvColumn: 'F' },        // Column F (index 5)
    'MEALS': { column: 6, csvColumn: 'G' },              // Column G (index 6)
    'ENTERTAINMENT': { column: 7, csvColumn: 'H' },      // Column H (index 7)
    'TRANSPORT/AIR-RAIL': { column: 9, csvColumn: 'J' }, // Column J (index 9)
    'COMPUTER SUPPLIES': { column: 10, csvColumn: 'K' }, // Column K (index 10)
    'CELL PHONE': { column: 11, csvColumn: 'L' },        // Column L (index 11)
    'GAS': { column: 12, csvColumn: 'M' },               // Column M (index 12)
    'COPIES': { column: 13, csvColumn: 'N' },            // Column N (index 13)
    'DUES': { column: 14, csvColumn: 'O' },              // Column O (index 14)
    'POSTAGE': { column: 15, csvColumn: 'P' },           // Column P (index 15)
    'OFFICE SUPPLIES': { column: 16, csvColumn: 'Q' },   // Column Q (index 16)
    'MISC': { column: 17, csvColumn: 'R' }               // Column R (index 17)
  };

  private static readonly DATA_START_ROW = 9;  // Row 10 in 1-based indexing (index 9)
  private static readonly DATA_END_ROW = 36;   // Row 37 in 1-based indexing (index 36)
  private static readonly MAX_RECEIPTS = 28;

  static async processExpenseReport(data: ExpenseReportData): Promise<string> {
    console.log('[CSVProcessor] Starting expense report processing');
    console.log('[CSVProcessor] Employee:', data.employeeName);
    console.log('[CSVProcessor] Receipt count:', data.receipts.length);

    // Read the template CSV
    const templateContent = await this.readCSVTemplate();
    
    // Parse CSV into 2D array
    let csvData = this.parseCSV(templateContent);
    console.log('[CSVProcessor] Template loaded, rows:', csvData.length);

    // Add employee name (Row 4, Column A - index [3][0])
    csvData[3][0] = data.employeeName;
    console.log('[CSVProcessor] Added employee name to row 4');

    // Add week ending date if provided (Row 4, Column P - index [3][15])
    if (data.weekEndingDate) {
      csvData[3][15] = data.weekEndingDate;
      console.log('[CSVProcessor] Added week ending date');
    }

    // Sort receipts by date (oldest first for chronological order)
    const sortedReceipts = this.sortReceiptsByDate(data.receipts);
    console.log('[CSVProcessor] Sorted receipts chronologically');

    // Check if we need to add rows for more than 28 receipts
    if (sortedReceipts.length > this.MAX_RECEIPTS) {
      console.log(`[CSVProcessor] Need to add ${sortedReceipts.length - this.MAX_RECEIPTS} additional rows`);
      csvData = this.insertAdditionalRows(csvData, sortedReceipts.length - this.MAX_RECEIPTS);
    }

    // Process each receipt and populate data
    let totalExpenses = 0;
    sortedReceipts.forEach((receipt, index) => {
      const rowIndex = this.DATA_START_ROW + index;
      console.log(`[CSVProcessor] Processing receipt ${index + 1} at row ${rowIndex + 1}`);

      // Column A: Date
      if (receipt.data.date) {
        csvData[rowIndex][0] = this.formatDate(receipt.data.date);
      }

      // Column B: Location (Merchant)
      if (receipt.data.merchant) {
        csvData[rowIndex][1] = receipt.data.merchant;
      }

      // Column D: Purpose of Trip/Expenditure 
      if (receipt.data.description) {
        csvData[rowIndex][3] = receipt.data.description;
      }

      // Parse amount
      const amount = this.parseAmount(receipt.data.total);
      totalExpenses += amount;

      // Column for category-specific amount
      if (receipt.data.category && this.EXPENSE_CATEGORIES[receipt.data.category as keyof typeof this.EXPENSE_CATEGORIES]) {
        const categoryInfo = this.EXPENSE_CATEGORIES[receipt.data.category as keyof typeof this.EXPENSE_CATEGORIES];
        csvData[rowIndex][categoryInfo.column] = this.formatAmount(amount);
        console.log(`[CSVProcessor] Added $${amount} to ${receipt.data.category} column ${categoryInfo.csvColumn}`);
      }

      // Column T: Total for this row (index 19)
      csvData[rowIndex][19] = this.formatAmount(amount);
    });

    // Update grand total in the totals row (Row 39, Column T - index [38][19])
    csvData[38][19] = this.formatAmount(totalExpenses);
    console.log(`[CSVProcessor] Added grand total: $${totalExpenses}`);

    // Update summary section totals (Row 54, Column L - index [53][11])
    csvData[53][11] = this.formatAmount(totalExpenses);
    csvData[56][12] = this.formatAmount(totalExpenses); // Balance due employee

    console.log('[CSVProcessor] Expense report processing complete');
    return this.generateCSV(csvData);
  }

  private static async readCSVTemplate(): Promise<string> {
    try {
      console.log('[CSVProcessor] Fetching CSV template from /api/csv-template');
      // In a browser environment, we'll need to fetch this differently
      // For now, we'll use a hardcoded template or require the file to be available
      const response = await fetch('/api/csv-template');
      console.log('[CSVProcessor] Template fetch response status:', response.status);
      
      if (!response.ok) {
        console.error('[CSVProcessor] Template fetch failed with status:', response.status);
        throw new Error(`Failed to load CSV template: ${response.status} ${response.statusText}`);
      }
      
      const csvContent = await response.text();
      console.log('[CSVProcessor] Template loaded successfully, content length:', csvContent.length);
      return csvContent;
    } catch (error) {
      console.error('[CSVProcessor] Error reading template:', error);
      throw new Error(`Unable to load expense report template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static parseCSV(content: string): string[][] {
    const lines = content.split('\n');
    return lines.map(line => {
      // Simple CSV parsing - handles basic cases
      const cells = line.split(',');
      // Ensure each row has at least 200 columns for wide CSV
      while (cells.length < 200) {
        cells.push('');
      }
      return cells;
    });
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

  private static insertAdditionalRows(csvData: string[][], additionalRows: number): string[][] {
    console.log(`[CSVProcessor] Inserting ${additionalRows} additional rows`);
    
    // Create new rows with same structure as template data rows
    const templateRow = csvData[this.DATA_START_ROW]; // Use first data row as template
    const newRows: string[][] = [];
    
    for (let i = 0; i < additionalRows; i++) {
      // Create empty row with same column count
      const newRow = new Array(templateRow.length).fill('');
      // Add the standard $0.00 in the totals column (index 19)
      newRow[19] = '$0.00';
      newRows.push(newRow);
    }

    // Insert new rows after the existing data rows (after row 37, index 36)
    const insertionPoint = this.DATA_END_ROW + 1;
    csvData.splice(insertionPoint, 0, ...newRows);
    
    return csvData;
  }

  private static parseAmount(amount?: string): number {
    if (!amount) return 0;
    // Remove all non-numeric characters except decimal point and negative sign
    const cleanAmount = amount.replace(/[^0-9.-]/g, '');
    return parseFloat(cleanAmount) || 0;
  }

  private static formatAmount(amount: number): string {
    return `$${amount.toFixed(2)}`;
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

  private static generateCSV(data: string[][]): string {
    return data.map(row => {
      // Escape cells that contain commas by wrapping in quotes
      return row.map(cell => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          // Escape internal quotes by doubling them
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',');
    }).join('\n');
  }

  static downloadCSV(csvContent: string, employeeName: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
    link.download = `expense_report_${sanitizedName}_${easternTime}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('[CSVProcessor] CSV download initiated');
  }
}