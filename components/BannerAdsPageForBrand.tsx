import React, { useState, useEffect } from 'react';
import { User, BannerAd, ConversationParticipant, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { MessagesIcon, SparklesIcon } from './Icons';
import BannerAdBookingModal from './BannerAdBookingModal';

interface BannerAdsPageForBrandProps {
    user: User;
    platformSettings: PlatformSettings;
    onStartChat: (participant: ConversationParticipant) => void;
}

const BannerAdCard: React.FC<{ 
    ad: BannerAd; 
    onBookNow: (ad: BannerAd) => void;
    onMessage: (ad: BannerAd) => void;
}> = ({ ad, onBookNow, onMessage }) => {
    return (
        <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col transform hover:-translate-y-1 transition-transform duration-300">
            {ad.isBoosted && (
                <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full flex items-center shadow-md z-10">
                    <SparklesIcon className="w-4 h-4 mr-1" /> Boosted
                </div>
            )}
            <img src={ad.photoUrl} alt={`Ad space in ${ad.location}`} className="w-full h-48 object-cover"/>
            <div className="p-5 flex-grow flex flex-col">
                <h3 className="text-lg font-bold text-gray-800">{ad.location}</h3>
                <p className="text-sm text-gray-500">{ad.address}</p>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><span className="font-semibold text-gray-500">Type:</span> {ad.bannerType}</div>
                    <div><span className="font-semibold text-gray-500">Size:</span> {ad.size}</div>
                </div>
                <div className="mt-4 flex-grow"></div>
                <div className="pt-4 border-t border-gray-200">
                    <p className="text-lg font-bold text-indigo-600 text-center">
                        ₹{(ad.feePerDay || 0).toLocaleString('en-IN')} <span className="text-sm font-normal text-gray-500">/ day</span>
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <button onClick={() => onMessage(ad)} className="w-full flex items-center justify-center px-4 py-3 text-sm font-semibold text-indigo-600 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-colors">
                           <MessagesIcon className="w-5 h-5 mr-2" /> Message
                        </button>
                        <button onClick={() => onBookNow(ad)} className="w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-colors">
                            Book Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const BannerAdsPageForBrand: React.FC<BannerAdsPageForBrandProps> = ({ user, platformSettings, onStartChat }) => {
    const [ads, setAds] = useState<BannerAd[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [bookingAd, setBookingAd] = useState<BannerAd | null>(null);

    const fetchAds = async (query: string) => {
        setIsLoading(true);
        try {
            const data = await apiService.getBannerAds(query, platformSettings);
            setAds(data);
        } catch (error) {
            console.error("Failed to fetch banner ads:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAds(''); // Initial fetch for all ads
    }, [platformSettings]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchAds(searchQuery);
    };

    const handleMessageAgency = (ad: BannerAd) => {
        const agencyParticipant: ConversationParticipant = {
            id: ad.agencyId,
            name: ad.agencyName,
            avatar: ad.agencyAvatar,
            role: 'banneragency',
            companyName: ad.agencyName,
        };
        onStartChat(agencyParticipant);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Banner Ads Marketplace</h1>
                <p className="text-gray-500 mt-1">Find the perfect outdoor advertising space for your brand.</p>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    type="text"
                    placeholder="Search by city (e.g., Mumbai, Delhi)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <button type="submit" className="px-5 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                    Search
                </button>
            </form>

            {isLoading ? (
                <div className="text-center p-8">Loading ad spaces...</div>
            ) : ads.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-lg shadow">
                    <p className="text-gray-500">No banner ads found for this location. Try another city or clear the search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {ads.map(ad => (
                        <BannerAdCard 
                            key={ad.id} 
                            ad={ad}
                            onBookNow={setBookingAd}
                            onMessage={handleMessageAgency}
                        />
                    ))}
                </div>
            )}
            
            {bookingAd && (
                <BannerAdBookingModal 
                    user={user}
                    ad={bookingAd}
                    onClose={() => setBookingAd(null)}
                />
            )}
        </div>
    );
};

export default BannerAdsPageForBrand;
