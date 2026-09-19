
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { devAuthBypass } from '@/lib/devAuth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { hasServerSession, listNotifications } from '@/services/api';
import Logo from './header/Logo';
import DesktopNav from './header/DesktopNav';
import MobileNav from './header/MobileNav';
import UserMenu from './header/UserMenu';
import AuthButtons from './header/AuthButtons';
import MobileMenuButton from './header/MobileMenuButton';
import MobileUserMenu from './header/MobileUserMenu';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const navigate = useNavigate();
  const { signOut, isSignedIn } = useAuth();
  const { user: displayUser } = useCurrentUser();

  // Unread badge: poll the wired notification center every 30s while signed in.
  React.useEffect(() => {
    if (!hasServerSession()) return;
    let cancelled = false;
    const tick = () => {
      listNotifications().then((d) => {
        if (!cancelled && d) setUnreadCount(d.unreadCount);
      }).catch(() => {});
    };
    tick();
    const iv = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [isSignedIn]);

  // In dev-bypass mode (VITE_DEV_SKIP_AUTH=true) show the navigation even
  // though the user is not signed in.
  const showAppNav = isSignedIn || devAuthBypass;

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate('/');
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="bg-white shadow-md sticky top-0 z-50 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left Side: Logo & Navigation */}
          <div className="flex items-center gap-8">
            <Logo />
            {showAppNav && <DesktopNav />}
          </div>
          
          {/* Right Side: User Menu / Auth Buttons */}
          <div className="flex items-center">
            {showAppNav && (
              <>
                <button
                  onClick={() => navigate('/messages?tab=whats-new', { state: { activeTab: 'whats-new' } })}
                  className="relative mr-2 p-2 rounded-full hover:bg-slate-100 text-slate-600"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {/* Desktop user menu */}
                <div className="hidden md:block">
                  <UserMenu user={displayUser} onSignOut={handleSignOut} />
                </div>

                {/* Mobile menu button and user avatar */}
                <div className="md:hidden flex items-center">
                  <MobileUserMenu user={displayUser} />
                  <MobileMenuButton isOpen={isMenuOpen} onClick={toggleMenu} />
                </div>
              </>
            )}
            {!showAppNav && <AuthButtons />}
          </div>
        </div>
      </div>

      {/* Mobile navigation menu */}
      {showAppNav && (
        <MobileNav
          isOpen={isMenuOpen}
          onItemClick={closeMenu}
          onSignOut={handleSignOut}
        />
      )}
    </header>
  );
};

export default Header;
