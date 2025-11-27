
import React, { useState, useEffect, useRef } from 'react';
import { PlatformBanner } from '../types';

interface ClickableImageBannerProps {
    banners: PlatformBanner[];
    interval?: number;
}

const ClickableImageBanner: React.FC<ClickableImageBannerProps> = ({ banners, interval = 5000 }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const timeoutRef = useRef<any>(null);

    // Reset timer when index changes or pause state changes
    useEffect(() => {
        if (isPaused) {
            return;
        }
        
        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (banners.length > 1) {
            timeoutRef.current = setTimeout(() => {
                nextSlide();
            }, interval);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [currentIndex, banners.length, isPaused, interval]);

    if (!banners || banners.length === 0) {
        return null;
    }

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    };

    // Touch handlers for Swipe
    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        setIsPaused(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) {
            setIsPaused(false);
            return;
        }
        
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe) {
            nextSlide();
        } else if (isRightSwipe) {
            prevSlide();
        }
        
        setIsPaused(false);
    };

    return (
        <div 
            className="bg-gray-200 dark:bg-gray-900 p-2 relative group overflow-hidden"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <div className="relative w-full h-28 sm:h-32 md:h-40 overflow-hidden rounded-lg">
                <div 
                    className="flex transition-transform duration-500 ease-in-out h-full w-full"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {banners.map((banner, idx) => (
                        <div key={banner.id} className="min-w-full h-full flex-shrink-0 relative">
                            <a 
                                href={banner.targetUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                title={banner.title} 
                                className="block w-full h-full"
                            >
                                <img 
                                    src={banner.imageUrl} 
                                    alt={banner.title} 
                                    className="w-full h-full object-contain" 
                                    draggable="false"
                                />
                            </a>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Navigation Dots */}
            {banners.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
                    {banners.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => {
                                e.preventDefault();
                                setCurrentIndex(idx);
                            }}
                            className={`rounded-full transition-all duration-300 shadow-sm ${
                                idx === currentIndex 
                                    ? 'bg-white w-6 h-1.5 opacity-100' 
                                    : 'bg-white/50 w-1.5 h-1.5 hover:bg-white/80'
                            }`}
                            aria-label={`Go to banner ${idx + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Arrow Controls (Visible on Desktop Hover) */}
            {banners.length > 1 && (
                <>
                    <button 
                        onClick={(e) => { e.preventDefault(); prevSlide(); }}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button 
                        onClick={(e) => { e.preventDefault(); nextSlide(); }}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </>
            )}
        </div>
    );
};

export default ClickableImageBanner;
