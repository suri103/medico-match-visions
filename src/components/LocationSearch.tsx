
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
import { countries, statesByCountry, citiesByState } from '@/features/matches/data/constants';

interface LocationSearchProps {
  selectedCountry: string | null;
  setSelectedCountry: (country: string | null) => void;
  selectedState: string | null;
  setSelectedState: (state: string | null) => void;
  selectedCity: string | null;
  setSelectedCity: (city: string | null) => void;
  className?: string;
  availableStates?: { value: string; label: string }[];
  availableCities?: { value: string; label: string }[];
}

const LocationSearch: React.FC<LocationSearchProps> = ({
  selectedCountry,
  setSelectedCountry,
  selectedState,
  setSelectedState,
  selectedCity,
  setSelectedCity,
  className,
  availableStates,
  availableCities
}) => {
  // Use prop-provided lists if available (from hook), otherwise compute from shared data
  const effectiveStates = availableStates !== undefined
    ? availableStates
    : (selectedCountry ? (statesByCountry[selectedCountry as keyof typeof statesByCountry] || []) : []);
  const effectiveCities = availableCities !== undefined
    ? availableCities
    : (selectedState ? (citiesByState[selectedState as keyof typeof citiesByState] || []) : []);

  // Backward-compatible wrappers for internal usage
  const getAvailableStates = () => effectiveStates;
  const getAvailableCities = () => effectiveCities;

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

export { LocationSearch };
