
import React, { useState } from 'react';
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
import { Search, Filter, Users, X } from 'lucide-react';

// Sample data for doctor profiles
const doctorProfiles = [
  {
    id: '1',
    name: 'Priya Sharma',
    age: 32,
    specialty: 'Cardiologist',
    hospital: 'Apollo Hospital',
    city: 'Mumbai',
    imageUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
    matchPercentage: 95,
    interests: ['Yoga', 'Travel', 'Reading', 'Cuisine'],
    isOnline: true
  },
  {
    id: '2',
    name: 'Rajiv Mehta',
    age: 35,
    specialty: 'Neurologist',
    hospital: 'AIIMS',
    city: 'Delhi',
    imageUrl: 'https://randomuser.me/api/portraits/men/42.jpg',
    matchPercentage: 88,
    interests: ['Tennis', 'Music', 'Hiking'],
    isOnline: false
  },
  {
    id: '3',
    name: 'Ananya Patel',
    age: 29,
    specialty: 'Pediatrician',
    hospital: 'Fortis Hospital',
    city: 'Bangalore',
    imageUrl: 'https://randomuser.me/api/portraits/women/67.jpg',
    matchPercentage: 84,
    interests: ['Dancing', 'Cooking', 'Photography'],
    isOnline: true
  },
  {
    id: '4',
    name: 'Vikram Singh',
    age: 34,
    specialty: 'Orthopedic Surgeon',
    hospital: 'Max Healthcare',
    city: 'Chennai',
    imageUrl: 'https://randomuser.me/api/portraits/men/79.jpg',
    matchPercentage: 82,
    interests: ['Cricket', 'Mountain Biking', 'Movies'],
    isOnline: false
  },
  {
    id: '5',
    name: 'Shreya Gupta',
    age: 31,
    specialty: 'Dermatologist',
    hospital: 'Medanta',
    city: 'Hyderabad',
    imageUrl: 'https://randomuser.me/api/portraits/women/90.jpg',
    matchPercentage: 79,
    interests: ['Painting', 'Literature', 'Swimming'],
    isOnline: true
  },
  {
    id: '6',
    name: 'Arjun Kapoor',
    age: 36,
    specialty: 'Psychiatrist',
    hospital: 'Columbia Asia',
    city: 'Pune',
    imageUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
    matchPercentage: 76,
    interests: ['Psychology', 'Chess', 'Running'],
    isOnline: false
  }
];

const Matches = () => {
  const { toast } = useToast();
  const [filteredDoctors, setFilteredDoctors] = useState(doctorProfiles);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [minAge, setMinAge] = useState([25]);
  const [maxAge, setMaxAge] = useState([45]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'matches' | 'video' | 'chat'>('matches');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const filtered = doctorProfiles.filter(doctor => {
      // Filter by search term
      const matchesSearch = doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doctor.city.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by age range
      const matchesAge = doctor.age >= minAge[0] && doctor.age <= maxAge[0];
      
      // Filter by specialties
      const matchesSpecialty = specialties.length === 0 || specialties.includes(doctor.specialty);
      
      return matchesSearch && matchesAge && matchesSpecialty;
    });
    
    setFilteredDoctors(filtered);
    setIsFilterVisible(false);
    
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
    setFilteredDoctors(doctorProfiles);
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
              
              <div className="w-full md:w-auto flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                <form onSubmit={handleSearch} className="flex space-x-2">
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
                </form>
                
                <Button 
                  variant="outline"
                  className="flex items-center space-x-2"
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                >
                  <Filter size={18} />
                  <span>Filters</span>
                </Button>
              </div>
            </div>
            
            {/* Filters Panel */}
            {isFilterVisible && (
              <div className="mb-8 p-6 bg-white rounded-xl shadow-md animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-mediblue-800">Refine Your Matches</h2>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setIsFilterVisible(false)}
                  >
                    <X size={20} />
                  </Button>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <div className="space-y-2">
                      {['Cardiologist', 'Neurologist', 'Pediatrician', 'Orthopedic Surgeon', 'Dermatologist', 'Psychiatrist'].map((specialty) => (
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
                    <Label className="block mb-3">Availability</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="online" />
                        <Label htmlFor="online" className="cursor-pointer">Currently Online</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="available" />
                        <Label htmlFor="available" className="cursor-pointer">Available for Video Dates</Label>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <Button variant="outline" onClick={handleReset}>Reset All</Button>
                  <Button onClick={handleSearch}>Apply Filters</Button>
                </div>
              </div>
            )}
            
            {/* Results */}
            {filteredDoctors.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDoctors.map((doctor) => (
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
