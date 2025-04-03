
import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Heart, Video, MessageSquare, User, CreditCard, Menu, X 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-mediblue-600 font-bold text-2xl">MedicoMatch</span>
            </div>
          </div>
          
          {/* Desktop navigation */}
          <nav className="hidden md:flex space-x-6">
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
              <span>Consult Astrologer</span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center space-x-1 text-gray-600 hover:text-mediblue-600"
              onClick={() => navigate('/profile')}
            >
              <User size={18} />
              <span>Profile</span>
            </Button>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              className="text-gray-600 hover:text-mediblue-600 focus:outline-none"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white pt-2 pb-4 px-4 shadow-lg animate-fade-in">
          <div className="flex flex-col space-y-2">
            <Button
              variant="ghost"
              className="flex items-center space-x-2 text-gray-600 hover:text-mediblue-600 justify-start"
              onClick={() => {
                navigate('/matches');
                setIsMenuOpen(false);
              }}
            >
              <Heart size={18} />
              <span>Matches</span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center space-x-2 text-gray-600 hover:text-mediblue-600 justify-start"
              onClick={() => {
                navigate('/video-dates');
                setIsMenuOpen(false);
              }}
            >
              <Video size={18} />
              <span>Video Dates</span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center space-x-2 text-gray-600 hover:text-mediblue-600 justify-start"
              onClick={() => {
                navigate('/messages');
                setIsMenuOpen(false);
              }}
            >
              <MessageSquare size={18} />
              <span>Messages</span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center space-x-2 text-gray-600 hover:text-mediblue-600 justify-start"
              onClick={() => {
                navigate('/astrologer');
                setIsMenuOpen(false);
              }}
            >
              <CreditCard size={18} />
              <span>Consult Astrologer</span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center space-x-2 text-gray-600 hover:text-mediblue-600 justify-start"
              onClick={() => {
                navigate('/profile');
                setIsMenuOpen(false);
              }}
            >
              <User size={18} />
              <span>Profile</span>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
