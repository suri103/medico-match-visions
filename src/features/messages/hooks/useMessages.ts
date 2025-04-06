import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export interface Message {
  id: string;
  name: string;
  specialty: string;
  imageUrl: string;
  lastMessage: string;
  timestamp: Date;
  unread: number;
  isOnline: boolean;
}

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
    lastMessage: 'I\'ll be attending the conference next month.',
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

export const useMessages = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('messages');
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const messagesPerPage = 3;
  
  const indexOfLastMessage = currentPage * messagesPerPage;
  const indexOfFirstMessage = indexOfLastMessage - messagesPerPage;
  const totalPages = Math.ceil(doctorChats.length / messagesPerPage);
  
  const filteredChats = doctorChats.filter(chat => 
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const currentMessages = filteredChats.slice(indexOfFirstMessage, indexOfLastMessage);
  
  const selectedChatData = selectedChat
    ? doctorChats.find(chat => chat.id === selectedChat)
    : null;
  
  const toggleMessageSelection = (id: string) => {
    if (selectedMessages.includes(id)) {
      setSelectedMessages(selectedMessages.filter(messageId => messageId !== id));
    } else {
      setSelectedMessages([...selectedMessages, id]);
    }
  };
  
  const toggleSelectAll = () => {
    if (selectedMessages.length === currentMessages.length) {
      setSelectedMessages([]);
    } else {
      setSelectedMessages(currentMessages.map(message => message.id));
    }
  };
  
  const handleBulkDelete = () => {
    toast({
      title: "Messages Deleted",
      description: `${selectedMessages.length} messages have been deleted.`,
    });
    setSelectedMessages([]);
  };
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedChat,
    setSelectedChat,
    activeTab,
    setActiveTab,
    selectedMessages,
    setSelectedMessages,
    currentPage,
    showAdvancedSearch,
    setShowAdvancedSearch,
    currentMessages,
    selectedChatData,
    totalPages,
    toggleMessageSelection,
    toggleSelectAll,
    handleBulkDelete,
    handlePageChange,
    filteredChats,
    messagesPerPage
  };
};
