
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface MessageSearchProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showAdvancedSearch: boolean;
  setShowAdvancedSearch: (show: boolean) => void;
}

const MessageSearch: React.FC<MessageSearchProps> = ({
  searchTerm,
  setSearchTerm,
  showAdvancedSearch,
  setShowAdvancedSearch
}) => {
  return (
    <div className={showAdvancedSearch ? "p-3 bg-gray-50 border-b" : ""}>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        <Input
          type="text"
          placeholder="Search by username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-1 text-sm w-full"
        />
      </div>
      
      {showAdvancedSearch && (
        <div className="flex justify-between mt-2">
          <Button variant="outline" size="sm" className="text-xs">Save Search</Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAdvancedSearch(false)}>Close</Button>
        </div>
      )}
    </div>
  );
};

export default MessageSearch;
