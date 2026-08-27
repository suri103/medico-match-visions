
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Doctor } from '../../matches/types';
import { useFavoritesContext } from '../FavoritesContext';

export const useFavorites = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    favorites,
    shortlist,
    likedBy,
    isFavorite,
    removeFavorite,
    addFavoriteById,
    toggleFavorite,
    unshortlistDoctor,
    sendInterest,
    withdrawInterest,
  } = useFavoritesContext();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = usePersistedState("mm:favoritesSort", "match");

  const handleRemoveFavorite = (id: string) => {
    removeFavorite(id);
    toast({
      title: "Removed from favorites",
      description: "Doctor has been removed from your favorites list.",
    });
  };

  const handleAddFavorite = (id: string) => {
    addFavoriteById(id);
    toast({
      title: "Added to favorites",
      description: "Doctor has been added to your favorites list.",
    });
  };

  const handleLike = (id: string) => {
    const doctor = favorites.find(d => d.id === id) || likedBy.find(d => d.id === id);
    if (!doctor) return;
    const wasFavorite = isFavorite(id);
    if (wasFavorite) {
      withdrawInterest(doctor.id);
      toast({ title: "Removed from favorites", description: `Dr. ${doctor.name} has been removed from your favorites and interests.` });
    } else {
      const accepted = sendInterest(doctor);
      if (!accepted) {
        toast({ title: "Interest limit reached", description: "Your plan's monthly interest limit is reached. Upgrade for more.", variant: "destructive" });
        return;
      }
      toast({ title: "Added to favorites", description: `Dr. ${doctor.name} has been saved to your favorites and interests.` });
    }
  };

  const { canMessage: canMsg, canVideoCall: canVid } = useFavoritesContext();
  const handleVideoCall = (id: string) => {
    if (!canVid(id)) {
      toast({ title: "Match to video chat", description: "Like each other first to unlock video calls.", variant: "destructive" });
      return;
    }
    navigate('/video-dates');
  };

  const handleChat = (id: string) => {
    if (!canMsg(id)) {
      toast({ title: "Match to chat", description: "Like each other first to unlock chat.", variant: "destructive" });
      return;
    }
    const doctor = favorites.find(d => d.id === id) || likedBy.find(d => d.id === id);
    toast({
      title: "Opening chat",
      description: doctor ? `Opening conversation with Dr. ${doctor.name}` : "Opening messages",
    });
    navigate('/messages', { state: { openChatId: id } } as never);
  };

  const filterDoctors = (doctors: Doctor[], searchTerm: string) => {
    return doctors.filter(doctor =>
      doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.hospital.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.city.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const sortDoctors = (doctors: Doctor[]) => {
    switch (sortBy) {
      case "match":
        return [...doctors].sort((a, b) => b.matchPercentage - a.matchPercentage);
      case "recent":
        return [...doctors].sort((a, b) => recentRank(a.lastActive) - recentRank(b.lastActive));
      case "ageAsc":
        return [...doctors].sort((a, b) => a.age - b.age);
      case "ageDesc":
        return [...doctors].sort((a, b) => b.age - a.age);
      default:
        return doctors;
    }
  };

  // "Online now" is most recent; then minutes/hours, then days/weeks
  const recentRank = (lastActive?: Date | string): number => {
    const value = typeof lastActive === "string" ? lastActive.toLowerCase() : "recently";
    if (value.includes("online") || value === "now") return 0;
    if (value.includes("minute") || value.includes("hour") || value.includes("today")) return 1;
    if (value.includes("yesterday") || value.includes("day")) return 2;
    if (value.includes("week")) return 3;
    return 4;
  };

  const handleUnshortlist = (id: string) => {
    unshortlistDoctor(id);
    toast({
      title: "Removed from saved shortlist",
      description: "Doctor has been removed from your saved shortlist.",
    });
  };

  const filteredFavorites = filterDoctors(favorites, searchTerm);
  const filteredShortlist = filterDoctors(shortlist, searchTerm);
  const filteredLikedBy = filterDoctors(likedBy, searchTerm);

  const sortedFavorites = sortDoctors(filteredFavorites);
  const sortedShortlist = sortDoctors(filteredShortlist);
  const sortedLikedBy = sortDoctors(filteredLikedBy);

  return {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortedFavorites,
    sortedShortlist,
    sortedLikedBy,
    handleRemoveFavorite,
    handleAddFavorite,
    handleUnshortlist,
    handleLike,
    toggleFavorite,
    handleVideoCall,
    handleChat
  };
};
