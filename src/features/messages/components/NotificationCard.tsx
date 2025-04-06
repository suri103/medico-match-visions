
import React from 'react';
import { Bell, Calendar, Eye, Heart } from 'lucide-react';
import { Notification } from '../hooks/useNotifications';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatMessageTime } from '../utils/formatTime';

interface NotificationCardProps {
  notification: Notification;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ notification }) => {
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
    <div 
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
  );
};

export default NotificationCard;
