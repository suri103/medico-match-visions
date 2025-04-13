
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

interface MobileUserMenuProps {
  user: any; // Replace with any to fix the immediate error
}

const MobileUserMenu: React.FC<MobileUserMenuProps> = ({ user }) => {
  const navigate = useNavigate();
  
  const userImage = user?.imageUrl || "https://randomuser.me/api/portraits/women/33.jpg";
  const userInitials = user?.firstName?.[0] ?? "" + user?.lastName?.[0] ?? "MR";

  return (
    <Avatar 
      className="h-8 w-8 cursor-pointer mr-4 border-2 border-mediblue-100"
      onClick={() => navigate('/profile')}
    >
      <AvatarImage src={userImage} alt={user?.firstName || "User"} />
      <AvatarFallback>{userInitials}</AvatarFallback>
    </Avatar>
  );
};

export default MobileUserMenu;
