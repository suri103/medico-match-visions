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
  PaginationEllipsis,
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';
import { LocationSearch } from '@/components/LocationSearch';

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
const ethnicityList = ['Asian', 'Black', 'Hispanic', 'White', 'Middle Eastern', 'Native American', 'Pacific Islander', 'Other'];
const castList = ['No preference', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Other'];
const colorList = ['Fair', 'Light', 'Medium', 'Olive', 'Brown', 'Dark'];

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
  const [selectedOrientation, setSelectedOrientation] = useState<string[]>([]);
  const [selectedEthnicity, setSelectedEthnicity] = useState<string[]>([]);
  const [selectedCast, setSelectedCast] = useState<string>('No preference');
  const [selectedColor, setSelectedColor] = useState<string>('');
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
  }, [filteredDoctors, currentPage]);

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
    setSelectedEthnicity([]);
    setSelectedCast('No preference');
    setSelectedColor('');
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

  const handleEthnicityChange = (ethnicity: string) => {
    setSelectedEthnicity(
      selectedEthnicity.includes(ethnicity)
        ? selectedEthnicity.filter((e) => e !== ethnicity)
        : [...selectedEthnicity, ethnicity]
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
        <SidebarProvider defaultOpen={true}>
          <div className="flex flex-1 w-full">
            {/* Sidebar */}
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
                        value={selectedColor} 
                        onValueChange={setSelectedColor}
                      >
                        <SelectTrigger id="color">
                          <SelectValue placeholder="Select skin tone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any</SelectItem>
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

            {/* Main content */}
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
                  </div>
                </div>
                
                {/* Saved searches section */}
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
                
                {/* Results display */}
                <div className="mb-4">
                  <div className="flex justify-between items-center">
                    <p className="text-gray-600">
                      Found <span className="font-semibold">{filteredDoctors.length}</span> matches
                    </p>
                    <Select defaultValue="match" onValueChange={() => {}}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="match">Match %</SelectItem>
                        <SelectItem value="recent">Recently active</SelectItem>
                        <SelectItem value="ageAsc">Age: Low to High</SelectItem>
                        <SelectItem value="ageDesc">Age: High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
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
          </div>
        </SidebarProvider>
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
