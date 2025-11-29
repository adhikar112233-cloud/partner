
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiService } from '../services/apiService';
import { PlatformSettings, User, PayoutRequest, Post, Transaction, AnyCollaboration, CollaborationRequest, CampaignApplication, AdSlotRequest, BannerAdBookingRequest, PlatformBanner, UserRole, StaffPermission, RefundRequest, DailyPayoutRequest, Dispute, CombinedCollabItem, Partner, DiscountSetting, Leaderboard, LeaderboardEntry, Agreements, KycDetails, CreatorVerificationDetails } from '../types';
import { Timestamp } from 'firebase/firestore';
import AdminPaymentHistoryPage from './AdminPaymentHistoryPage';
import { AnalyticsIcon, PaymentIcon, CommunityIcon, SupportIcon, CollabIcon, AdminIcon as KycIcon, UserGroupIcon, SparklesIcon, RocketIcon, ExclamationTriangleIcon, BannerAdsIcon, CheckBadgeIcon, TrophyIcon, DocumentTextIcon, SearchIcon, PencilIcon, TrashIcon, EyeIcon, LockClosedIcon, LockOpenIcon, BanknotesIcon, AdminIcon } from './Icons';
import LiveHelpPanel from './LiveHelpPanel';
import PayoutsPanel from './PayoutsPanel';
import MarketingPanel from './MarketingPanel';
import PlatformBannerPanel from './PlatformBannerPanel';
import { authService } from '../services/authService';
import PartnersPanel from './PartnersPanel';
import LeaderboardManager from './LeaderboardManager';
import UserManagementPanel from './UserManagementPanel';
import CollabDetailsModal from './CollabDetailsModal';
import StaffLoginModal from './StaffLoginModal';
import CommunityPage from './CommunityPage';
import UserDetailView from './UserDetailView';

type AdminTab = 'dashboard' | 'user_management' | 'staff_management' | 'collaborations' | 'kyc' | 'creator_verification' | 'payouts' | 'payment_history' | 'community' | 'live_help' | 'marketing' | 'disputes' | 'discounts' | 'platform_banners' | 'client_brands' | 'leaderboards' | 'agreements' | 'emi_management';

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

