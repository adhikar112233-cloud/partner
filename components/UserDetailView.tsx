
import React, { useState, useEffect } from 'react';
import { User, Transaction, PayoutRequest, AnyCollaboration, MembershipPlan, UserRole } from '../types';
import { apiService } from '../services/apiService';
import { Timestamp } from 'firebase/firestore';
import { ProfileIcon, PaymentIcon, MembershipIcon, CollabIcon, CheckBadgeIcon, DocumentIcon, LogoIcon, ChevronLeftIcon, ChevronRightIcon, ExclamationTriangleIcon } from './Icons';

interface UserDetailViewProps {
    user: User;
    users?: User[]; // List of users for navigation
    onSelectUser?: (user: User) => void; // Callback to switch user
    onClose: () => void;
    onUpdateUser: (userId: string, data: Partial<User>) => void;
    transactions: Transaction[];
    payouts: PayoutRequest[];
    collabs: AnyCollaboration[];
}

type Tab = 'profile' | 'financials' | 'membership' | 'collabs' | 'kyc';

const toJsDate = (ts: any): Date | undefined => {
    if (!ts) return undefined;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
    return undefined;
};

const UserDetailView: React.FC<UserDetailViewProps> = ({ user, users, onSelectUser, onClose, onUpdateUser, transactions, payouts, collabs }) => {
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [editProfile, setEditProfile] = useState({
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber || '',
        role: user.role,
        socialMediaLinks: ''
    });
    const [membershipEdit, setMembershipEdit] = useState({
        plan: user.membership?.plan || 'free',
        expiryDate: toJsDate(user.membership?.expiresAt)?.toISOString().split('T')[0] || ''
    });
    const [penaltyAmount, setPenaltyAmount] = useState<string>('0');

    // Determine navigation state
    const currentIndex = users ? users.findIndex(u => u.id === user.id) : -1;
    const hasPrev = currentIndex > 0;
    const hasNext = users && currentIndex < users.length - 1;

    const handlePrev = () => {
        if (hasPrev && users && onSelectUser) onSelectUser(users[currentIndex - 1]);
    };

    const handleNext = () => {
        if (hasNext && users && onSelectUser) onSelectUser(users[currentIndex + 1]);
    };

    // Keyboard navigation support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Avoid conflict if user is typing in an input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlePrev, handleNext, onClose]);

    useEffect(() => {
        // Reset edit state when user changes
        setEditProfile({
            name: user.name,
            email: user.email,
            mobileNumber: user.mobileNumber || '',
            role: user.role,
            socialMediaLinks: ''
        });
        setMembershipEdit({
            plan: user.membership?.plan || 'free',
            expiryDate: toJsDate(user.membership?.expiresAt)?.toISOString().split('T')[0] || ''
        });
        setPenaltyAmount(user.pendingPenalty?.toString() || '0');

        if (user.role === 'influencer') {
            apiService.getInfluencerProfile(user.id).then((data) => {
                if (data) {
                    setEditProfile(prev => ({ ...prev, socialMediaLinks: data.socialMediaLinks || '' }));
                }
            });
        }
    }, [user.id]); // Trigger on user ID change

    const userTransactions = transactions.filter(t => t.userId === user.id);
    const userPayouts = payouts.filter(p => p.userId === user.id);
    const userCollabs = collabs.filter(c => {
        if ('brandId' in c && c.brandId === user.id) return true;
        if ('influencerId' in c && (c as any).influencerId === user.id) return true;
        if ('liveTvId' in c && (c as any).liveTvId === user.id) return true;
        if ('agencyId' in c && (c as any).agencyId === user.id) return true;
        return false;
    });

    const handleSaveProfile = async () => {
        try {
            await apiService.updateUserProfile(user.id, {
                name: editProfile.name,
                email: editProfile.email,
                mobileNumber: editProfile.mobileNumber,
                role: editProfile.role
            });

            if (editProfile.role === 'influencer') {
                await apiService.updateInfluencerProfile(user.id, {
                    socialMediaLinks: editProfile.socialMediaLinks
                });
            }

            onUpdateUser(user.id, {
                name: editProfile.name,
                email: editProfile.email,
                mobileNumber: editProfile.mobileNumber,
                role: editProfile.role
            });
            alert('Profile updated!');
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to update profile.");
        }
    };

    const handleSaveMembership = async () => {
        const expiresAt = membershipEdit.expiryDate ? Timestamp.fromDate(new Date(membershipEdit.expiryDate)) : null;
        const membershipUpdate = {
            ...user.membership,
            plan: membershipEdit.plan,
            isActive: true,
            expiresAt: expiresAt
        };
        // @ts-ignore
        await apiService.updateUser(user.id, { membership: membershipUpdate });
        // @ts-ignore
        onUpdateUser(user.id, { membership: membershipUpdate });
        alert('Membership updated!');
    };

    const handleUpdatePenalty = async () => {
        const amount = parseFloat(penaltyAmount);
        if (isNaN(amount) || amount < 0) {
            alert("Please enter a valid positive number for the penalty.");
            return;
        }

        try {
            // Updated to use the secure backend endpoint
            await apiService.updatePenalty(user.id, amount);
            onUpdateUser(user.id, { pendingPenalty: amount });
            alert(`Penalty updated to ₹${amount}`);
        } catch (error) {
            console.error("Error updating penalty:", error);
            alert("Failed to update penalty via secure backend.");
        }
    };

    const handleKycAction = async (status: 'approved' | 'rejected') => {
        let reason;
        if (status === 'rejected') {
            reason = prompt("Reason for rejection:");
            if (!reason) return;
        }
        
        try {
            await apiService.updateKycStatus(user.id, status, reason);
            onUpdateUser(user.id, { kycStatus: status });
            // If approved, optimistically update UI to show verified badge effect if user object had it
            if (status === 'approved') {
                 // The backend handles the isVerified update on public collections, 
                 // but we can update local user state if needed for UI consistency
            }
            alert(`KYC ${status} successfully.`);
        } catch (error) {
            console.error("Failed to update KYC status:", error);
            alert("Failed to update status.");
        }
    };

    const TabButton = ({ tab, label, icon: Icon }: { tab: Tab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <Icon className="w-4 h-4 flex-shrink-0" /> {label}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-[60]" onClick={onClose}>
            {/* Added overflow-auto to enable scrollbars when content exceeds viewport */}
            <div className="w-full max-w-6xl bg-white dark:bg-gray-800 h-full overflow-auto shadow-2xl flex flex-col transition-all duration-300" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 sm:p-6 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow" />
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 break-all">{user.email}</p> 
                                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
                                <div className="mt-1 flex gap-2 text-xs">
                                    <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">{user.piNumber}</span>
                                    <span className={`px-2 py-0.5 rounded ${user.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{user.isBlocked ? 'Blocked' : 'Active'}</span>
                                    {user.pendingPenalty && user.pendingPenalty > 0 ? (
                                        <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded flex items-center gap-1 font-bold">
                                            <ExclamationTriangleIcon className="w-3 h-3" /> Penalty: ₹{user.pendingPenalty}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                             {/* Navigation Controls */}
                             <div className="flex items-center bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-1 mr-4 shadow-sm">
                                <button 
                                    onClick={handlePrev} 
                                    disabled={!hasPrev}
                                    title="Previous User (Left Arrow)"
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300"
                                >
                                    <ChevronLeftIcon className="w-5 h-5" />
                                </button>
                                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                                <button 
                                    onClick={handleNext} 
                                    disabled={!hasNext}
                                    title="Next User (Right Arrow)"
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300"
                                >
                                    <ChevronRightIcon className="w-5 h-5" />
                                </button>
                             </div>

                             <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl leading-none" title="Close (Esc)">&times;</button>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-gray-700 overflow-x-auto flex-shrink-0 bg-white dark:bg-gray-800">
                    <TabButton tab="profile" label="Profile" icon={ProfileIcon} />
                    <TabButton tab="financials" label="Financials & Penalties" icon={PaymentIcon} />
                    <TabButton tab="membership" label="Membership" icon={MembershipIcon} />
                    <TabButton tab="collabs" label="Collab History" icon={CollabIcon} />
                    <TabButton tab="kyc" label="KYC & Verification" icon={CheckBadgeIcon} />
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 flex-1 min-h-0">
                    {activeTab === 'profile' && (
                        <div className="space-y-4 max-w-lg">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                <input type="text" value={editProfile.name} onChange={e => setEditProfile({ ...editProfile, name: e.target.value })} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                <input type="email" value={editProfile.email} onChange={e => setEditProfile({ ...editProfile, email: e.target.value })} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                                <input type="tel" value={editProfile.mobileNumber} onChange={e => setEditProfile({ ...editProfile, mobileNumber: e.target.value })} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                                <select value={editProfile.role} onChange={e => setEditProfile({ ...editProfile, role: e.target.value as UserRole })} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:text-white">
                                    <option value="brand">Brand</option>
                                    <option value="influencer">Influencer</option>
                                    <option value="livetv">Live TV</option>
                                    <option value="banneragency">Banner Agency</option>
                                    <option value="staff">Staff</option>
                                </select>
                            </div>
                            
                            {editProfile.role === 'influencer' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Social Media Links</label>
                                    <textarea 
                                        value={editProfile.socialMediaLinks} 
                                        onChange={e => setEditProfile({ ...editProfile, socialMediaLinks: e.target.value })} 
                                        className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                                        rows={3}
                                        placeholder="Instagram: ..., YouTube: ..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Comma separated or new lines.</p>
                                </div>
                            )}

                            <button onClick={handleSaveProfile} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save Profile</button>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-6">
                            {/* Penalty Management Section */}
                            <div className="bg-red-50 dark:bg-red-900/10 p-4 sm:p-6 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
                                <h3 className="font-bold text-lg mb-4 text-red-800 dark:text-red-300 border-b border-red-200 dark:border-red-800 pb-2 flex items-center gap-2">
                                    <ExclamationTriangleIcon className="w-5 h-5" />
                                    Penalty Management
                                </h3>
                                <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                                    Manage cancellation penalties for this user. Penalties are automatically deducted from future payouts.
                                </p>
                                <div className="flex flex-col sm:flex-row items-end gap-4">
                                    <div className="flex-1 w-full">
                                        <label className="block text-sm font-medium text-red-900 dark:text-red-300 mb-1">
                                            Current Penalty Amount (₹)
                                        </label>
                                        <input 
                                            type="number" 
                                            value={penaltyAmount} 
                                            onChange={e => setPenaltyAmount(e.target.value)} 
                                            className="w-full p-2 border border-red-300 rounded bg-white dark:bg-gray-800 dark:border-red-700 dark:text-white font-bold"
                                            min="0"
                                        />
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button 
                                            onClick={handleUpdatePenalty} 
                                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 shadow-sm flex-1 sm:flex-none whitespace-nowrap"
                                        >
                                            Update Penalty
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setPenaltyAmount('0');
                                                // We intentionally don't auto-submit here to let admin review the 0 before clicking Update
                                            }}
                                            className="px-4 py-2 bg-white text-red-600 border border-red-300 rounded hover:bg-red-50 dark:bg-gray-800 dark:border-red-700 flex-1 sm:flex-none whitespace-nowrap"
                                        >
                                            Remove Penalty
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Saved Payment Details */}
                            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg border dark:border-gray-700 shadow-sm">
                                <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-white border-b dark:border-gray-700 pb-2">Saved Payment Methods</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Bank Details */}
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md border dark:border-gray-600">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                                Bank Account
                                            </h4>
                                            {user.savedBankDetails?.isVerified ? (
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center gap-1">
                                                    <CheckBadgeIcon className="w-3 h-3" /> Verified
                                                </span>
                                            ) : (
                                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">Unverified</span>
                                            )}
                                        </div>
                                        
                                        {user.savedBankDetails ? (
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 dark:text-gray-400">Holder Name:</span>
                                                    <span className="font-medium dark:text-gray-200">{user.savedBankDetails.accountHolderName}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 dark:text-gray-400">Account No:</span>
                                                    <span className="font-mono font-medium dark:text-gray-200">{user.savedBankDetails.accountNumber}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 dark:text-gray-400">IFSC:</span>
                                                    <span className="font-mono font-medium dark:text-gray-200">{user.savedBankDetails.ifscCode}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 dark:text-gray-400">Bank:</span>
                                                    <span className="font-medium dark:text-gray-200">{user.savedBankDetails.bankName}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">No bank details saved.</p>
                                        )}
                                    </div>

                                    {/* UPI Details */}
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-md border dark:border-gray-600">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-semibold text-gray-700 dark:text-gray-200">UPI Details</h4>
                                            {user.isUpiVerified ? (
                                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center gap-1">
                                                    <CheckBadgeIcon className="w-3 h-3" /> Verified
                                                </span>
                                            ) : (
                                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">Unverified</span>
                                            )}
                                        </div>

                                        {user.savedUpiId ? (
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-500 dark:text-gray-400">UPI ID:</span>
                                                    <span className="font-mono font-medium text-lg dark:text-gray-200">{user.savedUpiId}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">No UPI ID saved.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-white">Payments Made (Transactions)</h3>
                                    <div className="overflow-hidden rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                    <tr>
                                                        <th className="p-3 font-semibold whitespace-nowrap">Date</th>
                                                        <th className="p-3 font-semibold whitespace-nowrap">Tx Ref ID</th>
                                                        <th className="p-3 font-semibold whitespace-nowrap">Collab ID</th>
                                                        <th className="p-3 font-semibold whitespace-nowrap">Amount</th>
                                                        <th className="p-3 font-semibold whitespace-nowrap">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                    {userTransactions.map(t => (
                                                        <tr key={t.transactionId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                            <td className="p-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{toJsDate(t.timestamp)?.toLocaleDateString()}</td>
                                                            <td className="p-3 font-mono text-xs text-gray-500 select-all">{t.transactionId}</td>
                                                            <td className="p-3 font-mono text-xs text-gray-500 select-all">{t.collabId || '-'}</td>
                                                            <td className="p-3 font-bold text-red-600 dark:text-red-400 whitespace-nowrap">-₹{t.amount.toLocaleString()}</td>
                                                            <td className="p-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${t.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{t.status}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {userTransactions.length === 0 && <p className="p-4 text-center text-gray-500 italic">No payments made.</p>}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-white">Payouts Received</h3>
                                    <div className="overflow-hidden rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                    <tr>
                                                        <th className="p-3 font-semibold whitespace-nowrap">Date</th>
                                                        <th className="p-3 font-semibold whitespace-nowrap">Payout ID</th>
                                                        <th className="p-3 font-semibold whitespace-nowrap">Collab ID</th>
                                                        <th className="p-3 font-semibold whitespace-nowrap">Amount</th>
                                                        <th className="p-3 font-semibold whitespace-nowrap">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                    {userPayouts.map(p => (
                                                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                            <td className="p-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{toJsDate(p.timestamp)?.toLocaleDateString()}</td>
                                                            <td className="p-3 font-mono text-xs text-gray-500 select-all">{p.id}</td>
                                                            <td className="p-3 font-mono text-xs text-gray-500 select-all">{p.collabId || '-'}</td>
                                                            <td className="p-3 font-bold text-green-600 dark:text-green-400 whitespace-nowrap">+₹{p.amount.toLocaleString()}</td>
                                                            <td className="p-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${p.status === 'completed' ? 'bg-green-100 text-green-800' : p.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{p.status.replace('_', ' ')}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {userPayouts.length === 0 && <p className="p-4 text-center text-gray-500 italic">No payouts found.</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'membership' && (
                        <div className="space-y-4 max-w-lg">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Plan</label>
                                <select value={membershipEdit.plan} onChange={e => setMembershipEdit({ ...membershipEdit, plan: e.target.value as MembershipPlan })} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:text-white capitalize">
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
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Date</label>
                                <input type="date" value={membershipEdit.expiryDate} onChange={e => setMembershipEdit({ ...membershipEdit, expiryDate: e.target.value })} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`inline-block w-3 h-3 rounded-full ${user.membership?.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                <span className="text-sm">{user.membership?.isActive ? 'Active' : 'Inactive'}</span>
                            </div>
                            <button onClick={handleSaveMembership} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Update Membership</button>
                        </div>
                    )}

                    {activeTab === 'collabs' && (
                        <div>
                            <h3 className="font-bold text-lg mb-3">Collaboration History</h3>
                            <div className="overflow-hidden rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                            <tr>
                                                <th className="p-3 font-semibold whitespace-nowrap">Date</th>
                                                <th className="p-3 font-semibold whitespace-nowrap">Collab ID</th>
                                                <th className="p-3 font-semibold">Title</th>
                                                <th className="p-3 font-semibold">Type</th>
                                                <th className="p-3 font-semibold">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {userCollabs.map(c => {
                                                const title = 'title' in c ? c.title : ('campaignTitle' in c ? c.campaignTitle : ('campaignName' in c ? c.campaignName : 'Untitled'));
                                                let type = 'Other';
                                                if ('campaignId' in c) type = 'Campaign';
                                                else if ('influencerId' in c) type = 'Direct';
                                                else if ('liveTvId' in c) type = 'Live TV';
                                                else if ('agencyId' in c) type = 'Banner Ad';

                                                return (
                                                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="p-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{toJsDate(c.timestamp)?.toLocaleDateString()}</td>
                                                        <td className="p-3 font-mono text-xs text-gray-500 select-all">{c.collabId || c.id}</td>
                                                        <td className="p-3 font-medium text-gray-800 dark:text-gray-200">{title}</td>
                                                        <td className="p-3 text-xs text-gray-500">{type}</td>
                                                        <td className="p-3">
                                                            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs capitalize">{c.status.replace('_', ' ')}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {userCollabs.length === 0 && <p className="p-4 text-center text-gray-500 italic">No collaborations yet.</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'kyc' && (
                        <div className="space-y-6">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded border">
                                <h3 className="font-bold text-lg mb-2">Identity Verification (KYC)</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><strong>Status:</strong> {user.kycStatus}</div>
                                    <div><strong>ID Type:</strong> {user.kycDetails?.idType || 'N/A'}</div>
                                    <div><strong>ID Number:</strong> {user.kycDetails?.idNumber || 'N/A'}</div>
                                    <div><strong>Liveness:</strong> {user.kycDetails?.isLivenessVerified ? 'Verified' : 'Pending'}</div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    {user.kycDetails?.idProofUrl && <a href={user.kycDetails.idProofUrl} target="_blank" className="text-indigo-600 text-sm underline">View ID Proof</a>}
                                    {user.kycDetails?.selfieUrl && <a href={user.kycDetails.selfieUrl} target="_blank" className="text-indigo-600 text-sm underline">View Selfie</a>}
                                </div>
                                
                                {user.kycStatus === 'pending' && (
                                    <div className="mt-4 flex gap-3">
                                        <button onClick={() => handleKycAction('approved')} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Approve KYC</button>
                                        <button onClick={() => handleKycAction('rejected')} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reject KYC</button>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded border">
                                <h3 className="font-bold text-lg mb-2">Creator Verification</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><strong>Status:</strong> {user.creatorVerificationStatus}</div>
                                    {user.role === 'influencer' && <div><strong>Social Links:</strong> {user.creatorVerificationDetails?.socialMediaLinks ? 'Provided' : 'N/A'}</div>}
                                    {(user.role === 'livetv' || user.role === 'banneragency') && (
                                        <>
                                            <div><strong>GST Verified:</strong> {user.creatorVerificationDetails?.isGstVerified ? 'Yes' : 'No'}</div>
                                            <div><strong>PAN Verified:</strong> {user.creatorVerificationDetails?.isBusinessPanVerified ? 'Yes' : 'No'}</div>
                                        </>
                                    )}
                                </div>
                                <div className="mt-4 flex gap-2 flex-wrap">
                                    {user.creatorVerificationDetails?.registrationDocUrl && <a href={user.creatorVerificationDetails.registrationDocUrl} target="_blank" className="text-indigo-600 text-sm underline">View Registration</a>}
                                    {user.creatorVerificationDetails?.officePhotoUrl && <a href={user.creatorVerificationDetails.officePhotoUrl} target="_blank" className="text-indigo-600 text-sm underline">View Office</a>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserDetailView;