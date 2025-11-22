

import React, { useState, useEffect } from 'react';
import { User, PlatformSettings, Boost, BoostType } from '../types';
import { apiService } from '../services/apiService';
import CashfreeModal from './PhonePeModal';
import { Timestamp } from 'firebase/firestore';
import { RocketIcon, SparklesIcon } from './Icons';

interface BoostPageProps {
    user: User;
    platformSettings: PlatformSettings;
    onBoostActivated: () => void;
}

const toJsDate = (ts: any): Date | undefined => {
    if (!ts) return undefined;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    if (ts.seconds !== undefined && ts.nanoseconds !== undefined) return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
    return undefined;
};

const BoostPage: React.FC<BoostPageProps> = ({ user, platformSettings, onBoostActivated }) => {
    const [boosts, setBoosts] = useState<Boost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPaying, setIsPaying] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        apiService.getBoostsForUser(user.id)
            .then(setBoosts)
            .catch(() => setError("Failed to load your boost status."))
            .finally(() => setIsLoading(false));
    }, [user.id]);

    const activeProfileBoost = boosts.find(b => b.targetType === 'profile' && toJsDate(b.expiresAt)! > new Date());

    const discountSetting = platformSettings.discountSettings.creatorProfileBoost;

    const originalPrice = platformSettings.boostPrices.profile;
    const price = discountSetting.isEnabled && discountSetting.percentage > 0
        ? originalPrice * (1 - discountSetting.percentage / 100)
        : originalPrice;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Boost Your Profile</h1>
                <p className="text-gray-500 mt-1">Get featured at the top of discovery pages and attract more brands.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-purple-500">
                <h2 className="text-2xl font-bold text-gray-800">Your Boost Status</h2>
                {isLoading ? <p className="mt-4 text-gray-500">Loading status...</p> : 
                activeProfileBoost ? (
                    <div className="mt-4 text-center py-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-lg font-semibold text-green-700">Your profile is currently boosted!</p>
                        <p className="text-gray-600">Expires on: {toJsDate(activeProfileBoost.expiresAt)?.toLocaleDateString()}</p>
                    </div>
                ) : (
                    <div className="mt-4 text-center py-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-lg font-semibold text-gray-700">Your profile is not currently boosted.</p>
                        <p className="text-gray-600">Choose a plan below to increase your visibility.</p>
                    </div>
                )}
            </div>
            
            {error && <div className="p-4 text-center text-red-700 bg-red-100 rounded-lg">{error}</div>}
            
            {platformSettings.isProfileBoostingEnabled ? (
                <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col md:flex-row items-center text-center md:text-left gap-8">
                    <div className="text-purple-500"><RocketIcon className="w-24 h-24"/></div>
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold">Boost Your Profile</h3>
                        <p className="text-gray-500 mt-2">Get featured at the top of discovery pages for 7 days and attract more brands directly to you.</p>
                    </div>
                    <div className="text-center">
                        {discountSetting.isEnabled && price !== originalPrice && (
                            <div>
                                <del className="text-2xl font-bold text-gray-400">₹{originalPrice.toLocaleString('en-IN')}</del>
                                <p className="text-sm font-semibold text-green-600">{discountSetting.percentage}% OFF</p>
                            </div>
                        )}
                        <p className="text-4xl font-extrabold text-gray-800">₹{price.toLocaleString('en-IN')}</p>
                        <button
                            onClick={() => setIsPaying(true)}
                            disabled={isLoading || !!activeProfileBoost || user.role === 'banneragency'}
                            title={user.role === 'banneragency' ? 'Profile boosting is not available for agencies.' : undefined}
                            className="w-full mt-4 py-3 font-semibold text-white bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {activeProfileBoost ? 'Boost Active' : 'Boost for 7 Days'}
                        </button>
                    </div>
                </div>
            ) : (
                 <div className="text-center py-10 bg-white rounded-lg shadow"><p className="text-gray-500">Profile boosting is currently disabled by the administrator.</p></div>
            )}

            {isPaying && (
                <CashfreeModal
                    user={user}
                    collabType="boost_profile"
                    baseAmount={price}
                    platformSettings={platformSettings}
                    onClose={() => {
                        setIsPaying(false);
                        onBoostActivated();
                    }}
                    transactionDetails={{
                        userId: user.id,
                        description: `Profile Boost`,
                        relatedId: user.id, // For profile boost, target is the user themselves
                    }}
                />
            )}
        </div>
    );
};

export default BoostPage;