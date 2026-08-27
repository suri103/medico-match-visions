import { useCallback } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { demoModeEnabled } from '@/lib/devAuth';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'doctor';
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

const keyFor = (doctorId: string) => `mm:chat:${doctorId}`;

export function syncInboxForChat(doctorId: string, doctorName: string, doctorImage: string, next: { content: string; sender: string }[]) {
  const last = next[next.length - 1];
  if (!last) return;
  const preview = last.content.length > 60 ? last.content.slice(0, 60) + '…' : last.content;
  try {
    const raw = localStorage.getItem('mm:chats');
    const chats = raw ? JSON.parse(raw) : [];
    const idx = chats.findIndex((c: { id: string }) => c.id === doctorId);
    const entry = {
      id: doctorId,
      name: doctorName,
      specialty: 'Doctor',
      imageUrl: doctorImage,
      lastMessage: preview,
      timestamp: new Date().toISOString(),
      unread: 0,
      isOnline: true,
    };
    if (idx >= 0) {
      chats[idx] = { ...chats[idx], lastMessage: preview, timestamp: entry.timestamp };
      if (last.sender === 'doctor') chats[idx].unread = (chats[idx].unread ?? 0) + 1;
    } else {
      chats.push(entry);
    }
    localStorage.setItem('mm:chats', JSON.stringify(chats));
    window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:chats' } }));
  } catch { /* ignore */ }
}


// Mark one conversation's messages as read in the shared "mm:chats" inbox store.
export function markInboxReadForChat(doctorId: string) {
  try {
    const raw = localStorage.getItem('mm:chats');
    const chats = raw ? JSON.parse(raw) : [];
    const idx = chats.findIndex((c: { id: string }) => c.id === doctorId);
    if (idx >= 0 && chats[idx].unread) {
      chats[idx].unread = 0;
      localStorage.setItem('mm:chats', JSON.stringify(chats));
      window.dispatchEvent(new CustomEvent('mm:persisted-state-changed', { detail: { key: 'mm:chats' } }));
    }
  } catch {
    /* ignore */
  }
}
export function useChatSync() {
  const { isMatched, isBlocked } = useFavoritesContext();

  const canChat = useCallback((doctorId: string) => {
    if (isBlocked(doctorId)) return false;
    return isMatched(doctorId);
  }, [isMatched, isBlocked]);

  return { canChat, keyFor };
}

export function useChatMessages(doctorId: string, doctorName: string, doctorImage: string, _doctorSpecialty: string) {
  // Seeded demo conversation — development builds only (audit M2).
  const seed: ChatMessage[] = demoModeEnabled
    ? [
        { id: '1', content: 'What time works for you?', sender: 'doctor', timestamp: new Date(Date.now() - 86400000).toISOString(), status: 'read' },
        { id: '2', content: "Let's meet next week.", sender: 'user', timestamp: new Date(Date.now() - 43200000).toISOString(), status: 'read' },
        { id: '3', content: 'Have you read the research paper?', sender: 'doctor', timestamp: new Date().toISOString(), status: 'delivered' },
      ]
    : [];
  const [messages, setMessages] = usePersistedState<ChatMessage[]>(keyFor(doctorId), seed);

  const syncInbox = useCallback((nextMessages: ChatMessage[]) => {
    syncInboxForChat(doctorId, doctorName, doctorImage, nextMessages);
  }, [doctorId, doctorName, doctorImage]);

  const appendMessage = useCallback((content: string) => {
    const msg: ChatMessage = { id: Date.now().toString(), content, sender: 'user', timestamp: new Date().toISOString(), status: 'sent' };
    setMessages(prev => {
      const next = [...prev, msg];
      syncInbox(next);
      return next;
    });
  }, [setMessages, syncInbox]);

  const markInboxRead = useCallback(() => {
    markInboxReadForChat(doctorId);
  }, [doctorId]);

  return { messages, setMessages, appendMessage, markInboxRead, syncInbox };
}
