import { usePersistedState } from '@/hooks/usePersistedState';

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

const seedNotifications: Notification[] = [
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
];

export const useNotifications = () => {
  const [notifications, setNotifications] = usePersistedState<Notification[]>(
    'mm:notifications',
    seedNotifications
  );

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
