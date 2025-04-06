import React, { useState } from 'react';
import Header from '@/components/Header';
import Chat from '@/components/Chat';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Video, Trash, Bell, Eye, Heart, Calendar, 
  MoreVertical, CheckSquare, Filter 
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { toast } from '@/hooks/use-toast';

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
  },
  {
    id: '4',
    name: 'Sanjay Kumar',
    specialty: 'Orthopedic Surgeon',
    imageUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
    lastMessage: 'I'll be attending the conference next month.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    unread: 1,
    isOnline: false
  },
  {
    id: '5',
    name: 'Meera Reddy',
    specialty: 'Dermatologist',
    imageUrl: 'https://randomuser.me/api/portraits/women/22.jpg',
    lastMessage: 'Thanks for sharing those clinical resources.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    unread: 3,
    isOnline: true
  }
];

// Sample notifications data
const notifications = [
  {
    id: '1',
    type: 'message',
    from: 'Priya Sharma',
    content: 'You have 2 unread messages',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    read: false,
    imageUrl: 'https://randomuser.me/api/portraits/women/44.jpg'
  },
  {
    id: '2',
    type: 'profile_view',
    from: 'Arjun Nair',
    content: 'viewed your profile',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: false,
    imageUrl: 'https://randomuser.me/api/portraits/men/76.jpg'
  },
  {
    id: '3',
    type: 'interest',
    from: 'Leela Krishnan',
    content: 'expressed interest in connecting with you',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
    read: true,
    imageUrl: 'https://randomuser.me/api/portraits/women/90.jpg'
  },
  {
    id: '4',
    type: 'video_request',
    from: 'Vikram Singh',
    content: 'wants to schedule a video date',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12),
    read: false,
    imageUrl: 'https://randomuser.me/api/portraits/men/22.jpg'
  }
];

const MessagesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('messages');
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const messagesPerPage = 3;
  
  // Calculate pagination
  const indexOfLastMessage = currentPage * messagesPerPage;
  const indexOfFirstMessage = indexOfLastMessage - messagesPerPage;
  const totalPages = Math.ceil(doctorChats.length / messagesPerPage);
  
  // Filter chats based on search term
  const filteredChats = doctorChats.filter(chat => 
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const currentMessages = filteredChats.slice(indexOfFirstMessage, indexOfLastMessage);
  
  // Get selected chat data
  const selectedChatData = selectedChat
    ? doctorChats.find(chat => chat.id === selectedChat)
    : null;
  
  // Handle message selection
  const toggleMessageSelection = (id: string) => {
    if (selectedMessages.includes(id)) {
      setSelectedMessages(selectedMessages.filter(messageId => messageId !== id));
    } else {
      setSelectedMessages([...selectedMessages, id]);
    }
  };
  
  // Handle select all messages
  const toggleSelectAll = () => {
    if (selectedMessages.length === currentMessages.length) {
      setSelectedMessages([]);
    } else {
      setSelectedMessages(currentMessages.map(message => message.id));
    }
  };
  
  // Handle bulk delete
  const handleBulkDelete = () => {
    // In a real app, this would delete the messages from the database
    // Here we're just showing a toast notification
    toast({
      title: "Messages Deleted",
      description: `${selectedMessages.length} messages have been deleted.`,
    });
    setSelectedMessages([]);
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Get notification count by type
  const getNotificationCount = (type: string) => {
    return notifications.filter(n => n.type === type && !n.read).length;
  };

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'profile_view':
        return <Eye className="h-4 w-4 text-purple-500" />;
      case 'interest':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'video_request':
        return <Calendar className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow flex flex-col md:flex-row overflow-hidden p-4 gap-4">
        {/* Left sidebar: Tabs for Messages and What's New */}
        <div className={`w-full md:w-1/4 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col`}>
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
                  {doctorChats.reduce((acc, chat) => acc + chat.unread, 0) > 0 && (
                    <Badge className="ml-2 bg-mediblue-500">{doctorChats.reduce((acc, chat) => acc + chat.unread, 0)}</Badge>
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
              {/* Message actions and search */}
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
                  <span className="ml-1">{selectedMessages.length === currentMessages.length ? 'Deselect All' : 'Select All'}</span>
                </Button>
              </div>

              {/* Advanced search panel */}
              {showAdvancedSearch && (
                <div className="p-3 bg-gray-50 border-b">
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
                  
                  {/* Could add more filters here */}
                  <div className="flex justify-between mt-2">
                    <Button variant="outline" size="sm" className="text-xs">Save Search</Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAdvancedSearch(false)}>Close</Button>
                  </div>
                </div>
              )}

              {/* Messages list */}
              <div className="flex-grow overflow-y-auto">
                {currentMessages.length > 0 ? (
                  currentMessages.map((chat) => (
                    <div 
                      key={chat.id}
                      className={`p-3 border-b last:border-0 cursor-pointer transition-colors duration-150 
                        ${selectedChat === chat.id ? 'bg-mediblue-50 border-l-4 border-mediblue-500' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center">
                        <Checkbox 
                          checked={selectedMessages.includes(chat.id)}
                          onCheckedChange={() => toggleMessageSelection(chat.id)}
                          className="mr-2"
                        />
                        <div 
                          className="flex flex-1 items-center"
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
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="ml-2 h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toggleMessageSelection(chat.id)}>
                              {selectedMessages.includes(chat.id) ? 'Deselect' : 'Select'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => console.log('Mark as read')}>
                              Mark as {chat.unread > 0 ? 'read' : 'unread'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-500 focus:text-red-500" 
                              onClick={() => {
                                toast({
                                  title: "Message Deleted",
                                  description: "The message has been deleted.",
                                });
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    No conversations found
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredChats.length > messagesPerPage && (
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
                        
                        // Show first page, last page, and pages around current page
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
                        
                        // Show ellipsis
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
            </TabsContent>

            <TabsContent value="whats-new" className="flex-grow overflow-y-auto">
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Notifications</h3>
                
                {/* Notification stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white p-3 rounded-lg border shadow-sm">
                    <div className="flex items-center">
                      <div className="p-2 rounded-full bg-blue-100">
                        <Bell className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium">New Messages</div>
                        <div className="text-2xl font-semibold">{getNotificationCount('message')}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg border shadow-sm">
                    <div className="flex items-center">
                      <div className="p-2 rounded-full bg-purple-100">
                        <Eye className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium">Profile Views</div>
                        <div className="text-2xl font-semibold">{getNotificationCount('profile_view')}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg border shadow-sm">
                    <div className="flex items-center">
                      <div className="p-2 rounded-full bg-red-100">
                        <Heart className="h-5 w-5 text-red-500" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium">Interests</div>
                        <div className="text-2xl font-semibold">{getNotificationCount('interest')}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg border shadow-sm">
                    <div className="flex items-center">
                      <div className="p-2 rounded-full bg-green-100">
                        <Calendar className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium">Date Requests</div>
                        <div className="text-2xl font-semibold">{getNotificationCount('video_request')}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Notification list */}
                <div className="space-y-4">
                  {notifications.map(notification => (
                    <div 
                      key={notification.id}
                      className={`p-3 rounded-lg border ${notification.read ? 'bg-white' : 'bg-blue-50'} transition-colors duration-150`}
                    >
                      <div className="flex items-start">
                        <Avatar className="h-10 w-10">
                          <img src={notification.imageUrl} alt={notification.from} className="object-cover" />
                        </Avatar>
                        
                        <div className="ml-3 flex-grow">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900">Dr. {notification.from}</h4>
                            <span className="text-xs text-gray-500">
                              {formatMessageTime(notification.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center mt-1">
                            {getNotificationIcon(notification.type)}
                            <p className="text-sm text-gray-700 ml-1">{notification.content}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2 pl-12 flex space-x-2">
                        <Button size="sm" variant="default" className="text-xs">
                          Respond
                        </Button>
                        {!notification.read && (
                          <Button size="sm" variant="outline" className="text-xs">
                            Mark as Read
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {notifications.length === 0 && (
                    <div className="py-8 text-center text-gray-500">
                      No new notifications
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Right section: Chat window or empty state */}
        <div className={`w-full ${selectedChat ? 'md:w-3/4' : 'md:w-3/4'} h-full`}>
          {selectedChatData ? (
            <Chat
              doctorId={selectedChatData.id}
              doctorName={selectedChatData.name}
              doctorImage={selectedChatData.imageUrl}
              onStartVideoCall={() => console.log('Starting video call...')}
              onClose={() => setSelectedChat(null)}
            />
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center bg-white rounded-lg shadow-sm h-full">
              <Video className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-medium text-gray-700">Select a conversation</h3>
              <p className="text-gray-500 mt-2">Choose a chat from the list to start messaging</p>
              
              <div className="mt-8 p-6 bg-gray-50 rounded-lg max-w-lg">
                <h4 className="font-medium text-gray-800 mb-2">Quick Start Guide</h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start">
                    <div className="mr-2 mt-0.5 text-mediblue-500">•</div>
                    <span>Use the search bar to find specific contacts</span>
                  </li>
                  <li className="flex items-start">
                    <div className="mr-2 mt-0.5 text-mediblue-500">•</div>
                    <span>Check the "What's New" tab for your latest notifications</span>
                  </li>
                  <li className="flex items-start">
                    <div className="mr-2 mt-0.5 text-mediblue-500">•</div>
                    <span>Bulk select messages using the checkboxes for batch actions</span>
                  </li>
                  <li className="flex items-start">
                    <div className="mr-2 mt-0.5 text-mediblue-500">•</div>
                    <span>Start video calls directly from the chat interface</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
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
