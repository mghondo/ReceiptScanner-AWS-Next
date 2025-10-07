import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30; // Increased timeout for ExcelJS operations
export const dynamic = 'force-dynamic';

interface ReceiptData {
  data: {
    date?: string;
    vendor?: string;
    merchant?: string;
    store?: string;
    location?: string;
    category?: string;
    total?: string;
  };
}

interface MileageEntry {
  date?: string;
  startAddress?: string;
  endAddress?: string;
  businessPurpose?: string;
  mileage?: number;
  reimbursableDistance?: number;
  reimbursableAmount?: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API] export-complete-report started');
    const requestBody = await request.json();
    const { receipts, mileageEntries, employeeName } = requestBody;
    
    console.log('[API] Data received:', {
      employeeName,
      receiptsCount: receipts?.length || 0,
      mileageCount: mileageEntries?.length || 0
    });
    
    if (!employeeName) {
      console.error('[API] Missing employee name');
      return NextResponse.json(
        { error: 'Employee name is required' },
        { status: 400 }
      );
    }

    console.log('[API] Importing ExcelJS dynamically...');
    const ExcelJS = (await import('exceljs')).default;
    console.log('[API] ExcelJS imported successfully');

    // Create a new workbook that matches the original template structure
    console.log('[API] Creating workbook...');
    const workbook = new ExcelJS.Workbook();
    
    // Create main expense sheet
    const expenseSheet = workbook.addWorksheet('Expense Report');
    
    // Set column widths to match original (removed gaps at J and L)
    const columnWidths = [
      12, // A: Date
      25, // B: Location
      10, // C: Empty
      35, // D: Purpose
      10, // E: Empty
      10, // F: Empty
      12, // G: Hotel/Motel
      12, // H: Meals
      12, // I: Entertainment
      12, // J: Transport (moved from K)
      12, // K: Computer Supplies (moved from M)
      12, // L: Cell Phone (moved from N)
      12, // M: Gas/Mileage (moved from O)
      12, // N: Copies (moved from P)
      12, // O: Dues (moved from Q)
      12, // P: Postage (moved from R)
      12, // Q: Office Supplies (moved from S)
      12, // R: Misc (moved from T)
      12, // S: Totals (moved from U)
    ];
    
    expenseSheet.columns = columnWidths.map(width => ({ width }));

    // Row 1: Empty
    // Row 2: Title
    expenseSheet.mergeCells('D2:K2');
    const titleCell = expenseSheet.getCell('D2');
    titleCell.value = 'EXPENSE REPORT';
    titleCell.font = { size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    // Row 3: Empty
    
    // Row 4: Employee Name and Site
    const row4 = expenseSheet.getRow(4);
    row4.getCell(1).value = 'EMPLOYEE NAME';
    row4.getCell(1).font = { bold: true };
    row4.getCell(4).value = 'SEND CHECK TO:';
    row4.getCell(7).value = 'SITE (Circle';
    row4.getCell(9).value = 'or highlight)';
    row4.getCell(10).value = 'Columbus';
    row4.getCell(17).value = 'Week Ending';

    // Row 5: Employee name value
    const row5 = expenseSheet.getRow(5);
    row5.getCell(1).value = employeeName;
    row5.getCell(17).value = new Date().toLocaleDateString();

    // Row 6: Empty
    
    // Row 7: Section header
    const row7 = expenseSheet.getRow(7);
    row7.getCell(1).value = 'LISTING AND DESCRIPTION OF REIMBURSABLE EXPENSES';
    row7.getCell(1).font = { bold: true };

    // Row 8: Empty row for spacing
    
    // Row 9: All column headers in one row
    const row9 = expenseSheet.getRow(9);
    row9.getCell(1).value = 'DATE';
    row9.getCell(2).value = 'LOCATION';
    row9.getCell(4).value = 'PURPOSE OF TRIP/EXPENDITURE';
    row9.getCell(7).value = 'HOTEL/MOTEL';
    row9.getCell(8).value = 'MEALS';
    row9.getCell(9).value = 'ENTERTAINMENT';
    row9.getCell(10).value = 'TRANSPORT';
    row9.getCell(11).value = 'COMPUTER SUPPLIES';
    row9.getCell(12).value = 'CELL PHONE';
    row9.getCell(13).value = 'GAS/MILEAGE';
    row9.getCell(14).value = 'COPIES';
    row9.getCell(15).value = 'DUES';
    row9.getCell(16).value = 'POSTAGE';
    row9.getCell(17).value = 'OFFICE SUPPLIES';
    row9.getCell(18).value = 'MISC';
    row9.getCell(19).value = 'TOTALS';
    
    // Style header rows
    for (let col = 1; col <= 19; col++) {
      row9.getCell(col).font = { bold: true, size: 10 };
      row9.getCell(col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      row9.getCell(col).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }

    // Initialize totals
    let hotelTotal = 0;
    let mealTotal = 0;
    let entertainmentTotal = 0;
    let transportTotal = 0;
    let computerTotal = 0;
    let cellPhoneTotal = 0;
    let gasTotal = 0;
    let copiesTotal = 0;
    let duesTotal = 0;
    let postageTotal = 0;
    let officeTotal = 0;
    let miscTotal = 0;
    let grandTotal = 0;

    // Rows 10-37: Expense entries (28 rows available for entries)
    let currentRow = 10;
    const maxExpenseRow = 37;
    
    if (receipts && receipts.length > 0) {
      // Sort receipts by date before processing
      const sortedReceipts = [...receipts].sort((a: ReceiptData, b: ReceiptData) => {
        const dateA = a.data.date || '';
        const dateB = b.data.date || '';
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1; // No date goes to end
        if (!dateB) return -1; // No date goes to end
        
        // Parse dates properly
        const parseDate = (dateStr: string): Date | null => {
          if (!dateStr) return null;
          
          // Match M/D/YY or MM/DD/YY or M/D/YYYY or MM/DD/YYYY format
          const match = dateStr.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
          if (match) {
            const month = parseInt(match[1], 10);
            const day = parseInt(match[2], 10);
            let year = parseInt(match[3], 10);
            
            // Convert 2-digit year to 4-digit
            if (year < 100) {
              year = 2000 + year;
            }
            
            return new Date(year, month - 1, day, 12, 0, 0);
          }
          return null;
        };
        
        const parsedDateA = parseDate(dateA);
        const parsedDateB = parseDate(dateB);
        
        if (!parsedDateA && !parsedDateB) return 0;
        if (!parsedDateA) return 1;
        if (!parsedDateB) return -1;
        
        return parsedDateA.getTime() - parsedDateB.getTime();
      });
      
      console.log('[API] Sorted dates:', sortedReceipts.map((r: ReceiptData) => r.data.date));
      
      sortedReceipts.forEach((receipt: ReceiptData) => {
        if (currentRow <= maxExpenseRow) {
          const row = expenseSheet.getRow(currentRow);
          
          // Debug: Log receipt data to see what fields are available
          console.log('Receipt data:', receipt.data);
          
          // Date (Column A) - Format with leading zeros
          const formatDate = (dateStr: string | undefined): string => {
            if (!dateStr) return '';
            
            const match = dateStr.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (match) {
              const month = parseInt(match[1], 10);
              const day = parseInt(match[2], 10);
              let year = parseInt(match[3], 10);
              
              if (year < 100) {
                year = 2000 + year;
              }
              
              // Format with leading zeros
              const formattedMonth = month.toString().padStart(2, '0');
              const formattedDay = day.toString().padStart(2, '0');
              
              return `${formattedMonth}/${formattedDay}/${year}`;
            }
            return dateStr;
          };
          
          row.getCell(1).value = formatDate(receipt.data.date);
          
          // Location (Column B) - Try multiple possible field names for merchant/vendor
          const merchant = receipt.data.vendor || receipt.data.merchant || receipt.data.store || receipt.data.location || '';
          row.getCell(2).value = merchant;
          console.log('Setting location to:', merchant);
          
          // Purpose (Column D)
          row.getCell(4).value = receipt.data.category || 'Business Expense';
          
          // Amount in appropriate column based on category
          const amount = parseFloat(receipt.data.total?.replace(/[^\d.-]/g, '') || '0');
          
          // Categorize expenses based on dropdown categories
          const category = receipt.data.category?.toLowerCase() || '';
          
          if (category.includes('hotel') || category.includes('lodging') || category.includes('motel')) {
            row.getCell(7).value = amount; // G: Hotel/Motel
            hotelTotal += amount;
          } else if (category.includes('food') || category.includes('meal') || category.includes('restaurant') ||
                     receipt.data.vendor?.toLowerCase().includes('restaurant')) {
            row.getCell(8).value = amount; // H: Meals
            mealTotal += amount;
          } else if (category.includes('entertainment')) {
            row.getCell(9).value = amount; // I: Entertainment
            entertainmentTotal += amount;
          } else if (category.includes('transport') || category.includes('uber') || category.includes('lyft') ||
                     category.includes('taxi') || category.includes('air') || category.includes('rail')) {
            row.getCell(10).value = amount; // J: Transport
            transportTotal += amount;
          } else if (category.includes('computer') || category.includes('supplies')) {
            row.getCell(11).value = amount; // K: Computer Supplies
            computerTotal += amount;
          } else if (category.includes('cell') || category.includes('phone')) {
            row.getCell(12).value = amount; // L: Cell Phone
            cellPhoneTotal += amount;
          } else if (category.includes('gas') || category.includes('mileage') || category.includes('fuel')) {
            row.getCell(13).value = amount; // M: Gas/Mileage
            gasTotal += amount;
          } else if (category.includes('copies') || category.includes('printing')) {
            row.getCell(14).value = amount; // N: Copies
            copiesTotal += amount;
          } else if (category.includes('dues') || category.includes('membership')) {
            row.getCell(15).value = amount; // O: Dues
            duesTotal += amount;
          } else if (category.includes('postage') || category.includes('shipping')) {
            row.getCell(16).value = amount; // P: Postage
            postageTotal += amount;
          } else if (category.includes('office')) {
            row.getCell(17).value = amount; // Q: Office Supplies
            officeTotal += amount;
          } else {
            row.getCell(18).value = amount; // R: Misc
            miscTotal += amount;
          }
          
          // Row total in column S (19)
          row.getCell(19).value = amount;
          row.getCell(19).numFmt = '$#,##0.00';
          grandTotal += amount;
          
          // Add borders to all cells in the row
          for (let col = 1; col <= 19; col++) {
            row.getCell(col).border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            // Format currency columns
            if (col >= 7 && col <= 19) {
              const cell = row.getCell(col);
              if (cell.value && typeof cell.value === 'number') {
                cell.numFmt = '$#,##0.00';
              }
            }
          }
          
          currentRow++;
        }
      });
    }

    // Fill remaining rows up to row 37 with empty bordered cells
    while (currentRow <= maxExpenseRow) {
      const row = expenseSheet.getRow(currentRow);
      for (let col = 1; col <= 19; col++) {
        row.getCell(col).value = '';
        row.getCell(col).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        // Set $0.00 for totals column
        if (col === 19) {
          row.getCell(col).value = 0;
          row.getCell(col).numFmt = '$#,##0.00';
        }
      }
      currentRow++;
    }

    // Add mileage total to gas column
    let mileageTotal = 0;
    if (mileageEntries && mileageEntries.length > 0) {
      mileageTotal = mileageEntries.reduce((sum: number, entry: MileageEntry) => 
        sum + (entry.reimbursableAmount || 0), 0
      );
      gasTotal = mileageTotal;
    }

    // Row 38: Empty row
    const row38 = expenseSheet.getRow(38);
    for (let col = 1; col <= 19; col++) {
      row38.getCell(col).value = '';
    }

    // Row 39: TOTALS
    const row39 = expenseSheet.getRow(39);
    row39.getCell(6).value = 'TOTALS';
    row39.getCell(6).font = { bold: true };
    row39.getCell(7).value = hotelTotal || '';
    row39.getCell(8).value = mealTotal || '';
    row39.getCell(9).value = entertainmentTotal || '';
    row39.getCell(10).value = transportTotal || '';
    row39.getCell(11).value = computerTotal || '';
    row39.getCell(12).value = cellPhoneTotal || '';
    row39.getCell(13).value = gasTotal || '';
    row39.getCell(14).value = copiesTotal || '';
    row39.getCell(15).value = duesTotal || '';
    row39.getCell(16).value = postageTotal || '';
    row39.getCell(17).value = officeTotal || '';
    row39.getCell(18).value = miscTotal || '';
    row39.getCell(19).value = grandTotal + mileageTotal;
    
    // Format and style totals row
    for (let col = 7; col <= 19; col++) {
      const cell = row39.getCell(col);
      if (cell.value && typeof cell.value === 'number') {
        cell.numFmt = '$#,##0.00';
        cell.font = { bold: true };
      }
      cell.border = {
        top: { style: 'double' },
        left: { style: 'thin' },
        bottom: { style: 'double' },
        right: { style: 'thin' }
      };
    }

    // Row 40: Explanation header
    const row40 = expenseSheet.getRow(40);
    row40.getCell(1).value = 'DATE';
    row40.getCell(2).value = '*EXPLANATION OF ENTERTAINMENT & MISC. EXPENSES';
    row40.getCell(6).value = 'AMOUNT';
    row40.getCell(7).value = 'Account Coding';
    
    // Rows 41-47: Account coding section
    const accountCoding = [
      { desc: 'Hotel', account: '5710' },
      { desc: 'Meals', account: '5714' },
      { desc: 'Entertainment', account: '5718' },
      { desc: 'Air', account: '5712' },
      { desc: 'Computer Sup', account: '5405' },
      { desc: 'Mileage/Gas', account: '5720' },
    ];

    const row42 = expenseSheet.getRow(42);
    row42.getCell(6).value = 'Desc.';
    row42.getCell(7).value = 'Account';
    row42.getCell(8).value = 'Amount';
    row42.getCell(10).value = 'Desc.';
    row42.getCell(11).value = 'Account';
    row42.getCell(12).value = 'Amount';

    const codingRow = 43;
    accountCoding.forEach((code, index) => {
      const row = expenseSheet.getRow(codingRow + Math.floor(index / 2));
      const colOffset = (index % 2) === 0 ? 6 : 10;
      row.getCell(colOffset).value = code.desc;
      row.getCell(colOffset + 1).value = code.account;
    });

    // Additional account codes in second column
    const additionalCodes = [
      { desc: 'Copies', account: '5560' },
      { desc: 'Other', account: '5718' },
      { desc: 'Dues&Sub', account: '5470' },
      { desc: 'Cell Phones', account: '5678' },
      { desc: 'Office Supplies', account: '5560' },
      { desc: 'Postage', account: '5590' },
    ];

    additionalCodes.forEach((code, index) => {
      const row = expenseSheet.getRow(43 + index);
      row.getCell(10).value = code.desc;
      row.getCell(11).value = code.account;
    });

    // Rows 51-53: Certification text
    const row51 = expenseSheet.getRow(51);
    row51.getCell(14).value = 'I HEREBY CERTIFY THAT ALL THE EXPENSES ABOVE ARE DIRECTLY';
    const row52 = expenseSheet.getRow(52);
    row52.getCell(14).value = 'RELATED TO AND/OR ASSOCIATED WITH THE ACTIVE CONDUCT OF THE';
    const row53 = expenseSheet.getRow(53);
    row53.getCell(14).value = "COMPANY'S BUSINESS.";

    // Row 54: Summary section
    const row54 = expenseSheet.getRow(54);
    row54.getCell(6).value = 'SUMMARY';
    row54.getCell(9).value = 'AMOUNT';
    row54.getCell(6).font = { bold: true };
    row54.getCell(14).value = 'TOTAL EXPENSES';
    row54.getCell(14).font = { bold: true };
    row54.getCell(19).value = grandTotal + mileageTotal;
    row54.getCell(19).numFmt = '$#,##0.00';
    row54.getCell(19).font = { bold: true };
    row54.getCell(20).value = 'EMPLOYEE (SIGNATURE)';
    row54.getCell(21).value = 'DATE SIGNED';

    // Row 55: Net advances
    const row55 = expenseSheet.getRow(55);
    row55.getCell(14).value = 'NET ADVANCES';
    row55.getCell(19).value = 0;
    row55.getCell(19).numFmt = '$#,##0.00';

    // Row 56: Approved by
    const row56 = expenseSheet.getRow(56);
    row56.getCell(20).value = 'APPROVED BY:';
    row56.getCell(21).value = 'DATE SIGNED';

    // Row 57: Balance due
    const row57 = expenseSheet.getRow(57);
    row57.getCell(14).value = 'BALANCE DUE EMPLOYEE';
    row57.getCell(14).font = { bold: true };
    row57.getCell(19).value = grandTotal + mileageTotal;
    row57.getCell(19).numFmt = '$#,##0.00';
    row57.getCell(19).font = { bold: true };

    // Row 59: Revision note
    const row59 = expenseSheet.getRow(59);
    row59.getCell(1).value = 'revision 1/03/06';
    row59.getCell(1).font = { size: 8, italic: true };

    // Create Mileage Details sheet if there are mileage entries
    if (mileageEntries && mileageEntries.length > 0) {
      const mileageSheet = workbook.addWorksheet('Mileage Details');
      
      // Set column widths
      mileageSheet.columns = [
        { width: 12 }, // Date
        { width: 35 }, // From
        { width: 35 }, // To
        { width: 30 }, // Purpose
        { width: 10 }, // Miles
        { width: 12 }, // Amount
      ];

      // Title
      mileageSheet.mergeCells('A1:F1');
      const mileageTitleCell = mileageSheet.getCell('A1');
      mileageTitleCell.value = 'MILEAGE LOG';
      mileageTitleCell.font = { size: 14, bold: true };
      mileageTitleCell.alignment = { horizontal: 'center' };

      // Employee name
      mileageSheet.mergeCells('A2:F2');
      const mileageNameCell = mileageSheet.getCell('A2');
      mileageNameCell.value = `Employee: ${employeeName}`;
      mileageNameCell.font = { bold: true };

      // Headers
      const mileageHeaders = ['Date', 'From', 'To', 'Purpose', 'Miles', 'Amount'];
      const mileageHeaderRow = mileageSheet.getRow(4);
      mileageHeaders.forEach((header, index) => {
        const cell = mileageHeaderRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Add mileage entries
      let mileageRow = 5;
      let totalMiles = 0;
      
      mileageEntries.forEach((entry: MileageEntry) => {
        const row = mileageSheet.getRow(mileageRow);
        
        row.getCell(1).value = entry.date;
        row.getCell(2).value = entry.startAddress;
        row.getCell(3).value = entry.endAddress;
        row.getCell(4).value = entry.businessPurpose;
        row.getCell(5).value = entry.reimbursableDistance;
        row.getCell(6).value = entry.reimbursableAmount;
        row.getCell(6).numFmt = '$#,##0.00';
        
        // Add borders
        for (let col = 1; col <= 6; col++) {
          row.getCell(col).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
        
        totalMiles += entry.reimbursableDistance || 0;
        mileageRow++;
      });

      // Add some empty rows for future entries
      for (let i = 0; i < 20; i++) {
        const row = mileageSheet.getRow(mileageRow);
        for (let col = 1; col <= 6; col++) {
          row.getCell(col).value = '';
          row.getCell(col).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
        mileageRow++;
      }

      // Total row
      const mileageTotalRow = mileageSheet.getRow(mileageRow + 1);
      mileageTotalRow.getCell(4).value = 'TOTAL';
      mileageTotalRow.getCell(4).font = { bold: true };
      mileageTotalRow.getCell(5).value = totalMiles;
      mileageTotalRow.getCell(5).font = { bold: true };
      mileageTotalRow.getCell(6).value = mileageTotal;
      mileageTotalRow.getCell(6).numFmt = '$#,##0.00';
      mileageTotalRow.getCell(6).font = { bold: true };
      
      // Add borders to total row
      for (let col = 1; col <= 6; col++) {
        mileageTotalRow.getCell(col).border = {
          top: { style: 'double' },
          bottom: { style: 'double' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }

    // Generate the Excel file
    console.log('[API] Generating Excel buffer...');
    const buffer = await workbook.xlsx.writeBuffer();
    console.log('[API] Excel buffer generated, size:', buffer.byteLength);

    // Create filename with employee name and date
    const today = new Date().toISOString().split('T')[0];
    const fileName = `Expense Report - ${employeeName} - ${today}.xlsx`;

    console.log('[API] Returning file:', fileName);
    // Return the file
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}