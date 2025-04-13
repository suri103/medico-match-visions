
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MatchesHeaderProps {
  totalMatches: number;
  showSavedSearches: boolean;
  setShowSavedSearches: (show: boolean) => void;
  onSortChange: (value: string) => void;
}

const MatchesHeader: React.FC<MatchesHeaderProps> = ({ 
  totalMatches, 
  showSavedSearches, 
  setShowSavedSearches,
  onSortChange
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-8">
      <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800 mb-4 md:mb-0">
        Your Matches
      </h1>
      
      <div className="w-full md:w-auto flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
        <Button
          variant="outline" 
          size="sm"
          className={`flex items-center space-x-2 ${showSavedSearches ? 'bg-blue-50' : ''}`}
          onClick={() => setShowSavedSearches(!showSavedSearches)}
        >
          <Save size={16} />
          <span>Saved Searches</span>
        </Button>
      </div>

      <div className="mb-4 mt-4 md:mt-0 w-full md:w-auto">
        <div className="flex justify-between items-center">
          <p className="text-gray-600 mr-4">
            Found <span className="font-semibold">{totalMatches}</span> matches
          </p>
          <Select defaultValue="match" onValueChange={onSortChange}>
            <SelectTrigger className="w-[180px]">
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
    </div>
  );
};

export default MatchesHeader;
