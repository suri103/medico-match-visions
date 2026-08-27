
import React from 'react';
import MessageItem from './MessageItem';
import { Button } from '@/components/ui/button';
import { Message } from '../hooks/useMessages';
import { CheckSquare, Filter, Trash } from 'lucide-react';
import MessageSearch from './MessageSearch';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';

interface MessageListProps {
  currentMessages: Message[];
  selectedMessages: string[];
  selectedChat: string | null;
  showAdvancedSearch: boolean;
  searchTerm: string;
  totalPages: number;
  currentPage: number;
  toggleMessageSelection: (id: string) => void;
  toggleSelectAll: () => void;
  handleBulkDelete: () => void;
  setSelectedChat: (id: string | null) => void;
  setSearchTerm: (term: string) => void;
  setShowAdvancedSearch: (show: boolean) => void;
  handlePageChange: (page: number) => void;
  markChatRead: (id: string) => void;
  toggleChatReadState: (id: string) => void;
  deleteChat: (id: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  currentMessages,
  selectedMessages,
  selectedChat,
  showAdvancedSearch,
  searchTerm,
  totalPages,
  currentPage,
  toggleMessageSelection,
  toggleSelectAll,
  handleBulkDelete,
  setSelectedChat,
  setSearchTerm,
  setShowAdvancedSearch,
  handlePageChange,
  markChatRead,
  toggleChatReadState,
  deleteChat
}) => {
  return (
    <div className="flex-grow flex flex-col">
      <div className="px-4 py-2 flex justify-between items-center border-b">
        {selectedMessages.length > 0 ? (
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-500 hover:text-red-700"
              onClick={handleBulkDelete}
            >
              <Trash size={18} />
              <span className="ml-1">Delete</span>
            </Button>
            <span className="text-sm text-gray-500">{selectedMessages.length} selected</span>
          </div>
        ) : (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          >
            <Filter size={16} />
            <span className="ml-1">Filter</span>
          </Button>
        )}
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={toggleSelectAll}
        >
          <CheckSquare size={16} />
          <span className="ml-1">
            {selectedMessages.length === currentMessages.length ? 'Deselect All' : 'Select All'}
          </span>
        </Button>
      </div>

      {showAdvancedSearch && (
        <MessageSearch 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
        />
      )}

      <div className="flex-grow overflow-y-auto">
        {currentMessages.length > 0 ? (
          currentMessages.map((chat) => (
            <MessageItem
              key={chat.id}
              chat={chat}
              isSelected={selectedMessages.includes(chat.id)}
              isActive={selectedChat === chat.id}
              onSelect={toggleMessageSelection}
              onSelectMessage={(id) => {
                setSelectedChat(id);
                markChatRead(id);
              }}
              onToggleRead={() => toggleChatReadState(chat.id)}
              onDelete={() => deleteChat(chat.id)}
            />
          ))
        ) : (
          <div className="py-8 text-center text-gray-500">
            No conversations found
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="p-2 border-t">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNumber = idx + 1;
                
                if (
                  pageNumber === 1 ||
                  pageNumber === totalPages ||
                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        isActive={currentPage === pageNumber}
                        onClick={() => handlePageChange(pageNumber)}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                }
                
                if (pageNumber === 2 && currentPage > 3) {
                  return (
                    <PaginationItem key="ellipsis-start">
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                
                if (pageNumber === totalPages - 1 && currentPage < totalPages - 2) {
                  return (
                    <PaginationItem key="ellipsis-end">
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                
                return null;
              })}
              
              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default MessageList;
