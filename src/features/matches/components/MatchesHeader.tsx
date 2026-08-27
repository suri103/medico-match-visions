
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSidebar } from '@/components/ui/sidebar';

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
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex flex-col gap-4 mb-6 pb-2 border-b md:border-b-0 border-slate-200">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800">
            Your Matches
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Found <span className="font-semibold text-slate-800">{totalMatches}</span> doctor matches
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Filter Button */}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden flex items-center gap-1.5 h-9 bg-white border-mediblue-200 text-mediblue-700 hover:bg-mediblue-50 font-medium"
            onClick={toggleSidebar}
          >
            <Filter size={15} className="text-mediblue-600" />
            <span>Filters</span>
          </Button>

          <Button
            variant="outline" 
            size="sm"
            className={`flex items-center gap-1.5 h-9 ${showSavedSearches ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}
            onClick={() => setShowSavedSearches(!showSavedSearches)}
          >
            <Save size={15} />
            <span className="hidden sm:inline">Saved Searches</span>
            <span className="sm:hidden">Saved</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 w-full">
        <span className="text-xs text-slate-500 whitespace-nowrap">Sort by:</span>
        <Select defaultValue="match" onValueChange={onSortChange}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs bg-white">
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

export default MatchesHeader;

