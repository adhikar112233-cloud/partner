
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiService } from '../services/apiService';
import { PlatformSettings, User, PayoutRequest, Post, Transaction, AnyCollaboration, CollaborationRequest, CampaignApplication, AdSlotRequest, BannerAdBookingRequest, PlatformBanner, UserRole, StaffPermission, RefundRequest, DailyPayoutRequest, Dispute, CombinedCollabItem, Partner, DiscountSetting, Leaderboard, LeaderboardEntry, Agreements, KycDetails, CreatorVerificationDetails } from '../types';
import { Timestamp } from 'firebase/firestore';
import PostCard from './PostCard';
import AdminPaymentHistoryPage from './AdminPaymentHistoryPage';
import { AnalyticsIcon, PaymentIcon, CommunityIcon, SupportIcon, CollabIcon, AdminIcon as KycIcon, UserGroupIcon, SparklesIcon, RocketIcon, ExclamationTriangleIcon, BannerAdsIcon, CheckBadgeIcon, TrophyIcon, DocumentTextIcon, SearchIcon, PencilIcon, TrashIcon, EyeIcon } from './Icons';
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

const ALL_PERMISSIONS: StaffPermission[] = ['super_admin', 'user_management', 'financial', 'collaborations', 'kyc', 'community', 'support', 'marketing', 'live_help', 'analytics'];

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

