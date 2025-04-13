
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { doctorProfiles } from '../data/sampleData';
import { defaultSavedSearches } from '../data/constants';
import { Doctor, SavedSearch } from '../types';

const ITEMS_PER_PAGE = 6;

export const useMatches = () => {
  const { toast } = useToast();
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>(doctorProfiles);
  const [searchTerm, setSearchTerm] = useState('');
  const [minAge, setMinAge] = useState<number[]>([25]);
  const [maxAge, setMaxAge] = useState<number[]>([45]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'matches' | 'video' | 'chat'>('matches');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(defaultSavedSearches);
  const [searchName, setSearchName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingSavedSearchId, setEditingSavedSearchId] = useState<string | null>(null);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
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
  const [availableStates, setAvailableStates] = useState<{value: string, label: string}[]>([]);
  const [availableCities, setAvailableCities] = useState<{value: string, label: string}[]>([]);

  useEffect(() => {
    const totalPages = Math.ceil(filteredDoctors.length / ITEMS_PER_PAGE);
    setTotalPages(totalPages || 1);
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredDoctors, currentPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const filtered = doctorProfiles.filter(doctor => {
      const matchesSearch = doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doctor.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doctor.hospital.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesUsername = !usernameSearch || 
                          doctor.name.toLowerCase().includes(usernameSearch.toLowerCase());
      
      const matchesKeyword = !keywordSearch || 
                          doctor.interests.some(interest => interest.toLowerCase().includes(keywordSearch.toLowerCase())) ||
                          doctor.specialty.toLowerCase().includes(keywordSearch.toLowerCase()) ||
                          doctor.hospital.toLowerCase().includes(keywordSearch.toLowerCase());
      
      const matchesAge = doctor.age >= minAge[0] && doctor.age <= maxAge[0];
      
      const matchesSpecialty = specialties.length === 0 || specialties.includes(doctor.specialty);
      
      const matchesOnlineStatus = !onlineOnly || doctor.isOnline;
      
      const matchesCountry = !selectedCountry || doctor.country.toLowerCase().includes(selectedCountry.toLowerCase());
      const matchesState = !selectedState || doctor.state.toLowerCase().includes(selectedState.toLowerCase());
      const matchesCity = !selectedCity || doctor.city.toLowerCase().includes(selectedCity.toLowerCase());
      
      const matchesOrientation = selectedOrientation.length === 0 || selectedOrientation.includes(doctor.sexualOrientation);
      
      return matchesSearch && matchesUsername && matchesKeyword && matchesAge && matchesSpecialty && 
             matchesOnlineStatus && matchesCountry && matchesState && matchesCity && matchesOrientation;
    });
    
    setFilteredDoctors(filtered);
    setCurrentPage(1);
    
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

  const handleSortChange = (value: string) => {
    let sorted = [...filteredDoctors];

    switch (value) {
      case 'match':
        sorted.sort((a, b) => b.matchPercentage - a.matchPercentage);
        break;
      case 'recent':
        sorted.sort((a, b) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1));
        break;
      case 'ageAsc':
        sorted.sort((a, b) => a.age - b.age);
        break;
      case 'ageDesc':
        sorted.sort((a, b) => b.age - a.age);
        break;
      default:
        break;
    }

    setFilteredDoctors(sorted);
  };

  const getPaginatedDoctors = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredDoctors.slice(startIndex, endIndex);
  };

  const selectedDoctorData = selectedDoctor 
    ? doctorProfiles.find(d => d.id === selectedDoctor) 
    : null;

  return {
    filteredDoctors,
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
    selectedDoctor,
    setSelectedDoctor,
    activeView,
    setActiveView,
    savedSearches,
    searchName,
    setSearchName,
    currentPage,
    setCurrentPage,
    totalPages,
    editingSavedSearchId,
    setEditingSavedSearchId,
    showSavedSearches,
    setShowSavedSearches,
    selectedSavedSearch,
    setSelectedSavedSearch,
    usernameSearch,
    setUsernameSearch,
    keywordSearch,
    setKeywordSearch,
    selectedCountry,
    setSelectedCountry,
    selectedState,
    setSelectedState,
    selectedCity,
    setSelectedCity,
    selectedOrientation,
    selectedEthnicity,
    selectedCast,
    setSelectedCast,
    selectedColor,
    setSelectedColor,
    availableStates,
    availableCities,
    handleSearch,
    handleReset,
    handleVideoCall,
    handleChat,
    handleLike,
    saveCurrentSearch,
    loadSavedSearch,
    editSavedSearch,
    deleteSavedSearch,
    handleOrientationChange,
    handleEthnicityChange,
    handleSortChange,
    getPaginatedDoctors,
    selectedDoctorData
  };
};
