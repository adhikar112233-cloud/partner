
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiService } from '../services/apiService';
import { PlatformSettings, User, PayoutRequest, Post, Transaction, AnyCollaboration, CollaborationRequest, CampaignApplication, AdSlotRequest, BannerAdBookingRequest, PlatformBanner, UserRole, StaffPermission, RefundRequest, DailyPayoutRequest, Dispute, CombinedCollabItem, Partner, DiscountSetting, Leaderboard, LeaderboardEntry, Agreements, KycDetails, CreatorVerificationDetails } from '../types';
import { Timestamp } from 'firebase/firestore';
import PostCard from './PostCard';
import AdminPaymentHistoryPage from './AdminPaymentHistoryPage';
import { AnalyticsIcon, PaymentIcon, CommunityIcon, SupportIcon, CollabIcon, AdminIcon as KycIcon, UserGroupIcon, SparklesIcon, RocketIcon, ExclamationTriangleIcon, BannerAdsIcon, CheckBadgeIcon, TrophyIcon, DocumentTextIcon, SearchIcon, PencilIcon, TrashIcon } from './Icons';
import LiveHelpPanel from './LiveHelpPanel';
import PayoutsPanel from './PayoutsPanel';
import { filterPostsWithAI } from '../services/geminiService';
import MarketingPanel from './MarketingPanel';
import PlatformBannerPanel from './PlatformBannerPanel';
import { authService } from '../services/authService';
import PartnersPanel from './PartnersPanel';
import LeaderboardManager from './LeaderboardManager';
import UserManagementPanel from './UserManagementPanel';

interface AdminPanelProps {
    user: User;
    allUsers: User[];
    allTransactions: Transaction[];
    allPayouts: PayoutRequest[];
    allCollabs: AnyCollaboration[];
    allRefunds: RefundRequest[];
    allDailyPayouts: DailyPayoutRequest[];
    platformSettings: PlatformSettings;
    onUpdate: () => void;
}

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
    <button
        type="button"
        className={`${
            enabled ? 'bg-indigo-600' : 'bg-gray-200'
        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
    >
        <span
            aria-hidden="true"
            className={`${
                enabled ? 'translate-x-5' : 'translate-x-0'
            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);

const toJsDate = (ts: any): Date | undefined => {
    if (!ts) return undefined;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    if (ts.seconds !== undefined && ts.nanoseconds !== undefined) return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
    return undefined;
};

type AdminTab = 'dashboard' | 'user_management' | 'staff_management' | 'collaborations' | 'kyc' | 'creator_verification' | 'payouts' | 'payment_history' | 'community' | 'live_help' | 'marketing' | 'disputes' | 'discounts' | 'platform_banners' | 'client_brands' | 'leaderboards' | 'agreements';

// --- Dashboard Panel ---
const DashboardPanel: React.FC<{
    users: User[];
    collaborations: CombinedCollabItem[];
    transactions: Transaction[];
    payouts: PayoutRequest[];
    dailyPayouts: DailyPayoutRequest[];
}> = ({ users, collaborations, transactions, payouts, dailyPayouts }) => {
    const totalUsers = users.length;
    const totalRevenue = transactions.filter(t => t.type === 'payment' && t.status === 'completed').reduce((sum, t) => sum + t.amount, 0);
    const pendingPayouts = payouts.filter(p => p.status === 'pending').length + dailyPayouts.filter(d => d.status === 'pending').length;
    const activeCollabs = collaborations.filter(c => c.status === 'in_progress' || c.status === 'work_submitted').length;

    const StatCard = ({ title, value, color }: any) => (
        <div className={`p-4 rounded-xl bg-white dark:bg-gray-800 shadow border-l-4 ${color}`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
        </div>
    );

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Dashboard Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Users" value={totalUsers} color="border-blue-500" />
                <StatCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} color="border-green-500" />
                <StatCard title="Pending Payouts" value={pendingPayouts} color="border-yellow-500" />
                <StatCard title="Active Collabs" value={activeCollabs} color="border-purple-500" />
            </div>
        </div>
    );
};

// --- Staff Management Panel ---
const StaffManagementPanel: React.FC<{
    staffUsers: User[];
    onUpdate: () => void;
    platformSettings: PlatformSettings;
}> = ({ staffUsers, onUpdate }) => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 dark:text-white">Staff Management</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Name</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Email</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Permissions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {staffUsers.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="p-4 dark:text-gray-200">{u.name}</td>
                                <td className="p-4 dark:text-gray-200">{u.email}</td>
                                <td className="p-4 dark:text-gray-200">{u.staffPermissions?.join(', ') || 'None'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {staffUsers.length === 0 && <p className="p-4 text-center text-gray-500">No staff users found.</p>}
            </div>
        </div>
    );
};

