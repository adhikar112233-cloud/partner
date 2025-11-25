import React from 'react';
import { LogoIcon } from './Icons';

const SuccessPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border border-gray-100">
        <div className="flex justify-center mb-8">
          <LogoIcon className="h-16 w-auto" />
        </div>
        
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">Success!</h1>
        <p className="text-gray-600 mb-8 text-lg">Your action has been completed successfully.</p>
        
        <a 
          href="/" 
          className="block w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
};

export default SuccessPage;