
import React from 'react';
import NavItem from './NavItem';
import { 
  Heart, User, Star, Video, MessageSquare, Trophy, Calendar, HelpCircle, CreditCard, LogOut
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface MobileNavProps {
  isOpen: boolean;
  onItemClick: () => void;
  onSignOut: () => void;
}

const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onItemClick, onSignOut }) => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-16 left-0 right-0 bottom-0 z-50 md:hidden bg-white pt-2 pb-4 px-4 shadow-lg overflow-y-auto">
      <div className="grid grid-cols-2 gap-2">
        <NavItem 
          path="/matches" 
          icon={Heart} 
          label="Matches" 
          isActive={isActive('/matches')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="/search" 
          icon={User} 
          label="Search" 
          isActive={isActive('/search')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="/favorites" 
          icon={Star} 
          label="Favorites" 
          isActive={isActive('/favorites')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="/video-dates" 
          icon={Video} 
          label="Video Dates" 
          isActive={isActive('/video-dates')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="/messages" 
          icon={MessageSquare} 
          label="Messages" 
          isActive={isActive('/messages')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="/success-stories" 
          icon={Trophy} 
          label="Success Stories" 
          isActive={isActive('/success-stories')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="/plan" 
          icon={Calendar} 
          label="Plan" 
          isActive={isActive('/plan')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="/help" 
          icon={HelpCircle} 
          label="Help" 
          isActive={isActive('/help')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="/astrologer" 
          icon={CreditCard} 
          label="Astrologer" 
          isActive={isActive('/astrologer')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="/profile" 
          icon={User} 
          label="Profile" 
          isActive={isActive('/profile')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="#" 
          icon={LogOut} 
          label="Sign Out" 
          isActive={false} 
          onClick={onSignOut}
          className="flex items-center justify-start space-x-2 text-red-500 hover:text-red-700 text-sm"
          iconSize={16}
        />
      </div>
    </div>
  );
};

export default MobileNav;
