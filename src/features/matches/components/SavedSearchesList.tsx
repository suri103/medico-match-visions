
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SavedSearch } from '../types';
import SavedSearchItem from './SavedSearchItem';
import EmptyState from "@/features/favorites/components/EmptyState";

interface SavedSearchesListProps {
  savedSearches: SavedSearch[];
  onSelect: (search: SavedSearch) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
  // Added missing props that were causing type errors
  selectedSavedSearch?: string;
  showSavedSearches?: boolean;
  countries?: any[];
  statesByCountry?: Record<string, any[]>;
  onHideSavedSearches?: () => void;
  onLoadSavedSearch?: (search: SavedSearch) => void;
  onEditSavedSearch?: (search: SavedSearch) => void;
  onDeleteSavedSearch?: (id: string) => void;
}

const SavedSearchesList: React.FC<SavedSearchesListProps> = ({
  savedSearches,
  onSelect,
  onDelete,
  onCreateNew
}) => {
  return (
    <Card className="mt-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Saved Searches</h3>
          <Button variant="outline" size="sm" onClick={onCreateNew} className="flex items-center">
            <Plus className="h-4 w-4 mr-1" /> New Search
          </Button>
        </div>
        
        {savedSearches.length > 0 ? (
          <div className="space-y-3">
            {savedSearches.map((search) => (
              <SavedSearchItem 
                key={search.id} 
                savedSearch={search} // Updated prop name to match component expectations
                onSelect={() => onSelect(search)} 
                onDelete={() => onDelete(search.id)} 
              />
            ))}
          </div>
        ) : (
          <EmptyState 
            message="No saved searches" 
            description="Save your search criteria for quick access later" 
            iconName="search"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default SavedSearchesList;
