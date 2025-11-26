
import React, { useState } from 'react';
import { User, Transaction, PayoutRequest, AnyCollaboration, MembershipPlan, UserRole } from '../types';
import { apiService } from '../services/apiService';
import { Timestamp } from 'firebase/firestore';
import { ProfileIcon, PaymentIcon, MembershipIcon, CollabIcon, CheckBadgeIcon, DocumentIcon } from './Icons';

interface UserDetailViewProps {
    user: User;
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

const UserDetailView: React.FC<UserDetailViewProps> = ({ user, onClose, onUpdateUser, transactions, payouts, collabs }) => {
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [editProfile, setEditProfile] = useState({
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber || '',
        role: user.role
    });
    const [membershipEdit, setMembershipEdit] = useState({
        plan: user.membership?.plan || 'free',
        expiryDate: toJsDate(user.membership?.expiresAt)?.toISOString().split('T')[0] || ''
    });

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
        await apiService.updateUserProfile(user.id, editProfile);
        onUpdateUser(user.id, editProfile);
        alert('Profile updated!');
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

    const TabButton = ({ tab, label, icon: Icon }: { tab: Tab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <Icon className="w-4 h-4" /> {label}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-[60]" onClick={onClose}>
            <div className="w-full max-w-5xl bg-white dark:bg-gray-800 h-full overflow-y-auto shadow-2xl flex flex-col transition-all duration-300" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow" />
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email} • <span className="capitalize">{user.role}</span></p>
                                <div className="mt-1 flex gap-2 text-xs">
                                    <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">{user.piNumber}</span>
                                    <span className={`px-2 py-0.5 rounded ${user.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{user.isBlocked ? 'Blocked' : 'Active'}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-gray-700 overflow-x-auto">
                    <TabButton tab="profile" label="Profile" icon={ProfileIcon} />
                    <TabButton tab="financials" label="Financials" icon={PaymentIcon} />
                    <TabButton tab="membership" label="Membership" icon={MembershipIcon} />
                    <TabButton tab="collabs" label="Collab History" icon={CollabIcon} />
                    <TabButton tab="kyc" label="KYC & Verification" icon={CheckBadgeIcon} />
                </div>

                {/* Content */}
                <div className="p-6 flex-1">
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
                            <button onClick={handleSaveProfile} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save Profile</button>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-white">Payments Made (Transactions)</h3>
                                <div className="overflow-hidden rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                <tr>
                                                    <th className="p-3 font-semibold">Date</th>
                                                    <th className="p-3 font-semibold">Amount</th>
                                                    <th className="p-3 font-semibold">Status</th>
                                                    <th className="p-3 font-semibold">Description</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                {userTransactions.map(t => (
                                                    <tr key={t.transactionId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="p-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{toJsDate(t.timestamp)?.toLocaleDateString()}</td>
                                                        <td className="p-3 font-bold text-red-600 dark:text-red-400">-₹{t.amount.toLocaleString()}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${t.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{t.status}</span>
                                                        </td>
                                                        <td className="p-3 text-gray-600 dark:text-gray-400 max-w-[150px] truncate" title={t.description}>{t.description}</td>
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
                                                    <th className="p-3 font-semibold">Date</th>
                                                    <th className="p-3 font-semibold">Amount</th>
                                                    <th className="p-3 font-semibold">Status</th>
                                                    <th className="p-3 font-semibold">Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                {userPayouts.map(p => (
                                                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="p-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{toJsDate(p.timestamp)?.toLocaleDateString()}</td>
                                                        <td className="p-3 font-bold text-green-600 dark:text-green-400">+₹{p.amount.toLocaleString()}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${p.status === 'completed' ? 'bg-green-100 text-green-800' : p.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{p.status.replace('_', ' ')}</span>
                                                        </td>
                                                        <td className="p-3 text-gray-600 dark:text-gray-400 max-w-[150px] truncate" title={p.collaborationTitle}>{p.collaborationTitle}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {userPayouts.length === 0 && <p className="p-4 text-center text-gray-500 italic">No payouts found.</p>}
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
                            <ul className="space-y-2">
                                {userCollabs.map(c => {
                                    const title = 'title' in c ? c.title : ('campaignTitle' in c ? c.campaignTitle : ('campaignName' in c ? c.campaignName : 'Untitled'));
                                    return (
                                        <li key={c.id} className="p-3 border rounded bg-gray-50 dark:bg-gray-700/50">
                                            <div className="flex justify-between">
                                                <span className="font-semibold">{title}</span>
                                                <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded capitalize">{c.status.replace('_', ' ')}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">ID: {c.collabId || c.id}</div>
                                        </li>
                                    )
                                })}
                            </ul>
                            {userCollabs.length === 0 && <p className="text-gray-500 italic">No collaborations yet.</p>}
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
