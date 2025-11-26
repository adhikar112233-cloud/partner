
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiService } from '../services/apiService';
import { PlatformSettings, User, PayoutRequest, Post, Influencer, SocialMediaLink, Transaction, KycStatus, KycDetails, AnyCollaboration, CollaborationRequest, CampaignApplication, AdSlotRequest, BannerAdBookingRequest, CollabRequestStatus, CampaignApplicationStatus, AdBookingStatus, PlatformBanner, UserRole, StaffPermission, Message, RefundRequest, DailyPayoutRequest, Dispute, DiscountSetting, Membership, CombinedCollabItem, Partner, CreatorVerificationDetails } from '../types';
import { Timestamp, doc, updateDoc, QueryDocumentSnapshot, DocumentData, setDoc } from 'firebase/firestore';
import PostCard from './PostCard';
import AdminPaymentHistoryPage from './AdminPaymentHistoryPage';
import { AnalyticsIcon, PaymentIcon, CommunityIcon, SupportIcon, ChatBubbleLeftEllipsisIcon, CollabIcon, AdminIcon as KycIcon, UserGroupIcon, LockClosedIcon, LockOpenIcon, KeyIcon, SparklesIcon, RocketIcon, ExclamationTriangleIcon, BannerAdsIcon, EnvelopeIcon, ProfileIcon, ShareIcon as SocialsIcon, TrashIcon, PencilIcon, CheckBadgeIcon, TrophyIcon } from './Icons';
import LiveHelpPanel from './LiveHelpPanel';
import { db, firebaseConfig } from '../services/firebase';
import PayoutsPanel from './PayoutsPanel';
import { filterPostsWithAI, filterDisputesWithAI } from '../services/geminiService';
import MarketingPanel from './MarketingPanel';
import PlatformBannerPanel from './PlatformBannerPanel';
import { authService } from '../services/authService';
import PartnersPanel from './PartnersPanel';
import LeaderboardManager from './LeaderboardManager';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
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

type AdminTab = 'dashboard' | 'user_management' | 'staff_management' | 'collaborations' | 'kyc' | 'creator_verification' | 'payouts' | 'payment_history' | 'community' | 'live_help' | 'marketing' | 'disputes' | 'discounts' | 'platform_banners' | 'client_brands' | 'leaderboards';


// --- Creator Verification Components ---

