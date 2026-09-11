import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useMatches, MatchSearchCriteria } from '@/features/matches/hooks/useMatches';
import { countries, statesByCountry, specialtiesList, degreesList, orientationsList, ethnicityList, religionList, casteList, subcasteSuggestions, gotraList, colorList } from '@/features/matches/data/constants';
import { parseQueryToSearchCriteria } from '@/utils/queryValidation';

// Components
import SearchSidebar from '@/features/matches/components/SearchSidebar';
import SavedSearchesList from '@/features/matches/components/SavedSearchesList';
import MatchesHeader from '@/features/matches/components/MatchesHeader';
import DoctorsGrid from '@/features/matches/components/DoctorsGrid';
import { SavedSearch } from '@/features/matches/types';

const Matches = () => {
  const location = useLocation();
  const stateSearch = (location.state as { search?: MatchSearchCriteria } | null)?.search;
  const qs = new URLSearchParams(location.search);
  const querySearch = parseQueryToSearchCriteria(qs);
  const searchState = stateSearch || querySearch;
  const [showSavePanel, setShowSavePanel] = useState(false);
  const {
    searchTerm,
    setSearchTerm,
    minAge,
    setMinAge,
    maxAge,
    setMaxAge,
    specialties,
    setSpecialties,
    selectedDegrees,
    handleDegreeChange,
    onlineOnly,
    setOnlineOnly,
    activeView,
    setActiveView,
    savedSearches,
    showSavedSearches,
    setShowSavedSearches,
    selectedSavedSearch,
    selectedCountry,
    setSelectedCountry,
    selectedState,
    setSelectedState,
    selectedCity,
    setSelectedCity,
    selectedOrientation,
    selectedEthnicity,
    selectedReligion,
    setSelectedReligion,
    selectedCaste,
    setSelectedCaste,
    selectedCast,
    setSelectedCast,
    selectedSubcaste,
    setSelectedSubcaste,
    selectedGotra,
    setSelectedGotra,
    selectedMotherTongue,
    handleMotherTongueChange,
    excludeSameGotra,
    setExcludeSameGotra,
    minGunas,
    setMinGunas,
    selectedColor,
    setSelectedColor,
    selectedFamilyType,
    setSelectedFamilyType,
    selectedFamilyStatus,
    setSelectedFamilyStatus,
    selectedIncomeBand,
    setSelectedIncomeBand,
    selectedDiet,
    setSelectedDiet,
    dailyPicks,
    availableStates,
    availableCities,
    handleSearch,
    handleReset,
    handleVideoCall,
    handleChat,
    handleLike,
    loadSavedSearch,
    editSavedSearch,
    deleteSavedSearch,
    handleOrientationChange,
    handleEthnicityChange,
    handleSortChange,
    getPaginatedDoctors,
    selectedDoctorData,
    currentPage,
    setCurrentPage,
    totalPages,
    filteredDoctors,
    searchName,
    setSearchName,
    saveCurrentSearch
  } = useMatches(searchState);

  const handleCustomSearch = (e: React.FormEvent) => {
    handleSearch(e);
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    if (minAge?.[0]) params.set('min', String(minAge[0]));
    if (maxAge?.[0]) params.set('max', String(maxAge[0]));
    if (specialties?.length) params.set('spec', specialties.join(','));
    if (selectedDegrees?.length) params.set('deg', selectedDegrees.join(','));
    if (onlineOnly) params.set('online', '1');
    if (selectedCountry) params.set('country', selectedCountry);
    if (selectedState) params.set('state', selectedState);
    if (selectedCity) params.set('city', selectedCity);
    if (selectedOrientation?.length) params.set('ori', selectedOrientation.join(','));
    if (selectedEthnicity?.length) params.set('eth', selectedEthnicity.join(','));
    if (selectedReligion && selectedReligion !== 'No preference') params.set('rel', selectedReligion);
    const effectiveCaste = selectedCaste || selectedCast;
    if (effectiveCaste && effectiveCaste !== 'No preference') params.set('caste', effectiveCaste);
    if (selectedSubcaste) params.set('subcaste', selectedSubcaste);
    if (selectedGotra && selectedGotra !== 'No preference') params.set('gotra', selectedGotra);
    if (selectedMotherTongue?.length) params.set('mt', selectedMotherTongue.join(','));
    if (excludeSameGotra) params.set('nosamegotra', '1');
    if (minGunas) params.set('gunas', String(minGunas));
    if (selectedColor) params.set('color', selectedColor);
    if (selectedFamilyType && selectedFamilyType !== 'No preference') params.set('familyType', selectedFamilyType);
    if (selectedFamilyStatus && selectedFamilyStatus !== 'No preference') params.set('familyStatus', selectedFamilyStatus);
    if (selectedIncomeBand && selectedIncomeBand !== 'No preference') params.set('incomeBand', selectedIncomeBand);
    if (selectedDiet && selectedDiet !== 'No preference') params.set('diet', selectedDiet);
    const queryStr = params.toString();
    window.history.replaceState({}, '', queryStr ? `?${queryStr}` : window.location.pathname);
  };

  const handleCustomReset = () => {
    handleReset();
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleLoadSavedSearch = (search: SavedSearch) => {
    loadSavedSearch(search.id);
  };
  
  const handleEditSavedSearch = (search: SavedSearch) => {
    editSavedSearch(search.id);
    setShowSavePanel(true);
  };
  
  const handleDeleteSavedSearch = (id: string) => {
    deleteSavedSearch(id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      {activeView === 'matches' && (
        <SidebarProvider defaultOpen={true}>
          <div className="flex flex-1 w-full overflow-x-hidden">
            <SearchSidebar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              minAge={minAge}
              setMinAge={setMinAge}
              maxAge={maxAge}
              setMaxAge={setMaxAge}
              specialties={specialties}
              setSpecialties={setSpecialties}
              selectedDegrees={selectedDegrees}
              handleDegreeChange={handleDegreeChange}
              onlineOnly={onlineOnly}
              setOnlineOnly={setOnlineOnly}
              selectedCountry={selectedCountry}
              setSelectedCountry={setSelectedCountry}
              selectedState={selectedState}
              setSelectedState={setSelectedState}
              selectedCity={selectedCity}
              setSelectedCity={setSelectedCity}
              selectedOrientation={selectedOrientation}
              handleOrientationChange={handleOrientationChange}
              selectedEthnicity={selectedEthnicity}
              handleEthnicityChange={handleEthnicityChange}
              selectedReligion={selectedReligion}
              setSelectedReligion={setSelectedReligion}
              selectedCaste={selectedCaste}
              setSelectedCaste={setSelectedCaste}
              selectedCast={selectedCast}
              setSelectedCast={setSelectedCast}
              selectedSubcaste={selectedSubcaste}
              setSelectedSubcaste={setSelectedSubcaste}
              selectedGotra={selectedGotra}
              setSelectedGotra={setSelectedGotra}
              selectedMotherTongue={selectedMotherTongue}
              handleMotherTongueChange={handleMotherTongueChange}
              excludeSameGotra={excludeSameGotra}
              setExcludeSameGotra={setExcludeSameGotra}
              minGunas={minGunas}
              setMinGunas={setMinGunas}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              selectedFamilyType={selectedFamilyType}
              setSelectedFamilyType={setSelectedFamilyType}
              selectedFamilyStatus={selectedFamilyStatus}
              setSelectedFamilyStatus={setSelectedFamilyStatus}
              selectedIncomeBand={selectedIncomeBand}
              setSelectedIncomeBand={setSelectedIncomeBand}
              selectedDiet={selectedDiet}
              setSelectedDiet={setSelectedDiet}
              handleSearch={handleCustomSearch}
              handleReset={handleCustomReset}
              specialtiesList={specialtiesList}
              degreesList={degreesList}
              orientationsList={orientationsList}
              ethnicityList={ethnicityList}
              religionList={religionList}
              casteList={casteList}
              subcasteSuggestions={subcasteSuggestions}
              gotraList={gotraList}
              colorList={colorList}
              availableStates={availableStates}
              availableCities={availableCities}
            />

            <main className="flex-grow p-4 md:p-8 overflow-x-hidden w-full">
              <div className="max-w-7xl mx-auto w-full">
                <MatchesHeader
                  totalMatches={filteredDoctors.length}
                  showSavedSearches={showSavedSearches}
                  setShowSavedSearches={setShowSavedSearches}
                  onSortChange={handleSortChange}
                />

                {/* P0-5 Today's picks: server-ranked daily matches. */}
                {dailyPicks.length > 0 && (
                  <Card className="mt-4 bg-gradient-to-r from-rose-50 to-amber-50 border-rose-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">✨ Today's picks for you</CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-3 overflow-x-auto pb-3">
                      {dailyPicks.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => handleChat(d.id)}
                          className="min-w-[140px] text-left bg-white rounded-xl border p-2 hover:shadow"
                          title={`Chat with Dr. ${d.name}`}
                        >
                          <div className="text-sm font-semibold truncate">Dr. {d.name}</div>
                          <div className="text-xs text-slate-500 truncate">{d.specialty} · {d.city}</div>
                          <div className="text-xs text-emerald-700">{d.matchPercentage}% match{d.isVerified ? ' · ✓' : ''}</div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
                
                {showSavedSearches && (
                  <SavedSearchesList
                    savedSearches={savedSearches}
                    onSelect={handleLoadSavedSearch}
                    onDelete={handleDeleteSavedSearch}
                    onCreateNew={() => setShowSavePanel(true)}
                    selectedSavedSearch={selectedSavedSearch ?? undefined}
                    showSavedSearches={showSavedSearches}
                    countries={countries}
                    statesByCountry={statesByCountry}
                    onHideSavedSearches={() => setShowSavedSearches(false)}
                    onLoadSavedSearch={handleLoadSavedSearch}
                    onEditSavedSearch={handleEditSavedSearch}
                    onDeleteSavedSearch={handleDeleteSavedSearch}
                  />
                )}
                
                {showSavePanel && (
                  <Card className="mt-4 bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {selectedSavedSearch && savedSearches.some(s => s.id === selectedSavedSearch)
                          ? 'Update Saved Search'
                          : 'Save Current Search'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-grow">
                          <Label htmlFor="matches-search-name" className="block mb-1">
                            Search name
                          </Label>
                          <Input
                            id="matches-search-name"
                            placeholder="e.g. Cardiologists in Mumbai"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button type="button" onClick={() => {
                            saveCurrentSearch();
                            setShowSavePanel(false);
                          }}>
                            Save
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setShowSavePanel(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <DoctorsGrid
                  doctors={getPaginatedDoctors()}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  onLike={handleLike}
                  onVideo={handleVideoCall}
                  onMessage={handleChat}
                  onReset={handleCustomReset}
                />
              </div>
            </main>
          </div>
        </SidebarProvider>
      )}
      
      {activeView === 'video' && selectedDoctorData && (
        <div className="flex-grow overflow-x-hidden w-full">
          <VideoCall 
            doctorId={selectedDoctorData.id}
            doctorName={selectedDoctorData.name}
            doctorImage={selectedDoctorData.imageUrl}
            onEndCall={() => setActiveView('matches')}
          />
        </div>
      )}
      
      {activeView === 'chat' && selectedDoctorData && (
        <div className="flex-grow p-4 overflow-x-hidden w-full">
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
