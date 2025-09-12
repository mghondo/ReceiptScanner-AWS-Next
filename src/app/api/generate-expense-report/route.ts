import { NextRequest, NextResponse } from 'next/server';
import { ExcelGenerator } from '@/lib/excel-generator';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    console.log('[Generate Expense Report API] Processing request');
    console.log('[Generate Expense Report API] Employee:', data.employeeName);
    console.log('[Generate Expense Report API] Receipts:', data.receipts?.length);
    
    // Generate a new Excel file from scratch (avoids merged cell issues)
    const excelBuffer = await ExcelGenerator.generateExpenseReport(data);
    
    console.log('[Generate Expense Report API] Excel generated successfully, size:', excelBuffer.length);
    
    // Return the Excel file as a response
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="expense_report.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[Generate Expense Report API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate expense report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}