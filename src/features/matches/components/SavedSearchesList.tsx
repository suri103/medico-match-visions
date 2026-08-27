
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SavedSearch } from '../types';
import SavedSearchItem from './SavedSearchItem';
import EmptyState from "@/features/favorites/components/EmptyState";
import { Table, TableBody, TableHead, TableHeader } from '@/components/ui/table';

interface SavedSearchesListProps {
  savedSearches: SavedSearch[];
  onSelect: (search: SavedSearch) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
  // Added missing props that were causing type errors
  selectedSavedSearch?: string;
  showSavedSearches?: boolean;
  countries?: Array<{ value: string; label: string }>;
  statesByCountry?: Record<string, Array<{ value: string; label: string }>>;
  onHideSavedSearches?: () => void;
  onLoadSavedSearch?: (search: SavedSearch) => void;
  onEditSavedSearch?: (search: SavedSearch) => void;
  onDeleteSavedSearch?: (id: string) => void;
}

const SavedSearchesList: React.FC<SavedSearchesListProps> = ({
  savedSearches,
  onSelect,
  onDelete,
  onCreateNew,
  selectedSavedSearch,
  countries,
  statesByCountry,
  onLoadSavedSearch,
  onEditSavedSearch,
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
          <Table>
            <TableHeader>
              <TableHead>Name</TableHead>
              <TableHead>Criteria</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {savedSearches.map((search) => (
                <SavedSearchItem 
                  key={search.id} 
                  savedSearch={search}
                  onSelect={() => onSelect(search)} 
                  onLoad={() => onLoadSavedSearch ? onLoadSavedSearch(search) : onSelect(search)}
                  onEdit={() => onEditSavedSearch ? onEditSavedSearch(search) : undefined}
                  onDelete={() => onDelete(search.id)}
                  selectedSearchId={selectedSavedSearch}
                  countries={countries}
                  statesByCountry={statesByCountry}
                />
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState 
            title="No saved searches" 
            description="Save your search criteria for quick access later" 
            icon="search"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default SavedSearchesList;
