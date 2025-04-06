
import React from 'react';
import Header from '@/components/Header';
import Chat from '@/components/Chat';
import { useMessages } from '@/features/messages/hooks/useMessages';
import MessageTabs from '@/features/messages/components/MessageTabs';
import EmptyChat from '@/features/messages/components/EmptyChat';

const MessagesPage = () => {
  const { 
    activeTab, 
    setActiveTab, 
    selectedChatData, 
    setSelectedChat 
  } = useMessages();
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow flex flex-col md:flex-row overflow-hidden p-4 gap-4">
        <div className="w-full md:w-1/4 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <MessageTabs 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
          />
        </div>
        
        <div className="w-full md:w-3/4 h-full">
          {selectedChatData ? (
            <Chat
              doctorId={selectedChatData.id}
              doctorName={selectedChatData.name}
              doctorImage={selectedChatData.imageUrl}
              onStartVideoCall={() => console.log('Starting video call...')}
              onClose={() => setSelectedChat(null)}
            />
          ) : (
            <EmptyChat />
          )}
        </div>
      </main>
    </div>
  );
};

export default MessagesPage;
