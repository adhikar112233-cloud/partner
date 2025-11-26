
import React, { useState, useMemo, useEffect } from 'react';
import { User, StaffPermission, Transaction, PayoutRequest, RefundRequest, DailyPayoutRequest, PlatformSettings, CombinedCollabItem, SupportTicket, LiveHelpSession, AnyCollaboration, MembershipPlan, UserRole } from '../types';
import { AnalyticsIcon, UserGroupIcon, CollabIcon, CheckBadgeIcon, PaymentIcon, TrophyIcon, CommunityIcon, ChatBubbleLeftEllipsisIcon, EnvelopeIcon, ExclamationTriangleIcon, SparklesIcon, BannerAdsIcon, RocketIcon, TrashIcon, LockClosedIcon, LockOpenIcon, EyeIcon, PencilIcon, DocumentIcon, PlusIcon } from './Icons';
import TopInfluencersList from './TopInfluencersList';
import PayoutsPanel from './PayoutsPanel';
import AdminPaymentHistoryPage from './AdminPaymentHistoryPage';
import LiveHelpPanel from './LiveHelpPanel';
import CommunityPage from './CommunityPage';
import MarketingPanel from './MarketingPanel';
import SupportAdminPage from './SupportAdminPage';
import PlatformBannerPanel from './PlatformBannerPanel';
import PartnersPanel from './PartnersPanel';
import SettingsPanel from './SettingsPanel';
import { apiService } from '../services/apiService';
import { authService } from '../services/authService';
import { Timestamp } from 'firebase/firestore';

