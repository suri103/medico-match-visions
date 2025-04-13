
import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface NavItemProps {
  path: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  className?: string;
  iconSize?: number;
}

const NavItem: React.FC<NavItemProps> = ({
  path,
  icon: Icon,
  label,
  isActive,
  onClick,
  className = '',
  iconSize = 18
}) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate(path);
    if (onClick) onClick();
  };
  
  return (
    <Button
      variant="ghost"
      className={`flex items-center space-x-1 ${isActive ? 'text-mediblue-600 bg-gray-100' : 'text-gray-600 hover:text-mediblue-600'} ${className}`}
      onClick={handleClick}
    >
      <Icon size={iconSize} />
      <span className="truncate">{label}</span>
    </Button>
  );
};

export default NavItem;