const CreatorVerificationModal: React.FC<{ user: User, onClose: () => void, onActionComplete: () => void }> = ({ user, onClose, onActionComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const details = user.creatorVerificationDetails;

    const handleAction = async (status: 'approved' | 'rejected') => {
        let reason: string | undefined;
        if (status === 'rejected') {
            reason = prompt("Please provide a reason for rejection:");
            if (!reason) return;
        }

        if (!window.confirm(`Are you sure you want to ${status} this verification request?`)) return;

        setIsProcessing(true);
        try {
            await apiService.updateCreatorVerificationStatus(user.id, status, reason);
            onActionComplete();
            onClose();
        } catch (error) {
            console.error(`Failed to ${status}`, error);
            alert(`Could not ${status}. Please try again.`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!details) return null;

    const PreviewImage = ({ label, url }: { label: string, url?: string }) => (
        url ? (
            <div className="border rounded-lg p-2 bg-gray-50 dark:bg-gray-900/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{label}</p>
                <img 
                    src={url} 
                    alt={label} 
                    className="h-32 object-contain rounded cursor-zoom-in hover:opacity-90" 
                    onClick={() => setZoomedImage(url)}
                />
            </div>
        ) : null
    );

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Review Verification</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.name} ({user.role})</p>
                        </div>
                        <button onClick={onClose} className="text-gray-500 text-2xl">&times;</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                        {user.role === 'influencer' ? (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2">Social Media Links</h3>
                                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded border dark:border-gray-700 whitespace-pre-wrap text-sm font-mono dark:text-gray-300">
                                        {details.socialMediaLinks}
                                    </div>
                                </div>
                                <PreviewImage label="Creator Proof / Acknowledgement" url={details.acknowledgementUrl} />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Doc Type: <span className="font-bold uppercase">{details.registrationDocType || 'MSME'}</span></p>
                                    </div>
                                    <PreviewImage label="Registration Document (MSME/GST/Trade License)" url={details.registrationDocUrl} />
                                    <PreviewImage label="Office Photo" url={details.officePhotoUrl} />
                                    <PreviewImage label="Business PAN" url={details.businessPanUrl} />
                                    <PreviewImage label="Channel Stamp" url={details.channelStampUrl} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-end gap-3 rounded-b-2xl">
                        <button onClick={() => handleAction('rejected')} disabled={isProcessing} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">Reject</button>
                        <button onClick={() => handleAction('approved')} disabled={isProcessing} className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">Approve</button>
                    </div>
                </div>
            </div>
            {zoomedImage && (
                <div className="fixed inset-0 z-[60] bg-black bg-opacity-95 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
                    <img src={zoomedImage} className="max-w-full max-h-[90vh] rounded" />
                    <button className="absolute top-6 right-6 text-white text-4xl">&times;</button>
                </div>
            )}
        </>
    );
};

const CreatorVerificationPanel: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const fetchPending = useCallback(() => {
        setIsLoading(true);
        apiService.getPendingCreatorVerifications()
            .then(setPendingUsers)
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        fetchPending();
    }, [fetchPending]);

    if (isLoading) return <p className="p-8 text-center dark:text-gray-300">Loading...</p>;
    
    if (pendingUsers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <CheckBadgeIcon className="w-12 h-12 mb-2 opacity-50" />
                <p>No pending creator verification requests.</p>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Creator Verification Queue</h2>
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                        <tr>
                            <th className="p-4 font-medium text-gray-500 dark:text-gray-300">User</th>
                            <th className="p-4 font-medium text-gray-500 dark:text-gray-300">Role</th>
                            <th className="p-4 font-medium text-gray-500 dark:text-gray-300">Submitted</th>
                            <th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {pendingUsers.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-4">
                                    <div className="font-medium dark:text-gray-200">{user.name}</div>
                                    <div className="text-xs text-gray-500">{user.email}</div>
                                </td>
                                <td className="p-4 capitalize text-gray-600 dark:text-gray-300">{user.role}</td>
                                <td className="p-4 text-sm text-gray-500">Pending Review</td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={() => setSelectedUser(user)}
                                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium px-3 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                                    >
                                        Review
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {selectedUser && (
                <CreatorVerificationModal 
                    user={selectedUser} 
                    onClose={() => setSelectedUser(null)}
                    onActionComplete={() => {
                        fetchPending();
                        onUpdate();
                    }}
                />
            )}
        </div>
    );
};


// --- Existing Components (KycDetailModal, KycPanel, etc.) remain unchanged ---

const KycDetailModal: React.FC<{ user: User, onClose: () => void, onActionComplete: () => void }> = ({ user, onClose, onActionComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const { kycDetails } = user;

    const handleAction = async (status: 'approved' | 'rejected') => {
        let reason: string | undefined;
        if (status === 'rejected') {
            reason = prompt("Please provide a reason for rejection:");
            if (!reason) return; 
        }

        if (!window.confirm(`Are you sure you want to ${status} this KYC submission?`)) return;

        setIsProcessing(true);
        try {
            await apiService.updateKycStatus(user.id, status, reason);
            onActionComplete();
            onClose();
        } catch (error) {
            console.error(`Failed to ${status} KYC`, error);
            alert(`Could not ${status} KYC. Please try again.`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!kycDetails) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700 rounded-t-2xl">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">KYC Verification</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.name} ({user.role})</p>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-3xl leading-none">&times;</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                            {/* Left: User Details */}
                            <div className="bg-gray-50 dark:bg-gray-700/30 p-6 rounded-xl border border-gray-200 dark:border-gray-700 h-fit">
                                <h3 className="font-bold text-lg mb-4 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-2">Submitted Data</h3>
                                <dl className="space-y-3 text-sm dark:text-gray-300">
                                    <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">ID Type:</dt><dd className="font-medium">{kycDetails.idType || 'N/A'}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">ID Number:</dt><dd className="font-mono font-medium bg-gray-200 dark:bg-gray-600 px-2 rounded">{kycDetails.idNumber || 'N/A'}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">DOB:</dt><dd>{kycDetails.dob || 'N/A'}</dd></div>
                                    <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Gender:</dt><dd>{kycDetails.gender || 'N/A'}</dd></div>
                                    <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                                        <dt className="text-gray-500 dark:text-gray-400 mb-1">Address:</dt>
                                        <dd className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                                            {kycDetails.address}<br/>
                                            {kycDetails.villageTown}, {kycDetails.roadNameArea}<br/>
                                            {kycDetails.city}, {kycDetails.district}<br/>
                                            {kycDetails.state} - {kycDetails.pincode}
                                        </dd>
                                    </div>
                                </dl>
                            </div>

                            {/* Right: Documents */}
                            <div className="space-y-6">
                                <h3 className="font-bold text-lg mb-2 dark:text-gray-100">Documents</h3>
                                <div>
                                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">ID Proof Document</h4>
                                    {kycDetails.idProofUrl ? (
                                        <div 
                                            className="border-2 border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden cursor-zoom-in hover:border-indigo-500 transition-colors bg-gray-100 dark:bg-gray-900 flex items-center justify-center h-64"
                                            onClick={() => setZoomedImage(kycDetails.idProofUrl!)}
                                        >
                                            <img src={kycDetails.idProofUrl} alt="ID Proof" className="max-h-full max-w-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="h-32 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center text-red-500 text-sm">
                                            Not Uploaded
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Live Selfie</h4>
                                    {kycDetails.selfieUrl ? (
                                        <div 
                                            className="border-2 border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden cursor-zoom-in hover:border-indigo-500 transition-colors bg-gray-100 dark:bg-gray-900 flex items-center justify-center h-64"
                                            onClick={() => setZoomedImage(kycDetails.selfieUrl!)}
                                        >
                                            <img src={kycDetails.selfieUrl} alt="Selfie" className="max-h-full max-w-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="h-32 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center text-red-500 text-sm">
                                            Not Uploaded
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-between items-center rounded-b-2xl">
                        <div className="text-sm text-gray-500">Action required for verification.</div>
                        <div className="flex gap-3">
                            <button onClick={() => handleAction('rejected')} disabled={isProcessing} className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 shadow-sm">
                                ✕ Reject
                            </button>
                            <button onClick={() => handleAction('approved')} disabled={isProcessing} className="px-6 py-2.5 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
                                ✓ Approve
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lightbox */}
            {zoomedImage && (
                <div className="fixed inset-0 z-[60] bg-black bg-opacity-95 flex items-center justify-center p-4 animate-fade-in-down" onClick={() => setZoomedImage(null)}>
                    <img src={zoomedImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" alt="Zoomed Document" />
                    <button className="absolute top-6 right-6 text-white text-4xl hover:text-gray-300">&times;</button>
                    <p className="absolute bottom-6 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded-full">Click anywhere to close</p>
                </div>
            )}
        </>
    );
};

const KycPanel: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const [submissions, setSubmissions] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingUser, setViewingUser] = useState<User | null>(null);

    const fetchSubmissions = useCallback(() => {
        setIsLoading(true);
        apiService.getKycSubmissions()
            .then(setSubmissions)
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    if (isLoading) return <p className="p-8 text-center text-gray-500 dark:text-gray-400">Loading KYC submissions...</p>;
    
    if (submissions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
                    <KycIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p>No pending KYC submissions.</p>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">KYC Verification Queue</h2>
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {submissions.map(user => (
                        <li key={user.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-4">
                                    <div className="relative">
                                        <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-gray-600" />
                                        {user.kycDetails?.rejectionReason && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" title="Resubmitted after rejection"></span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email} • <span className="capitalize bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">{user.role}</span></p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-2.5 py-1 rounded-full">Pending Review</span>
                                    <button 
                                        onClick={() => setViewingUser(user)} 
                                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                                    >
                                        Review Documents
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            {viewingUser && (
                <KycDetailModal 
                    user={viewingUser}
                    onClose={() => setViewingUser(null)}
                    onActionComplete={() => {
                        fetchSubmissions();
                        onUpdate();
                    }}
                />
            )}
        </div>
    );
};

const PayoutStatusBadge: React.FC<{ status: PayoutRequest['status'] | Transaction['status'] }> = ({ status }) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full capitalize";
    const statusMap: Record<string, { text: string; classes: string }> = {
        pending: { text: "Pending", classes: "text-yellow-800 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/50" },
        on_hold: { text: "On Hold", classes: "text-blue-800 bg-blue-100 dark:text-blue-200 dark:bg-blue-900/50" },
        processing: { text: "Processing", classes: "text-purple-800 bg-purple-100 dark:text-purple-200 dark:bg-purple-900/50" },
        approved: { text: "Approved", classes: "text-green-800 bg-green-100 dark:text-green-200 dark:bg-green-900/50" },
        rejected: { text: "Rejected", classes: "text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900/50" },
        completed: { text: "Completed", classes: "text-green-800 bg-green-100 dark:text-green-200 dark:bg-green-900/50" },
        failed: { text: "Failed", classes: "text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900/50" },
    };
    const statusInfo = statusMap[status];

    if (!statusInfo) {
        return <span className={`${baseClasses} text-gray-800 bg-gray-100 dark:text-gray-200 dark:bg-gray-700`}>{status || 'Unknown'}</span>;
    }

    const { text, classes } = statusInfo;
    return <span className={`${baseClasses} ${classes}`}>{text}</span>;
};

const CommunityManagementPanel: React.FC = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAiSearching, setIsAiSearching] = useState(false);

    const fetchPosts = useCallback(() => {
        setIsLoading(true);
        apiService.getPosts().then(data => {
            setPosts(data);
            setFilteredPosts(data);
        }).finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        const dummyAdmin: User = { 
            id: 'admin', 
            name: 'Admin', 
            email: '', 
            role: 'staff', 
            membership: {} as any, 
            kycStatus: 'approved',
            avatar: 'https://placehold.co/100x100?text=Admin' // Add avatar
        };
        setCurrentUser(dummyAdmin);
        fetchPosts();
    }, [fetchPosts]);
    
    const handleDelete = async (postId: string) => {
        if(window.confirm("Are you sure you want to delete this post?")) {
            await apiService.deletePost(postId);
            fetchPosts();
        }
    };

    const handleUpdate = async (postId: string, data: Partial<Post>) => {
        await apiService.updatePost(postId, data);
        fetchPosts();
    };

    const handleAiSearch = async () => {
        if (!searchQuery.trim()) {
            setFilteredPosts(posts);
            return;
        }
        setIsAiSearching(true);
        try {
            const matchedIds = await filterPostsWithAI(searchQuery, posts);
            setFilteredPosts(posts.filter(p => matchedIds.includes(p.id)));
        } catch (err) {
            console.error(err);
            alert("AI Search failed. Showing all results.");
            setFilteredPosts(posts);
        } finally {
            setIsAiSearching(false);
        }
    };

    if (isLoading || !currentUser) return <p className="dark:text-gray-300 p-4">Loading posts...</p>;

    return (
        <div className="p-4 h-full flex flex-col">
            <div className="mb-4 relative">
                <input
                    type="text"
                    placeholder="AI search posts (e.g., 'posts by influencers', 'blocked content')"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
                    className="w-full p-3 pr-28 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                />
                <button
                    onClick={handleAiSearch}
                    disabled={isAiSearching}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center px-3 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-md shadow hover:shadow-md disabled:opacity-50"
                >
                    <SparklesIcon className={`w-4 h-4 mr-1 ${isAiSearching ? 'animate-spin' : ''}`} />
                    {isAiSearching ? 'Searching...' : 'AI Search'}
                </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
                 {filteredPosts.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 mt-8">No posts match your search.</p>
                ) : (
                    filteredPosts.map(post => (
                        <PostCard 
                            key={post.id} 
                            post={post} 
                            currentUser={currentUser}
                            onDelete={handleDelete}
                            onUpdate={handleUpdate}
                            onToggleLike={() => {}} 
                            onCommentChange={() => {}} 
                        />
                    ))
                )}
            </div>
        </div>
    );
};

const DashboardPanel: React.FC<{ users: User[], collaborations: CombinedCollabItem[], transactions: Transaction[], payouts: PayoutRequest[], dailyPayouts: DailyPayoutRequest[] }> = ({ users, collaborations, transactions, payouts, dailyPayouts }) => {
    const stats = [
        { label: 'Total Users', value: users.length, icon: UserGroupIcon, color: 'bg-blue-500' },
        { label: 'Active Collabs', value: collaborations.filter(c => c.status === 'in_progress').length, icon: CollabIcon, color: 'bg-green-500' },
        { label: 'Pending Payouts', value: payouts.filter(p => p.status === 'pending').length + dailyPayouts.filter(d => d.status === 'pending').length, icon: PaymentIcon, color: 'bg-yellow-500' },
        { label: 'Total Revenue', value: `₹${transactions.filter(t => t.type === 'payment' && t.status === 'completed').reduce((acc, t) => acc + t.amount, 0).toLocaleString()}`, icon: AnalyticsIcon, color: 'bg-purple-500' },
    ];

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Dashboard Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm flex items-center space-x-4">
                        <div className={`p-3 rounded-full text-white ${stat.color}`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StaffModal: React.FC<{
    staff: User | null;
    onClose: () => void;
    onSave: (data: any) => void;
}> = ({ staff, onClose, onSave }) => {
    const [name, setName] = useState(staff?.name || '');
    const [email, setEmail] = useState(staff?.email || '');
    const [mobile, setMobile] = useState(staff?.mobileNumber || '');
    const [password, setPassword] = useState('');
    const [permissions, setPermissions] = useState<StaffPermission[]>(staff?.staffPermissions || []);
    const [isLoading, setIsLoading] = useState(false);

    const allPermissions: StaffPermission[] = ['super_admin', 'user_management', 'financial', 'collaborations', 'kyc', 'community', 'support', 'marketing', 'live_help', 'analytics'];

    const togglePermission = (perm: StaffPermission) => {
        setPermissions(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave({ name, email, mobile, password, permissions });
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to save staff member.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4 dark:text-gray-100">{staff ? 'Edit Staff Member' : 'Add New Staff'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium dark:text-gray-300">Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium dark:text-gray-300">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={!!staff} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-60" />
                    </div>
                    {!staff && (
                        <div>
                            <label className="block text-sm font-medium dark:text-gray-300">Password</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium dark:text-gray-300">Mobile</label>
                        <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium dark:text-gray-300 mb-2">Permissions</label>
                        <div className="grid grid-cols-2 gap-2">
                            {allPermissions.map(perm => (
                                <label key={perm} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer dark:border-gray-600">
                                    <input 
                                        type="checkbox" 
                                        checked={permissions.includes(perm)} 
                                        onChange={() => togglePermission(perm)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm capitalize dark:text-gray-300">{perm.replace('_', ' ')}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                            {isLoading ? 'Saving...' : 'Save Staff'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const StaffManagementPanel: React.FC<{ staffUsers: User[], onUpdate: () => void, platformSettings: PlatformSettings }> = ({ staffUsers, onUpdate, platformSettings }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<User | null>(null);

    const handleSave = async (data: any) => {
        if (editingStaff) {
            await apiService.updateUser(editingStaff.id, {
                name: data.name,
                mobileNumber: data.mobile,
                staffPermissions: data.permissions
            });
        } else {
            await authService.createUserByAdmin(
                data.email,
                data.password,
                'staff',
                data.name,
                data.mobile,
                'free',
                data.permissions
            );
        }
        onUpdate();
    };

    const handleDelete = async (user: User) => {
        if (window.confirm(`Are you sure you want to remove ${user.name} from staff? This will block their account.`)) {
            await apiService.updateUser(user.id, { isBlocked: true, role: 'brand' }); // Demote and block
            onUpdate();
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Staff Management</h2>
                <button onClick={() => { setEditingStaff(null); setIsModalOpen(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    + Create Staff
                </button>
            </div>
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {staffUsers.map(staff => (
                        <div key={staff.id} className="p-4 border rounded-lg dark:border-gray-700 flex flex-col justify-between bg-gray-50 dark:bg-gray-700/30">
                            <div className="flex items-center gap-3 mb-3">
                                <img src={staff.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                                <div>
                                    <p className="font-bold dark:text-gray-200">{staff.name}</p>
                                    <p className="text-xs text-gray-500">{staff.email}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-4">
                                {staff.staffPermissions?.map(perm => (
                                    <span key={perm} className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-200">
                                        {perm.replace('_', ' ')}
                                    </span>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2 border-t pt-3 dark:border-gray-600">
                                <button onClick={() => { setEditingStaff(staff); setIsModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded dark:hover:bg-blue-900/30"><PencilIcon className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(staff)} className="p-1.5 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/30"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {isModalOpen && (
                <StaffModal 
                    staff={editingStaff} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave} 
                />
            )}
        </div>
    );
};

const CollaborationsPanel: React.FC<{ collaborations: CombinedCollabItem[], allTransactions: Transaction[], onUpdate: (id: string, type: string, data: any) => void }> = ({ collaborations, allTransactions, onUpdate }) => {
    return (
        <div className="p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">All Collaborations</h2>
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 sticky top-0">
                        <tr>
                            <th className="p-4 whitespace-nowrap">Collab ID</th>
                            <th className="p-4">Title</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Brand (User ID)</th>
                            <th className="p-4">Partner (User ID)</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Payment</th>
                            <th className="p-4 whitespace-nowrap">Creator Payout</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {collaborations.map(collab => (
                            <tr key={collab.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-4 font-mono text-xs text-gray-500 dark:text-gray-400 select-all">
                                    {collab.originalData.collabId || collab.id.substring(0, 8) + '...'}
                                </td>
                                <td className="p-4 font-medium dark:text-gray-200">{collab.title}</td>
                                <td className="p-4 text-sm text-gray-500">{collab.type}</td>
                                <td className="p-4">
                                    <div className="text-sm text-gray-800 dark:text-gray-200">{collab.customerName}</div>
                                    <div className="text-xs text-gray-500 font-mono">{collab.customerPiNumber || 'N/A'}</div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm text-gray-800 dark:text-gray-200">{collab.providerName}</div>
                                    <div className="text-xs text-gray-500 font-mono">{collab.providerPiNumber || 'N/A'}</div>
                                </td>
                                <td className="p-4"><span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 rounded-full capitalize">{collab.status.replace(/_/g, ' ')}</span></td>
                                <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full ${collab.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{collab.paymentStatus}</span></td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                                        collab.payoutStatus === 'Completed' ? 'bg-green-100 text-green-800' : 
                                        collab.payoutStatus === 'Requested' ? 'bg-purple-100 text-purple-800' : 
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {collab.payoutStatus}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const DisputesPanel: React.FC<{ disputes: Dispute[], allTransactions: Transaction[], onUpdate: () => void }> = ({ disputes, allTransactions, onUpdate }) => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Disputes</h2>
            {disputes.length === 0 ? <p className="text-gray-500">No active disputes.</p> : (
                <div className="space-y-4">
                    {disputes.map(d => (
                        <div key={d.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-red-100 dark:border-red-900">
                            <div className="flex justify-between">
                                <h3 className="font-bold text-red-600 dark:text-red-400">Dispute: {d.collaborationTitle}</h3>
                                <span className="text-sm text-gray-500">{d.status}</span>
                            </div>
                            <p className="text-sm mt-2 dark:text-gray-300"><strong>Reason:</strong> {d.reason}</p>
                            <p className="text-sm text-gray-500 mt-1">Raised by: {d.disputedByName}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DiscountSettingsPanel: React.FC<{ settings: PlatformSettings, setSettings: (s: PlatformSettings) => void, setIsDirty: (d: boolean) => void }> = ({ settings }) => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Discount Settings</h2>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                <p className="text-gray-500 dark:text-gray-400">Manage promotional discounts here.</p>
                <div className="mt-4 text-sm text-gray-400">Settings are currently read-only in this view.</div>
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
        { id: 'discounts', label: 'Discount Settings', icon: SparklesIcon, permission: 'super_admin' },
        { id: 'platform_banners', label: 'Platform Banners', icon: BannerAdsIcon, permission: 'marketing' },
        { id: 'client_brands', label: 'Partner Brands', icon: UserGroupIcon, permission: 'marketing' },
        { id: 'leaderboards', label: 'Leaderboards', icon: TrophyIcon, permission: 'marketing' },
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
            default: return <div>Select a tab</div>;
        }
    };

    return (
        <div className="flex h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">
            {/* Sidebar for Admin Tabs */}
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

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminPanel;
