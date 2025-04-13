
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { User } from '@clerk/clerk-react';

interface MobileUserMenuProps {
  user: User | null | undefined;
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
