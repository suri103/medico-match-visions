
import React, { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

// Sample data for countries
const countries = [
  { value: 'india', label: 'India' },
  { value: 'united_states', label: 'United States' },
  { value: 'canada', label: 'Canada' },
  { value: 'australia', label: 'Australia' },
  { value: 'united_kingdom', label: 'United Kingdom' },
];

// Sample data for states by country
const statesByCountry = {
  india: [
    { value: 'maharashtra', label: 'Maharashtra' },
    { value: 'delhi', label: 'Delhi' },
    { value: 'karnataka', label: 'Karnataka' },
    { value: 'tamil_nadu', label: 'Tamil Nadu' },
    { value: 'telangana', label: 'Telangana' },
  ],
  united_states: [
    { value: 'new_york', label: 'New York' },
    { value: 'california', label: 'California' },
    { value: 'texas', label: 'Texas' },
    { value: 'florida', label: 'Florida' },
  ],
  canada: [
    { value: 'ontario', label: 'Ontario' },
    { value: 'quebec', label: 'Quebec' },
    { value: 'british_columbia', label: 'British Columbia' },
  ],
  australia: [
    { value: 'new_south_wales', label: 'New South Wales' },
    { value: 'victoria', label: 'Victoria' },
    { value: 'queensland', label: 'Queensland' },
  ],
  united_kingdom: [
    { value: 'england', label: 'England' },
    { value: 'scotland', label: 'Scotland' },
    { value: 'wales', label: 'Wales' },
  ],
};

// Sample data for cities by state
const citiesByState = {
  maharashtra: [
    { value: 'mumbai', label: 'Mumbai' },
    { value: 'pune', label: 'Pune' },
    { value: 'nagpur', label: 'Nagpur' },
  ],
  delhi: [
    { value: 'new_delhi', label: 'New Delhi' },
    { value: 'old_delhi', label: 'Old Delhi' },
  ],
  karnataka: [
    { value: 'bangalore', label: 'Bangalore' },
    { value: 'mysore', label: 'Mysore' },
  ],
  tamil_nadu: [
    { value: 'chennai', label: 'Chennai' },
    { value: 'coimbatore', label: 'Coimbatore' },
  ],
  telangana: [
    { value: 'hyderabad', label: 'Hyderabad' },
    { value: 'warangal', label: 'Warangal' },
  ],
  new_york: [
    { value: 'nyc', label: 'New York City' },
    { value: 'buffalo', label: 'Buffalo' },
    { value: 'albany', label: 'Albany' },
  ],
  california: [
    { value: 'los_angeles', label: 'Los Angeles' },
    { value: 'san_francisco', label: 'San Francisco' },
    { value: 'san_diego', label: 'San Diego' },
  ],
  ontario: [
    { value: 'toronto', label: 'Toronto' },
    { value: 'ottawa', label: 'Ottawa' },
    { value: 'hamilton', label: 'Hamilton' },
  ],
};

interface LocationSearchProps {
  selectedCountry: string | null;
  setSelectedCountry: (country: string | null) => void;
  selectedState: string | null;
  setSelectedState: (state: string | null) => void;
  selectedCity: string | null;
  setSelectedCity: (city: string | null) => void;
  className?: string;
}

const LocationSearch: React.FC<LocationSearchProps> = ({
  selectedCountry,
  setSelectedCountry,
  selectedState,
  setSelectedState,
  selectedCity,
  setSelectedCity,
  className
}) => {
  const [availableStates, setAvailableStates] = useState<{value: string, label: string}[]>([]);
  const [availableCities, setAvailableCities] = useState<{value: string, label: string}[]>([]);

  // Update available states when country changes
  useEffect(() => {
    if (selectedCountry) {
      setAvailableStates(statesByCountry[selectedCountry as keyof typeof statesByCountry] || []);
      setSelectedState(null);
      setSelectedCity(null);
    } else {
      setAvailableStates([]);
      setSelectedState(null);
      setSelectedCity(null);
    }
  }, [selectedCountry, setSelectedState, setSelectedCity]);

  // Update available cities when state changes
  useEffect(() => {
    if (selectedState) {
      setAvailableCities(citiesByState[selectedState as keyof typeof citiesByState] || []);
      setSelectedCity(null);
    } else {
      setAvailableCities([]);
      setSelectedCity(null);
    }
  }, [selectedState, setSelectedCity]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      <div>
        <Label htmlFor="country" className="block mb-2">Country</Label>
        <Select 
          value={selectedCountry || ""} 
          onValueChange={(value) => setSelectedCountry(value !== "" ? value : null)}
        >
          <SelectTrigger id="country">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            <SelectItem value="">Any country</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country.value} value={country.value}>
                {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="state" className="block mb-2">State/Province</Label>
        <Select 
          value={selectedState || ""} 
          onValueChange={(value) => setSelectedState(value !== "" ? value : null)}
          disabled={!selectedCountry || availableStates.length === 0}
        >
          <SelectTrigger id="state">
            <SelectValue placeholder={selectedCountry ? "Select state" : "Select country first"} />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            <SelectItem value="">Any state</SelectItem>
            {availableStates.map((state) => (
              <SelectItem key={state.value} value={state.value}>
                {state.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="city" className="block mb-2">City</Label>
        <Select 
          value={selectedCity || ""} 
          onValueChange={(value) => setSelectedCity(value !== "" ? value : null)}
          disabled={!selectedState || availableCities.length === 0}
        >
          <SelectTrigger id="city">
            <SelectValue placeholder={selectedState ? "Select city" : "Select state first"} />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            <SelectItem value="">Any city</SelectItem>
            {availableCities.map((city) => (
              <SelectItem key={city.value} value={city.value}>
                {city.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export { LocationSearch, countries, statesByCountry, citiesByState };
