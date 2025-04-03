
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Heart, Video, MessageSquare, User, CreditCard, Menu, X, Bell, LogOut
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { toast } from '@/hooks/use-toast';

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

  const userImage = user?.imageUrl || "https://randomuser.me/api/portraits/women/33.jpg";
  const userInitials = user?.firstName?.[0] ?? "" + user?.lastName?.[0] ?? "MR";

  return (
    <header className="bg-white shadow-md sticky top-0 z-50 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div 
              className="flex-shrink-0 flex items-center cursor-pointer"
              onClick={() => navigate('/')}
            >
              <span className="text-mediblue-600 font-bold text-2xl">MedicoMatch</span>
            </div>
          </div>
          
          {isSignedIn ? (
            <>
              {/* Desktop navigation */}
              <nav className="hidden md:flex space-x-4">
                <Button
                  variant="ghost"
                  className="flex items-center space-x-1 text-gray-600 hover:text-mediblue-600"
                  onClick={() => navigate('/matches')}
                >
                  <Heart size={18} />
                  <span>Matches</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex items-center space-x-1 text-gray-600 hover:text-mediblue-600"
                  onClick={() => navigate('/video-dates')}
                >
                  <Video size={18} />
                  <span>Video Dates</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex items-center space-x-1 text-gray-600 hover:text-mediblue-600"
                  onClick={() => navigate('/messages')}
                >
                  <MessageSquare size={18} />
                  <span>Messages</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex items-center space-x-1 text-gray-600 hover:text-mediblue-600"
                  onClick={() => navigate('/astrologer')}
                >
                  <CreditCard size={18} />
                  <span>Astrologer</span>
                </Button>
                
                <div className="flex items-center ml-4">
                  <Button
                    variant="ghost"
                    className="relative p-2 rounded-full text-gray-600 hover:text-mediblue-600 hover:bg-gray-100"
                  >
                    <Bell size={20} />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  </Button>
                  
                  <Avatar 
                    className="h-9 w-9 cursor-pointer ml-2 border-2 border-mediblue-100 hover:border-mediblue-300 transition-colors"
                    onClick={() => navigate('/profile')}
                  >
                    <AvatarImage src={userImage} />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                  
                  <Button
                    variant="ghost"
                    className="ml-2 p-2 rounded-full text-gray-600 hover:text-red-600 hover:bg-gray-100"
                    onClick={handleSignOut}
                    title="Sign out"
                  >
                    <LogOut size={20} />
                  </Button>
                </div>
              </nav>

              {/* Mobile menu button */}
              <div className="md:hidden flex items-center">
                <Avatar 
                  className="h-8 w-8 cursor-pointer mr-4 border-2 border-mediblue-100"
                  onClick={() => navigate('/profile')}
                >
                  <AvatarImage src={userImage} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                
                <button
                  className="text-gray-600 hover:text-mediblue-600 focus:outline-none"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="text-mediblue-600 border-mediblue-600"
                onClick={() => navigate('/sign-in')}
              >
                Sign In
              </Button>
              <Button
                className="bg-mediblue-600 hover:bg-mediblue-700 text-white"
                onClick={() => navigate('/sign-up')}
              >
                Sign Up
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu - updated to show icons with text in a grid */}
      {isMenuOpen && isSignedIn && (
        <div className="md:hidden bg-white pt-2 pb-4 px-4 shadow-lg animate-fade-in">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              className="flex items-center justify-start space-x-2 text-gray-600 hover:text-mediblue-600 text-sm"
              onClick={() => {
                navigate('/matches');
                setIsMenuOpen(false);
              }}
            >
              <Heart size={16} />
              <span className="truncate">Matches</span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center justify-start space-x-2 text-gray-600 hover:text-mediblue-600 text-sm"
              onClick={() => {
                navigate('/video-dates');
                setIsMenuOpen(false);
              }}
            >
              <Video size={16} />
              <span className="truncate">Video Dates</span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center justify-start space-x-2 text-gray-600 hover:text-mediblue-600 text-sm"
              onClick={() => {
                navigate('/messages');
                setIsMenuOpen(false);
              }}
            >
              <MessageSquare size={16} />
              <span className="truncate">Messages</span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center justify-start space-x-2 text-gray-600 hover:text-mediblue-600 text-sm"
              onClick={() => {
                navigate('/astrologer');
                setIsMenuOpen(false);
              }}
            >
              <CreditCard size={16} />
              <span className="truncate">Astrologer</span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center justify-start space-x-2 text-gray-600 hover:text-mediblue-600 text-sm"
              onClick={() => {
                navigate('/profile');
                setIsMenuOpen(false);
              }}
            >
              <User size={16} />
              <span>Profile</span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center justify-start space-x-2 text-red-500 hover:text-red-700 text-sm"
              onClick={() => {
                handleSignOut();
                setIsMenuOpen(false);
              }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
