
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import MessageList from './MessageList';
import NotificationsList from './NotificationsList';
import { Message } from '../hooks/useMessages';
import { useMessages } from '../hooks/useMessages';
import { useNotifications } from '../hooks/useNotifications';

interface MessageTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const MessageTabs: React.FC<MessageTabsProps> = ({ activeTab, setActiveTab }) => {
  const { 
    searchTerm, 
    setSearchTerm, 
    selectedChat, 
    setSelectedChat, 
    selectedMessages, 
    currentPage, 
    showAdvancedSearch, 
    setShowAdvancedSearch, 
    currentMessages, 
    totalPages, 
    toggleMessageSelection, 
    toggleSelectAll, 
    handleBulkDelete, 
    handlePageChange 
  } = useMessages();
  
  const { notifications } = useNotifications();
  
  const getUnreadMessageCount = (messages: Message[]): number => {
    return messages.reduce((acc, chat) => acc + chat.unread, 0);
  };

  return (
    <Tabs 
      defaultValue="messages" 
      value={activeTab} 
      onValueChange={setActiveTab}
      className="w-full"
    >
      <div className="px-4 pt-4">
        <TabsList className="w-full">
          <TabsTrigger value="messages" className="flex-1">
            Messages
            {getUnreadMessageCount(currentMessages) > 0 && (
              <Badge className="ml-2 bg-mediblue-500">{getUnreadMessageCount(currentMessages)}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="whats-new" className="flex-1">
            What's New
            {notifications.filter(n => !n.read).length > 0 && (
              <Badge className="ml-2 bg-mediblue-500">{notifications.filter(n => !n.read).length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="messages" className="flex-grow flex flex-col">
        <MessageList
          currentMessages={currentMessages}
          selectedMessages={selectedMessages}
          selectedChat={selectedChat}
          showAdvancedSearch={showAdvancedSearch}
          searchTerm={searchTerm}
          totalPages={totalPages}
          currentPage={currentPage}
          toggleMessageSelection={toggleMessageSelection}
          toggleSelectAll={toggleSelectAll}
          handleBulkDelete={handleBulkDelete}
          setSelectedChat={setSelectedChat}
          setSearchTerm={setSearchTerm}
          setShowAdvancedSearch={setShowAdvancedSearch}
          handlePageChange={handlePageChange}
        />
      </TabsContent>

      <TabsContent value="whats-new" className="flex-grow overflow-y-auto">
        <NotificationsList />
      </TabsContent>
    </Tabs>
  );
};

export default MessageTabs;
