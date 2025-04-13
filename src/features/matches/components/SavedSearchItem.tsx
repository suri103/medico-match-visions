
import React from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, Edit, Delete, MapPin } from 'lucide-react';
import { SavedSearch } from '../types';

interface SavedSearchItemProps {
  search: SavedSearch;
  selectedSearchId: string | null;
  countries: Array<{ value: string; label: string }>;
  statesByCountry: Record<string, Array<{ value: string; label: string }>>;
  onLoad: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const SavedSearchItem: React.FC<SavedSearchItemProps> = ({
  search,
  selectedSearchId,
  countries,
  statesByCountry,
  onLoad,
  onEdit,
  onDelete
}) => {
  return (
    <TableRow className={selectedSearchId === search.id ? "bg-blue-50" : ""}>
      <TableCell className="font-medium">{search.name}</TableCell>
      <TableCell>
        <div className="text-sm text-gray-600">
          {search.specialties.length > 0 && 
            <span className="mr-3">
              {search.specialties.join(", ")}
            </span>
          }
          {(search.minAge[0] !== 25 || search.maxAge[0] !== 45) && 
            <span className="mr-3">
              {search.minAge[0]}-{search.maxAge[0]} y/o
            </span>
          }
          {search.country && 
            <span className="mr-3 flex items-center">
              <MapPin size={12} className="mr-1" />
              {countries.find(c => c.value === search.country)?.label}
              {search.state && `, ${statesByCountry[search.country as keyof typeof statesByCountry]?.find(s => s.value === search.state)?.label}`}
            </span>
          }
          {search.onlineOnly && 
            <span className="text-green-600 font-medium">Online only</span>
          }
        </div>
      </TableCell>
      <TableCell className="text-right space-x-1">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onLoad(search.id)}
          className="h-8 w-8"
        >
          <Search size={14} />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onEdit(search.id)}
          className="h-8 w-8"
        >
          <Edit size={14} />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onDelete(search.id)}
          className="h-8 w-8 text-red-500 hover:text-red-600"
        >
          <Delete size={14} />
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default SavedSearchItem;