const toJsDate = (ts: any): Date | undefined => {
    if (!ts) return undefined;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    if (ts.seconds !== undefined && ts.nanoseconds !== undefined) return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
    return undefined;
};

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
    <button
        type="button"
        className={`${enabled ? 'bg-indigo-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
    >
        <span
            aria-hidden="true"
            className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);

const STAFF_PERMISSIONS_CONFIG: { id: StaffPermission; label: string; description: string }[] = [
    { id: 'super_admin', label: 'Super Admin', description: 'Full access to all settings and panels.' },
    { id: 'user_management', label: 'User Management', description: 'Manage users, block accounts, reset passwords.' },
    { id: 'financial', label: 'Financials & Payouts', description: 'Process payouts, refunds, EMI, and view transaction history.' },
    { id: 'collaborations', label: 'Collaborations', description: 'View and manage collaboration requests.' },
    { id: 'kyc', label: 'KYC & Verification', description: 'Approve or reject KYC documents and creator verifications.' },
    { id: 'support', label: 'Support Tickets', description: 'Manage and reply to support tickets.' },
    { id: 'live_help', label: 'Live Help Chat', description: 'Respond to live chat requests from users.' },
    { id: 'community', label: 'Community Mod', description: 'Moderate community posts and comments.' },
    { id: 'marketing', label: 'Marketing & Ads', description: 'Manage banners, partners, push notifications, and emails.' },
    { id: 'analytics', label: 'Analytics', description: 'View dashboard analytics.' },
];

const StaffPermissionModal: React.FC<{
    user: User;
    onClose: () => void;
    onSave: () => void;
}> = ({ user, onClose, onSave }) => {
    const [permissions, setPermissions] = useState<StaffPermission[]>(user.staffPermissions || []);
    const [isSaving, setIsSaving] = useState(false);

    const togglePermission = (permId: StaffPermission) => {
        if (permissions.includes(permId)) {
            setPermissions(prev => prev.filter(p => p !== permId));
        } else {
            setPermissions(prev => [...prev, permId]);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiService.updateUser(user.id, { staffPermissions: permissions });
            onSave();
            onClose();
        } catch (error) {
            console.error("Failed to update permissions:", error);
            alert("Failed to update staff permissions.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[80] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Edit Permissions</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Managing roles for <span className="font-semibold text-gray-800 dark:text-gray-200">{user.name}</span> ({user.email})
                </p>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {STAFF_PERMISSIONS_CONFIG.map((perm) => {
                        const isChecked = permissions.includes(perm.id);
                        return (
                            <label key={perm.id} className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={isChecked} 
                                    onChange={() => togglePermission(perm.id)}
                                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <div className="ml-3">
                                    <span className={`block text-sm font-medium ${isChecked ? 'text-indigo-800 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {perm.label}
                                    </span>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {perm.description}
                                    </span>
                                </div>
                            </label>
                        );
                    })}
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                    <button 
                        onClick={onClose} 
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Permissions'}
                    </button>
                </div>
            </div>
        </div>
    );
};

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

            const updateData: any = {};
            if (action === 'refund') {
                updateData.status = 'rejected';
                updateData.rejectionReason = "Admin resolved dispute: Refund approved. Please request a refund.";
            } else if (action === 'payout') {
                updateData.status = 'completed';
            } else if (action === 'reverify') {
                updateData.status = 'work_submitted'; 
            }

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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Resolve Dispute</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl">&times;</button>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">Choose an action to resolve the dispute for <strong>{dispute.collaborationTitle}</strong>.</p>
                <div className="space-y-3">
                    <button onClick={() => handleAction('refund')} disabled={isResolving} className="w-full flex items-center justify-between px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
                        <span className="font-semibold">1. Refund to Brand</span><span className="text-xs opacity-70">Mark Rejected & Allow Refund</span>
                    </button>
                    <button onClick={() => handleAction('payout')} disabled={isResolving} className="w-full flex items-center justify-between px-4 py-3 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50">
                        <span className="font-semibold">2. Payout to Creator</span><span className="text-xs opacity-70">Mark Completed & Allow Payout</span>
                    </button>
                    <button onClick={() => handleAction('reverify')} disabled={isResolving} className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50">
                        <span className="font-semibold">3. Brand Re-verify</span><span className="text-xs opacity-70">Reset to 'Work Submitted'</span>
                    </button>
                </div>
                <div className="mt-6 text-center">
                    <button onClick={onClose} disabled={isResolving} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:underline">Cancel</button>
                </div>
            </div>
        </div>
    );
};

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
            d.id.toLowerCase().includes(lower) ||
            (d.collabId && d.collabId.toLowerCase().includes(lower))
        );
    }, [disputes, searchQuery]);

    return (
        <div className="p-4 sm:p-6 h-full overflow-y-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold dark:text-white">Disputes</h2>
                <div className="relative w-full sm:w-64">
                    <input type="text" placeholder="Search by ID, Collab ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                    <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
            </div>
            {filteredDisputes.length === 0 ? <p className="dark:text-gray-400">No open disputes found.</p> : (
                <div className="w-full overflow-x-auto">
                    <div className="space-y-4 min-w-[300px]">
                        {filteredDisputes.map(d => (
                            <div key={d.id} className="bg-white dark:bg-gray-800 p-4 rounded shadow border-l-4 border-red-500">
                                <div className="flex justify-between flex-wrap gap-2">
                                    <div>
                                        <p className="font-bold dark:text-white break-all">Dispute on: {d.collaborationTitle}</p>
                                        <p className="text-xs text-indigo-500 font-mono">Collab ID: {d.collabId || 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-mono text-gray-400 block">ID: {d.id}</span>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">By: {d.disputedByName} vs {d.disputedAgainstName}</p>
                                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm italic dark:text-gray-300 max-h-32 overflow-y-auto">
                                    {d.reason}
                                </div>
                                <p className="mt-2 font-bold dark:text-gray-200">Amount: ₹{d.amount}</p>
                                {d.status !== 'resolved' && (
                                    <div className="mt-4 flex justify-end pt-3 border-t dark:border-gray-700">
                                        <button onClick={() => setSelectedDispute(d)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"><CheckBadgeIcon className="w-4 h-4" />Resolve</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {selectedDispute && <DisputeResolutionModal dispute={selectedDispute} onClose={() => setSelectedDispute(null)} onResolve={onUpdate} />}
        </div>
    );
};

const DashboardPanel: React.FC<{ users: User[], collaborations: CombinedCollabItem[], transactions: Transaction[], payouts: PayoutRequest[], dailyPayouts: DailyPayoutRequest[] }> = ({ users, collaborations, transactions, payouts, dailyPayouts }) => {
    const totalUsers = users.length;
    const activeCollabs = collaborations.filter(c => ['in_progress', 'work_submitted', 'disputed'].includes(c.status)).length;
    const totalRevenue = transactions.filter(t => t.type === 'payment' && t.status === 'completed').reduce((acc, t) => acc + t.amount, 0);
    const pendingPayouts = payouts.filter(p => p.status === 'pending').length + dailyPayouts.filter(d => d.status === 'pending').length;

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Admin Dashboard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border-l-4 border-indigo-500">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalUsers}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border-l-4 border-green-500">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active Collabs</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{activeCollabs}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border-l-4 border-purple-500">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">₹{totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border-l-4 border-yellow-500">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pending Payouts</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{pendingPayouts}</p>
                </div>
            </div>
        </div>
    );
};

const EmiDashboardPanel: React.FC<{ collaborations: CombinedCollabItem[], currentUser: User }> = ({ collaborations, currentUser }) => {
    const [sendingReminder, setSendingReminder] = useState<string | null>(null);
    const [selectedCollabData, setSelectedCollabData] = useState<AnyCollaboration | null>(null);

    const pendingEmis = useMemo(() => {
        const emis: any[] = [];
        collaborations.forEach(collab => {
            const data = collab.originalData as any;
            if (data.paymentPlan === 'emi' && data.emiSchedule) {
                data.emiSchedule.forEach((emi: any) => {
                    if (emi.status !== 'paid') {
                        emis.push({
                            ...emi,
                            collabTitle: collab.title,
                            collabId: collab.id,
                            visibleCollabId: collab.visibleCollabId,
                            brandId: data.brandId,
                            brandName: data.brandName,
                            dueDateObj: new Date(emi.dueDate)
                        });
                    }
                });
            }
        });
        return emis.sort((a, b) => a.dueDateObj.getTime() - b.dueDateObj.getTime());
    }, [collaborations]);

    const handleSendReminder = async (emi: any) => {
        if (!emi.brandId) return;
        setSendingReminder(emi.id);
        try {
            await apiService.sendUserNotification(
                emi.brandId,
                "Payment Reminder",
                `Your EMI payment for ${emi.collabTitle} (${emi.description}) is due on ${emi.dueDateObj.toLocaleDateString()}. Please pay to avoid penalties.`
            );
            alert("Reminder sent successfully!");
        } catch (error) {
            console.error("Failed to send reminder:", error);
            alert("Failed to send reminder.");
        } finally {
            setSendingReminder(null);
        }
    };

    const handleViewDetails = (collabId: string) => {
        const collab = collaborations.find(c => c.id === collabId);
        if (collab) {
            setSelectedCollabData(collab.originalData);
        }
    };

    return (
        <div className="p-6 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">EMI Management</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Collab ID</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Due Date</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Amount</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Campaign</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Brand</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Status</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingEmis.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-gray-500">No pending EMI payments found.</td></tr>
                        ) : (
                            pendingEmis.map((emi) => {
                                const isOverdue = emi.dueDateObj < new Date();
                                return (
                                    <tr key={`${emi.collabId}-${emi.id}`} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="p-4 font-mono text-xs text-gray-500 dark:text-gray-400">{emi.visibleCollabId || '-'}</td>
                                        <td className="p-4 dark:text-white">
                                            {emi.dueDateObj.toLocaleDateString()}
                                            {isOverdue && <span className="ml-2 text-xs text-red-500 font-bold">OVERDUE</span>}
                                        </td>
                                        <td className="p-4 font-bold text-gray-800 dark:text-gray-200">₹{emi.amount.toLocaleString()}</td>
                                        <td className="p-4">
                                            <div className="font-medium dark:text-white">{emi.collabTitle}</div>
                                        </td>
                                        <td className="p-4 dark:text-gray-300">{emi.brandName}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs capitalize ${isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {isOverdue ? 'Overdue' : 'Pending'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleViewDetails(emi.collabId)}
                                                    className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded text-xs font-semibold"
                                                >
                                                    View Details
                                                </button>
                                                <button 
                                                    onClick={() => handleSendReminder(emi)}
                                                    disabled={sendingReminder === emi.id}
                                                    className="px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded text-xs font-semibold disabled:opacity-50"
                                                >
                                                    {sendingReminder === emi.id ? 'Sending...' : 'Send Reminder'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            {selectedCollabData && (
                <CollabDetailsModal 
                    collab={selectedCollabData} 
                    onClose={() => setSelectedCollabData(null)} 
                    currentUser={currentUser} 
                />
            )}
        </div>
    );
};

const StaffManagementPanel: React.FC<{ staffUsers: User[], onUpdate: () => void, platformSettings: PlatformSettings }> = ({ staffUsers, onUpdate, platformSettings }) => {
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [editingPermissionsUser, setEditingPermissionsUser] = useState<User | null>(null);

    return (
        <div className="p-6 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Staff Management</h2>
                <button onClick={() => setIsLoginModalOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2">
                    <AdminIcon className="w-4 h-4" /> Add Staff
                </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Name</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Email</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300">Role</th>
                            <th className="p-4 text-gray-600 dark:text-gray-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffUsers.map(u => (
                            <tr key={u.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="p-4 dark:text-white font-medium">{u.name}</td>
                                <td className="p-4 dark:text-white text-sm">{u.email}</td>
                                <td className="p-4 capitalize dark:text-white text-sm">
                                    {u.staffPermissions?.includes('super_admin') ? (
                                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold">Super Admin</span>
                                    ) : 'Staff'}
                                </td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={() => setEditingPermissionsUser(u)} 
                                        className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                        title="Edit Permissions"
                                    >
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isLoginModalOpen && <StaffLoginModal onClose={() => { setIsLoginModalOpen(false); onUpdate(); }} platformSettings={platformSettings} />}
            {editingPermissionsUser && (
                <StaffPermissionModal 
                    user={editingPermissionsUser} 
                    onClose={() => setEditingPermissionsUser(null)} 
                    onSave={onUpdate} 
                />
            )}
        </div>
    );
};

const CollaborationsPanel: React.FC<{ collaborations: CombinedCollabItem[], allTransactions: Transaction[], onUpdate: (id: string, type: string, data: any) => Promise<void>, currentUser: User }> = ({ collaborations, onUpdate, currentUser }) => {
    const [selectedCollab, setSelectedCollab] = useState<CombinedCollabItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCollaborations = useMemo(() => {
        if (!searchQuery) return collaborations;
        const lower = searchQuery.toLowerCase();
        return collaborations.filter(c => 
            c.title.toLowerCase().includes(lower) ||
            c.customerName.toLowerCase().includes(lower) ||
            c.providerName.toLowerCase().includes(lower) ||
            (c.visibleCollabId && c.visibleCollabId.toLowerCase().includes(lower)) ||
            c.status.toLowerCase().includes(lower)
        );
    }, [collaborations, searchQuery]);

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">All Collaborations</h2>
                <div className="relative w-full sm:w-64">
                    <input 
                        type="text" 
                        placeholder="Search by Title, Collab ID..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
            </div>
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="p-4">Type</th>
                            <th className="p-4">Title</th>
                            <th className="p-4">Collab ID</th>
                            <th className="p-4">Users</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCollaborations.map(c => (
                            <tr key={c.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="p-4 text-sm dark:text-gray-300">{c.type}</td>
                                <td className="p-4 font-medium dark:text-white">{c.title}</td>
                                <td className="p-4 text-sm font-mono text-gray-500 dark:text-gray-400">{c.visibleCollabId || '-'}</td>
                                <td className="p-4 text-sm dark:text-gray-300">{c.customerName} & {c.providerName}</td>
                                <td className="p-4"><span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs capitalize">{c.status.replace('_', ' ')}</span></td>
                                <td className="p-4"><button onClick={() => setSelectedCollab(c)} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">View</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {selectedCollab && <CollabDetailsModal collab={selectedCollab.originalData} onClose={() => setSelectedCollab(null)} currentUser={currentUser} />}
        </div>
    );
};

const KycPanel: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    useEffect(() => { apiService.getKycSubmissions().then(setUsers); }, []);
    
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">KYC Approvals</h2>
            <div className="grid gap-4">
                {users.map(u => (
                    <div key={u.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center">
                        <div><p className="font-bold dark:text-white">{u.name}</p><p className="text-sm text-gray-500">{u.email}</p></div>
                        <button onClick={() => setSelectedUser(u)} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">Review</button>
                    </div>
                ))}
                {users.length === 0 && <p className="text-gray-500">No pending KYC submissions.</p>}
            </div>
            {selectedUser && <UserDetailView user={selectedUser} onClose={() => { setSelectedUser(null); onUpdate(); }} onUpdateUser={onUpdate} transactions={[]} payouts={[]} collabs={[]} />}
        </div>
    );
};

const CreatorVerificationPanel: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    useEffect(() => { apiService.getPendingCreatorVerifications().then(setUsers); }, []);

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Creator Verifications</h2>
            <div className="grid gap-4">
                {users.map(u => (
                    <div key={u.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center">
                        <div><p className="font-bold dark:text-white">{u.name}</p><p className="text-sm text-gray-500">{u.role}</p></div>
                        <button onClick={() => setSelectedUser(u)} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">Review</button>
                    </div>
                ))}
                {users.length === 0 && <p className="text-gray-500">No pending verifications.</p>}
            </div>
            {selectedUser && <UserDetailView user={selectedUser} onClose={() => { setSelectedUser(null); onUpdate(); }} onUpdateUser={onUpdate} transactions={[]} payouts={[]} collabs={[]} />}
        </div>
    );
};

const CommunityManagementPanel: React.FC = () => {
    // Creating a mock admin user to pass to CommunityPage, as it requires a User prop
    // This allows reusing the CommunityPage component for moderation
    const mockAdminUser: User = { id: 'admin_view', name: 'Admin View', email: 'admin@system', role: 'staff', avatar: '', kycStatus: 'approved' } as User;
    return <CommunityPage user={mockAdminUser} feedType="global" />;
};

const DiscountSettingsPanel: React.FC<{ settings: PlatformSettings, setSettings: any, setIsDirty: any }> = ({ settings, setSettings, setIsDirty }) => {
    const handleChange = (key: keyof PlatformSettings['discountSettings'], field: 'isEnabled' | 'percentage', value: any) => {
        // Since we can't directly modify props, we rely on parent to pass updated settings or handle it via API call in a real scenario
        // Here we just display inputs. In a full implementation, `settings` would be state in this component or passed with a setter.
        // Assuming settings is immutable prop, this is just a placeholder UI.
        alert("Please use the main settings panel to update discounts.");
    };
    
    return (
        <div className="p-6 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Discount Settings</h2>
            <div className="space-y-4">
                {Object.entries(settings.discountSettings || {}).map(([key, setting]) => (
                    <div key={key} className="p-4 bg-white dark:bg-gray-800 rounded shadow">
                        <h3 className="font-bold capitalize mb-2 dark:text-white">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
                        <div className="flex gap-4 items-center">
                            <label className="flex items-center gap-2 dark:text-gray-300">
                                <input type="checkbox" checked={(setting as DiscountSetting).isEnabled} readOnly /> Enabled
                            </label>
                            <label className="flex items-center gap-2 dark:text-gray-300">
                                Percentage: <input type="number" value={(setting as DiscountSetting).percentage} readOnly className="w-16 p-1 border rounded dark:bg-gray-700" />%
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Go to Settings &gt; Platform Settings to edit.</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AgreementsPanel: React.FC = () => {
    const [agreements, setAgreements] = useState<Agreements>({ brand: '', influencer: '', livetv: '', banneragency: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        apiService.getAgreements().then(setAgreements);
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        await apiService.updateAgreements(agreements);
        setIsSaving(false);
        alert('Agreements saved!');
    };

    return (
        <div className="p-6 h-full flex flex-col overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Legal Agreements</h2>
                <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">Save All</button>
            </div>
            <div className="flex-1 space-y-6">
                {Object.keys(agreements).map((role) => (
                    <div key={role}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize">{role} Agreement</label>
                        <textarea
                            value={agreements[role as keyof Agreements]}
                            onChange={e => setAgreements({...agreements, [role]: e.target.value})}
                            rows={10}
                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
                            placeholder={`Enter agreement terms for ${role}... Use {{USER_NAME}} as placeholder.`}
                        />
                    </div>
                ))}
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
        const paymentMap = new Map<string, Transaction>();
        allTransactions.forEach(t => {
            if (t.type === 'payment' && t.status === 'completed') {
                paymentMap.set(t.relatedId, t);
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
            const transactionRef = paymentTx ? (paymentTx.paymentGatewayDetails?.referenceId || paymentTx.paymentGatewayDetails?.payment_id || paymentTx.transactionId) : undefined;
            const isDisputed = collab.status === 'disputed' || collab.status === 'brand_decision_pending' || collab.status === 'refund_pending_admin_review';

            return {
                id: collab.id,
                type: isDirect ? 'Direct' : isCampaign ? 'Campaign' : isLiveTv ? 'Live TV' : 'Banner Ad',
                title: ('title' in collab ? collab.title : null) || ('campaignTitle' in collab ? collab.campaignTitle : null) || ('campaignName' in collab ? collab.campaignName : 'N/A'),
                customerName: (customer as User)?.name || collab.brandName || 'Unknown',
                customerAvatar: (customer as User)?.avatar || collab.brandAvatar || '',
                customerPiNumber: (customer as User)?.piNumber,
                customerId: customerId,
                providerName: (provider as User)?.name || ('influencerName' in collab && collab.influencerName) || ('liveTvName' in collab && collab.liveTvName) || ('agencyName' in collab && collab.agencyName) || 'Unknown',
                providerAvatar: (provider as User)?.avatar || ('influencerAvatar' in collab && collab.influencerAvatar) || ('liveTvAvatar' in collab && collab.liveTvAvatar) || ('agencyAvatar' in collab && collab.agencyAvatar) || '',
                providerPiNumber: (provider as User)?.piNumber,
                providerId: providerId,
                date: toJsDate(collab.timestamp),
                status: collab.status as any,
                paymentStatus: collab.paymentStatus === 'paid' || collab.paymentStatus === 'payout_requested' || collab.paymentStatus === 'payout_complete' ? 'Paid' : 'Unpaid',
                payoutStatus: collab.paymentStatus === 'payout_requested' ? 'Requested' : collab.paymentStatus === 'payout_complete' ? 'Completed' : 'N/A',
                originalData: collab,
                visibleCollabId: collab.collabId,
                transactionRef: transactionRef,
                disputeStatus: isDisputed ? 'Active' : undefined
            };
        });
    }, [allCollabs, allUsers, allTransactions]);

    const tabs: { id: AdminTab; label: string; icon: React.FC<{className?: string}>, permission?: StaffPermission }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: AnalyticsIcon },
        { id: 'user_management', label: 'User Management', icon: UserGroupIcon, permission: 'user_management' },
        { id: 'staff_management', label: 'Staff Management', icon: UserGroupIcon, permission: 'super_admin' },
        { id: 'collaborations', label: 'Collaborations', icon: CollabIcon, permission: 'collaborations' },
        { id: 'emi_management', label: 'EMI Management', icon: BanknotesIcon, permission: 'financial' },
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
        onUpdate(); 
        if (activeTab === 'disputes') {
            fetchDisputes(); 
        }
    }, [onUpdate, activeTab, fetchDisputes]);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardPanel users={allUsers} collaborations={combinedCollaborations} transactions={allTransactions} payouts={allPayouts} dailyPayouts={allDailyPayouts} />;
            case 'user_management': return <UserManagementPanel allUsers={allUsers} onUpdate={handleRefresh} transactions={allTransactions} payouts={allPayouts} collabs={allCollabs} />;
            case 'staff_management': return <StaffManagementPanel staffUsers={staffUsers} onUpdate={handleRefresh} platformSettings={platformSettings} />;
            case 'collaborations': return <CollaborationsPanel collaborations={combinedCollaborations} allTransactions={allTransactions} onUpdate={handleCollabUpdate} currentUser={user} />;
            case 'emi_management': return <EmiDashboardPanel collaborations={combinedCollaborations} currentUser={user} />;
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
