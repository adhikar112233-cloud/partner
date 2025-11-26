
import React, { useEffect, useState } from 'react';
import { Influencer } from '../types';
import { apiService } from '../services/apiService';
import { TrophyIcon } from './Icons';

const TopInfluencersList: React.FC = () => {
    const [influencers, setInfluencers] = useState<Influencer[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTop = async () => {
            try {
                const data = await apiService.getTopInfluencers();
                setInfluencers(data);
            } catch (error) {
                console.error("Failed to fetch top influencers:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTop();
    }, []);

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading leaderboard...</div>;
    }

    const getRankStyle = (index: number) => {
        switch (index) {
            case 0: return 'bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-600'; // Gold
            case 1: return 'bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-500'; // Silver
            case 2: return 'bg-orange-100 border-orange-300 dark:bg-orange-900/30 dark:border-orange-600'; // Bronze
            default: return 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700';
        }
    };

    const getRankIcon = (index: number) => {
        if (index > 2) return <span className="font-bold text-gray-500 text-xl w-8 text-center">{index + 1}</span>;
        const color = index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-orange-500';
        return <TrophyIcon className={`w-8 h-8 ${color}`} />;
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center py-8">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center justify-center gap-3">
                    <TrophyIcon className="w-10 h-10 text-yellow-500" />
                    Top Performing Creators
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Ranked by highest collaborations and earnings.</p>
            </div>

            <div className="space-y-4">
                {influencers.map((inf, index) => (
                    <div 
                        key={inf.id} 
                        className={`flex items-center p-4 rounded-xl border-2 shadow-sm transition-transform hover:scale-[1.01] ${getRankStyle(index)}`}
                    >
                        <div className="flex-shrink-0 mr-4 sm:mr-6 flex items-center justify-center w-12">
                            {getRankIcon(index)}
                        </div>
                        
                        <img 
                            src={inf.avatar} 
                            alt={inf.name} 
                            className={`rounded-full object-cover border-2 border-white dark:border-gray-600 ${index === 0 ? 'w-20 h-20' : 'w-16 h-16'}`} 
                        />
                        
                        <div className="ml-4 flex-1">
                            <h3 className={`font-bold text-gray-900 dark:text-white ${index === 0 ? 'text-xl' : 'text-lg'}`}>
                                {inf.name}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">@{inf.handle}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">{inf.niche}</p>
                        </div>

                        <div className="text-right">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                ₹{(inf.totalEarnings || 0).toLocaleString('en-IN')}
                            </p>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                {inf.collaborationCount || 0} Collaborations
                            </p>
                        </div>
                    </div>
                ))}
                {influencers.length === 0 && (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-10">
                        No performance data available yet.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TopInfluencersList;