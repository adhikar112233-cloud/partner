import React from 'react';
import { IndianFlagIcon, LogoIcon } from './Icons';
import { PlatformSettings, User } from '../types';

interface PostLoginWelcomePageProps {
    user: User;
    settings: PlatformSettings;
    onContinue: () => void;
}

const PostLoginWelcomePage: React.FC<PostLoginWelcomePageProps> = ({ user, settings, onContinue }) => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center text-center p-6">
            <IndianFlagIcon className="w-20 h-auto mb-4" />
            <div className="bg-white dark:bg-gray-800 p-8 sm:p-12 rounded-2xl shadow-xl max-w-3xl w-full">
                <div className="flex justify-center w-full mb-6">
                    <LogoIcon showTagline={true} className="h-16 w-auto" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 dark:text-gray-100 mt-4">
                    Welcome, {user.name}!
                </h1>
                <p className="mt-4 text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                    {settings.welcomeMessage}
                </p>
                <button
                    onClick={onContinue}
                    className="mt-10 w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                >
                    Continue to Dashboard
                </button>
            </div>
        </div>
    );
};

export default PostLoginWelcomePage;