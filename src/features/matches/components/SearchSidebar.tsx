
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

interface SearchSidebarProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  minAge: number[];
  setMinAge: (value: number[]) => void;
  maxAge: number[];
  setMaxAge: (value: number[]) => void;
  specialties: string[];
  setSpecialties: (value: string[]) => void;
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
  selectedCast: string;
  setSelectedCast: (value: string) => void;
  selectedColor: string;
  setSelectedColor: (value: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  handleReset: () => void;
  specialtiesList: string[];
  orientationsList: string[];
  ethnicityList: string[];
  castList: string[];
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
  selectedCast,
  setSelectedCast,
  selectedColor,
  setSelectedColor,
  handleSearch,
  handleReset,
  specialtiesList,
  orientationsList,
  ethnicityList,
  castList,
  colorList
}) => {
  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center">
          <Filter size={18} className="mr-2" />
          Filter Matches
        </h2>
        <SidebarTrigger />
      </SidebarHeader>
      
      <SidebarContent>
        <form onSubmit={handleSearch}>
          <SidebarGroup>
            <SidebarGroupLabel>Search</SidebarGroupLabel>
            <SidebarGroupContent className="space-y-4 p-4">
              <div>
                <Label htmlFor="sidebar-search" className="block mb-2">Keywords</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 text-gray-400" size={15} />
                  <Input
                    id="sidebar-search"
                    placeholder="Search by name, specialty..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Location</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <LocationSearch
                selectedCountry={selectedCountry}
                setSelectedCountry={setSelectedCountry}
                selectedState={selectedState}
                setSelectedState={setSelectedState}
                selectedCity={selectedCity}
                setSelectedCity={setSelectedCity}
                className="space-y-4"
              />
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Age Range</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <div className="space-y-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-500">Min Age: {minAge}</span>
                  <span className="text-sm text-gray-500">Max Age: {maxAge}</span>
                </div>
                <div className="px-2">
                  <Slider 
                    defaultValue={[25]} 
                    max={65} 
                    min={18} 
                    step={1}
                    value={minAge}
                    onValueChange={setMinAge}
                    className="mb-6"
                  />
                  <Slider 
                    defaultValue={[45]} 
                    max={65} 
                    min={18} 
                    step={1}
                    value={maxAge}
                    onValueChange={setMaxAge}
                  />
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Specialty</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <div className="grid grid-cols-1 gap-2 h-40 overflow-y-auto pr-2">
                {specialtiesList.map((specialty) => (
                  <div key={specialty} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`sidebar-${specialty}`} 
                      checked={specialties.includes(specialty)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSpecialties([...specialties, specialty]);
                        } else {
                          setSpecialties(specialties.filter(s => s !== specialty));
                        }
                      }}
                    />
                    <Label htmlFor={`sidebar-${specialty}`} className="cursor-pointer text-sm">{specialty}</Label>
                  </div>
                ))}
              </div>
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
                    <Label htmlFor={`sidebar-orientation-${orientation}`} className="cursor-pointer text-sm">
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
              <div className="grid grid-cols-1 gap-2 h-40 overflow-y-auto pr-2">
                {ethnicityList.map((ethnicity) => (
                  <div key={ethnicity} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`sidebar-ethnicity-${ethnicity}`} 
                      checked={selectedEthnicity.includes(ethnicity)}
                      onCheckedChange={() => handleEthnicityChange(ethnicity)}
                    />
                    <Label htmlFor={`sidebar-ethnicity-${ethnicity}`} className="cursor-pointer text-sm">{ethnicity}</Label>
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Cast</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <Select 
                value={selectedCast} 
                onValueChange={setSelectedCast}
              >
                <SelectTrigger id="cast">
                  <SelectValue placeholder="Select cast" />
                </SelectTrigger>
                <SelectContent>
                  {castList.map((cast) => (
                    <SelectItem key={cast} value={cast}>
                      {cast}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarGroupContent>
          </SidebarGroup>
          
          <SidebarGroup>
            <SidebarGroupLabel>Skin Tone</SidebarGroupLabel>
            <SidebarGroupContent className="p-4">
              <Select 
                value={selectedColor || "any_color"} 
                onValueChange={setSelectedColor}
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
                <Label htmlFor="sidebar-online" className="cursor-pointer">Show only online doctors</Label>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button type="submit">Apply Filters</Button>
                <Button type="button" variant="outline" onClick={handleReset}>Reset Filters</Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </form>
      </SidebarContent>
    </Sidebar>
  );
};

export default SearchSidebar;
