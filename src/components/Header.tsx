
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { toast } from '@/hooks/use-toast';

import Logo from './header/Logo';
import DesktopNav from './header/DesktopNav';
import MobileNav from './header/MobileNav';
import UserMenu from './header/UserMenu';
import AuthButtons from './header/AuthButtons';
import MobileMenuButton from './header/MobileMenuButton';
import MobileUserMenu from './header/MobileUserMenu';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user, isSignedIn } = useUser();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate('/sign-in');
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="bg-white shadow-md sticky top-0 z-50 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Logo />
          </div>
          
          {isSignedIn ? (
            <>
              {/* Desktop navigation */}
              <DesktopNav />

              {/* Desktop user menu */}
              <div className="hidden md:block">
                <UserMenu user={user} onSignOut={handleSignOut} />
              </div>

              {/* Mobile menu button and user avatar */}
              <div className="md:hidden flex items-center">
                <MobileUserMenu user={user} />
                <MobileMenuButton isOpen={isMenuOpen} onClick={toggleMenu} />
              </div>
            </>
          ) : (
            <AuthButtons />
          )}
        </div>
      </div>

      {/* Mobile navigation menu */}
      {isSignedIn && (
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
