
import React from 'react';
import Header from '@/components/Header';
import FavoritesHeader from '@/features/favorites/components/FavoritesHeader';
import DoctorsGrid from '@/features/favorites/components/DoctorsGrid';
import EmptyState from '@/features/favorites/components/EmptyState';
import { useFavorites } from '@/features/favorites/hooks/useFavorites';

const FavoritesPage: React.FC = () => {
  const {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortedFavorites,
    handleRemoveFavorite,
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
          
          {sortedFavorites.length > 0 ? (
            <DoctorsGrid
              doctors={sortedFavorites}
              onRemoveFavorite={handleRemoveFavorite}
              onLike={handleLike}
              onVideo={handleVideoCall}
              onMessage={handleChat}
              gridType="favorites"
            />
          ) : (
            <EmptyState 
              type="favorites"
              navigateTo="/matches"
              buttonText="Browse & Star Matches"
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default FavoritesPage;
