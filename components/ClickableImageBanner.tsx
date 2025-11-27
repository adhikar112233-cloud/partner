
import React, { useState, useEffect } from 'react';
import { PlatformBanner } from '../types';

interface ClickableImageBannerProps {
    banners: PlatformBanner[];
    interval?: number;
}

const ClickableImageBanner: React.FC<ClickableImageBannerProps> = ({ banners, interval = 5000 }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (banners.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % banners.length);
        }, interval);

        return () => clearInterval(timer);
    }, [banners.length, interval]);

    if (!banners || banners.length === 0) {
        return null;
    }

    const currentBanner = banners[currentIndex];

    return (
        <div className="bg-gray-200 dark:bg-gray-900 p-2 relative group">
            <div className="relative w-full h-full overflow-hidden">
                <a 
                    href={currentBanner.targetUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    title={currentBanner.title} 
                    className="block w-full h-full"
                >
                    {/* Key added to trigger animation on change */}
                    <img 
                        key={currentBanner.id}
                        src={currentBanner.imageUrl} 
                        alt={currentBanner.title} 
                        className="w-full h-auto object-contain max-h-28 sm:max-h-32 mx-auto animate-fade-in-down" 
                    />
                </a>
            </div>
            
            {/* Navigation Dots */}
            {banners.length > 1 && (
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1.5 z-10">
                    {banners.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => {
                                e.preventDefault();
                                setCurrentIndex(idx);
                            }}
                            className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${
                                idx === currentIndex 
                                    ? 'bg-white w-4 opacity-100' 
                                    : 'bg-white/50 w-1.5 hover:bg-white/80'
                            }`}
                            aria-label={`Go to banner ${idx + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClickableImageBanner;
