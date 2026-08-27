
import { useCallback, useEffect } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { toast } from '@/hooks/use-toast';
import { demoModeEnabled } from '@/lib/devAuth';
import { localAvatar } from '@/lib/avatar';

import { doctorProfiles } from '@/features/matches/data/sampleData';

export interface Message {
  id: string;
  name: string;
  specialty: string;
  imageUrl: string;
  lastMessage: string;
  timestamp: string | Date;
  unread: number;
  isOnline: boolean;
}

const seedChats: Message[] = [
  {
    id: '1',
    name: 'John Smith',
    specialty: 'Cardiologist',
    imageUrl: 'https://randomuser.me/api/portraits/men/1.jpg',
    lastMessage: 'That sounds interesting! What time works for you?',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    unread: 2,
    isOnline: true
  },
  {
    id: '2',
    name: 'Emily Johnson',
    specialty: 'Neurologist',
    imageUrl: 'https://randomuser.me/api/portraits/women/2.jpg',
    lastMessage: "I enjoyed our video call. Let's meet next week.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
    unread: 0,
    isOnline: false
  },
  {
    id: '3',
    name: 'David Wilson',
    specialty: 'Pediatrician',
    imageUrl: 'https://randomuser.me/api/portraits/men/3.jpg',
    lastMessage: 'Have you read the latest research paper?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    unread: 0,
    isOnline: true
  },
  {
    id: '4',
    name: 'Sophia Martinez',
    specialty: 'Dermatologist',
    imageUrl: 'https://randomuser.me/api/portraits/women/4.jpg',
    lastMessage: "I'll be attending the conference next month.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    unread: 1,
    isOnline: false
  },
  {
    id: '5',
    name: 'Michael Brown',
    specialty: 'Orthopedic Surgeon',
    imageUrl: 'https://randomuser.me/api/portraits/men/5.jpg',
    lastMessage: 'Thanks for sharing those clinical resources.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    unread: 3,
    isOnline: true
  }
];

const syncDoctorDetails = (chatList: Message[]): Message[] => {
  return chatList.map(chat => {
    const doc = doctorProfiles.find(d => String(d.id) === String(chat.id));
    if (doc) {
      return {
        ...chat,
        name: doc.name.replace(/^dr\.?\s*/i, ''),
        specialty: doc.specialty,
        imageUrl: doc.imageUrl,
        isOnline: doc.isOnline ?? chat.isOnline,
      };
    }
    return chat;
  });
};

export const useMessages = () => {
  const [searchTerm, setSearchTerm] = usePersistedState('mm:messagesSearch', '');
  const [selectedChat, setSelectedChat] = usePersistedState<string | null>('mm:messagesSelectedChat', null);
  const [activeTab, setActiveTab] = usePersistedState('mm:messagesTab', 'messages');
  const [selectedMessages, setSelectedMessages] = usePersistedState<string[]>('mm:messagesSelected', []);
  const [currentPage, setCurrentPage] = usePersistedState('mm:messagesPage', 1);
  const [showAdvancedSearch, setShowAdvancedSearch] = usePersistedState('mm:messagesAdvanced', false);
  // Audit C3: these five invented conversations (John Smith/Emily Johnson/...)
  // were the unconditional initial value — shown to every user in production.
  // They are demo content now, so they only seed when demoModeEnabled (which is
  // statically false in a production build).
  const [rawChats, setChats] = usePersistedState<Message[]>('mm:chats', demoModeEnabled ? seedChats : []);
  const messagesPerPage = 3;

  // Always ensure chats are synced with current doctor profiles (fixes any stale cached names)
  const chats = syncDoctorDetails(rawChats);

  const ensureChat = useCallback((doctorId: string, doctorData?: { name?: string; specialty?: string; imageUrl?: string }) => {
    const stringId = String(doctorId);
    setChats(prev => {
      if (prev.some(c => String(c.id) === stringId)) return prev;
      const foundDoc = doctorProfiles.find(d => String(d.id) === stringId);
      const cleanName = doctorData?.name?.replace(/^dr\.?\s*/i, '') || foundDoc?.name?.replace(/^dr\.?\s*/i, '') || `Doctor ${stringId}`;
      const newChatEntry: Message = {
        id: stringId,
        name: cleanName,
        specialty: doctorData?.specialty || foundDoc?.specialty || 'General Practitioner',
        imageUrl: doctorData?.imageUrl || foundDoc?.imageUrl || localAvatar(cleanName),
        lastMessage: 'Conversation started',
        timestamp: new Date(),
        unread: 0,
        isOnline: true,
      };
      return [newChatEntry, ...prev];
    });
    setSelectedChat(stringId);
    setActiveTab('messages');
  }, [setChats, setSelectedChat, setActiveTab]);

  const indexOfLastMessage = currentPage * messagesPerPage;
  const indexOfFirstMessage = indexOfLastMessage - messagesPerPage;

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredChats.length / messagesPerPage));

  // Keep the current page within the valid range after filtering/deleting
  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, Math.max(1, totalPages)));
  }, [totalPages, setCurrentPage]);

  const selectedChatData = selectedChat
    ? (() => {
        const stringSelected = String(selectedChat);
        const foundInChats = chats.find(c => String(c.id) === stringSelected);
        const foundInDocs = doctorProfiles.find(d => String(d.id) === stringSelected);
        if (foundInDocs) {
          return {
            id: foundInDocs.id,
            name: foundInDocs.name.replace(/^dr\.?\s*/i, ''),
            specialty: foundInDocs.specialty,
            imageUrl: foundInDocs.imageUrl,
            lastMessage: foundInChats?.lastMessage || 'Conversation started',
            timestamp: foundInChats?.timestamp || new Date(),
            unread: foundInChats?.unread || 0,
            isOnline: foundInDocs.isOnline ?? true,
          };
        }
        return foundInChats || null;
      })()
    : null;

  const toggleMessageSelection = (id: string) => {
    setSelectedMessages(prev =>
      prev.includes(id)
        ? prev.filter(messageId => messageId !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedMessages(prev =>
      prev.length === currentMessages.length
        ? []
        : currentMessages.map(message => message.id)
    );
  };

  const handleBulkDelete = () => {
    const ids = new Set(selectedMessages);
    if (selectedChat && ids.has(selectedChat)) setSelectedChat(null);
    setChats(prev => prev.filter(chat => !ids.has(chat.id)));
    setSelectedMessages([]);
    toast({
      title: "Conversations Deleted",
      description: `${selectedMessages.length} conversation${selectedMessages.length === 1 ? '' : 's'} have been deleted.`,
    });
  };

  const markChatRead = (id: string) => {
    setChats(prev => prev.map(c => (c.id === id ? { ...c, unread: 0 } : c)));
  };

  const toggleChatReadState = (id: string) => {
    setChats(prev =>
      prev.map(c => (c.id === id ? { ...c, unread: c.unread > 0 ? 0 : 1 } : c))
    );
  };

  const deleteChat = (id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (selectedChat === id) setSelectedChat(null);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const currentMessages = filteredChats.slice(indexOfFirstMessage, indexOfLastMessage);

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
    markChatRead,
    toggleChatReadState,
    deleteChat,
    filteredChats,
    chats,
    messagesPerPage,
    ensureChat
  };
};
