import React from 'react';
import { Influencer, ProfileData } from '../types';
import { CollabIcon, MessagesIcon, InstagramIcon, YoutubeIcon, TiktokIcon, XIcon, SparklesIcon } from './Icons';

interface InfluencerCardProps {
  influencer: Influencer;
  onStartChat: (influencer: Influencer) => void;
  onSendCollabRequest: (influencer: Influencer) => void;
  onViewProfile: (profile: ProfileData) => void;
}

const Stat = ({ label, value }: { label: string, value: string | number }) => (
    <div className="text-center">
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
);

const SocialLinks: React.FC<{ links: string }> = ({ links }) => {
    const socialPlatforms = [
        { name: 'instagram', icon: <InstagramIcon className="w-5 h-5" />, color: "text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300" },
        { name: 'youtube', icon: <YoutubeIcon className="w-5 h-5" />, color: "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" },
        { name: 'tiktok', icon: <TiktokIcon className="w-5 h-5" />, color: "text-black hover:text-gray-700 dark:text-white dark:hover:text-gray-300" },
        { name: 'x.com', icon: <XIcon className="w-5 h-5" />, color: "text-gray-800 hover:text-black dark:text-gray-200 dark:hover:text-white" },
        { name: 'twitter', icon: <XIcon className="w-5 h-5" />, color: "text-gray-800 hover:text-black dark:text-gray-200 dark:hover:text-white" },
    ];

    const parsedLinks = links.split(',')
        .map(link => link.trim())
        .filter(link => link)
        .map(url => {
            const platform = socialPlatforms.find(p => url.toLowerCase().includes(p.name));
            return platform ? { ...platform, url } : null;
        })
        .filter(Boolean);

    if (parsedLinks.length === 0) return null;

    return (
        <div className="mt-4 flex items-center justify-center space-x-3">
            {parsedLinks.map((link, index) => (
                <a 
                    key={index} 
                    href={link!.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`transition-transform hover:scale-110 ${link!.color}`}
                    title={`Visit on ${link!.name}`}
                >
                    {link!.icon}
                </a>
            ))}
        </div>
    );
};


const InfluencerCard: React.FC<InfluencerCardProps> = ({ influencer, onStartChat, onSendCollabRequest, onViewProfile }) => {
  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
      {influencer.isBoosted && (
        <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full flex items-center shadow-md z-10">
          <SparklesIcon className="w-4 h-4 mr-1" /> Boosted
        </div>
      )}
      <div className="p-6 flex-grow flex flex-col">
        <div className="flex items-center space-x-4">
          <button onClick={() => onViewProfile({ 
              id: influencer.id, 
              name: influencer.name, 
              avatar: influencer.avatar, 
              role: 'influencer', 
              handle: influencer.handle, 
              bio: influencer.bio 
            })} 
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            aria-label={`View profile of ${influencer.name}`}
          >
            <img src={influencer.avatar} alt={influencer.name} className="w-16 h-16 rounded-full object-cover" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{influencer.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">@{influencer.handle}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-4 flex-grow">{influencer.bio}</p>
        
        {influencer.socialMediaLinks && <SocialLinks links={influencer.socialMediaLinks} />}
        
        <div className="mt-6 flex justify-around p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <Stat label="Followers" value={`${(influencer.followers / 1000).toFixed(1)}k`} />
            <Stat label="Niche" value={influencer.niche} />
            <Stat label="Eng. Rate" value={`${influencer.engagementRate}%`} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
            <button 
                onClick={() => onStartChat(influencer)}
                className="w-full flex items-center justify-center px-4 py-3 text-sm font-semibold text-indigo-600 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-all duration-300 dark:bg-gray-700 dark:text-indigo-300 dark:hover:bg-gray-600"
            >
                <MessagesIcon className="w-5 h-5 mr-2" />
                Message
            </button>
            <button 
                onClick={() => onSendCollabRequest(influencer)}
                className="w-full flex items-center justify-center px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
            >
                <CollabIcon className="w-5 h-5 mr-2" />
                Send Request
            </button>
        </div>
      </div>
    </div>
  );
};

export default InfluencerCard;