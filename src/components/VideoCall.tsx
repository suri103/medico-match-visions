
import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, Phone, 
  MessageSquare, Users, Settings, Send, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePersistedState } from '@/hooks/usePersistedState';
import { demoModeEnabled } from '@/lib/devAuth';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { doctorProfiles } from '@/features/matches/data/sampleData';
import { Doctor } from '@/features/matches/types';
import { toast } from '@/hooks/use-toast';

interface VideoCallProps {
  doctorId: string;
  doctorName: string;
  doctorImage: string;
  onEndCall: () => void;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'doctor';
  timestamp: string;
}

const VideoCall: React.FC<VideoCallProps> = ({
  doctorId,
  doctorName,
  doctorImage,
  onEndCall
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persisted chat messages scoped to this call
  const [chatMessages, setChatMessages] = usePersistedState<ChatMessage[]>(
    `mm:videocall-chat:${doctorId}`,
    []
  );

  const { canMessage } = useFavoritesContext();
  const canChat = canMessage(doctorId);
  const participants: Doctor[] = [doctorProfiles.find(d => d.id === doctorId || d.name === doctorName) || doctorProfiles[0]];

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

    React.useEffect(() => {
    // Simulate connection delay
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsConnected(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    if (!canChat) {
      toast({ title: "Not matched yet", description: "Like each other to unlock in-call chat.", variant: "destructive" });
      return;
    }
    const msg: ChatMessage = {
      id: Date.now().toString(),
      content: chatInput.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, msg]);
    setChatInput('');
    // Audit C3: do NOT simulate a doctor reply in production — a fabricated
    // incoming message presented as a real person is unacceptable. Demo only.
    if (!demoModeEnabled) return;
    setTimeout(() => {
      const replies = [
        "I'm doing well, thank you for asking.",
        "That's an interesting point.",
        "Let me get back to you on that.",
        "I agree with that perspective.",
        "What do you think about this case?",
      ];
      const reply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: replies[Math.floor(Math.random() * replies.length)],
        sender: 'doctor',
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, reply]);
    }, 2000);
  };

  const handleInviteParticipant = (doctor: Doctor) => {
    if (participants.some(p => p.id === doctor.id)) {
      toast({ title: "Already added", description: `${doctor.name} is already in the call.` });
      return;
    }
    toast({ title: "Invitation sent", description: `Inviting Dr. ${doctor.name} to the call.` });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Main video area */}
      <div className="flex-grow relative overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-t-mediblue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-xl">Connecting to Dr. {doctorName}...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Remote video (doctor) - Main large video */}
            <div className="absolute inset-0">
              {!isConnected || isVideoOff ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <Avatar className="w-32 h-32">
                    <img src={doctorImage} alt={doctorName} className="object-cover" />
                  </Avatar>
                </div>
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  {/* This would be where the actual video stream renders */}
                  <img 
                    src={doctorImage} 
                    alt={doctorName} 
                    className="w-full h-full object-cover opacity-80" 
                  />
                  <div className="absolute top-4 left-4">
                    <Card className="bg-black/50 text-white px-3 py-1 backdrop-blur-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-subtle"></div>
                        <span>Dr. {doctorName}</span>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </div>

            {/* Local video (user) - Small picture-in-picture */}
            <div className="absolute bottom-20 sm:bottom-4 right-3 sm:right-4 w-28 h-20 sm:w-48 sm:h-36 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg z-10">
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                {/* This would be where the actual local video stream renders */}
                <div className="text-xs text-center text-gray-300">Your camera</div>
              </div>
            </div>

            {/* In-call chat panel */}
            {showChat && (
              <div className="absolute bottom-20 sm:bottom-24 left-3 right-3 sm:left-auto sm:right-4 w-auto sm:w-80 h-80 sm:h-96 bg-gray-800 rounded-lg shadow-2xl flex flex-col border border-gray-700 z-20">
                <div className="bg-gray-700 px-4 py-2 flex items-center justify-between rounded-t-lg">
                  <h3 className="font-medium text-sm">Chat with Dr. {doctorName}</h3>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowChat(false)}>
                    <X size={16} />
                  </Button>
                </div>
                <div className="flex-grow overflow-y-auto p-3 space-y-2">
                  {chatMessages.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center mt-4">No messages yet. Say hello!</p>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className={`max-w-[80%] p-2 rounded-lg text-sm ${msg.sender === 'user' ? 'bg-mediblue-600 text-white ml-auto' : 'bg-gray-600 text-gray-100'}`}>
                        {msg.content}
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-2 border-t border-gray-700">
                  <div className="flex space-x-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={canChat ? "Type a message..." : "Match to chat..."}
                      disabled={!canChat || !isConnected}
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 text-xs"
                    />
                    <Button size="sm" onClick={handleSendMessage} disabled={!chatInput.trim() || !canChat || !isConnected} className="bg-mediblue-600 hover:bg-mediblue-700 shrink-0">
                      <Send size={15} />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Participants panel */}
            {showParticipants && (
              <div className="absolute bottom-20 sm:bottom-24 left-3 right-3 sm:left-auto sm:right-4 w-auto sm:w-80 h-80 sm:h-96 bg-gray-800 rounded-lg shadow-2xl flex flex-col border border-gray-700 z-20">
                <div className="bg-gray-700 px-4 py-2 flex items-center justify-between rounded-t-lg">
                  <h3 className="font-medium text-sm">Participants ({participants.length})</h3>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowParticipants(false)}>
                    <X size={16} />
                  </Button>
                </div>
                <div className="flex-grow overflow-y-auto p-3 space-y-2">
                  {participants.map(p => (
                    <div key={p.id} className="flex items-center space-x-3 p-2 bg-gray-700 rounded-lg">
                      <Avatar className="w-10 h-10">
                        <img src={p.imageUrl} alt={p.name} />
                      </Avatar>
                      <div>
                        <div className="font-medium">{p.name} <span className="text-xs text-gray-400">(You)</span></div>
                        <div className="text-xs text-gray-400">{p.specialty}</div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <h4 className="text-xs text-gray-400 mb-2">AVAILABLE DOCTORS</h4>
                    {doctorProfiles.slice(0, 5).filter(d => !participants.some(p => p.id === d.id)).map(d => (
                      <div key={d.id} className="flex items-center justify-between p-2 bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <img src={d.imageUrl} alt={d.name} />
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{d.name}</div>
                            <div className="text-xs text-gray-400">{d.specialty}</div>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleInviteParticipant(d)}>
                          Invite
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Settings panel */}
            {showSettings && (
              <div className="absolute bottom-20 sm:bottom-24 left-3 right-3 sm:left-auto sm:right-4 w-auto sm:w-80 h-80 sm:h-96 bg-gray-800 rounded-lg shadow-2xl flex flex-col border border-gray-700 z-20">
                <div className="bg-gray-700 px-4 py-2 flex items-center justify-between rounded-t-lg">
                  <h3 className="font-medium text-sm">Call Settings</h3>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowSettings(false)}>
                    <X size={16} />
                  </Button>
                </div>
                <div className="flex-grow overflow-y-auto p-3 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Audio</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Mute microphone</span>
                        <Button variant="ghost" size="sm" onClick={() => setIsMuted(!isMuted)}>
                          {isMuted ? 'Unmute' : 'Mute'}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Speaker</span>
                        <Button variant="ghost" size="sm" onClick={() => setIsSpeakerOn(!isSpeakerOn)}>
                          {isSpeakerOn ? 'On' : 'Off'}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Video</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Stop video</span>
                        <Button variant="ghost" size="sm" onClick={() => setIsVideoOff(!isVideoOff)}>
                          {isVideoOff ? 'Start' : 'Stop'}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Connection</h4>
                    <div className="text-xs text-gray-400">
                      Status: {isConnected ? 'Connected' : 'Connecting...'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-700"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-700"
              onClick={() => setIsVideoOff(!isVideoOff)}
            >
              {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
            </Button>
            
                                              <Button
              variant="ghost"
              size="icon"
              className={`rounded-full hover:bg-gray-700 ${showChat ? 'bg-gray-700' : ''}`}
              onClick={() => {
                if (!canChat) {
                  toast({ title: "Not matched yet", description: "Like each other to unlock in-call chat.", variant: "destructive" });
                  return;
                }
                setShowChat(!showChat);
                setShowParticipants(false);
                setShowSettings(false);
              }}
              title="In-call chat"
            >
              <MessageSquare size={20} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full hover:bg-gray-700 ${showParticipants ? 'bg-gray-700' : ''}`}
              onClick={() => {
                setShowParticipants(!showParticipants);
                setShowChat(false);
                setShowSettings(false);
              }}
              title="Participants"
            >
              <Users size={20} />
            </Button>
          </div>
          
          <Button
            variant="default"
            size="icon"
            className="rounded-full bg-red-600 hover:bg-red-700"
            onClick={onEndCall}
            title="End call"
          >
            <Phone size={20} className="rotate-[135deg]" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full hover:bg-gray-700 ${showSettings ? 'bg-gray-700' : ''}`}
            onClick={() => {
              setShowSettings(!showSettings);
              setShowChat(false);
              setShowParticipants(false);
            }}
            title="Settings"
          >
            <Settings size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
