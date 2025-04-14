
import React from 'react';
import NotificationCard from './NotificationCard';
import NotificationStats from './NotificationStats';
import { useNotifications } from '../hooks/useNotifications';
import { Notification } from '../hooks/useNotifications';

const NotificationsList: React.FC = () => {
  const { notifications, getNotificationCount } = useNotifications();

  return (
    <div className="p-4 flex flex-col h-full overflow-hidden">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Notifications</h3>
      
      <NotificationStats getNotificationCount={getNotificationCount} />
      
      <div className="space-y-4 overflow-y-auto flex-grow pr-1 mt-4">
        {notifications && notifications.length > 0 ? (
          notifications.map((notification: Notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
            />
          ))
        ) : (
          <div className="py-8 text-center text-gray-500">
            No new notifications
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsList;
