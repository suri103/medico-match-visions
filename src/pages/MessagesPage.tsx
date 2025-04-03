
import React, { useState } from 'react';
import Header from '@/components/Header';
import Chat from '@/components/Chat';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Search, Video } from 'lucide-react';

// Sample data for doctor chats
const doctorChats = [
  {
    id: '1',
    name: 'Priya Sharma',
    specialty: 'Cardiologist',
    imageUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
    lastMessage: 'That sounds interesting! What time works for you?',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    unread: 2,
    isOnline: true
  },
  {
    id: '2',
    name: 'Rajiv Mehta',
    specialty: 'Neurologist',
    imageUrl: 'https://randomuser.me/api/portraits/men/42.jpg',
    lastMessage: 'I enjoyed our video call. Let\'s meet next week.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
    unread: 0,
    isOnline: false
  },
  {
    id: '3',
    name: 'Ananya Patel',
    specialty: 'Pediatrician',
    imageUrl: 'https://randomuser.me/api/portraits/women/67.jpg',
    lastMessage: 'Have you read the latest research paper?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    unread: 0,
    isOnline: true
  }
];

const MessagesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  
  const filteredChats = doctorChats.filter(chat => 
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const selectedChatData = selectedChat
    ? doctorChats.find(chat => chat.id === selectedChat)
    : null;
    
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow flex overflow-hidden">
        {/* Sidebar with chat list */}
        <div className={`w-full ${selectedChat ? 'hidden md:block md:w-1/3 lg:w-1/4' : 'w-full'} border-r border-gray-200 bg-white`}>
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full"
              />
            </div>
            
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Messages</h2>
            
            <div className="space-y-1">
              {filteredChats.map((chat) => (
                <div 
                  key={chat.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors duration-150 flex items-center 
                    ${selectedChat === chat.id ? 'bg-mediblue-50 border-l-4 border-mediblue-500' : 'hover:bg-gray-50'}`}
                  onClick={() => setSelectedChat(chat.id)}
                >
                  <div className="relative mr-3">
                    <Avatar className="h-12 w-12">
                      <img src={chat.imageUrl} alt={chat.name} className="object-cover" />
                    </Avatar>
                    {chat.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-medium text-gray-900 truncate">Dr. {chat.name}</h3>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {formatMessageTime(chat.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
                  </div>
                  
                  {chat.unread > 0 && (
                    <div className="ml-2 bg-mediblue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {chat.unread}
                    </div>
                  )}
                </div>
              ))}
              
              {filteredChats.length === 0 && (
                <div className="py-8 text-center text-gray-500">
                  No conversations found
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Chat window */}
        <div className={`${selectedChat ? 'flex flex-col w-full md:w-2/3 lg:w-3/4' : 'hidden'} h-full`}>
          {selectedChatData ? (
            <Chat
              doctorId={selectedChatData.id}
              doctorName={selectedChatData.name}
              doctorImage={selectedChatData.imageUrl}
              onStartVideoCall={() => console.log('Starting video call...')}
              onClose={() => setSelectedChat(null)}
            />
          ) : (
            <div className="flex-grow flex items-center justify-center bg-gray-50 text-gray-400">
              Select a conversation to start messaging
            </div>
          )}
        </div>
        
        {/* Empty state when no chat is selected */}
        {!selectedChat && filteredChats.length > 0 && (
          <div className="hidden md:flex flex-col flex-grow items-center justify-center bg-gray-50">
            <Video className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-700">Select a conversation</h3>
            <p className="text-gray-500 mt-2">Choose a chat from the list to start messaging</p>
          </div>
        )}
      </main>
    </div>
  );
};

// Helper function to format message timestamps
const formatMessageTime = (date: Date) => {
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

export default MessagesPage;
