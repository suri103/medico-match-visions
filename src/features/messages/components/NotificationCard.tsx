import React from 'react';
import { Bell, Calendar, Eye, Heart, MessageSquare, Video, CheckCircle, MapPin, Stethoscope } from 'lucide-react';
import { Notification } from '../hooks/useNotifications';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatMessageTime } from '../utils/formatTime';
import { useNavigate } from 'react-router-dom';
import { useFavoritesContext } from '@/features/favorites/FavoritesContext';
import { useToast } from '@/hooks/use-toast';
import { doctorProfiles } from '@/features/matches/data/sampleData';

import { useMessages } from '../hooks/useMessages';

interface NotificationCardProps {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ 
  notification, 
  onMarkRead,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sendInterest, passInterest, isFavorite, connections } = useFavoritesContext();
  const { ensureChat } = useMessages();

  const doctorId = notification.doctorId || (
    doctorProfiles.find(d => d.name.toLowerCase().includes(notification.from.toLowerCase()))?.id || '1'
  );

  const matchedDoctor = doctorProfiles.find(d => d.id === doctorId) || {
    id: doctorId,
    name: notification.from,
    age: 32,
    specialty: notification.specialty || 'General Practitioner',
    hospital: notification.hospital || 'Medical Center',
    city: notification.city || 'City',
    state: 'State',
    country: 'India',
    imageUrl: notification.imageUrl,
    matchPercentage: 90,
    interests: ['Medicine', 'Reading'],
    isOnline: true,
    sexualOrientation: 'Straight'
  };

  const isAlreadyInterested = isFavorite(doctorId);
  const isConnected = connections.some(c => c.doctorId === doctorId && c.status === 'matched');

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'profile_view':
        return <Eye className="h-4 w-4 text-sky-500" />;
      case 'interest':
        return <Heart className="h-4 w-4 text-red-500 fill-red-500" />;
      case 'video_request':
        return <Calendar className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  const handleSendInterest = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead?.(notification.id);
    void sendInterest(matchedDoctor);
    toast({
      title: "Interest Sent!",
      description: `You expressed interest in Dr. ${notification.from}. They have been notified.`
    });
  };

  const handleAcceptInterest = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead?.(notification.id);
    void sendInterest(matchedDoctor);
    toast({
      title: "Connection Accepted!",
      description: `You are now connected with Dr. ${notification.from}. You can start chatting.`
    });
  };

  const handlePass = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead?.(notification.id);
    passInterest(doctorId);
    toast({
      title: "Passed",
      description: `Passed on connecting with Dr. ${notification.from}.`
    });
  };

  const handleOpenChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead?.(notification.id);
    ensureChat(doctorId, {
      name: notification.from,
      specialty: notification.specialty,
      imageUrl: notification.imageUrl,
    });
    void navigate('/messages', { 
      state: { 
        openChatId: doctorId, 
        activeTab: 'messages',
        doctorName: notification.from,
        doctorImage: notification.imageUrl,
        doctorSpecialty: notification.specialty,
      } 
    });
  };

  const handleVideoDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead?.(notification.id);
    void navigate('/video-dates');
  };

  const handleCardClick = () => {
    onMarkRead?.(notification.id);
    void navigate(`/doctor/${doctorId}`, {
      state: {
        returnTo: '/messages?tab=whats-new',
        returnTab: 'whats-new',
        fromPage: "What's New",
      }
    });
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
        notification.read ? 'bg-white border-slate-200' : 'bg-blue-50/70 border-blue-200 shadow-sm'
      }`}
    >
      <div className="flex items-start space-x-3">
        <Avatar className="h-12 w-12 shrink-0 border-2 border-white shadow-sm">
          <img src={notification.imageUrl} alt={notification.from} className="object-cover" />
        </Avatar>
        
        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-baseline gap-2">
            <h4 className="font-semibold text-gray-900 truncate text-sm md:text-base">
              Dr. {notification.from}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <span className="text-[11px] text-gray-400">
                {formatMessageTime(notification.timestamp)}
              </span>
              {!notification.read && (
                <button
                  type="button"
                  title="Mark as read"
                  className="text-[10px] font-medium text-mediblue-700 hover:text-mediblue-900 px-2 py-0.5 rounded-full bg-blue-100/70 hover:bg-blue-200 transition-colors shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead?.(notification.id);
                  }}
                >
                  Mark read
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="shrink-0">{getNotificationIcon(notification.type)}</span>
            <p className="text-xs text-gray-600 truncate">{notification.content}</p>
          </div>

          {(notification.specialty || notification.city) && (
            <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
              {notification.specialty && (
                <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                  <Stethoscope size={11} className="text-mediblue-600" />
                  {notification.specialty}
                </span>
              )}
              {notification.city && (
                <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                  <MapPin size={11} className="text-slate-500" />
                  {notification.city}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Real contextual response buttons */}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
        {notification.type === 'profile_view' && (
          <>
            {isConnected ? (
              <Button size="sm" variant="outline" className="flex-1 min-w-[100px] text-xs h-8 text-green-700 bg-green-50" onClick={handleOpenChat}>
                <MessageSquare size={13} className="mr-1.5 text-green-600" />
                Chat Now
              </Button>
            ) : isAlreadyInterested ? (
              <>
                <Badge variant="outline" className="text-xs text-mediblue-700 bg-blue-50 py-1 px-3">
                  <CheckCircle size={12} className="mr-1 text-mediblue-600" />
                  Interest Sent
                </Badge>
                <Button size="sm" variant="ghost" className="text-xs h-8 text-mediblue-600 hover:bg-blue-50" onClick={handleOpenChat}>
                  <MessageSquare size={13} className="mr-1.5" />
                  Chat
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" className="flex-1 min-w-[120px] text-xs h-8 bg-mediblue-600 hover:bg-mediblue-700" onClick={handleSendInterest}>
                  <Heart size={13} className="mr-1.5" />
                  Express Interest
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-8 text-mediblue-600 hover:bg-blue-50" onClick={handleOpenChat}>
                  <MessageSquare size={13} className="mr-1.5" />
                  Chat
                </Button>
              </>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-8" 
              onClick={(e) => { 
                e.stopPropagation(); 
                onMarkRead?.(notification.id);
                void navigate(`/doctor/${doctorId}`, {
                  state: {
                    returnTo: '/messages?tab=whats-new',
                    returnTab: 'whats-new',
                    fromPage: "What's New",
                  }
                }); 
              }}
            >
              View Profile
            </Button>
          </>
        )}

        {notification.type === 'interest' && (
          <>
            <Button size="sm" className="flex-1 min-w-[130px] text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white" onClick={handleAcceptInterest}>
              <Heart size={13} className="mr-1.5 fill-white" />
              Accept & Connect
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-8 text-slate-600" onClick={handlePass}>
              Pass
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-8 text-mediblue-600 hover:bg-blue-50" onClick={handleOpenChat}>
              <MessageSquare size={13} className="mr-1" />
              Chat
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-8" 
              onClick={(e) => { 
                e.stopPropagation(); 
                onMarkRead?.(notification.id);
                void navigate(`/doctor/${doctorId}`, {
                  state: {
                    returnTo: '/messages?tab=whats-new',
                    returnTab: 'whats-new',
                    fromPage: "What's New",
                  }
                }); 
              }}
            >
              View Profile
            </Button>
          </>
        )}

        {notification.type === 'message' && (
          <>
            <Button size="sm" className="flex-1 text-xs h-8 bg-mediblue-600 hover:bg-mediblue-700" onClick={handleOpenChat}>
              <MessageSquare size={13} className="mr-1.5" />
              Reply in Chat
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-8" 
              onClick={(e) => { 
                e.stopPropagation(); 
                onMarkRead?.(notification.id);
                void navigate(`/doctor/${doctorId}`, {
                  state: {
                    returnTo: '/messages?tab=whats-new',
                    returnTab: 'whats-new',
                    fromPage: "What's New",
                  }
                }); 
              }}
            >
              View Profile
            </Button>
          </>
        )}

        {notification.type === 'video_request' && (
          <>
            <Button size="sm" className="flex-1 min-w-[120px] text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleVideoDate}>
              <Video size={13} className="mr-1.5" />
              Join Video Date
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={handleVideoDate}>
              Reschedule
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-8 text-mediblue-600 hover:bg-blue-50" onClick={handleOpenChat}>
              <MessageSquare size={13} className="mr-1" />
              Chat
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-8" 
              onClick={(e) => { 
                e.stopPropagation(); 
                onMarkRead?.(notification.id);
                void navigate(`/doctor/${doctorId}`, {
                  state: {
                    returnTo: '/messages?tab=whats-new',
                    returnTab: 'whats-new',
                    fromPage: "What's New",
                  }
                }); 
              }}
            >
              View Profile
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationCard;
