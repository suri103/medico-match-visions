
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Bell, LogOut } from 'lucide-react';

interface UserMenuProps {
  user: any; // Replace with any to fix the immediate error
  onSignOut: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  
  const userImage = user?.imageUrl || "https://randomuser.me/api/portraits/women/33.jpg";
  const userInitials = user?.firstName?.[0] ?? "" + user?.lastName?.[0] ?? "MR";

  return (
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
        <AvatarImage src={userImage} alt={user?.firstName || "User"} />
        <AvatarFallback>{userInitials}</AvatarFallback>
      </Avatar>
      
      <Button
        variant="ghost"
        className="ml-2 p-2 rounded-full text-gray-600 hover:text-red-600 hover:bg-gray-100"
        onClick={onSignOut}
        title="Sign out"
      >
        <LogOut size={20} />
      </Button>
    </div>
  );
};

export default UserMenu;
