
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { favoriteDoctors, likedByDoctors, Doctor } from '../data/sampleData';

export const useFavorites = () => {
  const { toast } = useToast();
  const [favorites, setFavorites] = useState(favoriteDoctors);
  const [likedBy, setLikedBy] = useState(likedByDoctors);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("match");
  
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
        return [...doctors].sort((a, b) => a.lastActive === "Online now" ? -1 : b.lastActive === "Online now" ? 1 : 0);
      case "ageAsc":
        return [...doctors].sort((a, b) => a.age - b.age);
      case "ageDesc":
        return [...doctors].sort((a, b) => b.age - a.age);
      default:
        return doctors;
    }
  };

  const filteredFavorites = filterDoctors(favorites, searchTerm);
  const filteredLikedBy = filterDoctors(likedBy, searchTerm);

  const sortedFavorites = sortDoctors(filteredFavorites);
  const sortedLikedBy = sortDoctors(filteredLikedBy);

  return {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortedFavorites,
    sortedLikedBy,
    handleRemoveFavorite,
    handleAddFavorite,
    handleLike,
    handleVideoCall,
    handleChat
  };
};
