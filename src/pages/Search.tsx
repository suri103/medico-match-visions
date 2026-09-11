import React, { useState } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Search as SearchIcon, Users, X, Save, Delete, Edit, MapPin } from 'lucide-react';
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

import type { SavedSearch } from '@/features/matches/types';
import { defaultSavedSearches as sharedDefault } from '@/features/matches/data/constants';
import {
  degreesList,
  specialtiesList,
  orientationsList,
  ethnicityList,
  religionList,
  casteList,
  subcasteSuggestions,
  gotraList,
  motherTongueList,
  colorList,
} from '@/features/matches/data/constants';
const defaultSavedSearches: SavedSearch[] = sharedDefault;

const Search = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [minAge, setMinAge] = useState<number[]>([25]);
  const [maxAge, setMaxAge] = useState<number[]>([45]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [selectedDegrees, setSelectedDegrees] = useState<string[]>([]);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [savedSearches, setSavedSearches] = usePersistedState<SavedSearch[]>('mm:savedSearches', defaultSavedSearches);
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
  const [selectedReligion, setSelectedReligion] = useState<string>('No preference');
  const [selectedCaste, setSelectedCaste] = useState<string>('No preference');
  const [selectedSubcaste, setSelectedSubcaste] = useState<string>('');
  const [selectedGotra, setSelectedGotra] = useState<string>('No preference');
  const [selectedMotherTongue, setSelectedMotherTongue] = useState<string[]>([]);
  const [excludeSameGotra, setExcludeSameGotra] = useState<boolean>(false);
  const [minGunas, setMinGunas] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState<string>('');
  // P0-4 family depth.
  const [selectedFamilyType, setSelectedFamilyType] = useState<string>('No preference');
  const [selectedFamilyStatus, setSelectedFamilyStatus] = useState<string>('No preference');
  const [selectedIncomeBand, setSelectedIncomeBand] = useState<string>('No preference');
  const [selectedDiet, setSelectedDiet] = useState<string>('No preference');

  const handleMotherTongueChange = (lang: string) => {
    setSelectedMotherTongue(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const handleDegreeChange = (deg: string) => {
    setSelectedDegrees(prev =>
      prev.includes(deg) ? prev.filter(d => d !== deg) : [...prev, deg]
    );
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    if (usernameSearch) params.set('u', usernameSearch);
    if (keywordSearch) params.set('kw', keywordSearch);
    params.set('min', String(minAge[0]));
    params.set('max', String(maxAge[0]));
    if (specialties.length) params.set('spec', specialties.join(','));
    if (selectedDegrees.length) params.set('deg', selectedDegrees.join(','));
    if (onlineOnly) params.set('online', '1');
    if (selectedCountry) params.set('country', selectedCountry);
    if (selectedState) params.set('state', selectedState);
    if (selectedCity) params.set('city', selectedCity);
    if (selectedOrientation.length) params.set('ori', selectedOrientation.join(','));
    if (selectedEthnicity.length) params.set('eth', selectedEthnicity.join(','));
    if (selectedReligion && selectedReligion !== 'No preference') params.set('rel', selectedReligion);
    if (selectedCaste && selectedCaste !== 'No preference') {
      params.set('caste', selectedCaste);
      params.set('cast', selectedCaste);
    }
    if (selectedSubcaste) params.set('subcaste', selectedSubcaste);
    if (selectedGotra && selectedGotra !== 'No preference') params.set('gotra', selectedGotra);
    if (selectedMotherTongue.length) params.set('mt', selectedMotherTongue.join(','));
    if (excludeSameGotra) params.set('nosamegotra', '1');
    if (minGunas) params.set('gunas', String(minGunas));
    if (selectedColor) params.set('color', selectedColor);
    // P0-4 family depth.
    if (selectedFamilyType !== 'No preference') params.set('familyType', selectedFamilyType);
    if (selectedFamilyStatus !== 'No preference') params.set('familyStatus', selectedFamilyStatus);
    if (selectedIncomeBand !== 'No preference') params.set('incomeBand', selectedIncomeBand);
    if (selectedDiet !== 'No preference') params.set('diet', selectedDiet);
    toast({ title: "Search criteria applied", description: "Navigating to matches with your search criteria" });
    navigate(`/matches?${params.toString()}`, {
      state: {
        search: {
          searchTerm, usernameSearch, keywordSearch, minAge, maxAge, specialties, degrees: selectedDegrees, onlineOnly,
          country: selectedCountry, state: selectedState, city: selectedCity,
          sexualOrientation: selectedOrientation, ethnicity: selectedEthnicity,
          religion: selectedReligion, caste: selectedCaste, cast: selectedCaste,
          subcaste: selectedSubcaste, gotra: selectedGotra, motherTongue: selectedMotherTongue,
          excludeSameGotra, minGunas, color: selectedColor,
          familyType: selectedFamilyType, familyStatus: selectedFamilyStatus,
          incomeBand: selectedIncomeBand, diet: selectedDiet,
        },
      },
    });
  };

  const handleReset = () => {
    setSearchTerm('');
    setMinAge([25]);
    setMaxAge([45]);
    setSpecialties([]);
    setSelectedDegrees([]);
    setOnlineOnly(false);
    setSelectedCountry(null);
    setSelectedState(null);
    setSelectedCity(null);
    setSelectedOrientation([]);
    setSelectedEthnicity([]);
    setSelectedReligion('No preference');
    setSelectedCaste('No preference');
    setSelectedSubcaste('');
    setSelectedGotra('No preference');
    setSelectedMotherTongue([]);
    setExcludeSameGotra(false);
    setMinGunas(0);
    setSelectedColor('');
    setSelectedFamilyType('No preference');
    setSelectedFamilyStatus('No preference');
    setSelectedIncomeBand('No preference');
    setSelectedDiet('No preference');
    setUsernameSearch('');
    setKeywordSearch('');
    
    toast({
      title: "Search criteria reset",
      description: "All search fields have been cleared"
    });
  };

  const saveCurrentSearch = () => {
    const trimmed = searchName.trim();
    if (!trimmed) {
      toast({
        title: "Please name your search",
        description: "Enter a name to save your search criteria",
        variant: "destructive"
      });
      return;
    }
    if (savedSearches.some(s => s.name.toLowerCase() === trimmed.toLowerCase() && s.id !== editingSavedSearchId)) {
      toast({ title: "Name already exists", description: "Choose a different name.", variant: "destructive" });
      return;
    }
    if (!editingSavedSearchId && savedSearches.length >= 20) {
      toast({ title: "Too many saved searches", description: "Delete one before saving another (max 20).", variant: "destructive" });
      return;
    }

    const newSearch: SavedSearch = {
      id: editingSavedSearchId || Date.now().toString(),
      name: trimmed,
      minAge,
      maxAge,
      specialties,
      degrees: selectedDegrees,
      country: selectedCountry,
      state: selectedState,
      city: selectedCity,
      sexualOrientation: selectedOrientation,
      onlineOnly,
      searchKeywords: searchTerm,
      ethnicity: selectedEthnicity,
      religion: selectedReligion,
      caste: selectedCaste,
      cast: selectedCaste,
      subcaste: selectedSubcaste,
      gotra: selectedGotra,
      motherTongue: selectedMotherTongue,
      excludeSameGotra,
      minGunas,
      color: selectedColor,
      usernameSearch,
      keywordSearch,
      familyType: selectedFamilyType,
      familyStatus: selectedFamilyStatus,
      incomeBand: selectedIncomeBand,
      diet: selectedDiet,
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
    setSelectedDegrees(search.degrees ?? []);
    setSelectedCountry(search.country);
    setSelectedState(search.state);
    setSelectedCity(search.city);
    setSelectedOrientation(search.sexualOrientation);
    setOnlineOnly(search.onlineOnly);
    setSearchTerm(search.searchKeywords);
    setSelectedEthnicity(search.ethnicity ?? []);
    setSelectedReligion(search.religion ?? 'No preference');
    setSelectedCaste(search.caste ?? search.cast ?? 'No preference');
    setSelectedSubcaste(search.subcaste ?? '');
    setSelectedGotra(search.gotra ?? 'No preference');
    setSelectedMotherTongue(search.motherTongue ?? []);
    setExcludeSameGotra(search.excludeSameGotra ?? false);
    setMinGunas(search.minGunas ?? 0);
    setSelectedColor(search.color ?? '');
    setSelectedFamilyType(search.familyType ?? 'No preference');
    setSelectedFamilyStatus(search.familyStatus ?? 'No preference');
    setSelectedIncomeBand(search.incomeBand ?? 'No preference');
    setSelectedDiet(search.diet ?? 'No preference');
    setUsernameSearch(search.usernameSearch ?? '');
    setKeywordSearch(search.keywordSearch ?? '');
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
    setSelectedDegrees(search.degrees ?? []);
    setSelectedCountry(search.country);
    setSelectedState(search.state);
    setSelectedCity(search.city);
    setSelectedOrientation(search.sexualOrientation);
    setOnlineOnly(search.onlineOnly);
    setSearchTerm(search.searchKeywords);
    setSelectedEthnicity(search.ethnicity ?? []);
    setSelectedReligion(search.religion ?? 'No preference');
    setSelectedCaste(search.caste ?? search.cast ?? 'No preference');
    setSelectedSubcaste(search.subcaste ?? '');
    setSelectedGotra(search.gotra ?? 'No preference');
    setSelectedMotherTongue(search.motherTongue ?? []);
    setExcludeSameGotra(search.excludeSameGotra ?? false);
    setMinGunas(search.minGunas ?? 0);
    setSelectedColor(search.color ?? '');
    setSelectedFamilyType(search.familyType ?? 'No preference');
    setSelectedFamilyStatus(search.familyStatus ?? 'No preference');
    setSelectedIncomeBand(search.incomeBand ?? 'No preference');
    setSelectedDiet(search.diet ?? 'No preference');
    setUsernameSearch(search.usernameSearch ?? '');
    setKeywordSearch(search.keywordSearch ?? '');
    
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800">
                Find Your Match
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Advanced multi-attribute search across verified doctor profiles</p>
            </div>
            
            <div className="w-full sm:w-auto flex items-center gap-2">
              <Button
                variant="outline" 
                size="sm"
                className={`flex items-center space-x-2 h-9 w-full sm:w-auto ${showSavedSearches ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
                onClick={() => setShowSavedSearches(!showSavedSearches)}
              >
                <Save size={16} />
                <span>{showSavedSearches ? 'Hide Saved Searches' : 'Saved Searches'}</span>
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
                            <div className="text-sm text-gray-600 flex flex-wrap gap-2">
                              {search.specialties.length > 0 && 
                                <span>{search.specialties.join(", ")}</span>
                              }
                              {(search.minAge[0] !== 25 || search.maxAge[0] !== 45) && 
                                <span>{search.minAge[0]}-{search.maxAge[0]} y/o</span>
                              }
                              {search.country && 
                                <span className="flex items-center">
                                  <MapPin size={12} className="mr-1" />
                                  {search.country}
                                  {search.state && `, ${search.state}`}
                                </span>
                              }
                              {search.religion && search.religion !== 'No preference' && (
                                <span>{search.religion}</span>
                              )}
                              {(search.caste || search.cast) && (search.caste || search.cast) !== 'No preference' && (
                                <span>{search.caste || search.cast}</span>
                              )}
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
                              min={21} 
                              step={1}
                              value={minAge}
                              onValueChange={setMinAge}
                              className="mb-6"
                            />
                            <Slider 
                              defaultValue={[45]} 
                              max={65} 
                              min={21} 
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
                        <Label className="mb-2 block font-semibold text-slate-800">Medical Degree / Qualification</Label>
                        <div className="grid grid-cols-2 gap-2 h-40 overflow-y-auto pr-2 border rounded-md p-3 bg-slate-50/50">
                          {degreesList.map((deg) => (
                            <div key={deg} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`degree-${deg}`} 
                                checked={selectedDegrees.includes(deg)}
                                onCheckedChange={() => handleDegreeChange(deg)}
                              />
                              <Label htmlFor={`degree-${deg}`} className="cursor-pointer text-sm font-medium">{deg}</Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="mb-2 block font-semibold text-slate-800">Specialty</Label>
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
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label className="mb-2 block font-semibold text-slate-800">Sexual Orientation</Label>
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
                        
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="mb-2 block">Religion</Label>
                            <Select 
                              value={selectedReligion} 
                              onValueChange={setSelectedReligion}
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
                          </div>

                          <div>
                            <Label className="mb-2 block">Caste</Label>
                            <Select 
                              value={selectedCaste} 
                              onValueChange={setSelectedCaste}
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
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label className="mb-2 block">Subcaste</Label>
                        <div className="space-y-2">
                          <Select 
                            value={selectedSubcaste || 'No preference'} 
                            onValueChange={(v) => setSelectedSubcaste(v === 'No preference' ? '' : v)}
                          >
                            <SelectTrigger id="search-subcaste">
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
                            placeholder="Or enter specific subcaste..." 
                            value={selectedSubcaste}
                            onChange={(e) => setSelectedSubcaste(e.target.value)}
                            className="text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="mb-2 block">Gotra / Lineage</Label>
                        <div className="space-y-2">
                          <Select 
                            value={selectedGotra} 
                            onValueChange={setSelectedGotra}
                          >
                            <SelectTrigger id="search-gotra">
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
                          <div className="flex items-center space-x-2 pt-1">
                            <Checkbox 
                              id="search-exclude-gotra" 
                              checked={excludeSameGotra}
                              onCheckedChange={(checked) => setExcludeSameGotra(!!checked)}
                            />
                            <Label htmlFor="search-exclude-gotra" className="text-xs cursor-pointer font-normal">
                              Exclude Same Gotra (Sagotra Exogamy)
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Label className="mb-2 block">Mother Tongue / Regional Language</Label>
                        <div className="grid grid-cols-2 gap-2 h-40 overflow-y-auto pr-2 border rounded-md p-3">
                          {motherTongueList.map((lang) => (
                            <div key={lang} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`search-mt-${lang}`} 
                                checked={selectedMotherTongue.includes(lang)}
                                onCheckedChange={() => handleMotherTongueChange(lang)}
                              />
                              <Label htmlFor={`search-mt-${lang}`} className="cursor-pointer text-xs">{lang}</Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="mb-2 block">Kundali Compatibility (Ashta Koota / 36 Gunas)</Label>
                        <div className="space-y-3 border rounded-md p-3">
                          <Select 
                            value={minGunas.toString()} 
                            onValueChange={(val) => setMinGunas(parseInt(val, 10))}
                          >
                            <SelectTrigger id="search-min-gunas">
                              <SelectValue placeholder="Minimum Gunas" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Any Compatibility</SelectItem>
                              <SelectItem value="18">18+ Gunas (Shubh / Recommended)</SelectItem>
                              <SelectItem value="24">24+ Gunas (Good Alignment)</SelectItem>
                              <SelectItem value="28">28+ Gunas (Uttam / Excellent)</SelectItem>
                              <SelectItem value="32">32+ Gunas (Highest Match)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-slate-500">Filters prospective doctor matches meeting traditional 36-point Vedic horoscope compatibility.</p>
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
                          </div>
                          {/* P0-4 family depth filters. */}
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            {[
                              { label: 'Family Type', value: selectedFamilyType, set: setSelectedFamilyType, opts: ['Joint', 'Nuclear', 'Extended'] },
                              { label: 'Family Status', value: selectedFamilyStatus, set: setSelectedFamilyStatus, opts: ['Middle Class', 'Upper Middle Class', 'Affluent'] },
                              { label: 'Income', value: selectedIncomeBand, set: setSelectedIncomeBand, opts: ['Under ₹10L', '₹10–25L', '₹25–50L', '₹50L–1Cr', '₹1Cr+'] },
                              { label: 'Diet', value: selectedDiet, set: setSelectedDiet, opts: ['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan'] },
                            ].map((f) => (
                              <div key={f.label}>
                                <Label className="mb-2 block">{f.label}</Label>
                                <Select value={f.value} onValueChange={f.set}>
                                  <SelectTrigger><SelectValue placeholder="No preference" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="No preference">No preference</SelectItem>
                                    {f.opts.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
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
                  <p>🕉️ <span className="font-medium">Religion & Caste</span> preferences assist in discovering culturally aligned partners.</p>
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