// --- Add User Modal ---
const AddUserModal: React.FC<{ onClose: () => void; onUserAdded: () => void }> = ({ onClose, onUserAdded }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>('brand');
    const [mobileNumber, setMobileNumber] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await authService.createUserByAdmin(email, password, role, name, companyName, mobileNumber);
            onUserAdded();
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to create user. Email might be in use.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[70] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100">&times;</button>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Create New User</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                        <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="mt-1 block w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="brand">Brand</option>
                            <option value="influencer">Influencer</option>
                            <option value="livetv">Live TV</option>
                            <option value="banneragency">Banner Agency</option>
                            <option value="staff">Staff</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    {role !== 'influencer' && role !== 'staff' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company/Channel Name</label>
                            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="mt-1 block w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                        <input type="tel" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} className="mt-1 block w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 block w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" minLength={6} />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" disabled={isLoading} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
                        {isLoading ? 'Creating...' : 'Create User'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- User Details Modal ---

const UserDetailsModal: React.FC<{
    user: User;
    onClose: () => void;
    allTransactions: Transaction[];
    allPayouts: PayoutRequest[];
    allCollabs: AnyCollaboration[];
    onUpdate: () => void;
}> = ({ user, onClose, allTransactions, allPayouts, allCollabs, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'financials' | 'membership' | 'collabs' | 'kyc'>('profile');
    const [editingMembership, setEditingMembership] = useState(false);
    const [newPlan, setNewPlan] = useState<MembershipPlan>(user.membership?.plan || 'free');
    const [newExpiry, setNewExpiry] = useState<string>('');

    // Filter data for this user
    const userTransactions = useMemo(() => allTransactions.filter(t => t.userId === user.id), [allTransactions, user.id]);
    const userPayouts = useMemo(() => allPayouts.filter(p => p.userId === user.id), [allPayouts, user.id]);
    const userCollabs = useMemo(() => allCollabs.filter(c => 
        ('brandId' in c && c.brandId === user.id) || 
        ('influencerId' in c && c.influencerId === user.id) || 
        ('agencyId' in c && c.agencyId === user.id) || 
        ('liveTvId' in c && c.liveTvId === user.id)
    ), [allCollabs, user.id]);

    const handleUpdateMembership = async () => {
        if (!newPlan) return;
        let expiryDate: Timestamp | null = null;
        if (newExpiry) {
            expiryDate = Timestamp.fromDate(new Date(newExpiry));
        } else if (user.membership?.expiresAt) {
             // Keep existing if not changed, or set default if null
             expiryDate = user.membership.expiresAt as Timestamp;
        } else {
             // Default to 1 year if absolutely nothing exists
             const d = new Date();
             d.setFullYear(d.getFullYear() + 1);
             expiryDate = Timestamp.fromDate(d);
        }
        
        await apiService.updateUserProfile(user.id, {
            membership: {
                ...user.membership,
                plan: newPlan,
                isActive: true,
                expiresAt: expiryDate,
                usage: user.membership?.usage || { directCollaborations: 0, campaigns: 0, liveTvBookings: 0, bannerAdBookings: 0 }
            }
        });
        onUpdate();
        setEditingMembership(false);
        alert("Membership updated successfully.");
    };

    const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
    const formatDate = (ts: any) => {
        if (!ts) return 'N/A';
        if (ts instanceof Date) return ts.toLocaleDateString();
        if (ts.toDate) return ts.toDate().toLocaleDateString();
        if (typeof ts === 'string') return new Date(ts).toLocaleDateString();
        return 'N/A';
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border dark:border-gray-700" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full border-2 border-indigo-100 object-cover" />
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{user.name}</h2>
                            <div className="flex gap-2 text-sm mt-1">
                                <span className="text-gray-500 dark:text-gray-400 font-mono">{user.piNumber}</span>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                <span className="text-gray-500 dark:text-gray-400">{user.email}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400">&times;</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-x-auto">
                    {['profile', 'financials', 'membership', 'collabs', 'kyc'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-6 py-3 text-sm font-semibold whitespace-nowrap capitalize border-b-2 transition-colors ${
                                activeTab === tab 
                                    ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-gray-800 dark:text-indigo-400' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            {tab === 'financials' ? 'Financials' : tab === 'collabs' ? 'Collaborations' : tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-900">
                    
                    {/* 1. PROFILE */}
                    {activeTab === 'profile' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                                <h3 className="font-bold text-lg mb-4 dark:text-white">Personal Details</h3>
                                <dl className="space-y-3">
                                    <div className="flex justify-between border-b dark:border-gray-700 pb-2"><dt className="text-gray-500 dark:text-gray-400">Name</dt><dd className="font-medium dark:text-white">{user.name}</dd></div>
                                    <div className="flex justify-between border-b dark:border-gray-700 pb-2"><dt className="text-gray-500 dark:text-gray-400">Email</dt><dd className="font-medium dark:text-white">{user.email}</dd></div>
                                    <div className="flex justify-between border-b dark:border-gray-700 pb-2"><dt className="text-gray-500 dark:text-gray-400">Mobile</dt><dd className="font-medium dark:text-white">{user.mobileNumber || 'N/A'}</dd></div>
                                    <div className="flex justify-between border-b dark:border-gray-700 pb-2"><dt className="text-gray-500 dark:text-gray-400">Role</dt><dd className="font-medium capitalize dark:text-white">{user.role}</dd></div>
                                    <div className="flex justify-between border-b dark:border-gray-700 pb-2"><dt className="text-gray-500 dark:text-gray-400">Location</dt><dd className="font-medium dark:text-white">{user.location || 'N/A'}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Status</dt><dd className={`font-medium ${user.isBlocked ? 'text-red-500' : 'text-green-500'}`}>{user.isBlocked ? 'Blocked' : 'Active'}</dd></div>
                                </dl>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                                <h3 className="font-bold text-lg mb-4 dark:text-white">System Details</h3>
                                <dl className="space-y-3">
                                    <div className="flex justify-between border-b dark:border-gray-700 pb-2"><dt className="text-gray-500 dark:text-gray-400">User ID</dt><dd className="font-mono text-xs dark:text-white">{user.id}</dd></div>
                                    <div className="flex justify-between border-b dark:border-gray-700 pb-2"><dt className="text-gray-500 dark:text-gray-400">Profile ID (PI)</dt><dd className="font-mono dark:text-white">{user.piNumber}</dd></div>
                                    <div className="flex justify-between border-b dark:border-gray-700 pb-2"><dt className="text-gray-500 dark:text-gray-400">Referral Code</dt><dd className="font-mono dark:text-white">{user.referralCode || 'N/A'}</dd></div>
                                    <div className="flex justify-between border-b dark:border-gray-700 pb-2"><dt className="text-gray-500 dark:text-gray-400">Wallet</dt><dd className="font-bold text-green-600">{user.coins || 0} Coins</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Company</dt><dd className="font-medium dark:text-white">{user.companyName || 'N/A'}</dd></div>
                                </dl>
                            </div>
                        </div>
                    )}

                    {/* 2. FINANCIALS */}
                    {activeTab === 'financials' && (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                                <h3 className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 font-bold text-gray-700 dark:text-gray-200 border-b dark:border-gray-700">Payments Made (Transactions)</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                            <tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Description</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3">Status</th></tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-700">
                                            {userTransactions.length === 0 ? <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No transactions found.</td></tr> : 
                                            userTransactions.map(t => (
                                                <tr key={t.transactionId} className="dark:text-gray-300">
                                                    <td className="px-6 py-3">{formatDate(t.timestamp)}</td>
                                                    <td className="px-6 py-3 truncate max-w-xs">{t.description}</td>
                                                    <td className="px-6 py-3 text-red-500">-{formatCurrency(t.amount)}</td>
                                                    <td className="px-6 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${t.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{t.status}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                                <h3 className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 font-bold text-gray-700 dark:text-gray-200 border-b dark:border-gray-700">Payouts (Earnings)</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                            <tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Source</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3">Status</th></tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-700">
                                            {userPayouts.length === 0 ? <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No payouts found.</td></tr> :
                                            userPayouts.map(p => (
                                                <tr key={p.id} className="dark:text-gray-300">
                                                    <td className="px-6 py-3">{formatDate(p.timestamp)}</td>
                                                    <td className="px-6 py-3">{p.collaborationTitle}</td>
                                                    <td className="px-6 py-3 text-green-500">+{formatCurrency(p.amount)}</td>
                                                    <td className="px-6 py-3 capitalize">{p.status.replace('_', ' ')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. MEMBERSHIP */}
                    {activeTab === 'membership' && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                            <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
                                <h3 className="font-bold text-lg dark:text-white">Membership Status</h3>
                                {!editingMembership && (
                                    <button onClick={() => setEditingMembership(true)} className="text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                                        <PencilIcon className="w-4 h-4" /> Edit Access
                                    </button>
                                )}
                            </div>
                            
                            {editingMembership ? (
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                    <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-4">Admin Override</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Plan</label>
                                            <select value={newPlan} onChange={e => setNewPlan(e.target.value as MembershipPlan)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                                <option value="free">Free</option>
                                                <option value="basic">Basic</option>
                                                <option value="pro">Pro</option>
                                                <option value="premium">Premium</option>
                                                <option value="pro_10">Pro 10</option>
                                                <option value="pro_20">Pro 20</option>
                                                <option value="pro_unlimited">Pro Unlimited</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
                                            <input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 mt-6">
                                        <button onClick={handleUpdateMembership} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Save Changes</button>
                                        <button onClick={() => setEditingMembership(false)} className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Current Plan</p>
                                        <p className="text-xl font-bold capitalize text-indigo-600 dark:text-indigo-400">{user.membership?.plan.replace(/_/g, ' ') || 'Free'}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Expires On</p>
                                        <p className="text-xl font-bold dark:text-white">{formatDate(user.membership?.expiresAt)}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg col-span-1 md:col-span-2">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Active Status</p>
                                        <p className={`text-xl font-bold ${user.membership?.isActive ? 'text-green-600' : 'text-red-500'}`}>{user.membership?.isActive ? 'Active' : 'Inactive'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. COLLABS */}
                    {activeTab === 'collabs' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                            <h3 className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 font-bold text-gray-700 dark:text-gray-200 border-b dark:border-gray-700">Collaboration History</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                        <tr><th className="px-6 py-3">Title/Campaign</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Updated</th></tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {userCollabs.length === 0 ? <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No collaborations found.</td></tr> :
                                        userCollabs.map((c: any) => (
                                            <tr key={c.id} className="dark:text-gray-300">
                                                <td className="px-6 py-3 font-medium">{c.title || c.campaignTitle || c.campaignName}</td>
                                                <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{c.brandId === user.id ? 'Brand' : 'Provider'}</td>
                                                <td className="px-6 py-3"><span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-xs capitalize">{c.status.replace(/_/g, ' ')}</span></td>
                                                <td className="px-6 py-3">{formatDate(c.timestamp)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 5. KYC */}
                    {activeTab === 'kyc' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                                <h3 className="font-bold text-lg mb-4 dark:text-white border-b dark:border-gray-700 pb-2">User Identity (KYC)</h3>
                                <dl className="space-y-3">
                                    <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className={`font-bold capitalize ${user.kycStatus === 'approved' ? 'text-green-600' : 'text-yellow-600'}`}>{user.kycStatus.replace(/_/g, ' ')}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500">ID Type</dt><dd className="dark:text-white">{user.kycDetails?.idType || 'N/A'}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500">ID Number</dt><dd className="dark:text-white font-mono">{user.kycDetails?.idNumber || 'N/A'}</dd></div>
                                </dl>
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    {user.kycDetails?.idProofUrl && <a href={user.kycDetails.idProofUrl} target="_blank" rel="noreferrer" className="bg-gray-100 p-2 rounded text-center text-xs text-blue-600 block">ID Proof</a>}
                                    {user.kycDetails?.panCardUrl && <a href={user.kycDetails.panCardUrl} target="_blank" rel="noreferrer" className="bg-gray-100 p-2 rounded text-center text-xs text-blue-600 block">PAN Card</a>}
                                    {user.kycDetails?.selfieUrl && <a href={user.kycDetails.selfieUrl} target="_blank" rel="noreferrer" className="bg-gray-100 p-2 rounded text-center text-xs text-blue-600 block">Selfie</a>}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                                <h3 className="font-bold text-lg mb-4 dark:text-white border-b dark:border-gray-700 pb-2">Creator / Business Verification</h3>
                                <dl className="space-y-3">
                                    <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className={`font-bold capitalize ${user.creatorVerificationStatus === 'approved' ? 'text-green-600' : 'text-yellow-600'}`}>{user.creatorVerificationStatus?.replace(/_/g, ' ') || 'N/A'}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500">GST Name</dt><dd className="dark:text-white">{user.creatorVerificationDetails?.gstRegisteredName || 'N/A'}</dd></div>
                                </dl>
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    {user.creatorVerificationDetails?.registrationDocUrl && <a href={user.creatorVerificationDetails.registrationDocUrl} target="_blank" rel="noreferrer" className="bg-gray-100 p-2 rounded text-center text-xs text-blue-600 block">Reg Doc</a>}
                                    {user.creatorVerificationDetails?.officePhotoUrl && <a href={user.creatorVerificationDetails.officePhotoUrl} target="_blank" rel="noreferrer" className="bg-gray-100 p-2 rounded text-center text-xs text-blue-600 block">Office Photo</a>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- User Management Panel ---

const UserManagementPanel: React.FC<{
    users: User[];
    allTransactions: Transaction[];
    allPayouts: PayoutRequest[];
    allCollabs: AnyCollaboration[];
    onUpdate: () => void;
}> = ({ users, allTransactions, allPayouts, allCollabs, onUpdate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showAddUserModal, setShowAddUserModal] = useState(false);

    const filteredUsers = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return users.filter(u => 
            u.name.toLowerCase().includes(lower) ||
            u.email.toLowerCase().includes(lower) ||
            (u.mobileNumber && u.mobileNumber.includes(lower)) ||
            u.id.toLowerCase().includes(lower) ||
            (u.piNumber && u.piNumber.toLowerCase().includes(lower))
        );
    }, [users, searchTerm]);

    const handleBlock = async (user: User) => {
        if (window.confirm(`Are you sure you want to ${user.isBlocked ? 'unblock' : 'block'} ${user.name}?`)) {
            await apiService.updateUserProfile(user.id, { isBlocked: !user.isBlocked });
            onUpdate();
        }
    };

    const handleDelete = async (user: User) => {
        if (window.confirm(`DANGER: Are you sure you want to DELETE ${user.name}? This cannot be undone.`)) {
            const confirmName = prompt(`Type "${user.name}" to confirm deletion:`);
            if (confirmName === user.name) {
                await apiService.deleteUser(user.id);
                onUpdate();
            } else {
                alert("Name did not match. Deletion cancelled.");
            }
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center flex-wrap gap-4 bg-white dark:bg-gray-800">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">User Management</h2>
                <div className="flex gap-4 items-center">
                    <div className="relative w-64">
                        <input 
                            type="text" 
                            placeholder="Search users..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                    <button onClick={() => setShowAddUserModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2 shadow-md transition-all hover:shadow-lg">
                        <PlusIcon className="w-5 h-5" /> Create User
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs uppercase font-semibold border-b dark:border-gray-600">
                            <tr>
                                <th className="p-4">User Name</th>
                                <th className="p-4">User ID (PI)</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Email</th>
                                <th className="p-4">Mobile</th>
                                <th className="p-4">Membership</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200 border dark:border-gray-600" />
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white text-sm">{user.name}</p>
                                                {user.companyName && <p className="text-xs text-gray-500">{user.companyName}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm">
                                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{user.piNumber || 'N/A'}</span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize 
                                            ${user.role === 'brand' ? 'bg-blue-100 text-blue-800' : 
                                              user.role === 'influencer' ? 'bg-purple-100 text-purple-800' : 
                                              user.role === 'staff' ? 'bg-gray-800 text-white' :
                                              'bg-gray-100 text-gray-800'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm dark:text-gray-300 truncate max-w-[150px]" title={user.email}>
                                        {user.email}
                                    </td>
                                    <td className="p-4 text-sm dark:text-gray-300">
                                        {user.mobileNumber || '-'}
                                    </td>
                                    <td className="p-4">
                                        {user.membership?.isActive ? (
                                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-200">
                                                {user.membership.plan.replace(/_/g, ' ').replace('pro', 'Pro')}
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full border border-red-200">Inactive</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => setSelectedUser(user)} 
                                                className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 shadow-sm"
                                                title="View Full Details"
                                            >
                                                <EyeIcon className="w-4 h-4" /> View Details
                                            </button>
                                            <button 
                                                onClick={() => handleBlock(user)} 
                                                className={`${user.isBlocked ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'} border px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1`}
                                                title={user.isBlocked ? "Unblock User" : "Block User"}
                                            >
                                                {user.isBlocked ? <LockOpenIcon className="w-4 h-4" /> : <LockClosedIcon className="w-4 h-4" />}
                                                {user.isBlocked ? 'Unblock' : 'Block'}
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(user)} 
                                                className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1"
                                                title="Delete User"
                                            >
                                                <TrashIcon className="w-4 h-4" /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedUser && (
                <UserDetailsModal 
                    user={selectedUser} 
                    onClose={() => setSelectedUser(null)} 
                    allTransactions={allTransactions}
                    allPayouts={allPayouts}
                    allCollabs={allCollabs}
                    onUpdate={() => { onUpdate(); setSelectedUser(null); }}
                />
            )}
            {showAddUserModal && (
                <AddUserModal 
                    onClose={() => setShowAddUserModal(false)} 
                    onUserAdded={() => { onUpdate(); }} 
                />
            )}
        </div>
    );
};

// --- Main Admin Panel Component ---

type AdminTab = 'dashboard' | 'user_management' | 'staff_management' | 'collaborations' | 'kyc' | 'creator_verification' | 'payouts' | 'payment_history' | 'community' | 'live_help' | 'marketing' | 'disputes' | 'discounts' | 'platform_banners' | 'client_brands' | 'top_influencers' | 'support_tickets';

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

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, allUsers, allTransactions, allPayouts, allCollabs, allRefunds, allDailyPayouts, platformSettings, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

    const tabs: { id: AdminTab; label: string; icon: React.FC<{className?: string}>, permission?: StaffPermission }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: AnalyticsIcon },
        { id: 'user_management', label: 'User Management', icon: UserGroupIcon, permission: 'user_management' },
        { id: 'creator_verification', label: 'Verifications', icon: CheckBadgeIcon, permission: 'kyc' },
        { id: 'payouts', label: 'Payouts', icon: PaymentIcon, permission: 'financial' },
        { id: 'payment_history', label: 'History', icon: PaymentIcon, permission: 'financial' },
        { id: 'marketing', label: 'Marketing', icon: EnvelopeIcon, permission: 'marketing' },
        { id: 'live_help', label: 'Live Chat', icon: ChatBubbleLeftEllipsisIcon, permission: 'support' },
        { id: 'support_tickets', label: 'Tickets', icon: ExclamationTriangleIcon, permission: 'support' },
        { id: 'platform_banners', label: 'Banners', icon: BannerAdsIcon, permission: 'marketing' },
        { id: 'client_brands', label: 'Partners', icon: RocketIcon, permission: 'marketing' },
        { id: 'top_influencers', label: 'Top 10', icon: TrophyIcon, permission: 'marketing' },
        { id: 'community', label: 'Community', icon: CommunityIcon, permission: 'community' },
    ];

    const combinedCollaborations: CombinedCollabItem[] = allCollabs.map(c => ({
        id: c.id,
        type: 'unknown', // Simplification
        title: 'title' in c ? c.title : 'campaignTitle' in c ? c.campaignTitle : 'campaignName' in c ? c.campaignName : 'Unknown',
        customerName: c.brandName,
        customerAvatar: c.brandAvatar,
        providerName: 'influencerName' in c ? c.influencerName : 'liveTvName' in c ? c.liveTvName : 'agencyName' in c ? c.agencyName : '',
        providerAvatar: 'influencerAvatar' in c ? c.influencerAvatar : 'liveTvAvatar' in c ? c.liveTvAvatar : 'agencyAvatar' in c ? c.agencyAvatar : '',
        status: c.status,
        paymentStatus: c.paymentStatus || 'pending',
        payoutStatus: 'pending', // Derived logic simplified
        originalData: c
    }));

    return (
        <div className="flex h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">
            {/* Admin Sidebar */}
            <div className="w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex-shrink-0 overflow-y-auto">
                <div className="p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Admin Panel</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Super Admin Access</p>
                </div>
                <nav className="p-2 space-y-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === tab.id 
                                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' 
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            <tab.icon className="mr-3 h-5 w-5" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 relative">
                {activeTab === 'dashboard' && (
                    <div className="p-8">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Dashboard Overview</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{allUsers.length}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Transactions</p>
                                <p className="text-3xl font-bold text-green-600 dark:text-green-400">₹{allTransactions.reduce((acc, t) => acc + t.amount, 0).toLocaleString()}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Payouts</p>
                                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{allPayouts.filter(p => p.status === 'pending').length}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Open Disputes</p>
                                <p className="text-3xl font-bold text-red-600 dark:text-red-400">0</p>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'user_management' && (
                    <UserManagementPanel 
                        users={allUsers} 
                        allTransactions={allTransactions} 
                        allPayouts={allPayouts} 
                        allCollabs={allCollabs} 
                        onUpdate={onUpdate} 
                    />
                )}
                {activeTab === 'creator_verification' && (
                    <div className="p-6">
                        <h3 className="text-xl font-bold mb-4">Verification Requests</h3>
                        <p>Use the Users tab to view verification details per user.</p>
                    </div>
                )}
                {activeTab === 'payouts' && (
                    <PayoutsPanel 
                        payouts={allPayouts} 
                        refunds={allRefunds} 
                        dailyPayouts={allDailyPayouts} 
                        collaborations={combinedCollaborations} 
                        allTransactions={allTransactions} 
                        allUsers={allUsers} 
                        onUpdate={onUpdate} 
                    />
                )}
                {activeTab === 'payment_history' && (
                    <AdminPaymentHistoryPage 
                        transactions={allTransactions} 
                        payouts={allPayouts} 
                        allUsers={allUsers} 
                        collaborations={combinedCollaborations} 
                    />
                )}
                {activeTab === 'top_influencers' && <div className="p-6 overflow-y-auto h-full"><TopInfluencersList /></div>}
                {activeTab === 'community' && <CommunityPage user={user} feedType="global" />}
                {activeTab === 'live_help' && <LiveHelpPanel adminUser={user} />}
                {activeTab === 'marketing' && <MarketingPanel allUsers={allUsers} platformSettings={platformSettings} onUpdate={onUpdate} />}
                {activeTab === 'support_tickets' && <SupportAdminPage user={user} />}
                {activeTab === 'platform_banners' && <PlatformBannerPanel onUpdate={onUpdate} />}
                {activeTab === 'client_brands' && <PartnersPanel onUpdate={onUpdate} />}
            </div>
        </div>
    );
};