// --- Staff Modal ---
const StaffModal: React.FC<{
    staff: User | null;
    onClose: () => void;
    onSave: () => void;
}> = ({ staff, onClose, onSave }) => {
    const [name, setName] = useState(staff?.name || '');
    const [email, setEmail] = useState(staff?.email || '');
    const [password, setPassword] = useState(''); // Only for new
    const [permissions, setPermissions] = useState<StaffPermission[]>(staff?.staffPermissions || []);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const togglePermission = (perm: StaffPermission) => {
        setPermissions(prev => 
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            if (staff) {
                // Edit
                await apiService.updateUser(staff.id, {
                    name,
                    staffPermissions: permissions
                });
            } else {
                // Create
                if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");
                // Generating a placeholder mobile number as it's required by the auth service logic for profile creation
                const randomMobile = '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
                await authService.createUserByAdmin(email, password, 'staff', name, randomMobile, 'free', permissions);
            }
            onSave();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4 dark:text-white">{staff ? 'Edit Staff' : 'Create Staff Account'}</h3>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} required className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                    </div>
                    {!staff && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                            </div>
                        </>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
                        <div className="grid grid-cols-2 gap-2">
                            {ALL_PERMISSIONS.map(perm => (
                                <label key={perm} className="flex items-center space-x-2 p-2 border rounded dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={permissions.includes(perm)} 
                                        onChange={() => togglePermission(perm)}
                                        className="rounded text-indigo-600"
                                    />
                                    <span className="text-sm capitalize dark:text-gray-200">{perm.replace('_', ' ')}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-white">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                            {isLoading ? 'Saving...' : 'Save Staff'}
                        </button>
                    </div>
                </form>
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<User | null>(null);

    const handleCreate = () => {
        setEditingStaff(null);
        setIsModalOpen(true);
    };

    const handleEdit = (user: User) => {
        setEditingStaff(user);
        setIsModalOpen(true);
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Staff Management</h2>
                <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                    <UserGroupIcon className="w-5 h-5" />
                    Create New Staff
                </button>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="p-4 text-gray-600 dark:text-gray-300 font-semibold border-b dark:border-gray-600">Name</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300 font-semibold border-b dark:border-gray-600">Email</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300 font-semibold border-b dark:border-gray-600">Permissions</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300 font-semibold border-b dark:border-gray-600 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {staffUsers.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="p-4 dark:text-gray-200 font-medium">{u.name}</td>
                                <td className="p-4 dark:text-gray-200">{u.email}</td>
                                <td className="p-4 dark:text-gray-200">
                                    <div className="flex flex-wrap gap-1">
                                        {u.staffPermissions?.includes('super_admin') ? (
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-bold">Super Admin</span>
                                        ) : (
                                            u.staffPermissions?.map(p => (
                                                <span key={p} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-xs capitalize">
                                                    {p.replace('_', ' ')}
                                                </span>
                                            ))
                                        )}
                                        {(!u.staffPermissions || u.staffPermissions.length === 0) && <span className="text-gray-400 text-sm">None</span>}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => handleEdit(u)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-full transition-colors" title="Edit Permissions">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {staffUsers.length === 0 && <div className="p-8 text-center text-gray-500 dark:text-gray-400">No staff users found. Create one to get started.</div>}
            </div>

            {isModalOpen && (
                <StaffModal 
                    staff={editingStaff} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={onUpdate} 
                />
            )}
        </div>
    );
};

// --- Collab Detail Modal ---
const CollabDetailModal: React.FC<{ collab: CombinedCollabItem; onClose: () => void }> = ({ collab, onClose }) => {
    const data = collab.originalData;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Collaboration Details</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{collab.visibleCollabId || collab.id}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Status Section */}
                    <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                        <div className="flex-1">
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Status</span>
                            <span className={`px-2 py-1 rounded text-sm font-semibold capitalize ${collab.status === 'disputed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                {collab.status.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <div className="flex-1">
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Type</span>
                            <span className="text-sm font-medium dark:text-gray-200">{collab.type}</span>
                        </div>
                        <div className="flex-1">
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Date</span>
                            <span className="text-sm font-medium dark:text-gray-200">{collab.date?.toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Parties */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="border dark:border-gray-700 p-4 rounded-lg">
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Brand / Customer</h3>
                            <div className="flex items-center gap-3">
                                <img src={collab.customerAvatar} className="w-10 h-10 rounded-full bg-gray-200 object-cover" alt="" />
                                <div>
                                    <div className="font-semibold text-gray-800 dark:text-white">{collab.customerName}</div>
                                    <div className="text-xs font-mono text-gray-500">{collab.customerPiNumber || collab.customerId}</div>
                                </div>
                            </div>
                        </div>
                        <div className="border dark:border-gray-700 p-4 rounded-lg">
                            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Creator / Provider</h3>
                            <div className="flex items-center gap-3">
                                <img src={collab.providerAvatar} className="w-10 h-10 rounded-full bg-gray-200 object-cover" alt="" />
                                <div>
                                    <div className="font-semibold text-gray-800 dark:text-white">{collab.providerName}</div>
                                    <div className="text-xs font-mono text-gray-500">{collab.providerPiNumber || collab.providerId}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Specific Details */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Project Details</h3>
                        <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-4 space-y-3">
                            <div>
                                <span className="text-sm text-gray-500 block">Title / Campaign Name</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{collab.title}</span>
                            </div>
                            
                            {/* Conditional Fields based on Type */}
                            {data.message && (
                                <div>
                                    <span className="text-sm text-gray-500 block">Message/Brief</span>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2 rounded mt-1">{data.message}</p>
                                </div>
                            )}
                            {data.description && (
                                <div>
                                    <span className="text-sm text-gray-500 block">Description</span>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{data.description}</p>
                                </div>
                            )}
                            
                            {(data.startDate || data.endDate) && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div><span className="text-sm text-gray-500">Start Date:</span> <span className="text-sm dark:text-gray-300 ml-1">{data.startDate}</span></div>
                                    <div><span className="text-sm text-gray-500">End Date:</span> <span className="text-sm dark:text-gray-300 ml-1">{data.endDate}</span></div>
                                </div>
                            )}
                            
                            {data.adType && <div><span className="text-sm text-gray-500">Ad Type:</span> <span className="text-sm dark:text-gray-300 ml-1">{data.adType}</span></div>}
                            {data.bannerAdLocation && <div><span className="text-sm text-gray-500">Location:</span> <span className="text-sm dark:text-gray-300 ml-1">{data.bannerAdLocation}</span></div>}
                        </div>
                    </div>

                    {/* Financials */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Financials</h3>
                        <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-4 grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-sm text-gray-500 block">Final Amount</span>
                                <span className="font-bold text-green-600 text-lg">{data.finalAmount || data.budget || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-sm text-gray-500 block">Offer History</span>
                                <span className="text-sm dark:text-gray-300">
                                    {data.currentOffer ? `${data.currentOffer.amount} (by ${data.currentOffer.offeredBy})` : 'No negotiation'}
                                </span>
                            </div>
                            <div>
                                <span className="text-sm text-gray-500 block">Payment Status</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${collab.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {collab.paymentStatus}
                                </span>
                                {collab.transactionRef && <div className="text-xs text-gray-400 font-mono mt-1">Ref: {collab.transactionRef}</div>}
                            </div>
                            <div>
                                <span className="text-sm text-gray-500 block">Payout Status</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${collab.payoutStatus === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                    {collab.payoutStatus}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t dark:border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Close</button>
                </div>
            </div>
        </div>
    );
};

// --- Collaborations Panel ---
const CollaborationsPanel: React.FC<{
    collaborations: CombinedCollabItem[];
    allTransactions: Transaction[];
    onUpdate: (id: string, type: string, data: any) => Promise<void>;
}> = ({ collaborations, allTransactions, onUpdate }) => {
    const [selectedCollab, setSelectedCollab] = useState<CombinedCollabItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCollaborations = useMemo(() => {
        if (!searchQuery) return collaborations;
        const lower = searchQuery.toLowerCase();
        return collaborations.filter(c =>
            (c.title && c.title.toLowerCase().includes(lower)) ||
            (c.customerName && c.customerName.toLowerCase().includes(lower)) ||
            (c.providerName && c.providerName.toLowerCase().includes(lower)) ||
            (c.id && c.id.toLowerCase().includes(lower)) ||
            (c.visibleCollabId && c.visibleCollabId.toLowerCase().includes(lower)) ||
            (c.customerPiNumber && c.customerPiNumber.toLowerCase().includes(lower)) ||
            (c.providerPiNumber && c.providerPiNumber.toLowerCase().includes(lower))
        );
    }, [collaborations, searchQuery]);

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 className="text-2xl font-bold dark:text-white">All Collaborations</h2>
                <div className="relative w-full sm:w-64">
                    <input 
                        type="text" 
                        placeholder="Search collaborations..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-10 text-xs uppercase text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="p-4">Collab Details</th>
                            <th className="p-4">Brand / User ID</th>
                            <th className="p-4">Creator / User ID</th>
                            <th className="p-4">Financials</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                        {filteredCollaborations.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="p-4">
                                    <div className="font-bold text-gray-800 dark:text-white">{c.title}</div>
                                    <div className="text-xs text-gray-500">{c.type}</div>
                                    <div className="text-xs font-mono text-indigo-600 mt-1">{c.visibleCollabId || c.id}</div>
                                </td>
                                <td className="p-4">
                                    <div className="font-medium dark:text-gray-200">{c.customerName}</div>
                                    <div className="text-xs font-mono text-gray-500">{c.customerPiNumber || c.customerId}</div>
                                </td>
                                <td className="p-4">
                                    <div className="font-medium dark:text-gray-200">{c.providerName}</div>
                                    <div className="text-xs font-mono text-gray-500">{c.providerPiNumber || c.providerId}</div>
                                </td>
                                <td className="p-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 w-16">Payment:</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${c.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {c.paymentStatus}
                                            </span>
                                        </div>
                                        {c.transactionRef && (
                                            <div className="text-xs text-gray-400 font-mono ml-[4.5rem]">
                                                Tx: {c.transactionRef}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 w-16">Payout:</span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${c.payoutStatus === 'Completed' ? 'bg-green-100 text-green-800' : c.payoutStatus === 'Requested' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>
                                                {c.payoutStatus}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${c.status === 'disputed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {c.status.replace(/_/g, ' ')}
                                    </span>
                                    {c.disputeStatus && <div className="text-xs text-red-500 mt-1 font-bold">Disputed</div>}
                                </td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => setSelectedCollab(c)}
                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors dark:text-indigo-400 dark:hover:bg-gray-700"
                                        title="View Details"
                                    >
                                        <EyeIcon className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredCollaborations.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No collaborations found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {selectedCollab && <CollabDetailModal collab={selectedCollab} onClose={() => setSelectedCollab(null)} />}
        </div>
    );
};

// --- KYC Panel ---
const KycPanel: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const [pendingKycs, setPendingKycs] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
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

    const filteredKycs = useMemo(() => {
        if (!searchQuery) return pendingKycs;
        const lower = searchQuery.toLowerCase();
        return pendingKycs.filter(u => 
            u.name.toLowerCase().includes(lower) ||
            u.email.toLowerCase().includes(lower) ||
            (u.kycDetails?.idNumber && u.kycDetails.idNumber.toLowerCase().includes(lower))
        );
    }, [pendingKycs, searchQuery]);

    return (
        <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Pending KYC Requests</h2>
                <div className="relative w-full sm:w-64">
                    <input 
                        type="text" 
                        placeholder="Search KYC..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
            </div>

            {filteredKycs.length === 0 ? <p className="dark:text-gray-400">No pending KYC requests found.</p> : (
                <div className="space-y-4">
                    {filteredKycs.map(u => (
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
    const [searchQuery, setSearchQuery] = useState('');

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

    const filteredVerifications = useMemo(() => {
        if (!searchQuery) return pendingVerifications;
        const lower = searchQuery.toLowerCase();
        return pendingVerifications.filter(u => 
            u.name.toLowerCase().includes(lower) ||
            u.email.toLowerCase().includes(lower)
        );
    }, [pendingVerifications, searchQuery]);

    return (
        <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Creator Verification Requests</h2>
                <div className="relative w-full sm:w-64">
                    <input 
                        type="text" 
                        placeholder="Search requests..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
            </div>

            {filteredVerifications.length === 0 ? <p className="dark:text-gray-400">No pending requests found.</p> : (
                <div className="space-y-4">
                    {filteredVerifications.map(u => (
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
    const [searchQuery, setSearchQuery] = useState('');
    
    useEffect(() => {
        apiService.getPosts().then(setPosts);
    }, []);

    const handleDelete = async (postId: string) => {
        if(confirm("Delete this post?")) {
            await apiService.deletePost(postId);
            setPosts(prev => prev.filter(p => p.id !== postId));
        }
    };

    const filteredPosts = useMemo(() => {
        if (!searchQuery) return posts;
        const lower = searchQuery.toLowerCase();
        return posts.filter(p => 
            p.userName.toLowerCase().includes(lower) ||
            p.text.toLowerCase().includes(lower)
        );
    }, [posts, searchQuery]);

    return (
        <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Community Management</h2>
                <div className="relative w-full sm:w-64">
                    <input 
                        type="text" 
                        placeholder="Search posts..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
            </div>

            <div className="grid gap-4">
                {filteredPosts.length === 0 ? <p className="dark:text-gray-400">No posts found.</p> : filteredPosts.map(post => (
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

// --- Dispute Modal ---
const DisputeResolutionModal: React.FC<{
    dispute: Dispute;
    onClose: () => void;
    onResolve: () => void;
}> = ({ dispute, onClose, onResolve }) => {
    const [isResolving, setIsResolving] = useState(false);

    const handleAction = async (action: 'refund' | 'payout' | 'reverify') => {
        setIsResolving(true);
        try {
            await apiService.updateDispute(dispute.id, { 
                status: 'resolved',
                resolution: action 
            });

            // Update underlying collaboration based on action
            const updateData: any = {};
            
            if (action === 'refund') {
                updateData.status = 'rejected';
                // Trigger for refund logic should ideally be handled by payment service, 
                // but setting status to 'rejected' usually triggers manual refund flow in our current system
                updateData.rejectionReason = "Admin resolved dispute in favor of Brand (Refund).";
            } else if (action === 'payout') {
                updateData.status = 'completed';
                // Payout status will flow into payout queue naturally if completed
            } else if (action === 'reverify') {
                updateData.status = 'work_submitted'; // Reset to review stage
            }

            // Execute the update on the correct collection
            if (dispute.collaborationType === 'direct') await apiService.updateCollaborationRequest(dispute.collaborationId, updateData, 'admin');
            else if (dispute.collaborationType === 'campaign') await apiService.updateCampaignApplication(dispute.collaborationId, updateData, 'admin');
            else if (dispute.collaborationType === 'ad_slot') await apiService.updateAdSlotRequest(dispute.collaborationId, updateData, 'admin');
            else if (dispute.collaborationType === 'banner_booking') await apiService.updateBannerAdBookingRequest(dispute.collaborationId, updateData, 'admin');

            onResolve(); 
            onClose();
        } catch (error) {
            console.error("Failed to resolve dispute", error);
            alert("Failed to resolve dispute. Please try again.");
        } finally {
            setIsResolving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[110] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Resolve Dispute</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">&times;</button>
                </div>
                
                <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
                    Choose an action to resolve the dispute for <strong>{dispute.collaborationTitle}</strong>.
                </p>

                <div className="space-y-3">
                    <button 
                        onClick={() => handleAction('refund')}
                        disabled={isResolving}
                        className="w-full flex items-center justify-between px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                        <span className="font-semibold">1. Refund to Brand</span>
                        <span className="text-xs opacity-70">Mark as Rejected & Refund</span>
                    </button>

                    <button 
                        onClick={() => handleAction('payout')}
                        disabled={isResolving}
                        className="w-full flex items-center justify-between px-4 py-3 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                        <span className="font-semibold">2. Payout to Creator</span>
                        <span className="text-xs opacity-70">Mark as Completed</span>
                    </button>

                    <button 
                        onClick={() => handleAction('reverify')}
                        disabled={isResolving}
                        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                        <span className="font-semibold">3. Brand Re-verify</span>
                        <span className="text-xs opacity-70">Reset to 'Work Submitted'</span>
                    </button>
                </div>

                <div className="mt-6 text-center">
                    <button 
                        onClick={onClose}
                        disabled={isResolving}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:underline"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Disputes Panel ---
const DisputesPanel: React.FC<{ disputes: Dispute[], allTransactions: Transaction[], onUpdate: () => void }> = ({ disputes, onUpdate }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

    const filteredDisputes = useMemo(() => {
        if (!searchQuery) return disputes;
        const lower = searchQuery.toLowerCase();
        return disputes.filter(d => 
            d.collaborationTitle.toLowerCase().includes(lower) ||
            d.disputedByName.toLowerCase().includes(lower) ||
            d.disputedAgainstName.toLowerCase().includes(lower) ||
            d.reason.toLowerCase().includes(lower) ||
            d.id.toLowerCase().includes(lower)
        );
    }, [disputes, searchQuery]);

    const handleResolveClick = (dispute: Dispute) => {
        setSelectedDispute(dispute);
    };

    return (
        <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Disputes</h2>
                <div className="relative w-full sm:w-64">
                    <input 
                        type="text" 
                        placeholder="Search disputes..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
            </div>

            {filteredDisputes.length === 0 ? <p className="dark:text-gray-400">No open disputes found.</p> : (
                <div className="space-y-4">
                    {filteredDisputes.map(d => (
                        <div key={d.id} className="bg-white dark:bg-gray-800 p-4 rounded shadow border-l-4 border-red-500">
                            <div className="flex justify-between">
                                <p className="font-bold dark:text-white">Dispute on: {d.collaborationTitle}</p>
                                <span className="text-xs font-mono text-gray-400">ID: {d.id}</span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">By: {d.disputedByName} vs {d.disputedAgainstName}</p>
                            <p className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm italic dark:text-gray-300">{d.reason}</p>
                            <p className="mt-2 font-bold dark:text-gray-200">Amount: ₹{d.amount}</p>
                            
                            {d.status !== 'resolved' && (
                                <div className="mt-4 flex justify-end pt-3 border-t dark:border-gray-700">
                                    <button 
                                        onClick={() => handleResolveClick(d)}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                                    >
                                        <CheckBadgeIcon className="w-4 h-4" />
                                        Resolve
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {selectedDispute && (
                <DisputeResolutionModal 
                    dispute={selectedDispute} 
                    onClose={() => setSelectedDispute(null)} 
                    onResolve={onUpdate} 
                />
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
        <div className="p-4 sm:p-6 h-full overflow-y-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Discount Settings</h2>
                <button onClick={handleSave} className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 shadow-sm transition-colors">Save Changes</button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {(Object.entries(localSettings.discountSettings || {}) as [string, DiscountSetting][]).map(([key, setting]) => (
                    <div key={key} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between h-full">
                        <div className="mb-4">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Configure discount rules for this category.</p>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Enable Toggle Row */}
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-semibold ${setting.isEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                                        {setting.isEnabled ? 'Active' : 'Disabled'}
                                    </span>
                                    <ToggleSwitch 
                                        enabled={setting.isEnabled} 
                                        onChange={(val) => updateDiscount(key as any, 'isEnabled', val)}
                                    />
                                </div>
                            </div>

                            {/* Percentage Input Row */}
                            <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${setting.isEnabled ? 'bg-white dark:bg-gray-800 border-indigo-100 dark:border-gray-600' : 'bg-gray-100 dark:bg-gray-900/50 border-transparent opacity-60'}`}>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Discount Percentage</span>
                                <div className="flex items-center">
                                    <input 
                                        type="number" 
                                        value={setting.percentage} 
                                        onChange={(e) => updateDiscount(key as any, 'percentage', Number(e.target.value))}
                                        className="w-16 text-right font-bold text-indigo-600 dark:text-indigo-400 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:outline-none p-1"
                                        disabled={!setting.isEnabled}
                                        min="0"
                                        max="100"
                                    />
                                    <span className="ml-1 text-gray-500 dark:text-gray-400 font-medium">%</span>
                                </div>
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

    const fetchDisputes = useCallback(() => {
        setIsLoadingDisputes(true);
        apiService.getDisputes().then(setDisputes).finally(() => setIsLoadingDisputes(false));
    }, []);

    useEffect(() => {
        if (activeTab === 'disputes') {
            fetchDisputes();
        }
    }, [activeTab, fetchDisputes]);

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
        
        // Map transactions to collab IDs for fast lookup
        const paymentMap = new Map<string, Transaction>();
        allTransactions.forEach(t => {
            if (t.type === 'payment' && t.status === 'completed') {
                paymentMap.set(t.relatedId, t); // relatedId is typically the collab ID
            }
        });

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

            const paymentTx = paymentMap.get(collab.id);
            // Fallback: check if stored in collab document (some implementations might do this)
            const transactionRef = paymentTx ? (paymentTx.paymentGatewayDetails?.referenceId || paymentTx.paymentGatewayDetails?.payment_id || paymentTx.transactionId) : undefined;

            // Dispute status check
            const isDisputed = collab.status === 'disputed' || collab.status === 'brand_decision_pending' || collab.status === 'refund_pending_admin_review';

            return {
                id: collab.id,
                type: isDirect ? 'Direct' : isCampaign ? 'Campaign' : isLiveTv ? 'Live TV' : 'Banner Ad',
                title: ('title' in collab ? collab.title : null) || ('campaignTitle' in collab ? collab.campaignTitle : null) || ('campaignName' in collab ? collab.campaignName : 'N/A'),
                customerName: (customer as User)?.name || collab.brandName || 'Unknown',
                customerAvatar: (customer as User)?.avatar || collab.brandAvatar || '',
                customerPiNumber: (customer as User)?.piNumber,
                customerId: customerId, // New
                providerName: (provider as User)?.name || ('influencerName' in collab && collab.influencerName) || ('liveTvName' in collab && collab.liveTvName) || ('agencyName' in collab && collab.agencyName) || 'Unknown',
                providerAvatar: (provider as User)?.avatar || ('influencerAvatar' in collab && collab.influencerAvatar) || ('liveTvAvatar' in collab && collab.liveTvAvatar) || ('agencyAvatar' in collab && collab.agencyAvatar) || '',
                providerPiNumber: (provider as User)?.piNumber,
                providerId: providerId, // New
                date: toJsDate(collab.timestamp),
                status: collab.status as any,
                paymentStatus: collab.paymentStatus === 'paid' || collab.paymentStatus === 'payout_requested' || collab.paymentStatus === 'payout_complete' ? 'Paid' : 'Unpaid',
                payoutStatus: collab.paymentStatus === 'payout_requested' ? 'Requested' : collab.paymentStatus === 'payout_complete' ? 'Completed' : 'N/A',
                originalData: collab,
                visibleCollabId: collab.collabId, // New
                transactionRef: transactionRef, // New
                disputeStatus: isDisputed ? 'Active' : undefined // New
            };
        });
    }, [allCollabs, allUsers, allTransactions]);


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

    const handleRefresh = useCallback(() => {
        onUpdate(); // Trigger parent refresh for global data
        if (activeTab === 'disputes') {
            fetchDisputes(); // Specifically refresh local disputes state
        }
    }, [onUpdate, activeTab, fetchDisputes]);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardPanel users={allUsers} collaborations={combinedCollaborations} transactions={allTransactions} payouts={allPayouts} dailyPayouts={allDailyPayouts} />;
            case 'user_management': return <UserManagementPanel allUsers={allUsers} onUpdate={handleRefresh} transactions={allTransactions} payouts={allPayouts} collabs={allCollabs} />;
            case 'staff_management': return <StaffManagementPanel staffUsers={staffUsers} onUpdate={handleRefresh} platformSettings={platformSettings} />;
            case 'collaborations': return <CollaborationsPanel collaborations={combinedCollaborations} allTransactions={allTransactions} onUpdate={handleCollabUpdate} />;
            case 'kyc': return <KycPanel onUpdate={handleRefresh} />;
            case 'creator_verification': return <CreatorVerificationPanel onUpdate={handleRefresh} />;
            case 'payouts': return <PayoutsPanel payouts={allPayouts} refunds={allRefunds} dailyPayouts={allDailyPayouts} collaborations={combinedCollaborations} allTransactions={allTransactions} allUsers={allUsers} onUpdate={handleRefresh} />;
            case 'payment_history': return <AdminPaymentHistoryPage transactions={allTransactions} payouts={allPayouts} allUsers={allUsers} collaborations={combinedCollaborations.map(c => ({ id: c.id, trackingId: c.originalData.collabId }))} />;
            case 'community': return <CommunityManagementPanel />;
            case 'live_help': return <LiveHelpPanel adminUser={user} />;
            case 'marketing': return <MarketingPanel allUsers={allUsers} platformSettings={platformSettings} onUpdate={handleRefresh} />;
            case 'disputes': return <DisputesPanel disputes={disputes} allTransactions={allTransactions} onUpdate={handleRefresh} />;
            case 'discounts': return <DiscountSettingsPanel settings={platformSettings} setSettings={() => {}} setIsDirty={() => {}} />;
            case 'platform_banners': return <PlatformBannerPanel onUpdate={handleRefresh} />;
            case 'client_brands': return <PartnersPanel onUpdate={handleRefresh} />;
            case 'leaderboards': return <LeaderboardManager allUsers={allUsers} allTransactions={allTransactions} allCollabs={allCollabs} onUpdate={handleRefresh} />;
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
