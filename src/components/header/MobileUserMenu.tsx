
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

interface MobileUserMenuProps {
  user: {
    imageUrl?: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null | undefined;
}

const MobileUserMenu: React.FC<MobileUserMenuProps> = ({ user }) => {
  const navigate = useNavigate();
  
  // Real identity (Clerk or stored doctor profile); initials when no photo.
  const userImage = user?.imageUrl;
  const userInitials = ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).trim() || "MM";

  return (
    <Avatar 
      className="h-8 w-8 cursor-pointer mr-4 border-2 border-mediblue-100"
      onClick={() => navigate('/profile')}
    >
      {userImage ? (
        <AvatarImage src={userImage} alt={user?.firstName || "User"} />
      ) : (
        <AvatarFallback>{userInitials}</AvatarFallback>
      )}
    </Avatar>
  );
};

export default MobileUserMenu;
