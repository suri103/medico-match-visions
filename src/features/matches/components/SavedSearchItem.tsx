
import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, Edit, Delete, MapPin } from 'lucide-react';
import { SavedSearch } from '../types';

interface SavedSearchItemProps {
  savedSearch: SavedSearch; // Changed from 'search' to 'savedSearch'
  onSelect: () => void;
  onDelete: () => void;
  selectedSearchId?: string | null;
  countries?: Array<{ value: string; label: string }>;
  statesByCountry?: Record<string, Array<{ value: string; label: string }>>;
  onLoad?: () => void;
  onEdit?: () => void;
}

const SavedSearchItem: React.FC<SavedSearchItemProps> = ({
  savedSearch, // Updated prop name
  onSelect,
  onDelete,
  selectedSearchId,
  countries,
  statesByCountry,
}) => {
  return (
    <TableRow className={selectedSearchId === savedSearch.id ? "bg-blue-50" : ""}>
      <TableCell className="font-medium">{savedSearch.name}</TableCell>
      <TableCell>
        <div className="text-sm text-gray-600">
          {savedSearch.specialties.length > 0 && 
            <span className="mr-3">
              {savedSearch.specialties.join(", ")}
            </span>
          }
          {(savedSearch.minAge[0] !== 25 || savedSearch.maxAge[0] !== 45) && 
            <span className="mr-3">
              {savedSearch.minAge[0]}-{savedSearch.maxAge[0]} y/o
            </span>
          }
          {savedSearch.country && 
            <span className="mr-3 flex items-center">
              <MapPin size={12} className="mr-1" />
              {countries?.find(c => c.value === savedSearch.country)?.label || savedSearch.country}
              {savedSearch.state && `, ${statesByCountry?.[savedSearch.country as string]?.find(s => s.value === savedSearch.state)?.label || savedSearch.state}`}
            </span>
          }
          {savedSearch.onlineOnly && 
            <span className="text-green-600 font-medium">Online only</span>
          }
        </div>
      </TableCell>
      <TableCell className="text-right space-x-1">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onSelect}
          className="h-8 w-8"
        >
          <Search size={14} />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onSelect}
          className="h-8 w-8"
        >
          <Edit size={14} />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onDelete}
          className="h-8 w-8 text-red-500 hover:text-red-600"
        >
          <Delete size={14} />
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default SavedSearchItem;
