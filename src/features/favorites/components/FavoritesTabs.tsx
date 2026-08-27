
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Star, Heart, Bookmark } from 'lucide-react';
import { Doctor } from '@/features/matches/types';
import DoctorsGrid from './DoctorsGrid';
import EmptyState from './EmptyState';

interface FavoritesTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  favorites: Doctor[];
  shortlist?: Doctor[];
  likedBy: Doctor[];
  onRemoveFavorite: (id: string) => void;
  onAddFavorite: (id: string) => void;
  onUnshortlist?: (id: string) => void;
  onLike: (id: string) => void;
  onVideo: (id: string) => void;
  onMessage: (id: string) => void;
}

const FavoritesTabs: React.FC<FavoritesTabsProps> = ({
  activeTab,
  setActiveTab,
  favorites,
  shortlist = [],
  likedBy,
  onRemoveFavorite,
  onAddFavorite,
  onUnshortlist,
  onLike,
  onVideo,
  onMessage
}) => {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid grid-cols-1 sm:grid-cols-3 mb-6 bg-white border border-slate-200 shadow-sm h-auto p-1.5 gap-1.5 rounded-xl">
        <TabsTrigger value="favorites" className="flex items-center justify-center text-xs py-2 font-semibold data-[state=active]:bg-mediblue-50 data-[state=active]:text-mediblue-700">
          <Star className="mr-1.5 text-amber-500 fill-amber-500 shrink-0" size={15} />
          My Favorites ({favorites.length})
        </TabsTrigger>
        <TabsTrigger value="shortlist" className="flex items-center justify-center text-xs py-2 font-semibold data-[state=active]:bg-mediblue-50 data-[state=active]:text-mediblue-700">
          <Bookmark className="mr-1.5 text-mediblue-600 fill-mediblue-600 shrink-0" size={15} />
          Saved Matches ({shortlist.length})
        </TabsTrigger>
        <TabsTrigger value="likes" className="flex items-center justify-center text-xs py-2 font-semibold data-[state=active]:bg-mediblue-50 data-[state=active]:text-mediblue-700">
          <Heart className="mr-1.5 text-rose-500 fill-rose-500 shrink-0" size={15} />
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
            buttonText="Browse & Star Matches"
          />
        )}
      </TabsContent>

      <TabsContent value="shortlist" className="mt-0">
        {shortlist.length > 0 ? (
          <DoctorsGrid
            doctors={shortlist}
            onRemoveFavorite={onUnshortlist}
            onLike={onLike}
            onVideo={onVideo}
            onMessage={onMessage}
            gridType="favorites"
          />
        ) : (
          <EmptyState 
            type="favorites"
            navigateTo="/matches"
            buttonText="Browse & Save Matches"
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
