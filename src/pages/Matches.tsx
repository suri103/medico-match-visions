
import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import DoctorCard from '@/components/DoctorCard';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { Search, Filter, Users, X, Heart, Save, Delete, Edit, MapPin } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Sample data for doctor profiles
const doctorProfiles = [
  {
    id: '1',
    name: 'Priya Sharma',
    age: 32,
    specialty: 'Cardiologist',
    hospital: 'Apollo Hospital',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    imageUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
    matchPercentage: 95,
    interests: ['Yoga', 'Travel', 'Reading', 'Cuisine'],
    isOnline: true,
    gender: 'Female',
    sexualOrientation: 'Straight'
  },
  {
    id: '2',
    name: 'Rajiv Mehta',
    age: 35,
    specialty: 'Neurologist',
    hospital: 'AIIMS',
    city: 'Delhi',
    state: 'Delhi',
    country: 'India',
    imageUrl: 'https://randomuser.me/api/portraits/men/42.jpg',
    matchPercentage: 88,
    interests: ['Tennis', 'Music', 'Hiking'],
    isOnline: false,
    gender: 'Male',
    sexualOrientation: 'Straight'
  },
  {
    id: '3',
    name: 'Ananya Patel',
    age: 29,
    specialty: 'Pediatrician',
    hospital: 'Fortis Hospital',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    imageUrl: 'https://randomuser.me/api/portraits/women/67.jpg',
    matchPercentage: 84,
    interests: ['Dancing', 'Cooking', 'Photography'],
    isOnline: true,
    gender: 'Female',
    sexualOrientation: 'Bisexual'
  },
  {
    id: '4',
    name: 'Vikram Singh',
    age: 34,
    specialty: 'Orthopedic Surgeon',
    hospital: 'Max Healthcare',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    imageUrl: 'https://randomuser.me/api/portraits/men/79.jpg',
    matchPercentage: 82,
    interests: ['Cricket', 'Mountain Biking', 'Movies'],
    isOnline: false,
    gender: 'Male',
    sexualOrientation: 'Gay'
  },
  {
    id: '5',
    name: 'Shreya Gupta',
    age: 31,
    specialty: 'Dermatologist',
    hospital: 'Medanta',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    imageUrl: 'https://randomuser.me/api/portraits/women/90.jpg',
    matchPercentage: 79,
    interests: ['Painting', 'Literature', 'Swimming'],
    isOnline: true,
    gender: 'Female',
    sexualOrientation: 'Straight'
  },
  {
    id: '6',
    name: 'Arjun Kapoor',
    age: 36,
    specialty: 'Psychiatrist',
    hospital: 'Columbia Asia',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    imageUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
    matchPercentage: 76,
    interests: ['Psychology', 'Chess', 'Running'],
    isOnline: false,
    gender: 'Male',
    sexualOrientation: 'Straight'
  },
  {
    id: '7',
    name: 'Sarah Johnson',
    age: 33,
    specialty: 'Oncologist',
    hospital: 'Mayo Clinic',
    city: 'New York',
    state: 'New York',
    country: 'United States',
    imageUrl: 'https://randomuser.me/api/portraits/women/22.jpg',
    matchPercentage: 73,
    interests: ['Running', 'Cycling', 'Podcasts'],
    isOnline: true,
    gender: 'Female',
    sexualOrientation: 'Lesbian'
  },
  {
    id: '8',
    name: 'David Chen',
    age: 37,
    specialty: 'General Practitioner',
    hospital: 'St. Mary\'s Hospital',
    city: 'Toronto',
    state: 'Ontario',
    country: 'Canada',
    imageUrl: 'https://randomuser.me/api/portraits/men/53.jpg',
    matchPercentage: 70,
    interests: ['Hiking', 'Cooking', 'Photography'],
    isOnline: true,
    gender: 'Male',
    sexualOrientation: 'Straight'
  }
];

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

