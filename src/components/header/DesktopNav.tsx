
import React from 'react';
import NavItem from './NavItem';
import { 
  Heart, User, Star, Video, MessageSquare, Trophy, Calendar, HelpCircle, CreditCard
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const DesktopNav: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="hidden md:flex space-x-3">
      <NavItem 
        path="/matches" 
        icon={Heart} 
        label="Matches" 
        isActive={isActive('/matches')}
      />
      <NavItem 
        path="/search" 
        icon={User} 
        label="Search" 
        isActive={isActive('/search')}
      />
      <NavItem 
        path="/favorites" 
        icon={Star} 
        label="Favorites" 
        isActive={isActive('/favorites')}
      />
      <NavItem 
        path="/video-dates" 
        icon={Video} 
        label="Video Dates" 
        isActive={isActive('/video-dates')}
      />
      <NavItem 
        path="/messages" 
        icon={MessageSquare} 
        label="Messages" 
        isActive={isActive('/messages')}
      />
      <NavItem 
        path="/success-stories" 
        icon={Trophy} 
        label="Success Stories" 
        isActive={isActive('/success-stories')}
      />
      <NavItem 
        path="/plan" 
        icon={Calendar} 
        label="Plan" 
        isActive={isActive('/plan')}
      />
      <NavItem 
        path="/help" 
        icon={HelpCircle} 
        label="Help" 
        isActive={isActive('/help')}
      />
      <NavItem 
        path="/astrologer" 
        icon={CreditCard} 
        label="Astrologer" 
        isActive={isActive('/astrologer')}
      />
    </nav>
  );
};

export default DesktopNav;
