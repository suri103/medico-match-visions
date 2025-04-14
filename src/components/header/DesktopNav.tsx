
import React from 'react';
import NavItem from './NavItem';
import { 
  Heart, User, Star, Video, MessageSquare, Trophy, 
  CreditCard, HelpCircle, Calendar, MoreHorizontal
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="flex items-center space-x-1 text-gray-600 hover:text-mediblue-600"
          >
            <MoreHorizontal size={18} />
            <span className="truncate">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-white shadow-md">
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/plan'}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Club Plan</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/help'}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Help</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/astrologer'}>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Astrologer</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
};

export default DesktopNav;
