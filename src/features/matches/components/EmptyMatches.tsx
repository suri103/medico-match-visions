
import React from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyMatchesProps {
  onResetFilters: () => void;
}

const EmptyMatches: React.FC<EmptyMatchesProps> = ({ onResetFilters }) => {
  return (
    <div className="text-center py-16">
      <Users className="mx-auto h-16 w-16 text-gray-300 mb-4" />
      <h3 className="text-xl font-medium text-gray-900">No matches found</h3>
      <p className="text-gray-500 mt-2">Try adjusting your filters or search criteria</p>
      <Button className="mt-4" onClick={onResetFilters}>Reset Filters</Button>
    </div>
  );
};

export default EmptyMatches;
