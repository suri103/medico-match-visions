
import React from 'react';
import Header from '@/components/Header';
import Chat from '@/components/Chat';
import { useMessages } from '@/features/messages/hooks/useMessages';
import MessageTabs from '@/features/messages/components/MessageTabs';
import EmptyChat from '@/features/messages/components/EmptyChat';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const MessagesPage = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { openChatId?: string; activeTab?: string } };
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    activeTab, 
    setActiveTab, 
    selectedChatData, 
    setSelectedChat,
    ensureChat 
  } = useMessages();

  React.useEffect(() => {
    const id = location.state?.openChatId;
    if (id) {
      const nav = location.state as {
        doctorName?: string;
        doctorImage?: string;
        doctorSpecialty?: string;
      } | null;
      ensureChat(id, {
        name: nav?.doctorName,
        imageUrl: nav?.doctorImage,
        specialty: nav?.doctorSpecialty,
      });
      setSelectedChat(id);
    }
    const queryTab = searchParams.get('tab');
    const stateTab = location.state?.activeTab;
    const targetTab = stateTab || queryTab;
    if (targetTab && (targetTab === 'messages' || targetTab === 'whats-new')) {
      setActiveTab(targetTab);
    }
  }, [location.state, searchParams, setSelectedChat, setActiveTab, ensureChat]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSearchParams(newTab === 'messages' ? {} : { tab: newTab });
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow flex flex-col md:flex-row overflow-hidden p-2 sm:p-4 gap-4 max-w-7xl mx-auto w-full">
        {/* Left column: Conversations & Notifications List (hidden on mobile when chat is selected) */}
        <div className={`w-full md:w-1/3 lg:w-1/4 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex-col ${
          selectedChatData ? 'hidden md:flex' : 'flex'
        }`}>
          <MessageTabs 
            activeTab={activeTab} 
            setActiveTab={handleTabChange} 
          />
        </div>
        
        {/* Right column: Active Chat or Empty placeholder (hidden on mobile when no chat is open) */}
        <div className={`w-full md:w-2/3 lg:w-3/4 flex-col ${
          !selectedChatData ? 'hidden md:flex' : 'flex'
        }`}>
          {selectedChatData ? (
            <div className="w-full h-full">
              <Chat
                key={selectedChatData.id}
                doctorId={selectedChatData.id}
                doctorName={selectedChatData.name}
                doctorImage={selectedChatData.imageUrl}
                onStartVideoCall={() => navigate('/video-dates')}
                onClose={() => setSelectedChat(null)}
              />
            </div>
          ) : (
            <div className="w-full h-full">
              <EmptyChat />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MessagesPage;
