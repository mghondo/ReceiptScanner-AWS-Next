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

export class ExcelGenerator {
  private static readonly EXPENSE_CATEGORIES = {
    'HOTEL/MOTEL': 4,           // Column D
    'MEALS': 5,                 // Column E
    'ENTERTAINMENT': 6,         // Column F
    'TRANSPORT/AIR-RAIL': 7,    // Column G
    'COMPUTER SUPPLIES': 8,     // Column H
    'CELL PHONE': 9,            // Column I
    'GAS': 10,                  // Column J
    'COPIES': 11,               // Column K
    'DUES': 12,                 // Column L
    'POSTAGE': 13,              // Column M
    'OFFICE SUPPLIES': 14,      // Column N
    'MISC': 15                  // Column O
  };

  static async generateExpenseReport(data: ExpenseReportData): Promise<Buffer> {
    console.log('[ExcelGenerator] Creating new expense report');
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expense Report');

    // Set up column widths (removing empty columns)
    worksheet.columns = [
      { width: 12 },  // A - Date
      { width: 20 },  // B - Location
      { width: 30 },  // C - Purpose
      { width: 12 },  // D - Hotel/Motel
      { width: 10 },  // E - Meals
      { width: 12 },  // F - Entertainment
      { width: 12 },  // G - Transport
      { width: 12 },  // H - Computer
      { width: 10 },  // I - Cell Phone
      { width: 10 },  // J - Gas
      { width: 10 },  // K - Copies
      { width: 10 },  // L - Dues
      { width: 10 },  // M - Postage
      { width: 12 },  // N - Office Supplies
      { width: 10 },  // O - Misc
      { width: 12 },  // P - Totals
    ];

    // Add header rows
    this.addHeaderRows(worksheet, data.employeeName, data.weekEndingDate);

    // Add column headers (row 9)
    const headerRow = worksheet.getRow(9);
    headerRow.values = [
      'DATE',
      'LOCATION',
      'PURPOSE OF TRIP/EXPENDITURE',
      'HOTEL/\nMOTEL',
      // 'HOTEL/MOTEL',
      'MEALS',
      'ENTER-\nTAINMENT',
      'TRANSPORT\nAIR-RAIL',
      'COMPUTER\nSUPPLIES',
      'CELL PHONE',
      'GAS',
      'COPIES', 
      'DUES',
      'POSTAGE',
      'OFFICE\nSUPPLIES',
      'MISC',
      'TOTALS'
    ];
    
    // Style header row
    headerRow.font = { bold: true, size: 10 };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;
    
    // Add borders to header
    headerRow.eachCell((cell, colNumber) => {
      if (cell.value) {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE7E7E7' }
        };
      }
    });

    // Sort receipts by date
    console.log('[ExcelGenerator] ============ DATE SORTING DEBUG ============');
    console.log('[ExcelGenerator] Original receipt dates:', data.receipts.map(r => r.data.date || 'no date'));
    const sortedReceipts = this.sortReceiptsByDate(data.receipts);
    console.log('[ExcelGenerator] After sorting:', sortedReceipts.map(r => r.data.date || 'no date'));
    console.log('[ExcelGenerator] =========================================');

    // Handle dynamic row insertion if needed
    const maxRowsInTemplate = 28; // Rows 10-37
    const actualDataRows = Math.max(sortedReceipts.length, maxRowsInTemplate);
    
    // If we need more rows, insert them
    if (sortedReceipts.length > maxRowsInTemplate) {
      const additionalRows = sortedReceipts.length - maxRowsInTemplate;
      for (let i = 0; i < additionalRows; i++) {
        worksheet.insertRow(38 + i, []);
      }
    }
    
    // Process receipts (starting at row 10)
    const startRow = 10;
    const endRow = startRow + actualDataRows - 1;
    
