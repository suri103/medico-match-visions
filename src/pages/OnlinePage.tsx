import React from 'react';
import Header from '@/components/Header';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useMatches } from '@/features/matches/hooks/useMatches';
import { specialtiesList, degreesList, orientationsList, ethnicityList, religionList, casteList, subcasteSuggestions, gotraList, colorList } from '@/features/matches/data/constants';
import SearchSidebar from '@/features/matches/components/SearchSidebar';
import DoctorsGrid from '@/features/matches/components/DoctorsGrid';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import ProfileCompletenessBanner from '@/components/ProfileCompletenessBanner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const OnlineHeader: React.FC<{ count: number; onSortChange: (value: string) => void }> = ({ count, onSortChange }) => {
  const { toggleSidebar } = useSidebar();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Who's Online</h1>
          <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {count} Active Now
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Verified doctors available right now for instant matrimonial chat and video connection.
        </p>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
        <Button
          variant="outline"
          size="sm"
          className="md:hidden flex items-center gap-1.5 h-9 bg-white border-mediblue-200 text-mediblue-700 hover:bg-mediblue-50 font-medium text-xs"
          onClick={toggleSidebar}
        >
          <Filter size={15} className="text-mediblue-600" />
          <span>Filters</span>
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">Sort by:</span>
          <Select defaultValue="match" onValueChange={onSortChange}>
            <SelectTrigger className="w-[160px] sm:w-[180px] h-9 text-xs bg-white">
              <SelectValue placeholder="Sort doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="match">Match Percentage</SelectItem>
              <SelectItem value="gunas-desc">Astrology Gunas (Highest)</SelectItem>
              <SelectItem value="age-asc">Age (Youngest First)</SelectItem>
              <SelectItem value="age-desc">Age (Oldest First)</SelectItem>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

const OnlinePage = () => {
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
    availableStates,
    availableCities,
    handleSearch,
    handleReset,
    handleVideoCall,
    handleChat,
    handleLike,
    handleOrientationChange,
    handleEthnicityChange,
    handleSortChange,
    getPaginatedDoctors,
    selectedDoctorData,
    currentPage,
    setCurrentPage,
    totalPages,
    filteredDoctors,
  } = useMatches({ onlineOnly: true });

  const onlineDoctorsList = filteredDoctors.filter(d => d.isOnline);

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
              handleSearch={handleSearch}
              handleReset={handleReset}
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
                {/* Header section with count, mobile filter button, and sorting */}
                <OnlineHeader count={onlineDoctorsList.length} onSortChange={handleSortChange} />

                {/* Onboarding gap-fix #2: persistent completion nudge. */}
                <ProfileCompletenessBanner className="mb-6" />

                {/* Doctors Grid with all interactive modals */}
                <DoctorsGrid
                  doctors={getPaginatedDoctors().filter(d => d.isOnline)}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  onReset={handleReset}
                  onLike={handleLike}
                  onVideo={handleVideoCall}
                  onMessage={handleChat}
                />
              </div>
            </main>
          </div>
        </SidebarProvider>
      )}

      {activeView === 'video' && selectedDoctorData && (
        <VideoCall
          doctorId={selectedDoctorData.id}
          doctorName={selectedDoctorData.name}
          doctorImage={selectedDoctorData.imageUrl}
          onEndCall={() => setActiveView('matches')}
        />
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

export default OnlinePage;
