
import React from 'react';
import { Bell, Calendar, Eye, Heart } from 'lucide-react';

interface NotificationStatsProps {
  getNotificationCount: (type: string) => number;
}

const NotificationStats: React.FC<NotificationStatsProps> = ({ getNotificationCount }) => {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div className="bg-white p-3 rounded-lg border shadow-sm">
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-blue-100">
            <Bell className="h-5 w-5 text-blue-500" />
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium">New Messages</div>
            <div className="text-2xl font-semibold">{getNotificationCount('message')}</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-3 rounded-lg border shadow-sm">
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-purple-100">
            <Eye className="h-5 w-5 text-purple-500" />
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium">Profile Views</div>
            <div className="text-2xl font-semibold">{getNotificationCount('profile_view')}</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-3 rounded-lg border shadow-sm">
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-red-100">
            <Heart className="h-5 w-5 text-red-500" />
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium">Interests</div>
            <div className="text-2xl font-semibold">{getNotificationCount('interest')}</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-3 rounded-lg border shadow-sm">
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-green-100">
            <Calendar className="h-5 w-5 text-green-500" />
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium">Date Requests</div>
            <div className="text-2xl font-semibold">{getNotificationCount('video_request')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationStats;
