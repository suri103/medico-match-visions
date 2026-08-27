import React from 'react';
import { 
  Sidebar, SidebarHeader, SidebarContent, 
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarTrigger 
} from '@/components/ui/sidebar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Search } from 'lucide-react';
import { LocationSearch } from '@/components/LocationSearch';

import { 
  degreesList as defaultDegreesList,
  religionList as defaultReligionList, 
  casteList as defaultCasteList,
  gotraList as defaultGotraList,
  subcasteSuggestions as defaultSubcasteSuggestions,
  motherTongueList as defaultMotherTongueList
} from '../data/constants';

interface SearchSidebarProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  minAge: number[];
  setMinAge: (value: number[]) => void;
  maxAge: number[];
  setMaxAge: (value: number[]) => void;
  specialties: string[];
  setSpecialties: (value: string[]) => void;
  selectedDegrees?: string[];
  handleDegreeChange?: (degree: string) => void;
  onlineOnly: boolean;
  setOnlineOnly: (value: boolean) => void;
  selectedCountry: string | null;
  setSelectedCountry: (value: string | null) => void;
  selectedState: string | null;
  setSelectedState: (value: string | null) => void;
  selectedCity: string | null;
  setSelectedCity: (value: string | null) => void;
  selectedOrientation: string[];
  handleOrientationChange: (orientation: string) => void;
  selectedEthnicity: string[];
  handleEthnicityChange: (ethnicity: string) => void;
  selectedReligion?: string;
  setSelectedReligion?: (value: string) => void;
  selectedCaste?: string;
  setSelectedCaste?: (value: string) => void;
  selectedCast?: string;
  setSelectedCast?: (value: string) => void;
  selectedSubcaste?: string;
  setSelectedSubcaste?: (value: string) => void;
  selectedGotra?: string;
  setSelectedGotra?: (value: string) => void;
  selectedMotherTongue?: string[];
  handleMotherTongueChange?: (language: string) => void;
  excludeSameGotra?: boolean;
  setExcludeSameGotra?: (value: boolean) => void;
  minGunas?: number;
  setMinGunas?: (value: number) => void;
  selectedColor: string;
  setSelectedColor: (value: string) => void;
  availableStates: {value: string, label: string}[];
  availableCities: {value: string, label: string}[];
  handleSearch: (e: React.FormEvent) => void;
  handleReset: () => void;
  specialtiesList: string[];
  degreesList?: string[];
  orientationsList: string[];
  ethnicityList: string[];
  religionList?: string[];
  casteList?: string[];
  castList?: string[];
  subcasteSuggestions?: string[];
  gotraList?: string[];
  motherTongueList?: string[];
  colorList: string[];
}

