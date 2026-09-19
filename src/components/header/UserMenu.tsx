
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LogOut } from 'lucide-react';

interface UserMenuProps {
  user: {
    imageUrl?: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null | undefined;
  onSignOut: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ user, onSignOut }) => {
  const navigate = useNavigate();

  // Notifications bell lives ONLY in Header.tsx (single server-driven badge ->
  // /messages?tab=whats-new). The old /notifications route was removed because
  // nothing linked to it and the whats-new view is the richer center.

  // The avatar uses the real identity (Clerk or the stored doctor profile).
  // When no photo is available it falls back to the initials, never a fake persona.
  const userImage = user?.imageUrl;
  const userInitials = ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).trim() || "MM";

  return (
    <div className="flex items-center ml-4">
      <Avatar
        className="h-9 w-9 cursor-pointer ml-2 border-2 border-mediblue-100 hover:border-mediblue-300 transition-colors"
        onClick={() => navigate('/profile')}
      >
        {userImage ? (
          <AvatarImage src={userImage} alt={user?.firstName || "User"} />
        ) : (
          <AvatarFallback>{userInitials}</AvatarFallback>
        )}
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
