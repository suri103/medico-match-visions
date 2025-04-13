
import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Star } from 'lucide-react';

interface FavoritesHeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
}

const FavoritesHeader: React.FC<FavoritesHeaderProps> = ({
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy
}) => {
  return (
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
  );
};

export default FavoritesHeader;
