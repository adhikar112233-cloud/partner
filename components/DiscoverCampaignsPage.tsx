import React, { useState, useEffect } from 'react';
import { User, Campaign } from '../types';
import { apiService } from '../services/apiService';
import ApplyToCampaignModal from './ApplyToCampaignModal';
import { SparklesIcon } from './Icons';

interface DiscoverCampaignsPageProps {
    user: User; // The influencer
}

const CampaignCard: React.FC<{ campaign: Campaign; onApply: () => void; hasApplied: boolean; }> = ({ campaign, onApply, hasApplied }) => (
    <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col">
        {campaign.isBoosted && (
            <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full flex items-center shadow-md z-10">
                <SparklesIcon className="w-4 h-4 mr-1" /> Boosted
            </div>
        )}
        <div className="p-6 flex-grow flex flex-col">
            <div className="flex items-center space-x-4">
                <img src={campaign.brandAvatar} alt={campaign.brandName} className="w-12 h-12 rounded-full object-cover"/>
                <div>
                    <h3 className="text-sm font-semibold text-gray-600">{campaign.brandName}</h3>
                    <h2 className="text-lg font-bold text-gray-800">{campaign.title}</h2>
                </div>
            </div>
            <p className="text-sm text-gray-600 mt-4 flex-grow">{campaign.description}</p>
            <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-500">Location:</span>
                    <span className="font-semibold text-gray-800">{campaign.location || 'All'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-semibold text-gray-800">{campaign.category}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-gray-500">Type:</span>
                    <span className="font-semibold text-gray-800 capitalize">{campaign.collaborationType}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-500">Seeking:</span>
                    <span className="font-semibold text-gray-800">{campaign.influencerCount} Influencers</span>
                </div>
                {campaign.paymentOffer && (
                    <div className="flex justify-between">
                        <span className="text-gray-500">Offer:</span>
                        <span className="font-semibold text-indigo-600">{campaign.paymentOffer}</span>
                    </div>
                )}
            </div>
            <div className="mt-6">
                 <button 
                    onClick={onApply}
                    disabled={hasApplied}
                    className="w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {hasApplied ? 'Applied' : 'Apply Now'}
                </button>
            </div>
        </div>
    </div>
);


const DiscoverCampaignsPage: React.FC<DiscoverCampaignsPageProps> = ({ user }) => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [applyingTo, setApplyingTo] = useState<Campaign | null>(null);

    const fetchCampaigns = async () => {
        setIsLoading(true);
        try {
            const openCampaigns = await apiService.getAllOpenCampaigns(user.location);
            setCampaigns(openCampaigns);
        } catch (error) {
            console.error("Failed to fetch campaigns:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, [user.location]);

    if (isLoading) return <div className="text-center p-8">Loading campaigns...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Discover Campaigns</h1>
                <p className="text-gray-500 mt-1">Find and apply to exciting new collaboration opportunities.</p>
            </div>
            
            {campaigns.length === 0 ? (
                 <div className="text-center py-10 bg-white rounded-lg shadow">
                    <p className="text-gray-500">There are no open campaigns for your location at the moment. Check back soon!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map(campaign => (
                        <CampaignCard 
                            key={campaign.id} 
                            campaign={campaign} 
                            onApply={() => setApplyingTo(campaign)}
                            hasApplied={campaign.applicantIds?.includes(user.id) || false}
                        />
                    ))}
                </div>
            )}

            {applyingTo && (
                <ApplyToCampaignModal 
                    user={user} 
                    campaign={applyingTo} 
                    onClose={() => setApplyingTo(null)}
                    onApplied={() => {
                        // Refresh campaigns to update the "Applied" button state
                        fetchCampaigns();
                        setApplyingTo(null);
                    }}
                />
            )}
        </div>
    );
};

export default DiscoverCampaignsPage;
