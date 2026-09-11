import React from 'react';
import NavItem from './NavItem';
import { 
  Heart, User, Star, Video, MessageSquare, Users, 
  CreditCard, HelpCircle, Calendar, MoreHorizontal,
  Settings, UsersRound, Bookmark, Sparkles
} from 'lucide-react';
import { astrologyEnabled } from '@/lib/features';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  
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
        state={{ activeTab: 'messages' }}
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
              isActive('/favorites') || isActive('/saved-matches') || isActive('/my-interests') || isActive('/interested-in-you') 
              ? 'text-mediblue-600 bg-gray-100' 
              : 'text-gray-600 hover:text-mediblue-600'
            }`}
          >
            <UsersRound size={18} />
            <span className="truncate">Connections</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-52 bg-white shadow-md">
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/favorites')}>
            <Star className="mr-2 h-4 w-4 text-amber-500 fill-amber-500" />
            <span>My Favorites</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/saved-matches')}>
            <Bookmark className="mr-2 h-4 w-4 text-mediblue-600 fill-mediblue-600" />
            <span>Saved Matches</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/my-interests')}>
            <Heart className="mr-2 h-4 w-4 text-rose-500 fill-rose-500" />
            <span>My Interests</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/interested-in-you')}>
            <Heart className="mr-2 h-4 w-4 text-rose-500" />
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
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/profile')}>
            <User className="mr-2 h-4 w-4" />
            <span>My Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/account')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>My Account</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/help')}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Help</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/events')}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Meets & Events</span>
          </DropdownMenuItem>
          {astrologyEnabled && (
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/astrology')}>
              <Sparkles className="mr-2 h-4 w-4 text-purple-600" />
              <span>Astrology Consultation</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/plan')}>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Club Plan</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
};

export default DesktopNav;
