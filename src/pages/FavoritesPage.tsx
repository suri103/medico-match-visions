
import React, { useState } from 'react';
import Header from '@/components/Header';
import DoctorCard from '@/components/DoctorCard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Star, Search, Filter, Trash2, Heart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Sample favorite doctors data
const favoriteDoctors = [
  {
    id: "fav1",
    name: "Dr. Sarah Johnson",
    age: 32,
    specialty: "Cardiologist",
    hospital: "Mayo Clinic",
    city: "Rochester",
    state: "Minnesota",
    country: "United States",
    imageUrl: "https://randomuser.me/api/portraits/women/44.jpg",
    matchPercentage: 95,
    interests: ["Research", "Tennis", "Classical Music"],
    isOnline: true,
    isFavorite: true,
    lastActive: "2 hours ago",
    sexualOrientation: "Straight",
  },
  {
    id: "fav2",
    name: "Dr. Michael Chen",
    age: 36,
    specialty: "Neurologist",
    hospital: "Johns Hopkins Hospital",
    city: "Baltimore",
    state: "Maryland",
    country: "United States",
    imageUrl: "https://randomuser.me/api/portraits/men/32.jpg",
    matchPercentage: 89,
    interests: ["Hiking", "Medical Journals", "Photography"],
    isOnline: false,
    isFavorite: true,
    lastActive: "Yesterday",
    sexualOrientation: "Straight",
  },
  {
    id: "fav3",
    name: "Dr. Aisha Patel",
    age: 29,
    specialty: "Pediatrician",
    hospital: "Children's Hospital of Philadelphia",
    city: "Philadelphia",
    state: "Pennsylvania",
    country: "United States",
    imageUrl: "https://randomuser.me/api/portraits/women/67.jpg",
    matchPercentage: 92,
    interests: ["Child Psychology", "Yoga", "Painting"],
    isOnline: true,
    isFavorite: true,
    lastActive: "Online now",
    sexualOrientation: "Bisexual",
  },
];

// Sample doctors who liked you
const likedByDoctors = [
  {
    id: "like1",
    name: "Dr. James Wilson",
    age: 38,
    specialty: "Orthopedic Surgeon",
    hospital: "Cleveland Clinic",
    city: "Cleveland",
    state: "Ohio",
    country: "United States",
    imageUrl: "https://randomuser.me/api/portraits/men/52.jpg",
    matchPercentage: 87,
    interests: ["Sports Medicine", "Running", "Jazz"],
    isOnline: false,
    isFavorite: false,
    lastActive: "3 days ago",
    sexualOrientation: "Straight",
  },
  {
    id: "like2",
    name: "Dr. Emily Rodriguez",
    age: 34,
    specialty: "Dermatologist",
    hospital: "Massachusetts General Hospital",
    city: "Boston",
    state: "Massachusetts",
    country: "United States",
    imageUrl: "https://randomuser.me/api/portraits/women/28.jpg",
    matchPercentage: 91,
    interests: ["Cosmetic Procedures", "Travel", "Cooking"],
    isOnline: true,
    isFavorite: false,
    lastActive: "Online now",
    sexualOrientation: "Lesbian",
  },
];

const FavoritesPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("favorites");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("match");
  const [favorites, setFavorites] = useState(favoriteDoctors);
  const [likedBy, setLikedBy] = useState(likedByDoctors);

  const handleRemoveFavorite = (id: string) => {
    setFavorites(favorites.filter(doctor => doctor.id !== id));
    
    toast({
      title: "Removed from favorites",
      description: "Doctor has been removed from your favorites list.",
    });
  };

  const handleAddFavorite = (id: string) => {
    const doctor = likedBy.find(doc => doc.id === id);
    if (doctor) {
      const updatedDoctor = { ...doctor, isFavorite: true };
      setFavorites([...favorites, updatedDoctor]);
      
      toast({
        title: "Added to favorites",
        description: "Doctor has been added to your favorites list.",
      });
    }
  };

  const handleLike = (id: string) => {
    toast({
      title: "You liked this profile!",
      description: "We'll notify them of your interest.",
    });
  };

  const handleVideoCall = (id: string) => {
    toast({
      title: "Video call initiated",
      description: "Connecting to video call...",
    });
  };

  const handleChat = (id: string) => {
    toast({
      title: "Chat opened",
      description: "You can now start chatting.",
    });
  };

  const filteredFavorites = favorites.filter(doctor => 
    doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.hospital.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLikedBy = likedBy.filter(doctor => 
    doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.hospital.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortDoctors = (doctors: typeof favoriteDoctors) => {
    switch (sortBy) {
      case "match":
        return [...doctors].sort((a, b) => b.matchPercentage - a.matchPercentage);
      case "recent":
        return [...doctors].sort((a, b) => a.lastActive === "Online now" ? -1 : b.lastActive === "Online now" ? 1 : 0);
      case "ageAsc":
        return [...doctors].sort((a, b) => a.age - b.age);
      case "ageDesc":
        return [...doctors].sort((a, b) => b.age - a.age);
      default:
        return doctors;
    }
  };

  const sortedFavorites = sortDoctors(filteredFavorites);
  const sortedLikedBy = sortDoctors(filteredLikedBy);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800 mb-4 md:mb-0 flex items-center">
              <Star className="mr-2 text-amber-500" size={28} />
              My Favorites
            </h1>
            
            <div className="w-full md:w-auto flex flex-col md:flex-row gap-4">
              <div className="relative w-full md:w-auto">
                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                <Input
                  placeholder="Search favorites..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full md:w-[240px]"
                />
              </div>
              
              <Select defaultValue={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[180px]">
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
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="favorites" className="flex items-center">
                <Star className="mr-2" size={16} />
                My Favorites ({filteredFavorites.length})
              </TabsTrigger>
              <TabsTrigger value="likes" className="flex items-center">
                <Heart className="mr-2" size={16} />
                Liked Your Profile ({filteredLikedBy.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="favorites" className="mt-0">
              {sortedFavorites.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedFavorites.map((doctor) => (
                    <div key={doctor.id} className="relative">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="absolute top-2 right-2 z-10 bg-white/80 backdrop-blur-sm hover:bg-white text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveFavorite(doctor.id)}
                      >
                        <Trash2 size={18} />
                      </Button>
                      
                      <DoctorCard
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
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="pt-10 pb-10 text-center">
                    <Star className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <CardTitle className="text-xl mb-2">No favorites yet</CardTitle>
                    <CardDescription>
                      You haven't added any doctors to your favorites list yet. Browse matches and click the heart icon to save your favorites.
                    </CardDescription>
                    <Button 
                      className="mt-6" 
                      onClick={() => window.location.href = '/matches'}
                    >
                      Browse Matches
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="likes" className="mt-0">
              {sortedLikedBy.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedLikedBy.map((doctor) => (
                    <div key={doctor.id} className="relative">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="absolute top-2 right-2 z-10 bg-white/80 backdrop-blur-sm hover:bg-white text-amber-500 hover:text-amber-600"
                        onClick={() => handleAddFavorite(doctor.id)}
                      >
                        <Star size={18} />
                      </Button>
                      
                      <DoctorCard
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
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="pt-10 pb-10 text-center">
                    <Heart className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <CardTitle className="text-xl mb-2">No likes yet</CardTitle>
                    <CardDescription>
                      No doctors have liked your profile yet. Make sure your profile is complete to attract more potential matches.
                    </CardDescription>
                    <Button 
                      className="mt-6" 
                      onClick={() => window.location.href = '/profile'}
                    >
                      Update Profile
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default FavoritesPage;
