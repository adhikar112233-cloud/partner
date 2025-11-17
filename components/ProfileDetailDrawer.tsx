import React from 'react';
import { ProfileData } from '../types';
import { MessagesIcon } from './Icons';

interface ProfileDetailDrawerProps {
  profile: ProfileData;
  onClose: () => void;
  onSendMessage: (profile: ProfileData) => void;
}

const ProfileDetailDrawer: React.FC<ProfileDetailDrawerProps> = ({ profile, onClose, onSendMessage }) => {
  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      ></div>
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-6 z-50 transform transition-transform translate-y-0">
        <div className="max-w-4xl mx-auto">
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                aria-label="Close profile details"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            <div className="flex items-center space-x-6">
                <img 
                    src={profile.avatar} 
                    alt={profile.name} 
                    className="w-20 h-20 rounded-full object-cover shadow-md"
                />
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-800">{profile.name}</h2>
                    <p className="text-sm text-gray-500">
                        {profile.role === 'influencer' ? `@${profile.handle}` : profile.companyName}
                    </p>
                    {profile.bio && (
                        <p className="text-sm text-gray-600 mt-2">{profile.bio}</p>
                    )}
                </div>
                <button
                    onClick={() => onSendMessage(profile)}
                    className="flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
                >
                    <MessagesIcon className="w-5 h-5 mr-2" />
                    Send Message
                </button>
            </div>
        </div>
      </div>
    </>
  );
};

export default ProfileDetailDrawer;