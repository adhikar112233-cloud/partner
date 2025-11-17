import React from 'react';
import { LogoIcon } from './Icons';

interface PublicHeaderProps {
  onLoginClick: () => void;
}

const PublicHeader: React.FC<PublicHeaderProps> = ({ onLoginClick }) => {
  return (
    <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center">
         <LogoIcon />
      </div>
      <div className="flex items-center space-x-4">
        <button 
            onClick={onLoginClick} 
            className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
        >
            Login / Sign Up
        </button>
      </div>
    </header>
  );
};

export default PublicHeader;
