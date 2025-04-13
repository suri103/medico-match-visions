
import React from 'react';
import Header from '@/components/Header';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { countries, statesByCountry, specialtiesList, orientationsList, ethnicityList, castList, colorList } from '@/features/matches/data/constants';

// Components
import SearchSidebar from '@/features/matches/components/SearchSidebar';
import SavedSearchesList from '@/features/matches/components/SavedSearchesList';
import MatchesHeader from '@/features/matches/components/MatchesHeader';
import DoctorsGrid from '@/features/matches/components/DoctorsGrid';

const Matches = () => {
  const {
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
    selectedCast,
    setSelectedCast,
    selectedColor,
    setSelectedColor,
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
    filteredDoctors
  } = useMatches();

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
              selectedCast={selectedCast}
              setSelectedCast={setSelectedCast}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              handleSearch={handleSearch}
              handleReset={handleReset}
              specialtiesList={specialtiesList}
              orientationsList={orientationsList}
              ethnicityList={ethnicityList}
              castList={castList}
              colorList={colorList}
            />

            <main className="flex-grow p-4 md:p-8 overflow-x-hidden w-full">
              <div className="max-w-7xl mx-auto w-full">
                <MatchesHeader
                  totalMatches={filteredDoctors.length}
                  showSavedSearches={showSavedSearches}
                  setShowSavedSearches={setShowSavedSearches}
                  onSortChange={handleSortChange}
                />
                
                <SavedSearchesList
                  savedSearches={savedSearches}
                  selectedSavedSearch={selectedSavedSearch}
                  showSavedSearches={showSavedSearches}
                  countries={countries}
                  statesByCountry={statesByCountry}
                  onHideSavedSearches={() => setShowSavedSearches(false)}
                  onLoadSavedSearch={loadSavedSearch}
                  onEditSavedSearch={editSavedSearch}
                  onDeleteSavedSearch={deleteSavedSearch}
                />
                
                <DoctorsGrid
                  doctors={getPaginatedDoctors()}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  onLike={handleLike}
                  onVideo={handleVideoCall}
                  onMessage={handleChat}
                  onReset={handleReset}
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
