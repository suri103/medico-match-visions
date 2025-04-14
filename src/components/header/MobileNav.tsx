
import React from 'react';
import NavItem from './NavItem';
import { 
  Heart, User, Star, Video, MessageSquare, MoreHorizontal, LogOut,
  CreditCard, HelpCircle, Calendar, Users, Settings, UserHeart
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';

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
          path="/online" 
          icon={Users} 
          label="Online" 
          isActive={isActive('/online')} 
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
          path="/messages" 
          icon={MessageSquare} 
          label="Messages" 
          isActive={isActive('/messages')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        <NavItem 
          path="/video-dates" 
          icon={Video} 
          label="V-Dates" 
          isActive={isActive('/video-dates')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
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
          path="/astrologer" 
          icon={Star} 
          label="Astrology" 
          isActive={isActive('/astrologer')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-sm"
          iconSize={16}
        />
        
        {/* Connections Section */}
        <div className="col-span-2 mt-2">
          <h3 className="text-sm font-medium text-gray-500 px-2 py-1">Connections</h3>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <NavItem 
              path="/favorites" 
              icon={Star} 
              label="My Favorites" 
              isActive={isActive('/favorites')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-sm"
              iconSize={16}
            />
            <NavItem 
              path="/my-interests" 
              icon={Heart} 
              label="My Interests" 
              isActive={isActive('/my-interests')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-sm"
              iconSize={16}
            />
            <NavItem 
              path="/interested-in-you" 
              icon={UserHeart} 
              label="Interested in You" 
              isActive={isActive('/interested-in-you')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-sm w-full"
              iconSize={16}
            />
          </div>
        </div>
        
        {/* More Section */}
        <div className="col-span-2 mt-2">
          <h3 className="text-sm font-medium text-gray-500 px-2 py-1">More</h3>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <NavItem 
              path="/profile" 
              icon={User} 
              label="My Profile" 
              isActive={isActive('/profile')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-sm"
              iconSize={16}
            />
            <NavItem 
              path="/account" 
              icon={Settings} 
              label="My Account" 
              isActive={isActive('/account')} 
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
              path="/events" 
              icon={Calendar} 
              label="Meets & Events" 
              isActive={isActive('/events')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-sm"
              iconSize={16}
            />
            <NavItem 
              path="/plan" 
              icon={CreditCard} 
              label="Club Plan" 
              isActive={isActive('/plan')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-sm"
              iconSize={16}
            />
          </div>
        </div>
        
        <NavItem 
          path="#" 
          icon={LogOut} 
          label="Sign Out" 
          isActive={false} 
          onClick={onSignOut}
          className="flex items-center justify-start space-x-2 text-red-500 hover:text-red-700 text-sm col-span-2 mt-2"
          iconSize={16}
        />
      </div>
    </div>
  );
};

export default MobileNav;
