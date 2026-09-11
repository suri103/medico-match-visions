
import React from 'react';
import NavItem from './NavItem';
import { 
  Heart, User, Star, Video, MessageSquare, LogOut,
  CreditCard, HelpCircle, Calendar, Users, Settings, UsersRound, Bookmark, Sparkles
} from 'lucide-react';
import { astrologyEnabled } from '@/lib/features';
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
    <div className="fixed top-16 left-0 right-0 bottom-0 z-50 md:hidden bg-white/95 backdrop-blur-md pt-3 pb-8 px-4 shadow-xl overflow-y-auto border-t border-slate-200 animate-fade-in">
      <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
        <NavItem 
          path="/online" 
          icon={Users} 
          label="Online" 
          isActive={isActive('/online')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
          iconSize={16}
        />
        <NavItem 
          path="/search" 
          icon={User} 
          label="Search" 
          isActive={isActive('/search')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
          iconSize={16}
        />
        <NavItem 
          path="/messages" 
          icon={MessageSquare} 
          label="Messages" 
          isActive={isActive('/messages')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
          iconSize={16}
          state={{ activeTab: 'messages' }}
        />
        <NavItem 
          path="/video-dates" 
          icon={Video} 
          label="V-Dates" 
          isActive={isActive('/video-dates')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
          iconSize={16}
        />
        <NavItem 
          path="/matches" 
          icon={Heart} 
          label="Matches" 
          isActive={isActive('/matches')} 
          onClick={onItemClick}
          className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
          iconSize={16}
        />
        
        {/* Connections Section */}
        <div className="col-span-2 mt-3 pt-2 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 py-1">Connections</h3>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <NavItem 
              path="/favorites" 
              icon={Star} 
              label="My Favorites" 
              isActive={isActive('/favorites')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
              iconSize={16}
            />
            <NavItem 
              path="/saved-matches" 
              icon={Bookmark} 
              label="Saved Matches" 
              isActive={isActive('/saved-matches')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
              iconSize={16}
            />
            <NavItem 
              path="/my-interests" 
              icon={Heart} 
              label="My Interests" 
              isActive={isActive('/my-interests')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
              iconSize={16}
            />
            <NavItem 
              path="/interested-in-you" 
              icon={UsersRound} 
              label="Interested in You" 
              isActive={isActive('/interested-in-you')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl w-full"
              iconSize={16}
            />
          </div>
        </div>
        
        {/* More Section */}
        <div className="col-span-2 mt-3 pt-2 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 py-1">More & Account</h3>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <NavItem 
              path="/profile" 
              icon={User} 
              label="My Profile" 
              isActive={isActive('/profile')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
              iconSize={16}
            />
            <NavItem 
              path="/account" 
              icon={Settings} 
              label="My Account" 
              isActive={isActive('/account')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
              iconSize={16}
            />
            <NavItem 
              path="/help" 
              icon={HelpCircle} 
              label="Help & FAQs" 
              isActive={isActive('/help')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
              iconSize={16}
            />
            <NavItem 
              path="/events" 
              icon={Calendar} 
              label="Meets & Events" 
              isActive={isActive('/events')} 
              onClick={onItemClick}
              className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
              iconSize={16}
            />
            {astrologyEnabled && (
              <NavItem 
                path="/astrology" 
                icon={Sparkles} 
                label="Astrology" 
                isActive={isActive('/astrology')} 
                onClick={onItemClick}
                className="flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl"
                iconSize={16}
              />
            )}
            <NavItem 
              path="/plan" 
              icon={CreditCard} 
              label="Membership Plan" 
              isActive={isActive('/plan')} 
              onClick={onItemClick}
              className={`flex items-center justify-start space-x-2 text-xs sm:text-sm h-10 px-3 rounded-xl ${astrologyEnabled ? '' : 'col-span-2'}`}
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
          className="flex items-center justify-start space-x-2 text-red-500 hover:text-red-700 text-xs sm:text-sm col-span-2 mt-3 h-10 px-3 rounded-xl"
          iconSize={16}
        />
      </div>
    </div>
  );
};

export default MobileNav;
