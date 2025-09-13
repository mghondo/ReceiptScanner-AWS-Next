import { NextRequest, NextResponse } from 'next/server';

interface CalculateDistanceRequest {
  startAddress: string;
  endAddress: string;
  roundTrip: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const { startAddress, endAddress, roundTrip }: CalculateDistanceRequest = await req.json();

    // Validate required fields
    if (!startAddress || !endAddress) {
      return NextResponse.json(
        { error: 'Start address and end address are required' },
        { status: 400 }
      );
    }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!googleApiKey) {
      console.error('Missing GOOGLE_PLACES_API_KEY environment variable');
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    // Use Google Distance Matrix API to calculate distance
    const encodedStart = encodeURIComponent(startAddress);
    const encodedEnd = encodeURIComponent(endAddress);
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodedStart}&destinations=${encodedEnd}&units=imperial&key=${googleApiKey}`;

    console.log(`[MileageCalculate] Making request to Google Distance Matrix API`);
    console.log(`[MileageCalculate] From: ${startAddress}`);
    console.log(`[MileageCalculate] To: ${endAddress}`);
    
    const response = await fetch(url);
    const data = await response.json();

    console.log(`[MileageCalculate] Google API response status:`, data.status);

    if (data.status !== 'OK') {
      console.error(`[MileageCalculate] Google API error:`, data);
      return NextResponse.json(
        { error: `Google API error: ${data.status}` },
        { status: 400 }
      );
    }

    const element = data.rows[0]?.elements[0];
    
    if (!element || element.status !== 'OK') {
      console.error(`[MileageCalculate] No route found or element error:`, element);
      return NextResponse.json(
        { error: 'No route found between the specified addresses. Please check the addresses and try again.' },
        { status: 400 }
      );
    }

    // Extract distance in miles (Google returns in meters, but we requested imperial units)
    const distanceText = element.distance.text;
    const distanceValue = element.distance.value; // in meters
    
    // Convert meters to miles (1 mile = 1609.34 meters)
    const distanceInMiles = distanceValue / 1609.34;
    
    console.log(`[MileageCalculate] Distance: ${distanceText} (${distanceInMiles.toFixed(2)} miles)`);
    console.log(`[MileageCalculate] Duration: ${element.duration.text}`);

    return NextResponse.json({
      success: true,
      distance: parseFloat(distanceInMiles.toFixed(2)), // Round to 2 decimal places
      distanceText: distanceText,
      duration: element.duration.text,
      roundTrip: roundTrip,
      addresses: {
        start: startAddress,
        end: endAddress,
      }
    });

  } catch (error) {
    console.error('[MileageCalculate] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate distance',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}