    sortedReceipts.forEach((receipt, index) => {
      const rowNum = startRow + index;
      const row = worksheet.getRow(rowNum);
      
      // Date (Column A)
      row.getCell(1).value = receipt.data.date ? this.formatDate(receipt.data.date) : '';
      
      // Location/Merchant (Column B)
      row.getCell(2).value = receipt.data.merchant || '';
      
      // Purpose (Column C)
      row.getCell(3).value = receipt.data.description || '';
      
      // Amount in appropriate category column
      const amount = this.parseAmount(receipt.data.total);
      
      // Determine which category column to use
      let categoryCol: number | undefined;
      if (receipt.data.category) {
        categoryCol = this.EXPENSE_CATEGORIES[receipt.data.category as keyof typeof this.EXPENSE_CATEGORIES];
      }
      
      // If no category or unrecognized category, default to MISC (Column O)
      if (!categoryCol) {
        categoryCol = 15; // MISC column
        console.log(`[ExcelGenerator] Using MISC category for receipt: ${receipt.data.merchant || 'Unknown'}, category: ${receipt.data.category || 'None'}`);
      }
      
      // Place amount in the determined category column
      row.getCell(categoryCol).value = amount;
      row.getCell(categoryCol).numFmt = '$#,##0.00';
      
      console.log(`[ExcelGenerator] Added $${amount} to column ${categoryCol} for category: ${receipt.data.category || 'MISC'}`);
      
      // Total (Column P - 16) - Use SUM formula for columns D through O
      row.getCell(16).value = { formula: `SUM(D${rowNum}:O${rowNum})` };
      row.getCell(16).numFmt = '$#,##0.00';
      
      // Add borders to data cells (all columns from 1 to 16)
      for (let col = 1; col <= 16; col++) {
        row.getCell(col).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
      
      // Set row height
      row.height = 20;
    });

    // Add empty rows with formulas for remaining slots
    for (let i = startRow + sortedReceipts.length; i <= endRow; i++) {
      const row = worksheet.getRow(i);
      
      // Total column with SUM formula even for empty rows
      row.getCell(16).value = { formula: `SUM(D${i}:O${i})` };
      row.getCell(16).numFmt = '$#,##0.00';
      
      // Add borders (all columns from 1 to 16)
      for (let col = 1; col <= 16; col++) {
        row.getCell(col).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
      row.height = 20;
    }

    // Add totals row (adjust row number based on actual data)
    const totalsRowNum = endRow + 2; // Add a gap row
    const totalsRow = worksheet.getRow(totalsRowNum);
    totalsRow.getCell(3).value = 'TOTALS';
    totalsRow.getCell(3).font = { bold: true };
    totalsRow.getCell(3).alignment = { horizontal: 'right' };
    
    // Calculate column totals (columns 4-15 for expense categories) using SUM formulas
    for (let col = 4; col <= 15; col++) {
      const colLetter = String.fromCharCode(65 + col - 1); // Convert to letter (D=4, E=5, etc.)
      totalsRow.getCell(col).value = { formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})` };
      totalsRow.getCell(col).numFmt = '$#,##0.00';
      totalsRow.getCell(col).font = { bold: true };
    }
    
    // Grand total (column 16) - Sum of the totals column
    totalsRow.getCell(16).value = { formula: `SUM(P${startRow}:P${endRow})` };
    totalsRow.getCell(16).numFmt = '$#,##0.00';
    totalsRow.getCell(16).font = { bold: true };
    
    // Add borders to totals row
    for (let col = 3; col <= 16; col++) {
      totalsRow.getCell(col).border = {
        top: { style: 'double' },
        bottom: { style: 'double' }
      };
    }

    // Add summary section at bottom
    this.addSummarySection(worksheet, totalsRowNum);

    console.log('[ExcelGenerator] Report generation complete');
    
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private static addHeaderRows(worksheet: ExcelJS.Worksheet, employeeName: string, weekEndingDate?: string) {
    // Row 2: Title
    const titleRow = worksheet.getRow(2);
    titleRow.getCell(3).value = 'PURPOSE LEAF EXPENSE REPORT';
    titleRow.getCell(3).font = { bold: true, size: 14 };
    titleRow.getCell(3).alignment = { horizontal: 'center' };
    worksheet.mergeCells('C2:G2');

    // Row 4: Employee name and week ending
    const infoRow = worksheet.getRow(4);
    infoRow.getCell(1).value = 'EMPLOYEE NAME';
    infoRow.getCell(1).font = { bold: true };
    infoRow.getCell(2).value = employeeName;
    
    infoRow.getCell(4).value = 'SEND CHECK TO:';
    infoRow.getCell(6).value = 'SITE: Columbus';
    
    if (weekEndingDate) {
      infoRow.getCell(14).value = 'Week Ending';
      infoRow.getCell(14).font = { bold: true };
      infoRow.getCell(15).value = weekEndingDate;
    }

    // Row 7: Section header
    const sectionRow = worksheet.getRow(7);
    sectionRow.getCell(1).value = 'LISTING AND DESCRIPTION OF REIMBURSABLE EXPENSES';
    sectionRow.getCell(1).font = { bold: true, size: 11 };
    worksheet.mergeCells('A7:C7');
  }

  private static addSummarySection(worksheet: ExcelJS.Worksheet, totalsRowNum: number) {
    // Add some space
    const row51 = worksheet.getRow(51);
    row51.getCell(9).value = 'I HEREBY CERTIFY THAT ALL THE EXPENSES ABOVE ARE DIRECTLY';
    row51.getCell(9).font = { size: 9 };
    worksheet.mergeCells('I51:O51');

    const row52 = worksheet.getRow(52);
    row52.getCell(9).value = 'RELATED TO AND/OR ASSOCIATED WITH THE ACTIVE CONDUCT OF THE';
    row52.getCell(9).font = { size: 9 };
    worksheet.mergeCells('I52:O52');

    const row53 = worksheet.getRow(53);
    row53.getCell(9).value = "COMPANY'S BUSINESS.";
    row53.getCell(9).font = { size: 9 };
    worksheet.mergeCells('I53:L53');

    // Summary section (adjust row numbers based on totals row position)
    const summaryStartRow = totalsRowNum + 15;
    
    const totalExpensesRow = worksheet.getRow(summaryStartRow);
    totalExpensesRow.getCell(5).value = 'TOTAL EXPENSES';
    totalExpensesRow.getCell(5).font = { bold: true };
    totalExpensesRow.getCell(11).value = { formula: `P${totalsRowNum}` }; // Reference the grand total
    totalExpensesRow.getCell(11).numFmt = '$#,##0.00';
    totalExpensesRow.getCell(11).font = { bold: true };

    const advancesRow = worksheet.getRow(summaryStartRow + 1);
    advancesRow.getCell(5).value = 'NET ADVANCES';
    advancesRow.getCell(5).font = { bold: true };
    advancesRow.getCell(11).value = 0;
    advancesRow.getCell(11).numFmt = '$#,##0.00';

    const balanceRow = worksheet.getRow(summaryStartRow + 3);
    balanceRow.getCell(5).value = 'BALANCE DUE EMPLOYEE';
    balanceRow.getCell(5).font = { bold: true };
    balanceRow.getCell(11).value = { formula: `K${summaryStartRow}-K${summaryStartRow + 1}` }; // Total - Advances
    balanceRow.getCell(11).numFmt = '$#,##0.00';
    balanceRow.getCell(11).font = { bold: true };

    // Signature lines
    totalExpensesRow.getCell(13).value = 'EMPLOYEE (SIGNATURE)';
    totalExpensesRow.getCell(13).font = { size: 9 };
    totalExpensesRow.getCell(15).value = 'DATE SIGNED';
    totalExpensesRow.getCell(15).font = { size: 9 };

    const approvalRow = worksheet.getRow(summaryStartRow + 2);
    approvalRow.getCell(13).value = 'APPROVED BY:';
    approvalRow.getCell(13).font = { size: 9 };
    approvalRow.getCell(15).value = 'DATE SIGNED';
    approvalRow.getCell(15).font = { size: 9 };
  }

  private static normalizeDate(dateStr: string): string {
    if (!dateStr) return dateStr;
    
    // Remove leading zeros from month and day
    // Convert 09/05/25 to 9/5/25
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10).toString();
      const day = parseInt(parts[1], 10).toString();
      const year = parts[2];
      return `${month}/${day}/${year}`;
    }
    return dateStr;
  }

  private static sortReceiptsByDate(receipts: ReceiptEntry[]): ReceiptEntry[] {
    console.log('[ExcelGenerator] Starting date sort for receipts...');
    
    const receiptsWithParsedDates = receipts.map(receipt => {
      // Normalize the date first (remove leading zeros)
      const normalizedDate = this.normalizeDate(receipt.data.date || '');
      const parsedDate = this.parseReceiptDate(normalizedDate);
      return {
        receipt,
        parsedDate,
        originalDate: receipt.data.date,
        normalizedDate
      };
    });
    
    // Log parsing results
    receiptsWithParsedDates.forEach(item => {
      if (item.parsedDate) {
        console.log(`[ExcelGenerator] "${item.originalDate}" -> normalized to "${item.normalizedDate}" -> parsed to: ${item.parsedDate.toLocaleDateString('en-US')}`);
      } else {
        console.log(`[ExcelGenerator] "${item.originalDate}" could not be parsed`);
      }
    });
    
    // Sort by parsed dates
    receiptsWithParsedDates.sort((a, b) => {
      // Handle null dates
      if (!a.parsedDate && !b.parsedDate) return 0;
      if (!a.parsedDate) return 1;  // null dates to end
      if (!b.parsedDate) return -1; // null dates to end
      
      // Use the sortValue for more reliable sorting
      const aSortValue = (a.parsedDate as any).sortValue || 0;
      const bSortValue = (b.parsedDate as any).sortValue || 0;
      
      const diff = aSortValue - bSortValue;
      console.log(`[ExcelGenerator] Comparing ${a.originalDate} (${aSortValue}) vs ${b.originalDate} (${bSortValue}): ${diff}`);
      return diff;
    });
    
    console.log('[ExcelGenerator] Final sorted order:', 
      receiptsWithParsedDates.map(item => item.originalDate || 'no date'));
    
    return receiptsWithParsedDates.map(item => item.receipt);
  }

  private static parseReceiptDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Clean the date string
    const cleanedDate = dateStr.trim();
    
    try {
      // Handle various date formats with explicit parsing
      // Match M/D/YY or MM/DD/YY or M/D/YYYY or MM/DD/YYYY
      const dateMatch = cleanedDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (dateMatch) {
        const month = parseInt(dateMatch[1], 10);
        const day = parseInt(dateMatch[2], 10);
        let year = parseInt(dateMatch[3], 10);
        
        // Convert 2-digit year to 4-digit
        if (year < 100) {
          year = 2000 + year;  // Always assume 20xx for 2-digit years
        }
        
        // Validate date components
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          // Create a sortable date value (year * 10000 + month * 100 + day)
          // This ensures proper sorting regardless of timezone issues
          const sortValue = year * 10000 + month * 100 + day;
          
          // Create the actual date object
          const parsedDate = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid DST issues
          
          // Store the sort value as a property for debugging
          (parsedDate as any).sortValue = sortValue;
          
          console.log(`[ExcelGenerator] Parsed date: "${dateStr}" -> ${month}/${day}/${year} -> sortValue: ${sortValue}`);
          return parsedDate;
        }
      }
      
      // Try ISO format (YYYY-MM-DD)
      const isoMatch = cleanedDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
          const sortValue = year * 10000 + month * 100 + day;
          const parsedDate = new Date(year, month - 1, day, 12, 0, 0);
          (parsedDate as any).sortValue = sortValue;
          console.log(`[ExcelGenerator] Parsed ISO date: "${dateStr}" -> ${month}/${day}/${year} -> sortValue: ${sortValue}`);
          return parsedDate;
        }
      }
      
      console.warn(`[ExcelGenerator] Could not parse date: "${dateStr}"`);
      return null;
    } catch (error) {
      console.warn(`[ExcelGenerator] Error parsing date "${dateStr}":`, error);
      return null;
    }
  }

  private static parseAmount(amount?: string): number {
    if (!amount) return 0;
    const cleanAmount = amount.replace(/[^0-9.-]/g, '');
    return parseFloat(cleanAmount) || 0;
  }

  private static formatDate(dateStr: string): string {
    if (!dateStr) return '';
    
    try {
      // Parse the date string to get components
      const dateMatch = dateStr.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (dateMatch) {
        const month = parseInt(dateMatch[1], 10);
        const day = parseInt(dateMatch[2], 10);
        let year = parseInt(dateMatch[3], 10);
        
        // Convert 2-digit year to 4-digit
        if (year < 100) {
          year = 2000 + year;
        }
        
        // Format with leading zeros for month and day when needed
        const formattedMonth = month.toString().padStart(2, '0');
        const formattedDay = day.toString().padStart(2, '0');
        
        return `${formattedMonth}/${formattedDay}/${year}`;
      }
      
      // Try ISO format
      const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        
        const formattedMonth = month.toString().padStart(2, '0');
        const formattedDay = day.toString().padStart(2, '0');
        
        return `${formattedMonth}/${formattedDay}/${year}`;
      }
      
      // Fallback to original string if can't parse
      return dateStr;
    } catch (error) {
      return dateStr;
    }
  }
}