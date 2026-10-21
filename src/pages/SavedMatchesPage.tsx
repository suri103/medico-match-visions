import React, { useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bookmark, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { useToast } from '@/hooks/use-toast';
import DoctorsGrid from '@/features/favorites/components/DoctorsGrid';
import { Doctor } from '@/features/matches/types';

const SavedMatchesPage: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    shortlist,
    unshortlistDoctor,
    toggleFavorite,
    canMessage: canMsg,
    canVideoCall: canVid,
  } = useFavoritesContext();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("match");

  const handleUnshortlist = (id: string) => {
    unshortlistDoctor(id);
    toast({
      title: "Removed from saved matches",
      description: "Doctor has been removed from your saved list.",
    });
  };

  const handleLike = (id: string) => {
    const doctor = shortlist.find(d => d.id === id);
    if (!doctor) return;
    toggleFavorite(doctor);
  };

  const handleVideoCall = (id: string) => {
    if (!canVid(id)) {
      toast({ title: "Match to video chat", description: "Like each other first to unlock video calls.", variant: "destructive" });
      return;
    }
    void navigate('/video-dates');
  };

  const handleChat = (id: string) => {
    if (!canMsg(id)) {
      toast({ title: "Match to chat", description: "Like each other first to unlock chat.", variant: "destructive" });
      return;
    }
    void navigate('/messages', { state: { openChatId: id } } as never);
  };

  const filteredShortlist = shortlist.filter((doctor: Doctor) =>
    doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.hospital.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedShortlist = [...filteredShortlist].sort((a, b) => {
    switch (sortBy) {
      case "match":
        return b.matchPercentage - a.matchPercentage;
      case "ageAsc":
        return a.age - b.age;
      case "ageDesc":
        return b.age - a.age;
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header row */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Bookmark className="text-mediblue-600 fill-mediblue-600" size={26} />
                Saved Matches
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Profiles you have saved and bookmarked for later ({shortlist.length})
              </p>
            </div>
            
            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-[240px]">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <Input
                  placeholder="Search saved profiles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match">Match %</SelectItem>
                  <SelectItem value="ageAsc">Age: Low to High</SelectItem>
                  <SelectItem value="ageDesc">Age: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content */}
          {sortedShortlist.length > 0 ? (
            <DoctorsGrid
              doctors={sortedShortlist}
              onRemoveFavorite={handleUnshortlist}
              onLike={handleLike}
              onVideo={handleVideoCall}
              onMessage={handleChat}
              gridType="favorites"
            />
          ) : (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-12 text-center">
              <Bookmark className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-1.5">No saved matches yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                Click the bookmark icon on any doctor card to save profiles and review them here anytime.
              </p>
              <Button className="rounded-full bg-mediblue-600 hover:bg-mediblue-700 text-white shadow-xs" onClick={() => navigate('/matches')}>
                <Search className="h-4 w-4 mr-2" /> Browse Matches
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SavedMatchesPage;
