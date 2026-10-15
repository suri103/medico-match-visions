
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Video, 
  Send, 
  Smile, 
  Paperclip, 
  MoreVertical, 
  X,
  ArrowLeft,
  Calendar,
  Phone
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from '@/hooks/use-toast';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { usePlan } from '@/hooks/usePlan';
import { useNavigate } from 'react-router-dom';
import { syncInboxForChat } from '@/features/messages/hooks/useChatSync';
import { Crown, Sparkles, ArrowRight } from 'lucide-react';
import { demoModeEnabled } from '@/lib/devAuth';
import { useAuthSessionKey } from '@/hooks/useAuthSessionKey';
import {
  hasServerSession, listChannels, listMessages as listServerMessages,
  sendChatMessage as sendServerMessage, openEventStream, sendTyping,
  reportProfile,
} from '@/services/api';
import CallModal from '@/components/CallModal';

type Message = {
  id: string;
  content: string;
  sender: 'user' | 'doctor';
  timestamp: string | Date;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
};

const PREBUILT_STARTERS = [
  "Hello Dr. [Name]! Liked your profile and would love to connect for matrimony.",
  "Namaste Dr. [Name]! Viewed your medical credentials. Hope we can connect for an introduction.",
  "Hi Dr. [Name]! Are you available for a quick introduction chat or video call?",
  "Hello! Our astrological compatibility looks wonderful. Would like to initiate a conversation.",
  "Namaste! Hope you're having a good day at the hospital. Looking forward to connecting.",
];

const getInitialMessages = (id: string, name: string): Message[] => {
  // Fabricated conversation history is demo-only content (audit M2): real
  // conversations start empty in production builds.
  if (!demoModeEnabled) return [];
  const clean = (name || 'Doctor').replace(/^dr\.?\s*/i, '');
  if (id === '1') {
    return [
      { id: '1', content: 'That sounds interesting! What time works for you?', sender: 'doctor', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), status: 'read' },
      { id: '2', content: "Let's connect soon.", sender: 'user', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), status: 'read' },
    ];
  }
  if (id === '2') {
    return [
      { id: '1', content: "I enjoyed our video call. Let's meet next week.", sender: 'doctor', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), status: 'read' },
    ];
  }
  if (id === '3') {
    return [
      { id: '1', content: 'Have you read the latest pediatric research paper?', sender: 'doctor', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), status: 'read' },
    ];
  }
  if (id === '4') {
    return [
      { id: '1', content: `Hello! I'm Dr. ${clean}, Dermatologist from Miami. Viewed your profile and would love to connect!`, sender: 'doctor', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), status: 'read' },
    ];
  }
  if (id === '5') {
    return [
      { id: '1', content: 'Thanks for sharing those clinical resources.', sender: 'doctor', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), status: 'read' },
    ];
  }
  if (id === '7') {
    return [
      { id: '1', content: `Hello! I'm Dr. ${clean}, Cardiologist at Lilavati Hospital Mumbai. I viewed your biodata and medical credentials. Glad to connect!`, sender: 'doctor', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), status: 'read' },
    ];
  }
  if (id === '8') {
    return [
      { id: '1', content: `Hi! I'm Dr. ${clean}, Neurologist at Apollo Hospital Delhi. Sent you a message about pediatric neurology cases.`, sender: 'doctor', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), status: 'read' },
    ];
  }
  if (id === '9') {
    return [
      { id: '1', content: `Hello! I'm Dr. ${clean}, Orthopedic Surgeon at Fortis Bangalore. I requested a 1-on-1 video date consultation with you!`, sender: 'doctor', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), status: 'read' },
    ];
  }
  if (id === '10') {
    return [
      { id: '1', content: `Namaste! I'm Dr. ${clean}, Pediatrician at KIMS Hyderabad. Expressed interest in connecting with you for matrimony!`, sender: 'doctor', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), status: 'read' },
    ];
  }
  return [
    { id: '1', content: `Hello! I'm Dr. ${clean}. Great to connect with you on MedicoMatch!`, sender: 'doctor', timestamp: new Date().toISOString(), status: 'read' },
  ];
};

interface ChatProps {
  doctorId: string;
  doctorName: string;
  doctorImage: string;
  onStartVideoCall?: () => void;
  onClose?: () => void;
}

