import { usePersistedState } from '@/hooks/usePersistedState';
import { demoModeEnabled } from '@/lib/devAuth';
import { hasServerSession, listNotifications as serverListNotifications } from '@/services/api';
import { useEffect } from 'react';

export interface Notification {
  id: string;
  type: 'message' | 'profile_view' | 'interest' | 'video_request';
  from: string;
  doctorId?: string;
  content: string;
  timestamp: Date | string;
  read: boolean;
  imageUrl: string;
  specialty?: string;
  hospital?: string;
  city?: string;
}

// Demo seeds are DEV-ONLY (audit C-4 pattern): fabricated "profile views" from
// randomuser.me fixtures must never appear in a production build. The wired
// store below is the real data source when a server session exists.
const seedNotifications: Notification[] = demoModeEnabled ? [
  {
    id: '1',
    type: 'message' as const,
    from: 'Priya Patel',
    doctorId: '8',
    content: 'Sent you a new message about pediatric neurology cases',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    read: false,
    imageUrl: 'https://randomuser.me/api/portraits/women/8.jpg',
    specialty: 'Neurologist',
    hospital: 'Apollo Hospital',
    city: 'Delhi'
  },
  {
    id: '2',
    type: 'profile_view' as const,
    from: 'Aditya Sharma',
    doctorId: '7',
    content: 'Viewed your biodata and medical credentials',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    read: false,
    imageUrl: 'https://randomuser.me/api/portraits/men/7.jpg',
    specialty: 'Cardiologist',
    hospital: 'Lilavati Hospital',
    city: 'Mumbai'
  },
  {
    id: '3',
    type: 'interest' as const,
    from: 'Ananya Reddy',
    doctorId: '10',
    content: 'Expressed interest in connecting with you for matrimony',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    read: false,
    imageUrl: 'https://randomuser.me/api/portraits/women/67.jpg',
    specialty: 'Pediatrician',
    hospital: 'KIMS Hospitals',
    city: 'Hyderabad'
  },
  {
    id: '4',
    type: 'video_request' as const,
    from: 'Rajesh Gupta',
    doctorId: '9',
    content: 'Requested a 1-on-1 video date consultation',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    read: false,
    imageUrl: 'https://randomuser.me/api/portraits/men/54.jpg',
    specialty: 'Orthopedic Surgeon',
    hospital: 'Fortis Healthcare',
    city: 'Bangalore'
  },
  {
    id: '5',
    type: 'profile_view' as const,
    from: 'Sophia Martinez',
    doctorId: '4',
    content: 'Viewed your profile from Miami',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
    imageUrl: 'https://randomuser.me/api/portraits/women/4.jpg',
    specialty: 'Dermatologist',
    hospital: 'Skin Care Clinic',
    city: 'Miami'
  }
] : [];

export const useNotifications = () => {
  const [notifications, setNotifications] = usePersistedState<Notification[]>(
    'mm:notifications',
    seedNotifications
  );

  // Wired mode: the SERVER notification center is the source of truth (durable
  // rows incl. type='profile_view'). Merge on mount — server rows win by id;
  // local-only rows (demo/optimistic) are kept so nothing disappears offline.
  useEffect(() => {
    if (!hasServerSession()) return;
    let cancelled = false;
    void (async () => {
      try {
        const d = await serverListNotifications();
        if (cancelled || !d?.notifications?.length) return;
        setNotifications((prev) => {
          const byId = new Map(prev.map((n) => [n.id, n]));
          for (const sn of d.notifications) {
            byId.set(sn.id, {
              id: sn.id,
              type: (sn.type as Notification['type']) || 'message',
              from: sn.title || 'MedicoMatch',
              content: sn.body || '',
              timestamp: sn.createdAt,
              read: Boolean(sn.read),
              imageUrl: '',
              city: undefined,
              specialty: undefined,
              hospital: undefined,
            });
          }
          return Array.from(byId.values()).slice(0, 100);
        });
      } catch { /* offline — local store remains */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getNotificationCount = (type?: string) => {
    if (!type || type === 'all') {
      return notifications.filter(n => !n.read).length;
    }
    return notifications.filter(n => n.type === type && !n.read).length;
  };

  const pushNotification = (n: Omit<Notification, 'id' | 'timestamp' | 'read'> & Partial<Pick<Notification, 'id' | 'timestamp' | 'read'>>) => {
    setNotifications(prev => [
      { id: Date.now().toString(), timestamp: new Date().toISOString(), read: false, ...n } as Notification,
      ...prev,
    ].slice(0, 50));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return {
    notifications,
    getNotificationCount,
    pushNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
};
