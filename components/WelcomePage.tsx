import React from 'react';
import { IndianFlagIcon, LogoIcon } from './Icons';
import { PlatformSettings } from '../types';

interface WelcomePageProps {
    settings: PlatformSettings;
    onLoginClick: () => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ settings, onLoginClick }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
            <IndianFlagIcon className="w-20 h-auto mb-4" />
            <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-xl max-w-3xl w-full">
                <div className="flex justify-center w-full mb-6">
                    <LogoIcon showTagline={true} className="h-16 w-auto" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 mt-4">
                    A New Era of Collaboration
                </h1>
                <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
                    {settings.welcomeMessage}
                </p>
                <button
                    onClick={onLoginClick}
                    className="mt-10 w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                >
                    Get Started
                </button>
            </div>
        </div>
    );
};

export default WelcomePage;