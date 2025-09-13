import { NextRequest, NextResponse } from 'next/server';

interface MileageEntryData {
  id: string;
  date: string;
  startAddress: string;
  endAddress: string;
  businessPurpose: string;
  roundTrip: boolean;
  personalCommute: number;
  calculatedDistance: number;
  reimbursableDistance: number;
  reimbursableAmount: number;
  createdAt: Date;
  companyId?: string; // For multi-tenant support
}

// In-memory storage for demo purposes
// In production, this would be replaced with a proper database
let mileageEntries: MileageEntryData[] = [];

export async function GET(req: NextRequest) {
  try {
    console.log(`[MileageEntries] GET request - returning ${mileageEntries.length} entries`);
    
    // Sort by date descending (newest first)
    const sortedEntries = [...mileageEntries].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({
      success: true,
      entries: sortedEntries,
      total: sortedEntries.length
    });

  } catch (error) {
    console.error('[MileageEntries] GET Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch mileage entries',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const entryData: Omit<MileageEntryData, 'id' | 'createdAt'> = await req.json();

    // Validate required fields
    if (!entryData.date || !entryData.startAddress || !entryData.endAddress || !entryData.businessPurpose) {
      return NextResponse.json(
        { error: 'Missing required fields: date, startAddress, endAddress, businessPurpose' },
        { status: 400 }
      );
    }

    if (entryData.calculatedDistance === undefined || entryData.reimbursableDistance === undefined || entryData.reimbursableAmount === undefined) {
      return NextResponse.json(
        { error: 'Distance calculation required before saving' },
        { status: 400 }
      );
    }

    // Create new entry with generated ID and timestamp
    const newEntry: MileageEntryData = {
      ...entryData,
      id: `mileage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };

    // Add to in-memory storage
    mileageEntries.push(newEntry);

    console.log(`[MileageEntries] POST - Created new entry with ID: ${newEntry.id}`);
    console.log(`[MileageEntries] Entry details:`, {
      date: newEntry.date,
      purpose: newEntry.businessPurpose,
      miles: newEntry.reimbursableDistance,
      amount: newEntry.reimbursableAmount
    });

    return NextResponse.json({
      success: true,
      entry: newEntry,
      message: 'Mileage entry created successfully'
    });

  } catch (error) {
    console.error('[MileageEntries] POST Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create mileage entry',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const entryId = url.searchParams.get('id');

    if (!entryId) {
      return NextResponse.json(
        { error: 'Entry ID is required' },
        { status: 400 }
      );
    }

    // Find and remove entry
    const initialLength = mileageEntries.length;
    mileageEntries = mileageEntries.filter(entry => entry.id !== entryId);

    if (mileageEntries.length === initialLength) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    console.log(`[MileageEntries] DELETE - Removed entry with ID: ${entryId}`);

    return NextResponse.json({
      success: true,
      message: 'Mileage entry deleted successfully'
    });

  } catch (error) {
    console.error('[MileageEntries] DELETE Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete mileage entry',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}