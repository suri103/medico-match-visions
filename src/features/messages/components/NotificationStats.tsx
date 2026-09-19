import React from 'react';
import { Bell, Calendar, Eye, Heart } from 'lucide-react';

interface NotificationStatsProps {
  getNotificationCount: (type: string) => number;
  activeFilter?: string | null;
  onSelectFilter?: (type: string | null) => void;
}

const NotificationStats: React.FC<NotificationStatsProps> = ({ 
  getNotificationCount,
  activeFilter,
  onSelectFilter
}) => {
  const handleClick = (type: string) => {
    if (!onSelectFilter) return;
    if (activeFilter === type) {
      onSelectFilter(null);
    } else {
      onSelectFilter(type);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <button
        type="button"
        title="View all messages"
        aria-label="View all messages"
        onClick={() => handleClick('message')}
        className={`text-left p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
          activeFilter === 'message' 
            ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-400/30' 
            : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-blue-100 shrink-0">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div className="ml-3 min-w-0">
            <div className="text-xs text-slate-500 font-medium truncate">New Messages</div>
            <div className="text-xl font-bold text-slate-800">{getNotificationCount('message')}</div>
          </div>
        </div>
      </button>
      
      <button
        type="button"
        title="View all profile views"
        aria-label="View all profile views"
        onClick={() => handleClick('profile_view')}
        className={`text-left p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
          activeFilter === 'profile_view' 
            ? 'bg-sky-50/80 border-sky-500 ring-2 ring-sky-400/30' 
            : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-sky-100 shrink-0">
            <Eye className="h-5 w-5 text-sky-600" />
          </div>
          <div className="ml-3 min-w-0">
            <div className="text-xs text-slate-500 font-medium truncate">Profile Views</div>
            <div className="text-xl font-bold text-slate-800">{getNotificationCount('profile_view')}</div>
          </div>
        </div>
      </button>
      
      <button
        type="button"
        title="View all interests"
        aria-label="View all interests"
        onClick={() => handleClick('interest')}
        className={`text-left p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
          activeFilter === 'interest' 
            ? 'bg-red-50/80 border-red-500 ring-2 ring-red-400/30' 
            : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-red-100 shrink-0">
            <Heart className="h-5 w-5 text-red-600" />
          </div>
          <div className="ml-3 min-w-0">
            <div className="text-xs text-slate-500 font-medium truncate">Interests</div>
            <div className="text-xl font-bold text-slate-800">{getNotificationCount('interest')}</div>
          </div>
        </div>
      </button>
      
      <button
        type="button"
        title="View all date requests"
        aria-label="View all date requests"
        onClick={() => handleClick('video_request')}
        className={`text-left p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
          activeFilter === 'video_request' 
            ? 'bg-green-50/80 border-green-500 ring-2 ring-green-400/30' 
            : 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center">
          <div className="p-2 rounded-full bg-green-100 shrink-0">
            <Calendar className="h-5 w-5 text-green-600" />
          </div>
          <div className="ml-3 min-w-0">
            <div className="text-xs text-slate-500 font-medium truncate">Date Requests</div>
            <div className="text-xl font-bold text-slate-800">{getNotificationCount('video_request')}</div>
          </div>
        </div>
      </button>
    </div>
  );
};

export default NotificationStats;
