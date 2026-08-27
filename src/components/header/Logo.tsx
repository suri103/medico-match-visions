
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Logo: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div 
      className="flex-shrink-0 flex flex-col items-start cursor-pointer group select-none py-1"
      onClick={() => navigate('/')}
    >
      <div className="flex items-center">
        <span className="text-mediblue-600 font-bold text-[16px] sm:text-[18px] tracking-tight leading-none">
          MedicoMatch
        </span>
      </div>

      <div className="flex flex-col mt-0.5 w-fit">
        <span 
          className="text-rose-500 font-bold text-base sm:text-[17px] tracking-[0.22em] leading-none select-none inline-block pl-0.5"
          style={{ fontFamily: "'Dancing Script', 'Alex Brush', cursive" }}
        >
          Matrimony
        </span>
        {/* Balanced Bent / Curved Arc Underline (starts early, ends evenly) */}
        <svg 
          className="w-[96%] h-2.5 -mt-0.5 text-rose-500 overflow-visible -ml-0.5" 
          viewBox="0 0 100 8" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M 1 2 C 28 7.5, 72 7.5, 99 2" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
          />
        </svg>
      </div>
    </div>
  );
};

export default Logo;
