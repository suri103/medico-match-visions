
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const AuthButtons: React.FC = () => {
  const navigate = useNavigate();
  
  return (
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
  );
};

export default AuthButtons;
