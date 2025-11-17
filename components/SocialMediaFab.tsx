import React, { useState } from 'react';
import { SocialMediaLink } from '../types';
import { ShareIcon, InstagramIcon, YoutubeIcon, XIcon, TiktokIcon, FacebookIcon, LinkedInIcon } from './Icons';

interface SocialMediaFabProps {
  links: SocialMediaLink[];
}

const getIconForPlatform = (platform: string) => {
    const lowerPlatform = platform.toLowerCase();
    const className = "w-6 h-6";
    if (lowerPlatform.includes('instagram')) return <InstagramIcon className={className} />;
    if (lowerPlatform.includes('youtube')) return <YoutubeIcon className={className} />;
    if (lowerPlatform.includes('x') || lowerPlatform.includes('twitter')) return <XIcon className={className} />;
    if (lowerPlatform.includes('tiktok')) return <TiktokIcon className={className} />;
    if (lowerPlatform.includes('facebook')) return <FacebookIcon className={className} />;
    if (lowerPlatform.includes('linkedin')) return <LinkedInIcon className={className} />;
    return <ShareIcon className={className} />; // Default icon
};

const SocialMediaFab: React.FC<SocialMediaFabProps> = ({ links }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!links || links.length === 0) {
        return null;
    }

    return (
        <>
            <div className="fixed bottom-6 left-6 z-50">
                {/* Links Modal/Popover */}
                {isOpen && (
                    <div className="absolute bottom-full mb-4 w-60 bg-white rounded-lg shadow-2xl p-4 border border-gray-200">
                        <h4 className="font-bold text-gray-800 mb-3 text-center">Follow Us</h4>
                        <ul className="space-y-3">
                            {links.map((link, index) => (
                                <li key={index}>
                                    <a 
                                        href={link.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors group"
                                    >
                                        <span className="text-gray-600 group-hover:text-indigo-600">{getIconForPlatform(link.platform)}</span>
                                        <span className="font-medium text-gray-700">{link.platform}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                
                {/* Floating Action Button */}
                <button
                    onClick={() => setIsOpen(prev => !prev)}
                    className="w-16 h-16 bg-gradient-to-br from-teal-400 to-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center transform hover:scale-105 transition-transform"
                    aria-label="Open social media links"
                >
                    <ShareIcon className="w-8 h-8" />
                </button>
            </div>
            {/* Overlay to close */}
            {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 z-40"></div>}
        </>
    );
};

export default SocialMediaFab;
