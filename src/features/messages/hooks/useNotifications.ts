
import { useState } from 'react';

export interface Notification {
  id: string;
  type: 'message' | 'profile_view' | 'interest' | 'video_request';
  from: string;
  content: string;
  timestamp: Date;
  read: boolean;
  imageUrl: string;
}

const notifications = [
  {
    id: '1',
    type: 'message' as const,
    from: 'Priya Sharma',
    content: 'You have 2 unread messages',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    read: false,
    imageUrl: 'https://randomuser.me/api/portraits/women/44.jpg'
  },
  {
    id: '2',
    type: 'profile_view' as const,
    from: 'Arjun Nair',
    content: 'viewed your profile',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: false,
    imageUrl: 'https://randomuser.me/api/portraits/men/76.jpg'
  },
  {
    id: '3',
    type: 'interest' as const,
    from: 'Leela Krishnan',
    content: 'expressed interest in connecting with you',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
    read: true,
    imageUrl: 'https://randomuser.me/api/portraits/women/90.jpg'
  },
  {
    id: '4',
    type: 'video_request' as const,
    from: 'Vikram Singh',
    content: 'wants to schedule a video date',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12),
    read: false,
    imageUrl: 'https://randomuser.me/api/portraits/men/22.jpg'
  }
];

export const useNotifications = () => {
  const [notificationsData] = useState<Notification[]>(notifications);

  const getNotificationCount = (type: string) => {
    return notificationsData.filter(n => n.type === type && !n.read).length;
  };

  return {
    notifications: notificationsData,
    getNotificationCount
  };
};
