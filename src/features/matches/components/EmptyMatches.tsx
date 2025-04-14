
import React from 'react';
import { Users, Search, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyMatchesProps {
  onResetFilters: () => void;
  filterCount?: number;
  showSearchTips?: boolean;
}

const EmptyMatches: React.FC<EmptyMatchesProps> = ({ 
  onResetFilters, 
  filterCount = 0,
  showSearchTips = false 
}) => {
  return (
    <Card className="w-full overflow-hidden">
      <CardContent className="p-0">
        <div className="text-center py-16 px-4">
          <Users className="mx-auto h-16 w-16 text-gray-300 mb-4" />
          <h3 className="text-xl font-medium text-gray-900">No matches found</h3>
          
          {filterCount > 0 ? (
            <p className="text-gray-500 mt-2">
              No doctors match your current filters. Try adjusting your search criteria.
            </p>
          ) : (
            <p className="text-gray-500 mt-2">
              We couldn't find any matches based on your search. Try different keywords or filters.
            </p>
          )}
          
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <Button className="flex items-center gap-2" onClick={onResetFilters}>
              <RefreshCw size={16} />
              Reset All Filters
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Search size={16} />
              Browse All Doctors
            </Button>
          </div>
          
          {showSearchTips && (
            <div className="mt-10 max-w-lg mx-auto">
              <h4 className="font-medium text-gray-800 mb-3 flex items-center justify-center">
                <Filter size={18} className="mr-2 text-mediblue-500" />
                Search Tips
              </h4>
              <ul className="text-sm text-gray-600 space-y-2 text-left">
                <li className="flex items-start">
                  <div className="bg-mediblue-100 text-mediblue-700 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5">1</div>
                  <span>Try using broader location filters (country instead of city)</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-mediblue-100 text-mediblue-700 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5">2</div>
                  <span>Expand your age range preferences</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-mediblue-100 text-mediblue-700 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5">3</div>
                  <span>Include more medical specialties in your search</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-mediblue-100 text-mediblue-700 rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5">4</div>
                  <span>Use fewer keywords in your search</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EmptyMatches;