const Chat: React.FC<ChatProps> = ({ 
  doctorId, 
  doctorName, 
  doctorImage,
  onStartVideoCall,
  onClose 
}) => {
  const navigate = useNavigate();
  const { canMessage, blockDoctor } = useFavoritesContext();
  const { isPremium, isPlatinum } = usePlan();
  const gated = !canMessage(doctorId);

  const [messages, setMessages] = usePersistedState<Message[]>(
    `mm:chat:${doctorId}`,
    () => getInitialMessages(doctorId, doctorName)
  );
  
  const [newMessage, setNewMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const EMOJIS = ['😀', '😄', '😂', '😍', '😊', '❤️', '👍', '🎉', '👋', '🙏', '🤝', '🌟'];
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ---- Wired backend: real message history for matched, server-backed chats.
  // Local storage remains the immediate cache; the server is the record. ----
  const sessionKey = useAuthSessionKey();
  const [serverChannelId, setServerChannelId] = useState<string | null>(null);
  const [peerUserId, setPeerUserId] = useState<string | null>(null);
  const [showCall, setShowCall] = useState(false);
  useEffect(() => {
    // M-7 fix: gate the SERVER history only on having a session. The previous
    // local-cache gate (canMessage) dead-ended genuinely matched users whose
    // connections had not hydrated (fresh login / cross-device), because this
    // effect never re-ran after hydration. Local gating still controls the
    // composer below; reading must not depend on cache freshness.
    if (!hasServerSession()) return;
    let cancelled = false;
    (async () => {
      const channels = await listChannels();
      if (!channels || cancelled) return;
      const ch = channels.find((c) => c.profile.id === doctorId);
      if (!ch) return; // no accepted interest yet on the server
      setServerChannelId(ch.channelId);
      setPeerUserId(ch.peerUserId);
      const history = await listServerMessages(ch.channelId);
      if (!history || cancelled || history.length === 0) return;
      setMessages(
        history.map((m) => ({
          id: m.id,
          content: m.body,
          sender: m.mine ? ('user' as const) : ('doctor' as const),
          timestamp: m.createdAt,
          status: 'read' as const,
        }))
      );
    })().catch(() => {
      /* offline — cached thread stays */
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, sessionKey]);

  // ---- Realtime delivery: SSE push (primary) with the 6s poller as fallback
  // whenever the stream is down. Both paths funnel into one merge so optimistic
  // local sends are never clobbered. ----
  const lastPollSigRef = useRef('');
  const myUserIdRef = useRef<string | null>(null);
  // Audit H6: refresh `myUserId` when the signed-in identity changes (without a
  // reload), so optimistic sends are attributed to the current account.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('mm:authSession');
      const s = raw ? JSON.parse(raw) : null;
      myUserIdRef.current = typeof s?.user?.id === 'string' ? s.user.id : null;
    } catch {
      myUserIdRef.current = null;
    }
  }, [sessionKey]);

  const mergeServerMessages = useCallback((serverMsgs: Message[]) => {
    setMessages((prev) => {
      // Preserve optimistic local sends the server has not echoed yet.
      const pending = prev.filter(
        (p) => p.sender === 'user' && p.status === 'sending' &&
          !serverMsgs.some((s) => s.sender === 'user' && s.content === p.content)
      );
      const merged = [...serverMsgs, ...pending].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const sig = JSON.stringify(merged.map((m) => [m.id, m.content]));
      if (sig === lastPollSigRef.current) return prev; // no-op render guard
      lastPollSigRef.current = sig;
      return merged;
    });
  }, [setMessages]);

  const [sseLive, setSseLive] = useState(false);
  // Typing indicator: peer's ephemeral "typing…" state for THIS channel.
  const [peerTyping, setPeerTyping] = useState(false);
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Emit-side typing throttle: at most one POST per 2s while composing. The
  // peer's banner self-expires after 4s, so a dropped signal never sticks.
  const lastTypingSentAt = useRef(0);
  const maybeEmitTyping = () => {
    if (!serverChannelId || !hasServerSession()) return;
    const now = Date.now();
    if (now - lastTypingSentAt.current < 2000) return;
    lastTypingSentAt.current = now;
    void sendTyping(serverChannelId).catch(() => {});
  };
  useEffect(() => {
    if (!serverChannelId || !hasServerSession()) return;
    return openEventStream({
      onOpen: () => setSseLive(true),
      onError: () => setSseLive(false),
      onTyping: (payload) => {
        if (payload.channelId !== serverChannelId) return;
        setPeerTyping(true);
        if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
        peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 4000);
      },
      onMessage: (payload) => {
        if (payload.channelId !== serverChannelId) return;
        // An incoming message implicitly ends the typing state.
        setPeerTyping(false);
        const mine = payload.message.senderId === myUserIdRef.current;
        mergeServerMessages([{
          id: payload.message.id,
          content: payload.message.body,
          sender: mine ? 'user' : 'doctor',
          timestamp: payload.message.createdAt,
          status: 'read',
        }]);
      },
    });
  }, [serverChannelId, mergeServerMessages]);

  // Fallback poller — only runs while the SSE stream is NOT live.
  useEffect(() => {
    if (!serverChannelId || sseLive || !hasServerSession()) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const history = await listServerMessages(serverChannelId);
        if (cancelled || !history) return;
        mergeServerMessages(
          history.map((m) => ({
            id: m.id,
            content: m.body,
            sender: m.mine ? ('user' as const) : ('doctor' as const),
            timestamp: m.createdAt,
            status: 'read' as const,
          }))
        );
      } catch {
        /* transient poll failure — next tick retries */
      }
    };
    void tick();
    const iv = setInterval(tick, 6000);
    // P0-7: tell the server the peer's messages are now seen (read receipts).
    void (async () => {
      try {
        const { markMessagesRead } = await import('@/services/api');
        await markMessagesRead(serverChannelId);
      } catch { /* non-fatal */ }
    })();
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [serverChannelId, sseLive, mergeServerMessages]);
  
  const syncInbox = (next: Message[]) => syncInboxForChat(doctorId, doctorName, doctorImage, next);

  const handleSendMessage = () => {
    if (newMessage.trim() === '') return;
    if (gated) {
      toast({ title: "Not matched yet", description: "Like each other to unlock chat. Send an interest from Matches first.", variant: "destructive" });
      return;
    }
    if (!isPremium) {
      // Free tier is limited to prebuilt starters (enforced, not just advertised).
      toast({ title: "Premium Feature 👑", description: "Custom messages need Premium. Free tier can send the prebuilt starters.", variant: "destructive" });
      return;
    }
    if (editingMessageId) {
      setMessages(prev => {
        const next = prev.map(m => (m.id === editingMessageId ? { ...m, content: newMessage.trim() } : m));
        syncInbox(next);
        return next;
      });
      setEditingMessageId(null);
      setNewMessage('');
      setIsComposing(false);
      return;
    }
    const message: Message = {
      // Date.now() alone collides when two writes land in the same millisecond.
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content: newMessage.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
      // Optimistic send: 'sending' until the wired backend acknowledges, then
      // the 6s poller reconciles it into the durable thread.
      status: serverChannelId ? 'sending' : 'sent',
    };
    setMessages(prev => {
      const next = [...prev, message];
      syncInbox(next);
      return next;
    });
    if (serverChannelId) {
      void sendServerMessage(serverChannelId, message.content)
        .then((ok) => {
          if (ok) {
            setMessages(prev => prev.map(m => (m.id === message.id ? { ...m, status: 'sent' as const } : m)));
          } else {
            setMessages(prev => prev.map(m => (m.id === message.id ? { ...m, status: 'failed' as const } : m)));
            toast({ title: "Message not delivered", description: "The message could not be synced. Please try again.", variant: "destructive" });
          }
        })
        .catch(() => {
          // Honest failure: the durable record did NOT land. Keep the bubble
          // locally but mark it failed instead of silently claiming success.
          setMessages(prev => prev.map(m => (m.id === message.id ? { ...m, status: 'failed' as const } : m)));
          toast({ title: "Message not delivered", description: "The message could not be synced. Please try again.", variant: "destructive" });
        });
    } else {
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, status: 'delivered' as const } : m));
      }, 1200);
    }
    setNewMessage('');
    setIsComposing(false);
  };

  const handleStartEdit = (id: string, content: string) => {
    if (!isPremium) {
      toast({
        title: "Premium Feature 👑",
        description: "Editing sent messages is a Premium & Platinum feature. Upgrade to unlock full chat tools.",
      });
      return;
    }
    setEditingMessageId(id);
    setNewMessage(content);
    setIsComposing(true);
    setShowEmojiPicker(false);
  };

  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPremium) {
      toast({
        title: "Premium Feature 👑",
        description: "Sending documents and file attachments is reserved for Premium and Platinum members.",
      });
      if (attachInputRef.current) attachInputRef.current.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      if (gated) {
        toast({ title: "Not matched yet", description: "Unlock chat by matching first.", variant: "destructive" });
        if (attachInputRef.current) attachInputRef.current.value = '';
        return;
      }
      const message: Message = {
        id: Date.now().toString(),
        content: `📎 ${file.name}`,
        sender: 'user',
        timestamp: new Date().toISOString(),
        status: 'sent',
      };
      setMessages(prev => {
        const next = [...prev, message];
        syncInbox(next);
        return next;
      });
    }
    if (attachInputRef.current) attachInputRef.current.value = '';
  };

  const insertEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== messageId);
      // Sync whatever remains — without fabricating an incoming doctor message
      // when the thread becomes empty (audit L2).
      syncInbox(next);
      return next;
    });
    toast({ title: "Message deleted", description: "The message has been removed." });
  };

  const handleClearChat = () => {
    setMessages([]);
    try {
      const raw = localStorage.getItem('mm:chats');
      const chats = raw ? JSON.parse(raw) : [];
      const next = chats.map((c: { id: string }) => c.id === doctorId ? { ...c, lastMessage: 'Conversation cleared', timestamp: new Date().toISOString() } : c);
      localStorage.setItem('mm:chats', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:chats' } }));
    } catch { /* ignore */ }
    toast({ title: "Chat cleared", description: "The conversation history has been cleared." });
  };

  const handleSchedule = () => {
    toast({
      title: "Opening video call",
      description: "Redirecting you to the video call screen to start or schedule the date.",
    });
    onStartVideoCall?.();
  };

  const handlePhoneCall = () => {
    navigate('/video-dates');
    toast({ title: "Voice call", description: "Redirected to video call — voice calls connect through video." });
  };

  const handleBlock = () => {
    blockDoctor(doctorId);
    try {
      const raw = localStorage.getItem('mm:chats');
      if (raw) {
        const chats = JSON.parse(raw).filter((c: { id: string }) => c.id !== doctorId);
        localStorage.setItem('mm:chats', JSON.stringify(chats));
        window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:chats' } }));
      }
    } catch { /* ignore */ }
    toast({ title: "Doctor blocked", description: "You will no longer receive messages from this doctor. Unblock from Interested In You / Favorites." });
    onClose?.();
  };

  const handleReport = () => {
    void reportProfile(doctorId, "Inappropriate chat behavior", "Reported from chat conversation").catch(() => false);
    try {
      const raw = localStorage.getItem('mm:reports');
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({ doctorId, doctorName, at: new Date().toISOString() });
      // Cap the store so it cannot grow unbounded.
      localStorage.setItem('mm:reports', JSON.stringify(arr.slice(0, 100)));
    } catch { /* ignore */ }
    toast({ title: "Report recorded", description: "The report is saved on this device and the profile is hidden from your feed." });
  };

  const handleViewProfile = () => {
    toast({ title: "Doctor profile", description: `Dr. ${doctorName} — view full details on Matches or Online.` });
    navigate('/matches');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const formatMessageTime = (date: string | Date) => {
    const today = new Date();
    const messageDate = new Date(date as string);
    
    if (
      messageDate.getDate() === today.getDate() &&
      messageDate.getMonth() === today.getMonth() &&
      messageDate.getFullYear() === today.getFullYear()
    ) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return messageDate.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[80vh] bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between p-3 border-b bg-white">
        <div className="flex items-center min-w-0 pr-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden mr-1.5 h-8 w-8 shrink-0 text-slate-700 hover:bg-slate-100"
            onClick={onClose}
          >
            <ArrowLeft size={18} />
          </Button>
          
          <Avatar className="h-9 w-9 sm:h-10 sm:w-10 mr-2 sm:mr-3 shrink-0 border border-slate-200">
            <img src={doctorImage} alt={doctorName} className="object-cover" />
          </Avatar>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm sm:text-base text-slate-900 truncate">Dr. {doctorName}</h3>
              {isPlatinum ? (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] py-0 px-1.5 font-semibold shrink-0">
                  <Crown size={10} className="mr-0.5 text-purple-600" /> Platinum
                </Badge>
              ) : isPremium ? (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] py-0 px-1.5 font-semibold shrink-0">
                  <Crown size={10} className="mr-0.5 text-amber-600" /> Premium
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-slate-50 text-slate-600 text-[10px] py-0 px-1.5 shrink-0">
                  Free
                </Badge>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-600 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Online
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-0.5 sm:space-x-1 shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-mediblue-600 hover:bg-mediblue-50"
            onClick={handleSchedule}
            title="Schedule Consultation"
          >
            <Calendar size={17} />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-mediblue-600 hover:bg-mediblue-50"
            onClick={handlePhoneCall}
            title="Call"
          >
            <Phone size={17} />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-mediblue-600 hover:bg-mediblue-50"
            onClick={() => {
              // Real 1:1 WebRTC call when wired to a matched server chat;
              // otherwise hand off to the parent (demo scheduling flow).
              if (serverChannelId && peerUserId) setShowCall(true);
              else onStartVideoCall?.();
            }}
            title="Start Video Call"
          >
            <Video size={17} />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600">
                <MoreVertical size={17} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleViewProfile}>
                View doctor profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleClearChat}>
                Clear chat history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBlock}>
                Block doctor
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-500" onClick={handleReport}>
                Report doctor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {gated && (
        <div className="bg-amber-50 border-b px-3 sm:px-4 py-2 text-xs sm:text-sm text-amber-800 flex items-center justify-between">
          <span>Chat unlocks after you both like each other. Send an interest to get started.</span>
          <button className="text-amber-900 underline text-xs font-semibold shrink-0 ml-2" onClick={() => navigate('/matches')}>Browse matches</button>
        </div>
      )}
      {/* Messages area */}
      <div className="flex-grow p-3 sm:p-4 overflow-y-auto">
        <div className="space-y-3 sm:space-y-4">
          {messages.map((message) => {
            const isSentByUser = message.sender === 'user';
            return (
              <div 
                key={message.id} 
                className={`flex ${isSentByUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex max-w-[88%] sm:max-w-[80%]">
                  {!isSentByUser && (
                    <Avatar className="h-8 w-8 mr-2 mt-1 flex-shrink-0">
                      <img src={doctorImage} alt={doctorName} />
                    </Avatar>
                  )}
                  
                  <div>
                    <div 
                      className={`rounded-2xl px-4 py-2 inline-block
                        ${isSentByUser 
                          ? 'bg-mediblue-100 text-mediblue-900 rounded-br-none' 
                          : 'bg-gray-100 rounded-bl-none'}
                      `}
                    >
                      {message.content}
                    </div>
                    <div className={`text-xs text-gray-500 mt-1 ${isSentByUser ? 'text-right' : 'text-left'}`}>
                      {formatMessageTime(message.timestamp)}
                      {isSentByUser && message.status && (
                        <span className="ml-2">
                          {message.status === 'read' && (
                            <span className="text-blue-500">✓✓</span>
                          )}
                          {message.status === 'delivered' && (
                            <span>✓✓</span>
                          )}
                          {message.status === 'sent' && (
                            <span>✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {isSentByUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStartEdit(message.id, message.content)}>
                          Edit message
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteMessage(message.id)}>
                          Delete message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Message input */}
      <div className="border-t p-3 bg-white">
        <input type="file" ref={attachInputRef} className="hidden" onChange={handleAttach} />
        
        {/* Prebuilt Starters Bar */}
        <div className="mb-2.5">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles size={12} className="text-amber-500" />
              {isPremium ? "Quick Replies / Starters:" : "Prebuilt Conversation Starters (Free):"}
            </span>
            {!isPremium && (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-medium">
                Free Tier
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
            {PREBUILT_STARTERS.map((starter, i) => {
              const cleanDoctor = doctorName.replace(/^dr\.?\s*/i, '');
              const formatted = starter.replace('[Name]', cleanDoctor);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setNewMessage(formatted);
                  }}
                  className="shrink-0 text-[11px] py-1 px-2.5 rounded-full bg-slate-100/90 hover:bg-mediblue-50 hover:text-mediblue-800 border border-slate-200/80 text-slate-700 transition-all active:scale-95 shadow-2xs whitespace-nowrap"
                  title="Click to insert prebuilt starter message"
                >
                  "{formatted.length > 36 ? formatted.slice(0, 36) + '…' : formatted}"
                </button>
              );
            })}
          </div>
        </div>

        {showEmojiPicker && (
          <div className="flex flex-wrap gap-1 border-b pb-2 mb-2">
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                className="text-xl hover:bg-gray-100 rounded px-1"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        {/* Peer typing indicator (ephemeral SSE state; auto-expires). */}
        {peerTyping && (
          <div className="flex items-center gap-1.5 px-1 pb-1.5" aria-live="polite">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-mediblue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-mediblue-400 animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-mediblue-400 animate-bounce" style={{ animationDelay: '240ms' }} />
            </span>
            <span className="text-[11px] text-slate-500">Dr. {doctorName.replace(/^Dr\.\s*/i, '')} is typing…</span>
          </div>
        )}
        {isComposing ? (
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {editingMessageId ? 'Edit message' : 'Compose message'}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => { setIsComposing(false); setEditingMessageId(null); }}
              >
                <X size={18} />
              </Button>
            </div>
            <Textarea
              value={newMessage}
              onChange={(e) => { setNewMessage(e.target.value); maybeEmitTyping(); }}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here..."
              className="min-h-[120px]"
            />
            <div className="flex justify-between">
              <div className="flex space-x-1">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => attachInputRef.current?.click()}>
                  <Paperclip size={18} />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <Smile size={18} />
                </Button>
              </div>
              <Button onClick={handleSendMessage} className="bg-mediblue-600 hover:bg-mediblue-700">
                <Send size={16} className="mr-2" />
                {editingMessageId ? 'Update' : 'Send'}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex space-x-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 shrink-0 text-slate-500 hover:text-mediblue-600"
                onClick={() => attachInputRef.current?.click()}
                title={isPremium ? "Attach File" : "Attachments (Premium)"}
              >
                <Paperclip size={18} />
              </Button>
              <div className="flex-grow relative">
                <Input
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); maybeEmitTyping(); }}
                  onKeyDown={handleKeyDown}
                  placeholder={isPremium ? "Type a message..." : "Select a prebuilt starter above..."}
                  className="pr-10 text-xs"
                  disabled={!isPremium}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-700"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile size={17} />
                </Button>
              </div>
              <Button 
                onClick={handleSendMessage} 
                className="bg-mediblue-600 hover:bg-mediblue-700 text-white w-10 h-10 rounded-full p-0 flex items-center justify-center shrink-0 shadow-xs"
                disabled={!newMessage.trim() || gated}
              >
                <Send size={16} />
              </Button>
            </div>

            {/* Free Tier Notice & Upgrade CTA */}
            {!isPremium && (
              <div className="mt-2.5 p-2 px-3 rounded-xl bg-gradient-to-r from-amber-50/90 to-orange-50/90 border border-amber-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Crown size={14} className="text-amber-600 shrink-0" />
                  <p className="text-[11px] text-amber-900 truncate">
                    Free tier can send prebuilt starters. <span className="font-semibold hidden sm:inline">Upgrade to Premium for custom typing.</span>
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-6 px-2.5 text-[10px] font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shrink-0 shadow-xs"
                  onClick={() => navigate('/plan')}
                >
                  Upgrade <ArrowRight size={10} className="ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real 1:1 WebRTC call (matched server chats only). */}
      {showCall && serverChannelId && peerUserId && (
        <CallModal
          open
          onClose={() => setShowCall(false)}
          peerUserId={peerUserId}
          peerName={doctorName.replace(/^Dr\.\s*/i, '')}
          startCall
        />
      )}
    </div>
  );
};

export default Chat;
