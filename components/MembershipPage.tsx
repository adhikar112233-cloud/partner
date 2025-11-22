import React, { useState } from 'react';
import { User, PlatformSettings, MembershipPlan } from '../types';
import { apiService } from '../services/apiService';
import CashfreeModal from './PhonePeModal';
import { Timestamp } from 'firebase/firestore';

interface MembershipPageProps {
    user: User;
    platformSettings: PlatformSettings;
    onActivationSuccess: () => void;
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

const MembershipPage: React.FC<MembershipPageProps> = ({ user, platformSettings, onActivationSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successPlan, setSuccessPlan] = useState<MembershipPlan | null>(null);
    const [payingForPlan, setPayingForPlan] = useState<{ plan: MembershipPlan; price: number } | null>(null);

    const isCreator = ['influencer', 'livetv', 'banneragency'].includes(user.role);

    const getDiscountedPrice = (originalPrice: number, discountSetting: { isEnabled: boolean; percentage: number }) => {
        if (discountSetting.isEnabled && discountSetting.percentage > 0) {
          return originalPrice * (1 - discountSetting.percentage / 100);
        }
        return originalPrice;
    };

    const brandPlans = [
        { id: 'pro_10' as MembershipPlan, name: 'Pro 10', originalPrice: platformSettings.membershipPrices.pro_10, description: 'Up to 10 of each collaboration type per year.', limit: '10 Collaborations', durationText: '/ year' },
        { id: 'pro_20' as MembershipPlan, name: 'Pro 20', originalPrice: platformSettings.membershipPrices.pro_20, description: 'Up to 20 of each collaboration type per year.', limit: '20 Collaborations', durationText: '/ year' },
        { id: 'pro_unlimited' as MembershipPlan, name: 'Pro Unlimited', originalPrice: platformSettings.membershipPrices.pro_unlimited, description: 'Unlimited collaborations.', limit: 'Unlimited', durationText: '/ year' },
    ].map(plan => ({
        ...plan,
        price: getDiscountedPrice(plan.originalPrice, platformSettings.discountSettings.brandMembership)
    }));
    
    const creatorPlans = [
        { id: 'basic' as MembershipPlan, name: 'Basic', originalPrice: platformSettings.membershipPrices.basic, description: 'Get full visibility to brands for one month.', limit: 'Unlimited Collabs', durationText: '/ 1 Month' },
        { id: 'pro' as MembershipPlan, name: 'Pro', originalPrice: platformSettings.membershipPrices.pro, description: 'Best value for short-term projects.', limit: 'Unlimited Collabs', durationText: '/ 6 Months' },
        { id: 'premium' as MembershipPlan, name: 'Premium', originalPrice: platformSettings.membershipPrices.premium, description: 'Maximum savings for long-term growth.', limit: 'Unlimited Collabs', durationText: '/ 1 Year' },
    ].map(plan => ({
        ...plan,
        price: getDiscountedPrice(plan.originalPrice, platformSettings.discountSettings.creatorMembership)
    }));

    const handleChoosePlan = (plan: MembershipPlan, price: number) => {
        setError(null);
        setPayingForPlan({ plan, price });
    };

    const CurrentPlanCard = () => {
        const { membership } = user;
        
        const effectiveMembership = membership || {
            plan: 'free' as MembershipPlan,
            isActive: false,
            expiresAt: null,
            usage: { directCollaborations: 0, campaigns: 0, liveTvBookings: 0, bannerAdBookings: 0 }
        };

        const { plan, isActive, expiresAt, usage } = effectiveMembership;
        
        const expiryDateObj = toJsDate(expiresAt);
        const isCurrentlyActive = effectiveMembership.isActive && expiryDateObj && expiryDateObj > new Date();

        const expiryDate = expiryDateObj?.toLocaleDateString() ?? 'N/A';

        const usageLimits: Record<MembershipPlan, number | typeof Infinity> = {
            free: 1,
            pro_10: 10,
            pro_20: 20,
            pro_unlimited: Infinity,
            basic: Infinity,
            pro: Infinity,
            premium: Infinity,
        };
        const limit = usageLimits[plan] ?? 0;
        
        const getLimitText = () => {
            if (isCreator) return 'Unlimited Visibility';
            if (limit === Infinity) return 'Unlimited';
            return `${limit} / type / year`;
        }


        return (
            <div className="mb-10 p-6 bg-white rounded-2xl shadow-lg border-2 border-indigo-500">
                <h2 className="text-2xl font-bold text-gray-800">Your Current Plan</h2>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-sm text-gray-500">Plan</p>
                        <p className="text-lg font-semibold text-indigo-600 capitalize">{plan.replace(/_/g, ' ')}</p>
                    </div>
                     <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <p className={`text-lg font-semibold ${isCurrentlyActive ? 'text-green-600' : 'text-gray-600'}`}>{isCurrentlyActive ? 'Active' : 'Inactive'}</p>
                    </div>
                     <div>
                        <p className="text-sm text-gray-500">Expires On</p>
                        <p className="text-lg font-semibold">{expiryDate}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Limit</p>
                        <p className="text-lg font-semibold">{getLimitText()}</p>
                    </div>
                </div>
                {user.role === 'brand' && usage && (
                    <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                        <h3 className="font-semibold mb-2">Usage this cycle:</h3>
                        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <li>Direct Collaborations: {usage.directCollaborations} / {limit === Infinity ? '∞' : limit}</li>
                            <li>Campaigns: {usage.campaigns} / {limit === Infinity ? '∞' : limit}</li>
                            <li>Live TV Bookings: {usage.liveTvBookings} / {limit === Infinity ? '∞' : limit}</li>
                            <li>Banner Ad Bookings: {usage.bannerAdBookings} / {limit === Infinity ? '∞' : limit}</li>
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    const plansToShow = isCreator
        ? (platformSettings.isCreatorMembershipEnabled ? creatorPlans : [])
        : (platformSettings.isProMembershipEnabled ? brandPlans : []);
        
    const discountSetting = isCreator ? platformSettings.discountSettings.creatorMembership : platformSettings.discountSettings.brandMembership;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <CurrentPlanCard />

            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-800">Choose Your Plan</h1>
                <p className="text-gray-500 mt-1">
                    {isCreator ? 'Activate your profile and get seen by brands.' : 'Unlock more collaborations and features.'}
                </p>
            </div>

            {successPlan && <div className="p-4 text-center text-green-700 bg-green-100 rounded-lg">Successfully activated {successPlan.replace(/_/g, ' ')} plan! Redirecting...</div>}
            {error && <div className="p-4 text-center text-red-700 bg-red-100 rounded-lg">{error}</div>}

            {plansToShow.length > 0 ? (
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 ${isLoading ? 'opacity-50' : ''}`}>
                    {plansToShow.map((plan) => (
                        <div key={plan.id} className="bg-white rounded-2xl shadow-lg p-8 flex flex-col text-center transform hover:-translate-y-2 transition-transform duration-300">
                            <h3 className="text-2xl font-bold">{plan.name}</h3>
                            <p className="text-gray-500 mt-2">{plan.description}</p>
                            <div className="my-6">
                                {discountSetting.isEnabled && plan.price !== plan.originalPrice && (
                                    <div>
                                        <del className="text-2xl font-bold text-gray-400">₹{plan.originalPrice.toLocaleString('en-IN')}</del>
                                        <p className="text-sm font-semibold text-green-600">{discountSetting.percentage}% OFF</p>
                                    </div>
                                )}
                                <p className="text-4xl font-extrabold text-gray-800">
                                    ₹{plan.price.toLocaleString('en-IN')}
                                    <span className="text-base font-medium text-gray-500">{plan.durationText}</span>
                                </p>
                            </div>
                            <div className="flex-grow"></div>
                            <button
                                onClick={() => handleChoosePlan(plan.id, plan.price)}
                                disabled={isLoading || user.membership?.plan === plan.id}
                                className="w-full py-3 font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {user.membership?.plan === plan.id ? 'Current Plan' : 'Choose Plan'}
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 col-span-full bg-white rounded-lg shadow"><p className="text-gray-500">Memberships are currently disabled by the administrator.</p></div>
            )}
            
            {payingForPlan && (
                <CashfreeModal
                    user={user}
                    collabType="membership"
                    baseAmount={payingForPlan.price}
                    platformSettings={platformSettings}
                    onClose={() => {
                        setPayingForPlan(null);
                        onActivationSuccess(); // Refresh data when user closes modal after returning
                    }}
                    transactionDetails={{
                        userId: user.id,
                        description: `Membership Plan: ${payingForPlan.plan.replace(/_/g, ' ')}`,
                        relatedId: payingForPlan.plan,
                    }}
                />
            )}
        </div>
    );
};

export default MembershipPage;