const SearchSidebar: React.FC<SearchSidebarProps> = ({
  searchTerm,
  setSearchTerm,
  minAge,
  setMinAge,
  maxAge,
  setMaxAge,
  specialties,
  setSpecialties,
  selectedDegrees = [],
  handleDegreeChange,
  onlineOnly,
  setOnlineOnly,
  selectedCountry,
  setSelectedCountry,
  selectedState,
  setSelectedState,
  selectedCity,
  setSelectedCity,
  selectedOrientation,
  handleOrientationChange,
  selectedEthnicity,
  handleEthnicityChange,
  selectedReligion = 'No preference',
  setSelectedReligion,
  selectedCaste,
  setSelectedCaste,
  selectedCast = 'No preference',
  setSelectedCast,
  selectedSubcaste = '',
  setSelectedSubcaste,
  selectedGotra = 'No preference',
  setSelectedGotra,
  selectedMotherTongue = [],
  handleMotherTongueChange,
  excludeSameGotra = false,
  setExcludeSameGotra,
  minGunas = 0,
  setMinGunas,
  selectedColor,
  setSelectedColor,
  availableStates,
  availableCities,
  handleSearch,
  handleReset,
  specialtiesList,
  degreesList = defaultDegreesList,
  orientationsList,
  ethnicityList,
  religionList = defaultReligionList,
  casteList = defaultCasteList,
  subcasteSuggestions = defaultSubcasteSuggestions,
  gotraList = defaultGotraList,
  motherTongueList = defaultMotherTongueList,
  colorList
}) => {

  const activeCasteValue = selectedCaste ?? selectedCast;
  const onCasteChange = (val: string) => {
    setSelectedCaste?.(val);
    setSelectedCast?.(val);
  };

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-4 border-b flex flex-row justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Filter className="h-5 w-5 text-mediblue-600" />
          Filter Matches
        </h2>
        <SidebarTrigger />
      </SidebarHeader>
      
      <SidebarContent>
        <form onSubmit={handleSearch}>
          <SidebarGroup>
            <SidebarGroupLabel>Keyword Search</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search doctors, hospitals, cities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Age Range</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{minAge[0]} years</span>
                  <span className="text-sm text-gray-500">{maxAge[0]} years</span>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Age</Label>
                  <Slider 
                    value={minAge} 
                    min={21} 
                    max={65} 
                    step={1}
                    onValueChange={(val) => {
                      setMinAge(val);
                      if (val[0] > maxAge[0]) setMaxAge(val);
                    }} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum Age</Label>
                  <Slider 
                    value={maxAge} 
                    min={21} 
                    max={65} 
                    step={1}
                    onValueChange={(val) => {
                      setMaxAge(val);
                      if (val[0] < minAge[0]) setMinAge(val);
                    }} 
                  />
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Medical Degree / Qualification</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {degreesList.map((deg) => (
                  <div key={deg} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`sidebar-degree-${deg}`} 
                      checked={selectedDegrees.includes(deg)}
                      onCheckedChange={() => handleDegreeChange?.(deg)}
                    />
                    <Label htmlFor={`sidebar-degree-${deg}`} className="text-sm font-normal cursor-pointer">
                      {deg}
                    </Label>
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Specialty</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {specialtiesList.map((specialty) => (
                  <div key={specialty} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`sidebar-specialty-${specialty}`} 
                      checked={specialties.includes(specialty)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSpecialties([...specialties, specialty]);
                        } else {
                          setSpecialties(specialties.filter((s) => s !== specialty));
                        }
                      }}
                    />
                    <Label htmlFor={`sidebar-specialty-${specialty}`} className="text-sm font-normal cursor-pointer">
                      {specialty}
                    </Label>
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Location</SidebarGroupLabel>
            <SidebarGroupContent className="p-4 space-y-4">
              <LocationSearch
                selectedCountry={selectedCountry}
                setSelectedCountry={setSelectedCountry}
                selectedState={selectedState}
                setSelectedState={setSelectedState}
                selectedCity={selectedCity}
                setSelectedCity={setSelectedCity}
                availableStates={availableStates}
                availableCities={availableCities}
              />
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Sexual Orientation</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <div className="space-y-2">
                {orientationsList.map((orientation) => (
                  <div key={orientation} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`sidebar-orientation-${orientation}`} 
                      checked={selectedOrientation.includes(orientation)}
                      onCheckedChange={() => handleOrientationChange(orientation)}
                    />
                    <Label htmlFor={`sidebar-orientation-${orientation}`} className="text-sm font-normal cursor-pointer">
                      {orientation}
                    </Label>
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Ethnicity</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <div className="space-y-2">
                {ethnicityList.map((ethnicity) => (
                  <div key={ethnicity} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`sidebar-ethnicity-${ethnicity}`} 
                      checked={selectedEthnicity.includes(ethnicity)}
                      onCheckedChange={() => handleEthnicityChange(ethnicity)}
                    />
                    <Label htmlFor={`sidebar-ethnicity-${ethnicity}`} className="text-sm font-normal cursor-pointer">
                      {ethnicity}
                    </Label>
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Religion</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <Select 
                value={selectedReligion} 
                onValueChange={(val) => setSelectedReligion?.(val)}
              >
                <SelectTrigger id="religion">
                  <SelectValue placeholder="Select religion" />
                </SelectTrigger>
                <SelectContent>
                  {religionList.map((rel) => (
                    <SelectItem key={rel} value={rel}>
                      {rel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Caste</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <Select 
                value={activeCasteValue} 
                onValueChange={onCasteChange}
              >
                <SelectTrigger id="caste">
                  <SelectValue placeholder="Select caste" />
                </SelectTrigger>
                <SelectContent>
                  {casteList.map((caste) => (
                    <SelectItem key={caste} value={caste}>
                      {caste}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Subcaste</SidebarGroupLabel>
            <SidebarGroupContent className="p-4 space-y-2">
              <Select 
                value={selectedSubcaste || 'No preference'} 
                onValueChange={(val) => setSelectedSubcaste?.(val === 'No preference' ? '' : val)}
              >
                <SelectTrigger id="subcaste-select">
                  <SelectValue placeholder="Popular subcastes" />
                </SelectTrigger>
                <SelectContent>
                  {subcasteSuggestions.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                placeholder="Or type specific subcaste..." 
                value={selectedSubcaste}
                onChange={(e) => setSelectedSubcaste?.(e.target.value)}
                className="text-xs h-8"
              />
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Gotra</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <Select 
                value={selectedGotra} 
                onValueChange={(val) => setSelectedGotra?.(val)}
              >
                <SelectTrigger id="gotra">
                  <SelectValue placeholder="Select gotra" />
                </SelectTrigger>
                <SelectContent>
                  {gotraList.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {setExcludeSameGotra && (
                <div className="flex items-center space-x-2 mt-3 pt-2 border-t border-slate-100">
                  <Checkbox 
                    id="sidebar-exclude-gotra" 
                    checked={excludeSameGotra}
                    onCheckedChange={(checked) => setExcludeSameGotra(!!checked)}
                  />
                  <Label htmlFor="sidebar-exclude-gotra" className="text-xs font-normal text-slate-700 cursor-pointer">
                    Exclude Same Gotra (Sagotra)
                  </Label>
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Mother Tongue</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {motherTongueList.map((lang) => (
                  <div key={lang} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`mt-${lang}`} 
                      checked={selectedMotherTongue.includes(lang)}
                      onCheckedChange={() => handleMotherTongueChange?.(lang)}
                    />
                    <Label htmlFor={`mt-${lang}`} className="text-xs font-normal cursor-pointer">
                      {lang}
                    </Label>
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Kundali Match (36 Gunas)</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <div className="space-y-2">
                <Select 
                  value={minGunas.toString()} 
                  onValueChange={(val) => setMinGunas?.(parseInt(val, 10))}
                >
                  <SelectTrigger id="min-gunas">
                    <SelectValue placeholder="Minimum Gunas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any Compatibility</SelectItem>
                    <SelectItem value="18">18+ Gunas (Auspicious / Shubh)</SelectItem>
                    <SelectItem value="24">24+ Gunas (Good Alignment)</SelectItem>
                    <SelectItem value="28">28+ Gunas (Uttam / Excellent)</SelectItem>
                    <SelectItem value="32">32+ Gunas (Highest Match)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">Filters doctors meeting traditional Vedic Ashta Koota thresholds.</p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Skin Tone</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <Select 
                value={selectedColor || "any_color"} 
                onValueChange={(value) => setSelectedColor(value === "any_color" ? "" : value)}
              >
                <SelectTrigger id="color">
                  <SelectValue placeholder="Select skin tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any_color">Any</SelectItem>
                  {colorList.map((color) => (
                    <SelectItem key={color} value={color}>
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupContent className="p-4">
              <div className="flex items-center space-x-2 mb-6">
                <Checkbox 
                  id="sidebar-online" 
                  checked={onlineOnly}
                  onCheckedChange={(checked) => setOnlineOnly(!!checked)}
                />
                <Label htmlFor="sidebar-online" className="text-sm font-normal cursor-pointer">
                  Online doctors only
                </Label>
              </div>
              
              <div className="space-y-2">
                <Button type="submit" className="w-full bg-mediblue-600 hover:bg-mediblue-700">
                  <Search className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={handleReset}>
                  Reset Filters
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </form>
      </SidebarContent>
    </Sidebar>
  );
};

export default SearchSidebar;
