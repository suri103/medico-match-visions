
import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Search as SearchIcon, Filter, Users, X, Save, Delete, Edit, MapPin } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LocationSearch } from '@/components/LocationSearch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const specialtiesList = ['Cardiologist', 'Neurologist', 'Pediatrician', 'Orthopedic Surgeon', 'Dermatologist', 'Psychiatrist', 'Oncologist', 'General Practitioner'];
const orientationsList = ['Straight', 'Gay', 'Lesbian', 'Bisexual'];
const ethnicityList = ['Asian', 'Black', 'Hispanic', 'White', 'Middle Eastern', 'Native American', 'Pacific Islander', 'Other'];
const castList = ['No preference', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Other'];
const colorList = ['Fair', 'Light', 'Medium', 'Olive', 'Brown', 'Dark'];

interface SavedSearch {
  id: string;
  name: string;
  minAge: number[];
  maxAge: number[];
  specialties: string[];
  country: string | null;
  state: string | null;
  city: string | null;
  sexualOrientation: string[];
  onlineOnly: boolean;
  searchKeywords: string;
}

const defaultSavedSearches: SavedSearch[] = [
  {
    id: '1',
    name: 'Cardiologists in Mumbai',
    minAge: [30],
    maxAge: [40],
    specialties: ['Cardiologist'],
    country: 'india',
    state: 'maharashtra',
    city: 'mumbai',
    sexualOrientation: [],
    onlineOnly: false,
    searchKeywords: '',
  },
  {
    id: '2',
    name: 'Online Doctors',
    minAge: [25],
    maxAge: [45],
    specialties: [],
    country: null,
    state: null,
    city: null,
    sexualOrientation: [],
    onlineOnly: true,
    searchKeywords: '',
  }
];

const Search = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [minAge, setMinAge] = useState<number[]>([25]);
  const [maxAge, setMaxAge] = useState<number[]>([45]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(defaultSavedSearches);
  const [searchName, setSearchName] = useState('');
  const [editingSavedSearchId, setEditingSavedSearchId] = useState<string | null>(null);
  const [selectedSavedSearch, setSelectedSavedSearch] = useState<string | null>(null);
  const [usernameSearch, setUsernameSearch] = useState('');
  const [keywordSearch, setKeywordSearch] = useState('');
  
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedOrientation, setSelectedOrientation] = useState<string[]>([]);
  const [selectedEthnicity, setSelectedEthnicity] = useState<string[]>([]);
  const [selectedCast, setSelectedCast] = useState<string>('No preference');
  const [selectedColor, setSelectedColor] = useState<string>('');
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    toast({
      title: "Search criteria applied",
      description: "Navigating to matches with your search criteria",
    });
    
    // Navigate to matches page with search parameters
    navigate('/matches');
  };

  const handleReset = () => {
    setSearchTerm('');
    setMinAge([25]);
    setMaxAge([45]);
    setSpecialties([]);
    setOnlineOnly(false);
    setSelectedCountry(null);
    setSelectedState(null);
    setSelectedCity(null);
    setSelectedOrientation([]);
    setSelectedEthnicity([]);
    setSelectedCast('No preference');
    setSelectedColor('');
    setUsernameSearch('');
    setKeywordSearch('');
    
    toast({
      title: "Search criteria reset",
      description: "All search fields have been cleared"
    });
  };

  const saveCurrentSearch = () => {
    if (!searchName.trim()) {
      toast({
        title: "Please name your search",
        description: "Enter a name to save your search criteria",
        variant: "destructive"
      });
      return;
    }

    const newSearch: SavedSearch = {
      id: editingSavedSearchId || Date.now().toString(),
      name: searchName,
      minAge,
      maxAge,
      specialties,
      country: selectedCountry,
      state: selectedState,
      city: selectedCity,
      sexualOrientation: selectedOrientation,
      onlineOnly,
      searchKeywords: searchTerm,
    };

    if (editingSavedSearchId) {
      setSavedSearches(savedSearches.map(search => 
        search.id === editingSavedSearchId ? newSearch : search
      ));
      setEditingSavedSearchId(null);
    } else {
      setSavedSearches([...savedSearches, newSearch]);
    }

    setSearchName('');
    
    toast({
      title: "Search saved!",
      description: "Your search criteria has been saved for future use."
    });
  };

  const loadSavedSearch = (searchId: string) => {
    const search = savedSearches.find(s => s.id === searchId);
    if (!search) return;

    setMinAge(search.minAge);
    setMaxAge(search.maxAge);
    setSpecialties(search.specialties);
    setSelectedCountry(search.country);
    setSelectedState(search.state);
    setSelectedCity(search.city);
    setSelectedOrientation(search.sexualOrientation);
    setOnlineOnly(search.onlineOnly);
    setSearchTerm(search.searchKeywords);
    setSelectedSavedSearch(searchId);

    toast({
      title: "Search loaded",
      description: `Applied search criteria: "${search.name}"`
    });
  };

  const editSavedSearch = (searchId: string) => {
    const search = savedSearches.find(s => s.id === searchId);
    if (!search) return;

    setEditingSavedSearchId(searchId);
    setSearchName(search.name);
    setMinAge(search.minAge);
    setMaxAge(search.maxAge);
    setSpecialties(search.specialties);
    setSelectedCountry(search.country);
    setSelectedState(search.state);
    setSelectedCity(search.city);
    setSelectedOrientation(search.sexualOrientation);
    setOnlineOnly(search.onlineOnly);
    setSearchTerm(search.searchKeywords);
    
    toast({
      title: "Edit saved search",
      description: "Make your changes and click 'Save search' when done."
    });
  };

  const deleteSavedSearch = (searchId: string) => {
    setSavedSearches(savedSearches.filter(s => s.id !== searchId));
    
    if (selectedSavedSearch === searchId) {
      setSelectedSavedSearch(null);
    }
    
    toast({
      title: "Search deleted",
      description: "Your saved search has been removed."
    });
  };

  const handleOrientationChange = (orientation: string) => {
    setSelectedOrientation(
      selectedOrientation.includes(orientation)
        ? selectedOrientation.filter((o) => o !== orientation)
        : [...selectedOrientation, orientation]
    );
  };

  const handleEthnicityChange = (ethnicity: string) => {
    setSelectedEthnicity(
      selectedEthnicity.includes(ethnicity)
        ? selectedEthnicity.filter((e) => e !== ethnicity)
        : [...selectedEthnicity, ethnicity]
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800 mb-4 md:mb-0">
              Find Your Match
            </h1>
            
            <div className="w-full md:w-auto flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
              <Button
                variant="outline" 
                size="sm"
                className={`flex items-center space-x-2 ${showSavedSearches ? 'bg-blue-50' : ''}`}
                onClick={() => setShowSavedSearches(!showSavedSearches)}
              >
                <Save size={16} />
                <span>Saved Searches</span>
              </Button>
            </div>
          </div>
          
          {showSavedSearches && (
            <div className="mb-6 p-4 bg-white rounded-xl shadow-sm animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-mediblue-800">Saved Searches</h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowSavedSearches(false)}
                >
                  <X size={18} />
                </Button>
              </div>
              
              {savedSearches.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Criteria</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedSearches.map((search) => (
                        <TableRow 
                          key={search.id}
                          className={selectedSavedSearch === search.id ? "bg-blue-50" : ""}
                        >
                          <TableCell className="font-medium">{search.name}</TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-600">
                              {search.specialties.length > 0 && 
                                <span className="mr-3">
                                  {search.specialties.join(", ")}
                                </span>
                              }
                              {(search.minAge[0] !== 25 || search.maxAge[0] !== 45) && 
                                <span className="mr-3">
                                  {search.minAge[0]}-{search.maxAge[0]} y/o
                                </span>
                              }
                              {search.country && 
                                <span className="mr-3 flex items-center">
                                  <MapPin size={12} className="mr-1" />
                                  {search.country}
                                  {search.state && `, ${search.state}`}
                                </span>
                              }
                              {search.onlineOnly && 
                                <span className="text-green-600 font-medium">Online only</span>
                              }
                            </div>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => loadSavedSearch(search.id)}
                              className="h-8 w-8"
                            >
                              <SearchIcon size={14} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => editSavedSearch(search.id)}
                              className="h-8 w-8"
                            >
                              <Edit size={14} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => deleteSavedSearch(search.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                            >
                              <Delete size={14} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Save className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <p>You haven't saved any searches yet.</p>
                  <p className="text-sm mt-1">Use the search panel and save your criteria for future use.</p>
                </div>
              )}
            </div>
          )}
          
          <div className="grid md:grid-cols-12 gap-6">
            <div className="md:col-span-8 lg:col-span-9">
              <Card>
                <CardHeader>
                  <CardTitle>Search Criteria</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSearch} className="space-y-6">
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-3 text-gray-400" size={18} />
                      <Input
                        placeholder="Search by name, specialty, hospital..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label className="mb-2 block">Age Range</Label>
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
                      </div>
                      
                      <div>
                        <Label className="mb-2 block">Location</Label>
                        <LocationSearch
                          selectedCountry={selectedCountry}
                          setSelectedCountry={setSelectedCountry}
                          selectedState={selectedState}
                          setSelectedState={setSelectedState}
                          selectedCity={selectedCity}
                          setSelectedCity={setSelectedCity}
                          className="space-y-4"
                        />
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label className="mb-2 block">Specialty</Label>
                        <div className="grid grid-cols-2 gap-2 h-40 overflow-y-auto pr-2 border rounded-md p-3">
                          {specialtiesList.map((specialty) => (
                            <div key={specialty} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`specialty-${specialty}`} 
                                checked={specialties.includes(specialty)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSpecialties([...specialties, specialty]);
                                  } else {
                                    setSpecialties(specialties.filter(s => s !== specialty));
                                  }
                                }}
                              />
                              <Label htmlFor={`specialty-${specialty}`} className="cursor-pointer text-sm">{specialty}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="mb-2 block">Sexual Orientation</Label>
                        <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                          {orientationsList.map((orientation) => (
                            <div key={orientation} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`orientation-${orientation}`} 
                                checked={selectedOrientation.includes(orientation)}
                                onCheckedChange={() => handleOrientationChange(orientation)}
                              />
                              <Label htmlFor={`orientation-${orientation}`} className="cursor-pointer text-sm">
                                {orientation}
                              </Label>
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-4">
                          <Label className="mb-2 block">Cast Preference</Label>
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
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label className="mb-2 block">Ethnicity</Label>
                        <div className="grid grid-cols-2 gap-2 h-40 overflow-y-auto pr-2 border rounded-md p-3">
                          {ethnicityList.map((ethnicity) => (
                            <div key={ethnicity} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`ethnicity-${ethnicity}`} 
                                checked={selectedEthnicity.includes(ethnicity)}
                                onCheckedChange={() => handleEthnicityChange(ethnicity)}
                              />
                              <Label htmlFor={`ethnicity-${ethnicity}`} className="cursor-pointer text-sm">{ethnicity}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="mb-2 block">Advanced Filters</Label>
                        <div className="space-y-4">
                          <div className="border rounded-md p-3">
                            <div className="flex items-center space-x-2 mb-4">
                              <Checkbox 
                                id="online" 
                                checked={onlineOnly}
                                onCheckedChange={(checked) => setOnlineOnly(!!checked)}
                              />
                              <Label htmlFor="online" className="cursor-pointer">Show only online doctors</Label>
                            </div>
                            
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="username" className="text-sm">Username contains</Label>
                                <Input 
                                  id="username" 
                                  placeholder="Enter username" 
                                  value={usernameSearch}
                                  onChange={(e) => setUsernameSearch(e.target.value)}
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor="keyword" className="text-sm">Keywords in bio/interests</Label>
                                <Input 
                                  id="keyword" 
                                  placeholder="Enter keywords" 
                                  value={keywordSearch}
                                  onChange={(e) => setKeywordSearch(e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <Label className="mb-2 block">Skin Tone</Label>
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
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                      {editingSavedSearchId ? (
                        <div className="flex-grow flex gap-3 w-full sm:w-auto">
                          <Input
                            placeholder="Enter a name for this search"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="flex-grow"
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={saveCurrentSearch}
                          >
                            Update Search
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-grow flex gap-3 w-full sm:w-auto">
                          <Input
                            placeholder="Save this search for later"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="flex-grow"
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={saveCurrentSearch}
                          >
                            Save Search
                          </Button>
                        </div>
                      )}
                      
                      <div className="flex gap-3 w-full sm:w-auto">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleReset}
                          className="w-full sm:w-auto"
                        >
                          Reset
                        </Button>
                        <Button 
                          type="submit"
                          className="w-full sm:w-auto"
                        >
                          Search
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
            
            <div className="md:col-span-4 lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle>Search Tips</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p>🌟 <span className="font-medium">Be specific</span> with your specialty criteria to find the most relevant matches.</p>
                  <p>🌍 <span className="font-medium">Location filters</span> help you find doctors in your area or preferred location.</p>
                  <p>💾 <span className="font-medium">Save searches</span> you frequently use to quickly apply them later.</p>
                  <p>🔍 <span className="font-medium">Keyword search</span> can find matches based on interests, hospitals, or education.</p>
                  <p>⭐ <span className="font-medium">Online status</span> filters can help you find doctors currently available to chat.</p>
                </CardContent>
              </Card>
              
              <div className="mt-6">
                <Card className="bg-mediblue-50 border-mediblue-100">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <Users className="mx-auto h-12 w-12 text-mediblue-600" />
                      <h3 className="font-semibold text-lg text-mediblue-800">Looking for your matches?</h3>
                      <p className="text-sm text-mediblue-700">View doctors who match your preferences and have shown interest in your profile.</p>
                      <Button 
                        onClick={() => navigate('/matches')}
                        className="w-full"
                      >
                        Go to My Matches
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Search;