// --- Collaborations Panel ---
const CollaborationsPanel: React.FC<{
    collaborations: CombinedCollabItem[];
    allTransactions: Transaction[];
    onUpdate: (id: string, type: string, data: any) => Promise<void>;
}> = ({ collaborations }) => {
    return (
        <div className="p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-4 dark:text-white">All Collaborations</h2>
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Title</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Type</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Brand</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Creator</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {collaborations.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="p-4 dark:text-gray-200">{c.title}</td>
                                <td className="p-4 dark:text-gray-200">{c.type}</td>
                                <td className="p-4 dark:text-gray-200">{c.customerName}</td>
                                <td className="p-4 dark:text-gray-200">{c.providerName}</td>
                                <td className="p-4 dark:text-gray-200 capitalize">{c.status.replace(/_/g, ' ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- KYC Panel ---
const KycPanel: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const [pendingKycs, setPendingKycs] = useState<User[]>([]);
    
    useEffect(() => {
        apiService.getKycSubmissions().then(setPendingKycs);
    }, []);

    const handleApprove = async (userId: string) => {
        await apiService.updateKycStatus(userId, 'approved');
        onUpdate();
        setPendingKycs(prev => prev.filter(u => u.id !== userId));
    };

    const handleReject = async (userId: string) => {
        const reason = prompt("Reason for rejection:");
        if (reason) {
            await apiService.updateKycStatus(userId, 'rejected', reason);
            onUpdate();
            setPendingKycs(prev => prev.filter(u => u.id !== userId));
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 dark:text-white">Pending KYC Requests</h2>
            {pendingKycs.length === 0 ? <p className="dark:text-gray-400">No pending KYC requests.</p> : (
                <div className="space-y-4">
                    {pendingKycs.map(u => (
                        <div key={u.id} className="bg-white dark:bg-gray-800 p-4 rounded shadow flex justify-between items-center">
                            <div>
                                <p className="font-bold dark:text-white">{u.name}</p>
                                <p className="text-sm text-gray-500">{u.email}</p>
                                <p className="text-sm dark:text-gray-300">ID: {u.kycDetails?.idType} - {u.kycDetails?.idNumber}</p>
                            </div>
                            <div className="flex gap-2">
                                {u.kycDetails?.idProofUrl && <a href={u.kycDetails.idProofUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center px-3">View ID</a>}
                                <button onClick={() => handleApprove(u.id)} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">Approve</button>
                                <button onClick={() => handleReject(u.id)} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Reject</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Creator Verification Panel ---
const CreatorVerificationPanel: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const [pendingVerifications, setPendingVerifications] = useState<User[]>([]);

    useEffect(() => {
        apiService.getPendingCreatorVerifications().then(setPendingVerifications);
    }, []);

    const handleApprove = async (userId: string) => {
        await apiService.updateCreatorVerificationStatus(userId, 'approved');
        onUpdate();
        setPendingVerifications(prev => prev.filter(u => u.id !== userId));
    };

    const handleReject = async (userId: string) => {
        const reason = prompt("Reason for rejection:");
        if (reason) {
            await apiService.updateCreatorVerificationStatus(userId, 'rejected', reason);
            onUpdate();
            setPendingVerifications(prev => prev.filter(u => u.id !== userId));
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 dark:text-white">Creator Verification Requests</h2>
            {pendingVerifications.length === 0 ? <p className="dark:text-gray-400">No pending requests.</p> : (
                <div className="space-y-4">
                    {pendingVerifications.map(u => (
                        <div key={u.id} className="bg-white dark:bg-gray-800 p-4 rounded shadow flex justify-between items-center">
                            <div>
                                <p className="font-bold dark:text-white">{u.name} ({u.role})</p>
                                <p className="text-sm text-gray-500">{u.email}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleApprove(u.id)} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">Approve</button>
                                <button onClick={() => handleReject(u.id)} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Reject</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Community Management Panel ---
const CommunityManagementPanel: React.FC = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    
    useEffect(() => {
        apiService.getPosts().then(setPosts);
    }, []);

    const handleDelete = async (postId: string) => {
        if(confirm("Delete this post?")) {
            await apiService.deletePost(postId);
            setPosts(prev => prev.filter(p => p.id !== postId));
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 dark:text-white">Community Management</h2>
            <div className="grid gap-4">
                {posts.map(post => (
                    <div key={post.id} className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <div className="flex justify-between items-center">
                            <p className="font-bold dark:text-white">{post.userName}</p>
                            <button onClick={() => handleDelete(post.id)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                        <p className="mt-2 dark:text-gray-300">{post.text}</p>
                        {post.imageUrl && <img src={post.imageUrl} className="mt-2 h-32 object-cover rounded" alt="" />}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Disputes Panel ---
const DisputesPanel: React.FC<{ disputes: Dispute[], allTransactions: Transaction[], onUpdate: () => void }> = ({ disputes }) => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 dark:text-white">Disputes</h2>
            {disputes.length === 0 ? <p className="dark:text-gray-400">No open disputes.</p> : (
                <div className="space-y-4">
                    {disputes.map(d => (
                        <div key={d.id} className="bg-white dark:bg-gray-800 p-4 rounded shadow border-l-4 border-red-500">
                            <p className="font-bold dark:text-white">Dispute on: {d.collaborationTitle}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">By: {d.disputedByName} vs {d.disputedAgainstName}</p>
                            <p className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm italic dark:text-gray-300">{d.reason}</p>
                            <p className="mt-2 font-bold dark:text-gray-200">Amount: ₹{d.amount}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Discount Settings Panel ---
const DiscountSettingsPanel: React.FC<{ 
    settings: PlatformSettings; 
    setSettings: (s: PlatformSettings) => void;
    setIsDirty: (b: boolean) => void;
}> = ({ settings }) => {
    const [localSettings, setLocalSettings] = useState<PlatformSettings>(settings);

    const handleSave = async () => {
        await apiService.updatePlatformSettings(localSettings);
        alert("Discount settings saved.");
    };

    const updateDiscount = (key: keyof typeof settings.discountSettings, field: 'isEnabled' | 'percentage', value: any) => {
        setLocalSettings(prev => ({
            ...prev,
            discountSettings: {
                ...prev.discountSettings,
                [key]: {
                    ...prev.discountSettings[key],
                    [field]: value
                }
            }
        }));
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Discount Settings</h2>
                <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Save Changes</button>
            </div>
            
            <div className="space-y-6">
                {(Object.entries(localSettings.discountSettings || {}) as [string, DiscountSetting][]).map(([key, setting]) => (
                    <div key={key} className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                        <h3 className="font-bold mb-2 capitalize dark:text-gray-200">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={setting.isEnabled} 
                                    onChange={(e) => updateDiscount(key as any, 'isEnabled', e.target.checked)}
                                    className="rounded text-indigo-600"
                                />
                                <span className="dark:text-gray-300">Enabled</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={setting.percentage} 
                                    onChange={(e) => updateDiscount(key as any, 'percentage', Number(e.target.value))}
                                    className="border rounded p-1 w-20 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <span className="dark:text-gray-300">% Discount</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Agreements Panel ---
const AgreementsPanel: React.FC = () => {
    const [agreements, setAgreements] = useState<Agreements>({ brand: '', influencer: '', livetv: '', banneragency: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeRole, setActiveRole] = useState<keyof Agreements>('brand');

    useEffect(() => {
        setIsLoading(true);
        apiService.getAgreements()
            .then(setAgreements)
            .finally(() => setIsLoading(false));
    }, []);

    const handleChange = (val: string) => {
        setAgreements(prev => ({ ...prev, [activeRole]: val }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiService.updateAgreements(agreements);
            alert("Agreements updated successfully!");
        } catch (error) {
            console.error(error);
            alert("Failed to save agreements.");
        } finally {
            setIsSaving(false);
        }
    };

    const roles: { id: keyof Agreements, label: string }[] = [
        { id: 'brand', label: 'Brand Agreement' },
        { id: 'influencer', label: 'Influencer Agreement' },
        { id: 'livetv', label: 'Live TV Agreement' },
        { id: 'banneragency', label: 'Banner Agency Agreement' },
    ];

    if (isLoading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading agreements...</div>;

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">User Agreements</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Use <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-indigo-600 font-mono">{"{{USER_NAME}}"}</code> to insert the user's name dynamically.
                    </p>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {isSaving ? 'Saving...' : 'Save All Changes'}
                </button>
            </div>

            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                {roles.map(role => (
                    <button
                        key={role.id}
                        onClick={() => setActiveRole(role.id)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeRole === role.id 
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        {role.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 flex flex-col">
                <textarea
                    value={agreements[activeRole]}
                    onChange={(e) => handleChange(e.target.value)}
                    className="flex-1 w-full p-4 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 font-mono text-sm resize-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={`Enter terms and conditions for ${activeRole}s here...`}
                />
                <div className="mt-2 text-xs text-gray-500 text-right">
                    Supports plain text. HTML/Markdown rendering depends on frontend implementation (currently plain text/pre-wrap).
                </div>
            </div>
        </div>
    );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, allUsers, allTransactions, allPayouts, allCollabs, allRefunds, allDailyPayouts, platformSettings, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [isLoadingDisputes, setIsLoadingDisputes] = useState(false);
    
    const staffUsers = useMemo(() => allUsers.filter(u => u.role === 'staff' && !u.isBlocked), [allUsers]);

    useEffect(() => {
        if (activeTab === 'disputes') {
            setIsLoadingDisputes(true);
            apiService.getDisputes().then(setDisputes).finally(() => setIsLoadingDisputes(false));
        }
    }, [activeTab]);

    const handleCollabUpdate = async (id: string, type: string, data: Partial<AnyCollaboration>) => {
        const collabTypeMap: { [key: string]: 'direct' | 'campaign' | 'ad_slot' | 'banner_booking' } = {
            'Direct': 'direct',
            'Campaign': 'campaign',
            'Live TV': 'ad_slot',
            'Banner Ad': 'banner_booking'
        };
        const collabType = collabTypeMap[type];
        if (!collabType) return;
        
        try {
            switch(collabType) {
                case 'direct': await apiService.updateCollaborationRequest(id, data as Partial<CollaborationRequest>, user.id); break;
                case 'campaign': await apiService.updateCampaignApplication(id, data as Partial<CampaignApplication>, user.id); break;
                case 'ad_slot': await apiService.updateAdSlotRequest(id, data as Partial<AdSlotRequest>, user.id); break;
                case 'banner_booking': await apiService.updateBannerAdBookingRequest(id, data as Partial<BannerAdBookingRequest>, user.id); break;
            }
            onUpdate();
        } catch (error) {
            console.error("Failed to update collaboration", error);
        }
    };
    
    const combinedCollaborations = useMemo<CombinedCollabItem[]>(() => {
        const userMap = new Map(allUsers.map(u => [u.id, u]));
        return allCollabs.map((collab) => {
            const isDirect = 'influencerId' in collab;
            const isCampaign = 'campaignId' in collab;
            const isLiveTv = 'liveTvId' in collab;
            const isBanner = 'bannerAdId' in collab;
    
            const customerId = collab.brandId;
            let providerId: string | undefined;
            if (isDirect || isCampaign) providerId = (collab as CollaborationRequest | CampaignApplication).influencerId;
            if (isLiveTv) providerId = (collab as AdSlotRequest).liveTvId;
            if (isBanner) providerId = (collab as BannerAdBookingRequest).agencyId;
    
            const customer = userMap.get(customerId);
            const provider = providerId ? userMap.get(providerId) : undefined;

            return {
                id: collab.id,
                type: isDirect ? 'Direct' : isCampaign ? 'Campaign' : isLiveTv ? 'Live TV' : 'Banner Ad',
                title: ('title' in collab ? collab.title : null) || ('campaignTitle' in collab ? collab.campaignTitle : null) || ('campaignName' in collab ? collab.campaignName : 'N/A'),
                customerName: (customer as User)?.name || collab.brandName || 'Unknown',
                customerAvatar: (customer as User)?.avatar || collab.brandAvatar || '',
                customerPiNumber: (customer as User)?.piNumber,
                providerName: (provider as User)?.name || ('influencerName' in collab && collab.influencerName) || ('liveTvName' in collab && collab.liveTvName) || ('agencyName' in collab && collab.agencyName) || 'Unknown',
                providerAvatar: (provider as User)?.avatar || ('influencerAvatar' in collab && collab.influencerAvatar) || ('liveTvAvatar' in collab && collab.liveTvAvatar) || ('agencyAvatar' in collab && collab.agencyAvatar) || '',
                providerPiNumber: (provider as User)?.piNumber,
                date: toJsDate(collab.timestamp),
                status: collab.status as any,
                paymentStatus: collab.paymentStatus === 'paid' || collab.paymentStatus === 'payout_requested' || collab.paymentStatus === 'payout_complete' ? 'Paid' : 'Unpaid',
                payoutStatus: collab.paymentStatus === 'payout_requested' ? 'Requested' : collab.paymentStatus === 'payout_complete' ? 'Completed' : 'N/A',
                originalData: collab
            };
        });
    }, [allCollabs, allUsers]);


    const tabs: { id: AdminTab; label: string; icon: React.FC<{className?: string}>, permission?: StaffPermission }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: AnalyticsIcon },
        { id: 'user_management', label: 'User Management', icon: UserGroupIcon, permission: 'user_management' },
        { id: 'staff_management', label: 'Staff Management', icon: UserGroupIcon, permission: 'super_admin' },
        { id: 'collaborations', label: 'Collaborations', icon: CollabIcon, permission: 'collaborations' },
        { id: 'kyc', label: 'KYC Verification', icon: KycIcon, permission: 'kyc' },
        { id: 'creator_verification', label: 'Creator Verification', icon: CheckBadgeIcon, permission: 'kyc' },
        { id: 'payouts', label: 'Payouts & Refunds', icon: PaymentIcon, permission: 'financial' },
        { id: 'payment_history', label: 'Payment History', icon: PaymentIcon, permission: 'financial' },
        { id: 'community', label: 'Community', icon: CommunityIcon, permission: 'community' },
        { id: 'live_help', label: 'Live Help Queue', icon: SupportIcon, permission: 'live_help' },
        { id: 'marketing', label: 'Marketing Tools', icon: RocketIcon, permission: 'marketing' },
        { id: 'disputes', label: 'Disputes', icon: ExclamationTriangleIcon, permission: 'support' },
        { id: 'discounts', label: 'Discounts & Pricing', icon: SparklesIcon, permission: 'super_admin' },
        { id: 'platform_banners', label: 'Platform Banners', icon: BannerAdsIcon, permission: 'marketing' },
        { id: 'client_brands', label: 'Partner Brands', icon: UserGroupIcon, permission: 'marketing' },
        { id: 'leaderboards', label: 'Leaderboards', icon: TrophyIcon, permission: 'marketing' },
        { id: 'agreements', label: 'Legal & Agreements', icon: DocumentTextIcon, permission: 'super_admin' },
    ];

    const visibleTabs = tabs.filter(tab => {
        if (!tab.permission) return true;
        if (user.staffPermissions?.includes('super_admin')) return true;
        return user.staffPermissions?.includes(tab.permission);
    });

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardPanel users={allUsers} collaborations={combinedCollaborations} transactions={allTransactions} payouts={allPayouts} dailyPayouts={allDailyPayouts} />;
            case 'user_management': return <UserManagementPanel allUsers={allUsers} onUpdate={onUpdate} transactions={allTransactions} payouts={allPayouts} collabs={allCollabs} />;
            case 'staff_management': return <StaffManagementPanel staffUsers={staffUsers} onUpdate={onUpdate} platformSettings={platformSettings} />;
            case 'collaborations': return <CollaborationsPanel collaborations={combinedCollaborations} allTransactions={allTransactions} onUpdate={handleCollabUpdate} />;
            case 'kyc': return <KycPanel onUpdate={onUpdate} />;
            case 'creator_verification': return <CreatorVerificationPanel onUpdate={onUpdate} />;
            case 'payouts': return <PayoutsPanel payouts={allPayouts} refunds={allRefunds} dailyPayouts={allDailyPayouts} collaborations={combinedCollaborations} allTransactions={allTransactions} allUsers={allUsers} onUpdate={onUpdate} />;
            case 'payment_history': return <AdminPaymentHistoryPage transactions={allTransactions} payouts={allPayouts} allUsers={allUsers} collaborations={combinedCollaborations.map(c => ({ id: c.id, trackingId: c.originalData.collabId }))} />;
            case 'community': return <CommunityManagementPanel />;
            case 'live_help': return <LiveHelpPanel adminUser={user} />;
            case 'marketing': return <MarketingPanel allUsers={allUsers} platformSettings={platformSettings} onUpdate={onUpdate} />;
            case 'disputes': return <DisputesPanel disputes={disputes} allTransactions={allTransactions} onUpdate={onUpdate} />;
            case 'discounts': return <DiscountSettingsPanel settings={platformSettings} setSettings={() => {}} setIsDirty={() => {}} />;
            case 'platform_banners': return <PlatformBannerPanel onUpdate={onUpdate} />;
            case 'client_brands': return <PartnersPanel onUpdate={onUpdate} />;
            case 'leaderboards': return <LeaderboardManager allUsers={allUsers} allTransactions={allTransactions} allCollabs={allCollabs} onUpdate={onUpdate} />;
            case 'agreements': return <AgreementsPanel />;
            default: return <div>Select a tab</div>;
        }
    };

    return (
        <div className="flex h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">
            <div className="w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col flex-shrink-0 overflow-y-auto">
                <div className="p-4 border-b dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Admin Panel</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.name}</p>
                </div>
                <nav className="flex-1 p-2 space-y-1">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200'
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            <tab.icon className={`mr-3 h-5 w-5 ${activeTab === tab.id ? 'text-indigo-500 dark:text-indigo-300' : 'text-gray-400 dark:text-gray-500'}`} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminPanel;
