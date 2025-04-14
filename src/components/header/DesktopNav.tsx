
import React from 'react';
import NavItem from './NavItem';
import { 
  Heart, User, Star, Video, MessageSquare, Users, 
  CreditCard, HelpCircle, Calendar, MoreHorizontal,
  Settings, BookOpen, Info, DollarSign, UserHeart
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

const DesktopNav: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="hidden md:flex space-x-3">
      <NavItem 
        path="/online" 
        icon={Users} 
        label="Online" 
        isActive={isActive('/online')}
      />
      <NavItem 
        path="/search" 
        icon={User} 
        label="Search" 
        isActive={isActive('/search')}
      />
      <NavItem 
        path="/messages" 
        icon={MessageSquare} 
        label="Messages" 
        isActive={isActive('/messages')}
      />
      <NavItem 
        path="/video-dates" 
        icon={Video} 
        label="V-Dates" 
        isActive={isActive('/video-dates')}
      />
      
      {/* Connections Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className={`flex items-center space-x-1 ${
              isActive('/favorites') || isActive('/my-interests') || isActive('/interested-in-you') 
              ? 'text-mediblue-600 bg-gray-100' 
              : 'text-gray-600 hover:text-mediblue-600'
            }`}
          >
            <UserHeart size={18} />
            <span className="truncate">Connections</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48 bg-white shadow-md">
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/favorites'}>
            <Star className="mr-2 h-4 w-4" />
            <span>My Favorites</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/my-interests'}>
            <Heart className="mr-2 h-4 w-4" />
            <span>My Interests</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/interested-in-you'}>
            <Heart className="mr-2 h-4 w-4" />
            <span>Interested in You</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NavItem 
        path="/matches" 
        icon={Heart} 
        label="Matches" 
        isActive={isActive('/matches')}
      />
      <NavItem 
        path="/astrologer" 
        icon={Star} 
        label="Astrology" 
        isActive={isActive('/astrologer')}
      />

      {/* More Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className={`flex items-center space-x-1 ${
              isActive('/profile') || isActive('/account') || isActive('/help') || isActive('/events')
              ? 'text-mediblue-600 bg-gray-100' 
              : 'text-gray-600 hover:text-mediblue-600'
            }`}
          >
            <MoreHorizontal size={18} />
            <span className="truncate">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-white shadow-md">
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/profile'}>
            <User className="mr-2 h-4 w-4" />
            <span>My Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/account'}>
            <Settings className="mr-2 h-4 w-4" />
            <span>My Account</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/help'}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Help</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/events'}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Meets & Events</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/plan'}>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Club Plan</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
};

export default DesktopNav;
