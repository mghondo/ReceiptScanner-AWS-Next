'use client';

import { useState, useEffect, useRef } from 'react';

// Extend Window interface to include Google Maps
declare global {
  interface Window {
    google: {
      maps: {
        places: {
          Autocomplete: unknown;
        };
      };
    };
  }
}

interface MileageEntryData {
  id?: string;
  date: string;
  startAddress: string;
  endAddress: string;
  businessPurpose: string;
  roundTrip: boolean;
  personalCommute: number;
  calculatedDistance?: number;
  reimbursableDistance?: number;
  reimbursableAmount?: number;
}

interface MileageEntryProps {
  onSave: (entry: MileageEntryData) => void;
  isCalculating: boolean;
}

const IRS_MILEAGE_RATE = 0.67; // $0.67 per mile for 2024

export default function MileageEntry({ onSave, isCalculating }: MileageEntryProps) {
  const [formData, setFormData] = useState<MileageEntryData>({
    date: new Date().toISOString().split('T')[0], // Today's date
    startAddress: '',
    endAddress: '',
    businessPurpose: '',
    roundTrip: false,
    personalCommute: 0,
  });

  const [isFormValid, setIsFormValid] = useState(false);
  const startAddressRef = useRef<HTMLInputElement>(null);
  const endAddressRef = useRef<HTMLInputElement>(null);
  const startAutocompleteRef = useRef<unknown>(null);
  const endAutocompleteRef = useRef<unknown>(null);

  // Update form validation whenever form data changes
  const validateForm = (data: MileageEntryData) => {
    const isValid = 
      data.date !== '' &&
      data.startAddress.trim() !== '' &&
      data.endAddress.trim() !== '' &&
      data.businessPurpose.trim() !== '';
    setIsFormValid(isValid);
  };

  const handleInputChange = (field: keyof MileageEntryData, value: string | number | boolean) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    validateForm(newData);
  };

  const handleCalculateDistance = async () => {
    if (!isFormValid) return;

    try {
      const response = await fetch('/api/mileage/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startAddress: formData.startAddress,
          endAddress: formData.endAddress,
          roundTrip: formData.roundTrip,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate distance');
      }

      const result = await response.json();
      
      const totalDistance = result.distance * (formData.roundTrip ? 2 : 1);
      const reimbursableDistance = Math.max(0, totalDistance - formData.personalCommute);
      const reimbursableAmount = reimbursableDistance * IRS_MILEAGE_RATE;

      const updatedData = {
        ...formData,
        calculatedDistance: totalDistance,
        reimbursableDistance,
        reimbursableAmount,
      };

      setFormData(updatedData);
    } catch (error) {
      console.error('Error calculating distance:', error);
      alert('Failed to calculate distance. Please check the addresses and try again.');
    }
  };

  const handleSave = () => {
    if (formData.calculatedDistance && formData.reimbursableDistance !== undefined) {
      onSave(formData);
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        startAddress: '',
        endAddress: '',
        businessPurpose: '',
        roundTrip: false,
        personalCommute: 0,
      });
      setIsFormValid(false);
    }
  };

  // Initialize Google Places Autocomplete
  useEffect(() => {
    const initializeAutocomplete = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        // Initialize start address autocomplete
        if (startAddressRef.current && !startAutocompleteRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          startAutocompleteRef.current = new (window.google.maps.places.Autocomplete as any)(
            startAddressRef.current,
            { 
              types: ['address'],
              componentRestrictions: { country: 'us' } // Restrict to US addresses
            }
          );
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (startAutocompleteRef.current as any).addListener('place_changed', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const place = (startAutocompleteRef.current as any)?.getPlace();
            if (place && place.formatted_address) {
              setFormData(prevData => {
                const newData = { ...prevData, startAddress: place.formatted_address };
                validateForm(newData);
                return newData;
              });
            }
          });
        }

        // Initialize end address autocomplete
        if (endAddressRef.current && !endAutocompleteRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          endAutocompleteRef.current = new (window.google.maps.places.Autocomplete as any)(
            endAddressRef.current,
            { 
              types: ['address'],
              componentRestrictions: { country: 'us' } // Restrict to US addresses
            }
          );
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (endAutocompleteRef.current as any).addListener('place_changed', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const place = (endAutocompleteRef.current as any)?.getPlace();
            if (place && place.formatted_address) {
              setFormData(prevData => {
                const newData = { ...prevData, endAddress: place.formatted_address };
                validateForm(newData);
                return newData;
              });
            }
          });
        }
      }
    };

    // Try to initialize immediately
    initializeAutocomplete();

    // If Google Maps isn't loaded yet, try again after a short delay
    const timer = setTimeout(initializeAutocomplete, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Load Google Maps Places API
  useEffect(() => {
    // Check if Google Maps is already loaded or being loaded
    if (window.google || document.querySelector('script[src*="maps.googleapis.com"]')) {
      return;
    }

    const script = document.createElement('script');
    // Use the MYNEW_ prefixed key, fallback to the regular one if needed
    const apiKey = process.env.MYNEW_NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || 'AIzaSyAwbwb4HGdofQSyunr_rSthv0sk00JmuOI';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    
    script.onload = () => {
      console.log('Google Maps Places API loaded successfully');
    };
    
    script.onerror = () => {
      console.error('Failed to load Google Maps Places API');
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Add Mileage Entry</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            required
          />
        </div>

        {/* Business Purpose */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business Purpose <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.businessPurpose}
            onChange={(e) => handleInputChange('businessPurpose', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            placeholder="e.g., Client meeting, business conference"
            required
          />
        </div>

        {/* Start Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Address <span className="text-red-500">*</span>
          </label>
          <input
            ref={startAddressRef}
            type="text"
            value={formData.startAddress}
            onChange={(e) => handleInputChange('startAddress', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            placeholder="Enter starting address"
            required
          />
        </div>

        {/* End Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End Address <span className="text-red-500">*</span>
          </label>
          <input
            ref={endAddressRef}
            type="text"
            value={formData.endAddress}
            onChange={(e) => handleInputChange('endAddress', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            placeholder="Enter destination address"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Personal Commute */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Personal Commute Deduction (miles)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={formData.personalCommute}
            onChange={(e) => handleInputChange('personalCommute', parseFloat(e.target.value) || 0)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            placeholder="0"
          />
          <p className="text-sm text-gray-500 mt-1">
            Miles to deduct for personal commute portion
          </p>
        </div>

        {/* Round Trip Checkbox */}
        <div className="flex items-center mt-8">
          <input
            type="checkbox"
            id="roundTrip"
            checked={formData.roundTrip}
            onChange={(e) => handleInputChange('roundTrip', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="roundTrip" className="ml-2 text-sm font-medium text-gray-700">
            Round Trip (double the distance)
          </label>
        </div>
      </div>

      {/* Calculate Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleCalculateDistance}
          disabled={!isFormValid || isCalculating}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            isFormValid && !isCalculating
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isCalculating ? 'Calculating...' : 'Calculate Distance & Amount'}
        </button>
      </div>

      {/* Calculation Results */}
      {formData.calculatedDistance !== undefined && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-medium text-green-800 mb-3">Distance Calculation</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-green-700">Total Distance:</span>
              <p className="text-green-800">{formData.calculatedDistance.toFixed(1)} miles</p>
            </div>
            <div>
              <span className="font-medium text-green-700">Personal Commute:</span>
              <p className="text-green-800">-{formData.personalCommute.toFixed(1)} miles</p>
            </div>
            <div>
              <span className="font-medium text-green-700">Reimbursable:</span>
              <p className="text-green-800">{formData.reimbursableDistance?.toFixed(1)} miles</p>
            </div>
            <div>
              <span className="font-medium text-green-700">Amount:</span>
              <p className="text-green-800 text-lg font-bold">
                ${formData.reimbursableAmount?.toFixed(2)}
              </p>
            </div>
          </div>
          
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Save Mileage Entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}