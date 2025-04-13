
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Logo: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div 
      className="flex-shrink-0 flex items-center cursor-pointer"
      onClick={() => navigate('/')}
    >
      <span className="text-mediblue-600 font-bold text-2xl">MedicoMatch</span>
    </div>
  );
};

export default Logo;
