
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Bell, LogOut } from 'lucide-react';
import { useNotifications } from '@/features/messages/hooks/useNotifications';

interface UserMenuProps {
  user: {
    imageUrl?: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null | undefined;
  onSignOut: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { notifications } = useNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  // The avatar uses the real identity (Clerk or the stored doctor profile).
  // When no photo is available it falls back to the initials, never a fake persona.
  const userImage = user?.imageUrl;
  const userInitials = ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).trim() || "MM";

  return (
    <div className="flex items-center ml-4">
      <Button
        variant="ghost"
        className="relative p-2 rounded-full text-gray-600 hover:text-mediblue-600 hover:bg-gray-100"
        onClick={() => navigate('/messages?tab=whats-new', { state: { activeTab: 'whats-new' } })}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
      
      <Avatar 
        className="h-9 w-9 cursor-pointer ml-2 border-2 border-mediblue-100 hover:border-mediblue-300 transition-colors"
        onClick={() => navigate('/profile')}
      >
        {userImage ? (
          <AvatarImage src={userImage} alt={user?.firstName || "User"} />
        ) : (
          <AvatarFallback>{userInitials}</AvatarFallback>
        )}
      </Avatar>
      
      <Button
        variant="ghost"
        className="ml-2 p-2 rounded-full text-gray-600 hover:text-red-600 hover:bg-gray-100"
        onClick={onSignOut}
        title="Sign out"
      >
        <LogOut size={20} />
      </Button>
    </div>
  );
};

export default UserMenu;
