
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Star, Heart } from 'lucide-react';
import { Doctor } from '../data/sampleData';
import DoctorsGrid from './DoctorsGrid';
import EmptyState from './EmptyState';

interface FavoritesTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  favorites: Doctor[];
  likedBy: Doctor[];
  onRemoveFavorite: (id: string) => void;
  onAddFavorite: (id: string) => void;
  onLike: (id: string) => void;
  onVideo: (id: string) => void;
  onMessage: (id: string) => void;
}

const FavoritesTabs: React.FC<FavoritesTabsProps> = ({
  activeTab,
  setActiveTab,
  favorites,
  likedBy,
  onRemoveFavorite,
  onAddFavorite,
  onLike,
  onVideo,
  onMessage
}) => {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-6">
        <TabsTrigger value="favorites" className="flex items-center">
          <Star className="mr-2" size={16} />
          My Favorites ({favorites.length})
        </TabsTrigger>
        <TabsTrigger value="likes" className="flex items-center">
          <Heart className="mr-2" size={16} />
          Liked Your Profile ({likedBy.length})
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="favorites" className="mt-0">
        {favorites.length > 0 ? (
          <DoctorsGrid
            doctors={favorites}
            onRemoveFavorite={onRemoveFavorite}
            onLike={onLike}
            onVideo={onVideo}
            onMessage={onMessage}
            gridType="favorites"
          />
        ) : (
          <EmptyState 
            type="favorites"
            navigateTo="/matches"
            buttonText="Browse Matches"
          />
        )}
      </TabsContent>
      
      <TabsContent value="likes" className="mt-0">
        {likedBy.length > 0 ? (
          <DoctorsGrid
            doctors={likedBy}
            onAddFavorite={onAddFavorite}
            onLike={onLike}
            onVideo={onVideo}
            onMessage={onMessage}
            gridType="likes"
          />
        ) : (
          <EmptyState 
            type="likes"
            navigateTo="/profile"
            buttonText="Update Profile"
          />
        )}
      </TabsContent>
    </Tabs>
  );
};

export default FavoritesTabs;
