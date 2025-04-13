
import React from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SavedSearchItem from './SavedSearchItem';
import { SavedSearch } from '../types';
import { EmptyState } from '@/features/favorites/components/EmptyState';

interface SavedSearchesListProps {
  savedSearches: SavedSearch[];
  selectedSavedSearch: string | null;
  showSavedSearches: boolean;
  countries: Array<{ value: string; label: string }>;
  statesByCountry: Record<string, Array<{ value: string; label: string }>>;
  onHideSavedSearches: () => void;
  onLoadSavedSearch: (id: string) => void;
  onEditSavedSearch: (id: string) => void;
  onDeleteSavedSearch: (id: string) => void;
}

const SavedSearchesList: React.FC<SavedSearchesListProps> = ({
  savedSearches,
  selectedSavedSearch,
  showSavedSearches,
  countries,
  statesByCountry,
  onHideSavedSearches,
  onLoadSavedSearch,
  onEditSavedSearch,
  onDeleteSavedSearch
}) => {
  if (!showSavedSearches) return null;

  return (
    <div className="mb-6 p-4 bg-white rounded-xl shadow-sm animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-mediblue-800">Saved Searches</h2>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onHideSavedSearches}
        >
          <X size={18} />
        </Button>
      </div>
      
      {savedSearches.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {savedSearches.map((search) => (
                <SavedSearchItem
                  key={search.id}
                  search={search}
                  selectedSearchId={selectedSavedSearch}
                  countries={countries}
                  statesByCountry={statesByCountry}
                  onLoad={onLoadSavedSearch}
                  onEdit={onEditSavedSearch}
                  onDelete={onDeleteSavedSearch}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Save className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p>You haven't saved any searches yet.</p>
          <p className="text-sm mt-1">Use the search panel and save your criteria for future use.</p>
        </div>
      )}
    </div>
  );
};

export default SavedSearchesList;
