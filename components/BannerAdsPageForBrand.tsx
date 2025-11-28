import React, { useState, useEffect } from 'react';
import { User, BannerAd, ConversationParticipant, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { MessagesIcon, SparklesIcon, VerifiedIcon } from './Icons';
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
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden flex flex-col transform hover:-translate-y-1 transition-transform duration-300">
            {ad.isBoosted && (
                <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full flex items-center shadow-md z-10">
                    <SparklesIcon className="w-4 h-4 mr-1" /> Boosted
                </div>
            )}
            <img src={ad.photoUrl} alt={`Ad space in ${ad.location}`} className="w-full h-48 object-cover"/>
            <div className="p-5 flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white line-clamp-1">{ad.address}</h3>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full whitespace-nowrap">{ad.bannerType}</span>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                    <img src={ad.agencyAvatar} alt={ad.agencyName} className="w-6 h-6 rounded-full"/>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        {ad.agencyName}
                        {ad.isVerified && <VerifiedIcon className="w-3 h-3 text-blue-500" />}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300 mb-4">
                    <div>
                        <span className="block text-xs text-gray-400">Location</span>
                        <span className="font-medium">{ad.location}</span>
                    </div>
                    <div>
                        <span className="block text-xs text-gray-400">Size</span>
                        <span className="font-medium">{ad.size}</span>
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <p className="text-xs text-gray-400">Daily Fee</p>
                        <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">₹{ad.feePerDay.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => onMessage(ad)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors">
                            <MessagesIcon className="w-5 h-5"/>
                        </button>
                        <button onClick={() => onBookNow(ad)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow transition-colors">
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
    const [filteredAds, setFilteredAds] = useState<BannerAd[]>([]);
    const [locationFilter, setLocationFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAd, setSelectedAd] = useState<BannerAd | null>(null);

    useEffect(() => {
        const fetchAds = async () => {
            setIsLoading(true);
            try {
                const data = await apiService.getBannerAds('', platformSettings);
                setAds(data);
                setFilteredAds(data);
            } catch (err) {
                console.error("Failed to load banner ads", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAds();
    }, [platformSettings]);

    useEffect(() => {
        let result = ads;
        if (locationFilter) {
            result = result.filter(ad => ad.location.toLowerCase().includes(locationFilter.toLowerCase()));
        }
        if (typeFilter) {
            result = result.filter(ad => ad.bannerType === typeFilter);
        }
        setFilteredAds(result);
    }, [locationFilter, typeFilter, ads]);

    const handleMessage = (ad: BannerAd) => {
        onStartChat({
            id: ad.agencyId,
            name: ad.agencyName,
            avatar: ad.agencyAvatar,
            role: 'banneragency',
            companyName: ad.agencyName
        });
    };

    const bannerTypes = Array.from(new Set(ads.map(ad => ad.bannerType)));
    const locations = Array.from(new Set(ads.map(ad => ad.location)));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Banner Ads</h1>
                <p className="text-gray-500 dark:text-gray-400">Browse and book physical ad spaces.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <select 
                    value={locationFilter} 
                    onChange={e => setLocationFilter(e.target.value)} 
                    className="p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                    <option value="">All Cities</option>
                    {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
                <select 
                    value={typeFilter} 
                    onChange={e => setTypeFilter(e.target.value)} 
                    className="p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                    <option value="">All Types</option>
                    {bannerTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
            </div>

            {isLoading ? (
                <div className="text-center py-10">Loading ads...</div>
            ) : filteredAds.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow"><p className="text-gray-500">No banner ads available.</p></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAds.map(ad => (
                        <BannerAdCard key={ad.id} ad={ad} onBookNow={setSelectedAd} onMessage={handleMessage} />
                    ))}
                </div>
            )}

            {selectedAd && (
                <BannerAdBookingModal 
                    user={user} 
                    ad={selectedAd} 
                    onClose={() => setSelectedAd(null)} 
                />
            )}
        </div>
    );
};

export default BannerAdsPageForBrand;