import React, { useState } from 'react';
import NotificationCard from './NotificationCard';
import NotificationStats from './NotificationStats';
import { useNotifications, Notification } from '../hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Filter } from 'lucide-react';

const NotificationsList: React.FC = () => {
  const { notifications, getNotificationCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredNotifications = activeFilter
    ? notifications.filter((n: Notification) => n.type === activeFilter)
    : notifications;

  const getFilterLabel = (type: string) => {
    switch (type) {
      case 'message': return 'Messages';
      case 'profile_view': return 'Profile Views';
      case 'interest': return 'Interests';
      case 'video_request': return 'Date Requests';
      default: return 'All';
    }
  };

  return (
    <div className="p-4 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          Notifications
          {notifications.filter(n => !n.read).length > 0 && (
            <Badge className="bg-mediblue-600 text-white text-xs">
              {notifications.filter(n => !n.read).length} new
            </Badge>
          )}
        </h3>
        {notifications.some(n => !n.read) && (
          <Button size="sm" variant="ghost" className="text-xs text-mediblue-600 hover:text-mediblue-700" onClick={markAllAsRead}>
            Mark all read
          </Button>
        )}
      </div>
      
      <NotificationStats 
        getNotificationCount={getNotificationCount} 
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
      />

      {activeFilter && (
        <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 rounded-lg mb-3 text-xs text-slate-700">
          <span className="flex items-center gap-1 font-medium">
            <Filter size={12} className="text-mediblue-600" />
            Filtered by: <span className="font-semibold text-mediblue-700">{getFilterLabel(activeFilter)}</span> ({filteredNotifications.length})
          </span>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-6 px-1.5 text-xs text-slate-500 hover:text-slate-800"
            onClick={() => setActiveFilter(null)}
          >
            Clear <X size={12} className="ml-1" />
          </Button>
        </div>
      )}
      
      <div className="space-y-3 overflow-y-auto flex-grow pr-1 mt-1">
        {filteredNotifications && filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification: Notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={markAsRead}
              onDelete={deleteNotification}
            />
          ))
        ) : (
          <div className="py-12 text-center text-gray-400">
            <p className="text-sm font-medium">No notifications {activeFilter ? `matching "${getFilterLabel(activeFilter)}"` : ''}</p>
            {activeFilter && (
              <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => setActiveFilter(null)}>
                View all notifications
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsList;
