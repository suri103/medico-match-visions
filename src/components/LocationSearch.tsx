
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MapPin, Globe, Building2 } from 'lucide-react';

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
  texas: [
    { value: 'houston', label: 'Houston' },
    { value: 'dallas', label: 'Dallas' },
    { value: 'austin', label: 'Austin' },
  ],
  florida: [
    { value: 'miami', label: 'Miami' },
    { value: 'orlando', label: 'Orlando' },
    { value: 'tampa', label: 'Tampa' },
  ],
  ontario: [
    { value: 'toronto', label: 'Toronto' },
    { value: 'ottawa', label: 'Ottawa' },
    { value: 'hamilton', label: 'Hamilton' },
  ],
  quebec: [
    { value: 'montreal', label: 'Montreal' },
    { value: 'quebec_city', label: 'Quebec City' },
  ],
  british_columbia: [
    { value: 'vancouver', label: 'Vancouver' },
    { value: 'victoria', label: 'Victoria' },
  ],
  new_south_wales: [
    { value: 'sydney', label: 'Sydney' },
    { value: 'newcastle', label: 'Newcastle' },
  ],
  victoria: [
    { value: 'melbourne', label: 'Melbourne' },
    { value: 'geelong', label: 'Geelong' },
  ],
  queensland: [
    { value: 'brisbane', label: 'Brisbane' },
    { value: 'gold_coast', label: 'Gold Coast' },
  ],
  england: [
    { value: 'london', label: 'London' },
    { value: 'manchester', label: 'Manchester' },
    { value: 'birmingham', label: 'Birmingham' },
  ],
  scotland: [
    { value: 'edinburgh', label: 'Edinburgh' },
    { value: 'glasgow', label: 'Glasgow' },
  ],
  wales: [
    { value: 'cardiff', label: 'Cardiff' },
    { value: 'swansea', label: 'Swansea' },
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
  // Get appropriate lists based on selections
  const getAvailableStates = () => {
    if (selectedCountry) {
      return statesByCountry[selectedCountry as keyof typeof statesByCountry] || [];
    }
    return [];
  };

  const getAvailableCities = () => {
    if (selectedState) {
      return citiesByState[selectedState as keyof typeof citiesByState] || [];
    }
    return [];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <Label htmlFor="country" className="flex items-center gap-1 mb-1.5">
          <Globe className="h-4 w-4" />
          Country
        </Label>
        <Select 
          value={selectedCountry || "any_country"} 
          onValueChange={(value) => {
            setSelectedCountry(value !== "any_country" ? value : null);
            setSelectedState(null);
            setSelectedCity(null);
          }}
        >
          <SelectTrigger id="country" className="w-full">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent className="max-h-[240px]">
            <SelectItem value="any_country">Any country</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country.value} value={country.value}>
                {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="state" className="flex items-center gap-1 mb-1.5">
          <MapPin className="h-4 w-4" />
          State/Province
        </Label>
        <Select 
          value={selectedState || "any_state"} 
          onValueChange={(value) => {
            setSelectedState(value !== "any_state" ? value : null);
            setSelectedCity(null);
          }}
          disabled={!selectedCountry}
        >
          <SelectTrigger id="state" className="w-full">
            <SelectValue placeholder={selectedCountry ? "Select state" : "Select country first"} />
          </SelectTrigger>
          <SelectContent className="max-h-[240px]">
            <SelectItem value="any_state">Any state</SelectItem>
            {getAvailableStates().map((state) => (
              <SelectItem key={state.value} value={state.value}>
                {state.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="city" className="flex items-center gap-1 mb-1.5">
          <Building2 className="h-4 w-4" />
          City
        </Label>
        <Select 
          value={selectedCity || "any_city"} 
          onValueChange={(value) => setSelectedCity(value !== "any_city" ? value : null)}
          disabled={!selectedState}
        >
          <SelectTrigger id="city" className="w-full">
            <SelectValue placeholder={selectedState ? "Select city" : "Select state first"} />
          </SelectTrigger>
          <SelectContent className="max-h-[240px]">
            <SelectItem value="any_city">Any city</SelectItem>
            {getAvailableCities().map((city) => (
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
