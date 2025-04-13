
import React, { useState } from 'react';
import Header from '@/components/Header';
import FavoritesHeader from '@/features/favorites/components/FavoritesHeader';
import FavoritesTabs from '@/features/favorites/components/FavoritesTabs';
import { useFavorites } from '@/features/favorites/hooks/useFavorites';

const FavoritesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("favorites");
  const {
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
  } = useFavorites();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto w-full">
          <FavoritesHeader 
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />
          
          <FavoritesTabs 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            favorites={sortedFavorites}
            likedBy={sortedLikedBy}
            onRemoveFavorite={handleRemoveFavorite}
            onAddFavorite={handleAddFavorite}
            onLike={handleLike}
            onVideo={handleVideoCall}
            onMessage={handleChat}
          />
        </div>
      </main>
    </div>
  );
};

export default FavoritesPage;
