import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    // Read the Excel template from the parent directory
    const templatePath = join(process.cwd(), '..', 'Expense Report.xlsx');
    const excelBuffer = readFileSync(templatePath);
    
    return new NextResponse(Buffer.from(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'inline; filename="expense-report-template.xlsx"',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[Excel Template API] Error reading template:', error);
    return NextResponse.json(
      { error: 'Failed to load Excel template' },
      { status: 500 }
    );
  }
}