const specialtiesList = ['Cardiologist', 'Neurologist', 'Pediatrician', 'Orthopedic Surgeon', 'Dermatologist', 'Psychiatrist', 'Oncologist', 'General Practitioner'];
const orientationsList = ['Straight', 'Gay', 'Lesbian', 'Bisexual'];

const ITEMS_PER_PAGE = 6;

const Matches = () => {
  const { toast } = useToast();
  const [filteredDoctors, setFilteredDoctors] = useState(doctorProfiles);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [minAge, setMinAge] = useState<number[]>([25]);
  const [maxAge, setMaxAge] = useState<number[]>([45]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'matches' | 'video' | 'chat'>('matches');
  const [searchTab, setSearchTab] = useState<'basic' | 'advanced'>('basic');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(defaultSavedSearches);
  const [searchName, setSearchName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingSavedSearchId, setEditingSavedSearchId] = useState<string | null>(null);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [selectedSavedSearch, setSelectedSavedSearch] = useState<string | null>(null);
  const [usernameSearch, setUsernameSearch] = useState('');
  const [keywordSearch, setKeywordSearch] = useState('');
  
  // Location filtering
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [availableStates, setAvailableStates] = useState<{value: string, label: string}[]>([]);
  const [availableCities, setAvailableCities] = useState<{value: string, label: string}[]>([]);
  const [selectedOrientation, setSelectedOrientation] = useState<string[]>([]);

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
  }, [selectedCountry]);

  // Update available cities when state changes
  useEffect(() => {
    if (selectedState) {
      setAvailableCities(citiesByState[selectedState as keyof typeof citiesByState] || []);
      setSelectedCity(null);
    } else {
      setAvailableCities([]);
      setSelectedCity(null);
    }
  }, [selectedState]);

  // Update pagination when filtered doctors change
  useEffect(() => {
    const totalPages = Math.ceil(filteredDoctors.length / ITEMS_PER_PAGE);
    setTotalPages(totalPages || 1);
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredDoctors]);

  // Reset search term and filters when switching between basic and advanced search
  useEffect(() => {
    if (searchTab === 'basic') {
      setIsFilterVisible(false);
    }
  }, [searchTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const filtered = doctorProfiles.filter(doctor => {
      // Filter by search term (name, specialty, city)
      const matchesSearch = doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doctor.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doctor.hospital.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Username search (exact or partial match)
      const matchesUsername = !usernameSearch || 
                            doctor.name.toLowerCase().includes(usernameSearch.toLowerCase());
      
      // Keyword search (in interests, specialty, hospital)
      const matchesKeyword = !keywordSearch || 
                            doctor.interests.some(interest => interest.toLowerCase().includes(keywordSearch.toLowerCase())) ||
                            doctor.specialty.toLowerCase().includes(keywordSearch.toLowerCase()) ||
                            doctor.hospital.toLowerCase().includes(keywordSearch.toLowerCase());
      
      // Filter by age range
      const matchesAge = doctor.age >= minAge[0] && doctor.age <= maxAge[0];
      
      // Filter by specialties
      const matchesSpecialty = specialties.length === 0 || specialties.includes(doctor.specialty);
      
      // Filter by online status
      const matchesOnlineStatus = !onlineOnly || doctor.isOnline;
      
      // Filter by location
      const matchesCountry = !selectedCountry || doctor.country.toLowerCase() === countries.find(c => c.value === selectedCountry)?.label.toLowerCase();
      const matchesState = !selectedState || doctor.state.toLowerCase() === statesByCountry[selectedCountry as keyof typeof statesByCountry]?.find(s => s.value === selectedState)?.label.toLowerCase();
      const matchesCity = !selectedCity || doctor.city.toLowerCase() === citiesByState[selectedState as keyof typeof citiesByState]?.find(c => c.value === selectedCity)?.label.toLowerCase();
      
      // Filter by sexual orientation
      const matchesOrientation = selectedOrientation.length === 0 || selectedOrientation.includes(doctor.sexualOrientation);
      
      return matchesSearch && matchesUsername && matchesKeyword && matchesAge && matchesSpecialty && 
             matchesOnlineStatus && matchesCountry && matchesState && matchesCity && matchesOrientation;
    });
    
    setFilteredDoctors(filtered);
    setCurrentPage(1);
    
    if (searchTab === 'advanced') {
      setIsFilterVisible(false);
    }
    
    toast({
      title: `Found ${filtered.length} matches`,
      description: "Showing doctors that match your criteria",
    });
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
    setUsernameSearch('');
    setKeywordSearch('');
    setFilteredDoctors(doctorProfiles);
    setCurrentPage(1);
    setIsFilterVisible(false);
  };

  const handleVideoCall = (id: string) => {
    setSelectedDoctor(id);
    setActiveView('video');
  };

  const handleChat = (id: string) => {
    setSelectedDoctor(id);
    setActiveView('chat');
  };

  const handleLike = (id: string) => {
    toast({
      title: "You liked this profile!",
      description: "We'll notify them of your interest.",
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

    // Apply this search immediately
    const event = { preventDefault: () => {} } as React.FormEvent;
    handleSearch(event);

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
    
    setIsFilterVisible(true);
    setSearchTab('advanced');
    
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

  const getPaginatedDoctors = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredDoctors.slice(startIndex, endIndex);
  };

  const selectedDoctorData = selectedDoctor 
    ? doctorProfiles.find(d => d.id === selectedDoctor) 
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      {activeView === 'matches' && (
        <main className="flex-grow p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800 mb-4 md:mb-0">
                Your Matches
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
                
                <Tabs 
                  value={searchTab} 
                  onValueChange={(value) => setSearchTab(value as 'basic' | 'advanced')}
                  className="w-full md:w-auto"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Basic Search</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced Search</TabsTrigger>
                  </TabsList>
                </Tabs>
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
                                {search.minAge[0] !== 25 || search.maxAge[0] !== 45 && 
                                  <span className="mr-3">
                                    {search.minAge[0]}-{search.maxAge[0]} y/o
                                  </span>
                                }
                                {search.country && 
                                  <span className="mr-3 flex items-center">
                                    <MapPin size={12} className="mr-1" />
                                    {countries.find(c => c.value === search.country)?.label}
                                    {search.state && `, ${statesByCountry[search.country as keyof typeof statesByCountry]?.find(s => s.value === search.state)?.label}`}
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
                                <Search size={14} />
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
            
            {searchTab === 'basic' && (
              <div className="mb-8">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type="text"
                      placeholder="Search by name, specialty, city..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full"
                    />
                  </div>
                  <Button type="submit">Search</Button>
                  <Button type="button" variant="outline" onClick={handleReset}>Reset</Button>
                  <Button 
                    type="button"
                    variant="outline"
                    className="flex items-center space-x-2"
                    onClick={() => setIsFilterVisible(!isFilterVisible)}
                  >
                    <Filter size={18} />
                    <span>Filters</span>
                  </Button>
                </form>
              </div>
            )}
            
            {searchTab === 'advanced' && (
              <div className="mb-8 p-6 bg-white rounded-xl shadow-sm animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-mediblue-800">Advanced Search</h2>
                  {!isFilterVisible && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setIsFilterVisible(true)}
                    >
                      <Filter size={18} />
                    </Button>
                  )}
                </div>
                
                <form onSubmit={handleSearch}>
                  <div className="grid md:grid-cols-3 gap-6 mb-6">
                    <div>
                      <Label htmlFor="keywords" className="block mb-2">Keywords</Label>
                      <Input
                        id="keywords"
                        placeholder="Search by keywords"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="username" className="block mb-2">Username</Label>
                      <Input
                        id="username"
                        placeholder="Search by username"
                        value={usernameSearch}
                        onChange={(e) => setUsernameSearch(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="interests" className="block mb-2">Interests/Skills</Label>
                      <Input
                        id="interests"
                        placeholder="Search interests or skills"
                        value={keywordSearch}
                        onChange={(e) => setKeywordSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {isFilterVisible && (
                    <>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        <div>
                          <Label className="block mb-3">Age Range</Label>
                          <div className="space-y-6">
                            <div>
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
                        </div>
                        
                        <div>
                          <Label className="block mb-3">Specialty</Label>
                          <div className="grid grid-cols-2 gap-2 h-48 overflow-y-auto pr-2">
                            {specialtiesList.map((specialty) => (
                              <div key={specialty} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={specialty} 
                                  checked={specialties.includes(specialty)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSpecialties([...specialties, specialty]);
                                    } else {
                                      setSpecialties(specialties.filter(s => s !== specialty));
                                    }
                                  }}
                                />
                                <Label htmlFor={specialty} className="cursor-pointer">{specialty}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <Label className="block mb-3">Sexual Orientation</Label>
                          <div className="space-y-2">
                            {orientationsList.map((orientation) => (
                              <div key={orientation} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`orientation-${orientation}`} 
                                  checked={selectedOrientation.includes(orientation)}
                                  onCheckedChange={() => handleOrientationChange(orientation)}
                                />
                                <Label htmlFor={`orientation-${orientation}`} className="cursor-pointer">
                                  {orientation}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-3 gap-6 mb-6">
                        <div>
                          <Label htmlFor="country" className="block mb-2">Country</Label>
                          <Select 
                            value={selectedCountry || ""} 
                            onValueChange={(value) => setSelectedCountry(value || null)}
                          >
                            <SelectTrigger id="country">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
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
                            onValueChange={(value) => setSelectedState(value || null)}
                            disabled={!selectedCountry || availableStates.length === 0}
                          >
                            <SelectTrigger id="state">
                              <SelectValue placeholder={selectedCountry ? "Select state" : "Select country first"} />
                            </SelectTrigger>
                            <SelectContent>
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
                            onValueChange={(value) => setSelectedCity(value || null)}
                            disabled={!selectedState || availableCities.length === 0}
                          >
                            <SelectTrigger id="city">
                              <SelectValue placeholder={selectedState ? "Select city" : "Select state first"} />
                            </SelectTrigger>
                            <SelectContent>
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
                      
                      <div className="flex items-center space-x-2 mb-6">
                        <Checkbox 
                          id="online" 
                          checked={onlineOnly}
                          onCheckedChange={(checked) => setOnlineOnly(!!checked)}
                        />
                        <Label htmlFor="online" className="cursor-pointer">Show only online doctors</Label>
                      </div>
                      
                      <div className="border-t pt-6 mb-2">
                        <div className="flex items-center space-x-4 mb-4">
                          <Label htmlFor="search-name" className="whitespace-nowrap">Save this search:</Label>
                          <Input
                            id="search-name"
                            placeholder="Enter name for this search"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="max-w-xs"
                          />
                          <Button 
                            type="button" 
                            onClick={saveCurrentSearch}
                            variant="outline"
                            size="sm"
                          >
                            {editingSavedSearchId ? "Update search" : "Save search"}
                          </Button>
                          {editingSavedSearchId && (
                            <Button 
                              type="button" 
                              onClick={() => {
                                setEditingSavedSearchId(null);
                                setSearchName('');
                              }}
                              variant="ghost"
                              size="sm"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-end space-x-3 mt-4">
                    <Button variant="outline" type="button" onClick={handleReset}>Reset All</Button>
                    {isFilterVisible && (
                      <Button 
                        variant="outline" 
                        type="button" 
                        onClick={() => setIsFilterVisible(false)}
                      >
                        Close Filters
                      </Button>
                    )}
                    <Button type="submit">Search</Button>
                  </div>
                </form>
              </div>
            )}
            
            {/* Active filters summary */}
            {(minAge[0] !== 25 || maxAge[0] !== 45 || specialties.length > 0 || 
              onlineOnly || selectedCountry || selectedOrientation.length > 0 || 
              usernameSearch || keywordSearch) && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-blue-700">Active filters:</span>
                  
                  {minAge[0] !== 25 || maxAge[0] !== 45 ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Age: {minAge[0]}-{maxAge[0]}
                    </span>
                  ) : null}
                  
                  {specialties.length > 0 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {specialties.length > 1 ? `${specialties.length} specialties` : specialties[0]}
                    </span>
                  )}
                  
                  {selectedCountry && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {countries.find(c => c.value === selectedCountry)?.label}
                      {selectedState && ` > ${statesByCountry[selectedCountry as keyof typeof statesByCountry]?.find(s => s.value === selectedState)?.label}`}
                      {selectedCity && ` > ${citiesByState[selectedState as keyof typeof citiesByState]?.find(c => c.value === selectedCity)?.label}`}
                    </span>
                  )}
                  
                  {selectedOrientation.length > 0 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {selectedOrientation.length > 1 ? `${selectedOrientation.length} orientations` : selectedOrientation[0]}
                    </span>
                  )}
                  
                  {usernameSearch && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Username: {usernameSearch}
                    </span>
                  )}
                  
                  {keywordSearch && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Keyword: {keywordSearch}
                    </span>
                  )}
                  
                  {onlineOnly && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Online only
                    </span>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-auto text-xs h-7 px-2"
                    onClick={handleReset}
                  >
                    Clear all
                  </Button>
                </div>
              </div>
            )}
            
            {/* Results */}
            {getPaginatedDoctors().length > 0 ? (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {getPaginatedDoctors().map((doctor) => (
                    <DoctorCard
                      key={doctor.id}
                      id={doctor.id}
                      name={doctor.name}
                      age={doctor.age}
                      specialty={doctor.specialty}
                      hospital={doctor.hospital}
                      city={doctor.city}
                      imageUrl={doctor.imageUrl}
                      matchPercentage={doctor.matchPercentage}
                      interests={doctor.interests}
                      isOnline={doctor.isOnline}
                      onLike={handleLike}
                      onVideo={handleVideoCall}
                      onMessage={handleChat}
                    />
                  ))}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination className="mb-8">
                    <PaginationContent>
                      {currentPage > 1 && (
                        <PaginationItem>
                          <PaginationPrevious 
                            href="#" 
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(currentPage - 1);
                            }} 
                          />
                        </PaginationItem>
                      )}
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first page, last page, and pages around current page
                        if (
                          page === 1 || 
                          page === totalPages || 
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink 
                                href="#" 
                                isActive={page === currentPage}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setCurrentPage(page);
                                }}
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                        
                        // Show ellipsis for gaps
                        if (page === 2 && currentPage > 3) {
                          return (
                            <PaginationItem key="ellipsis-start">
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }
                        
                        if (page === totalPages - 1 && currentPage < totalPages - 2) {
                          return (
                            <PaginationItem key="ellipsis-end">
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }
                        
                        return null;
                      })}
                      
                      {currentPage < totalPages && (
                        <PaginationItem>
                          <PaginationNext 
                            href="#" 
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(currentPage + 1);
                            }} 
                          />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <Users className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-medium text-gray-900">No matches found</h3>
                <p className="text-gray-500 mt-2">Try adjusting your filters or search criteria</p>
                <Button className="mt-4" onClick={handleReset}>Reset Filters</Button>
              </div>
            )}
          </div>
        </main>
      )}
      
      {activeView === 'video' && selectedDoctorData && (
        <div className="flex-grow">
          <VideoCall 
            doctorId={selectedDoctorData.id}
            doctorName={selectedDoctorData.name}
            doctorImage={selectedDoctorData.imageUrl}
            onEndCall={() => setActiveView('matches')}
          />
        </div>
      )}
      
      {activeView === 'chat' && selectedDoctorData && (
        <div className="flex-grow p-4">
          <div className="max-w-4xl mx-auto h-[80vh]">
            <Chat 
              doctorId={selectedDoctorData.id}
              doctorName={selectedDoctorData.name}
              doctorImage={selectedDoctorData.imageUrl}
              onStartVideoCall={() => setActiveView('video')}
              onClose={() => setActiveView('matches')}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Matches;

