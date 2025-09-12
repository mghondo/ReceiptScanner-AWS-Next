import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    // Read the CSV template from the root directory
    const templatePath = join(process.cwd(), '..', 'Expense report-Table 1.csv');
    const csvContent = readFileSync(templatePath, 'utf-8');
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[CSV Template API] Error reading template:', error);
    return NextResponse.json(
      { error: 'Failed to load CSV template' },
      { status: 500 }
    );
  }
}