
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiService } from '../services/apiService';
import { PlatformSettings, User, PayoutRequest, Post, Influencer, SocialMediaLink, Transaction, KycStatus, KycDetails, AnyCollaboration, CollaborationRequest, CampaignApplication, AdSlotRequest, BannerAdBookingRequest, CollabRequestStatus, CampaignApplicationStatus, AdBookingStatus, PlatformBanner, UserRole, StaffPermission, Message, RefundRequest, DailyPayoutRequest, Dispute, DiscountSetting, Membership, CombinedCollabItem, CreatorVerificationStatus, CreatorVerificationDetails, Partner } from '../types';
import { Timestamp, doc, updateDoc, QueryDocumentSnapshot, DocumentData, setDoc } from 'firebase/firestore';
import PostCard from './PostCard';
import AdminPaymentHistoryPage from './AdminPaymentHistoryPage';
import { AnalyticsIcon, PaymentIcon, CommunityIcon, SupportIcon, ChatBubbleLeftEllipsisIcon, CollabIcon, AdminIcon as KycIcon, UserGroupIcon, LockClosedIcon, LockOpenIcon, KeyIcon, SparklesIcon, RocketIcon, ExclamationTriangleIcon, BannerAdsIcon, EnvelopeIcon, ProfileIcon, ShareIcon as SocialsIcon, TrashIcon, PencilIcon } from './Icons';
import LiveHelpPanel from './LiveHelpPanel';
import { db, firebaseConfig } from '../services/firebase';
import PayoutsPanel from './PayoutsPanel';
import { filterPostsWithAI, filterDisputesWithAI } from '../services/geminiService';
import MarketingPanel from './MarketingPanel';
import PlatformBannerPanel from './PlatformBannerPanel';
import { authService } from '../services/authService';
import PartnersPanel from './PartnersPanel';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

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

type AdminTab = 'dashboard' | 'user_management' | 'staff_management' | 'collaborations' | 'kyc' | 'creator_verification' | 'payouts' | 'payment_history' | 'community' | 'live_help' | 'marketing' | 'disputes' | 'discounts' | 'platform_banners' | 'client_brands';


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

const CreatorVerificationModal: React.FC<{ user: User, onClose: () => void, onActionComplete: () => void }> = ({ user, onClose, onActionComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const { creatorVerificationDetails: details } = user;
    const [confirmStatus, setConfirmStatus] = useState<'approved' | 'rejected' | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const handleConfirm = async () => {
        if (!confirmStatus) return;
        
        if (confirmStatus === 'rejected' && !rejectionReason.trim()) {
            alert("Please provide a reason for rejection.");
            return;
        }

        setIsProcessing(true);
        try {
            await apiService.updateCreatorVerificationStatus(user.id, confirmStatus, rejectionReason);
            onActionComplete();
            onClose();
        } catch (error) {
            console.error(`Failed to ${confirmStatus} verification`, error);
            alert(`Could not ${confirmStatus} verification. Please try again.`);
        } finally {
            setIsProcessing(false);
            setConfirmStatus(null);
        }
    };

    if (!details) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col relative">
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Creator Verification for {user.name}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>
                <div className="flex-1 p-6 overflow-y-auto">
                    <h3 className="font-semibold text-lg mb-4 dark:text-gray-200">Submitted Details ({user.role})</h3>
                    <dl className="text-sm space-y-3 dark:text-gray-300">
                        {user.role === 'influencer' && (
                            <>
                                <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">Social Links:</dt><dd className="col-span-2 whitespace-pre-wrap">{details.socialMediaLinks}</dd></div>
                                <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">ID Number:</dt><dd className="col-span-2 font-mono">{details.idNumber}</dd></div>
                            </>
                        )}
                        {(user.role === 'livetv' || user.role === 'banneragency') && (
                            <>
                                <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">Registration No.:</dt><dd className="col-span-2">{details.registrationNo}</dd></div>
                                <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">MSME No.:</dt><dd className="col-span-2">{details.msmeNo}</dd></div>
                                <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">Business PAN:</dt><dd className="col-span-2 font-mono">{details.businessPan}</dd></div>
                                <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">Trade License:</dt><dd className="col-span-2">{details.tradeLicenseNo}</dd></div>
                            </>
                        )}
                    </dl>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-end gap-3">
                    <button onClick={() => setConfirmStatus('rejected')} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700">Reject</button>
                    <button onClick={() => setConfirmStatus('approved')} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">Approve</button>
                </div>

                {confirmStatus && (
                    <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded-2xl z-10 flex flex-col p-6 animate-fade-in-down">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                            Confirm {confirmStatus === 'approved' ? 'Approval' : 'Rejection'}
                        </h3>
                        
                        <div className="flex-1">
                            {confirmStatus === 'approved' ? (
                                <p className="text-gray-600 dark:text-gray-300">
                                    Are you sure you want to approve this verification request? The user will receive a verified badge.
                                </p>
                            ) : (
                                <div>
                                    <p className="text-gray-600 dark:text-gray-300 mb-2">
                                        Please provide a reason for rejection:
                                    </p>
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                        rows={4}
                                        placeholder="e.g., Invalid ID proof, blurred documents..."
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button 
                                onClick={() => { setConfirmStatus(null); setRejectionReason(''); }} 
                                disabled={isProcessing}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirm} 
                                disabled={isProcessing}
                                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${
                                    confirmStatus === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {isProcessing ? 'Processing...' : `Confirm ${confirmStatus === 'approved' ? 'Approve' : 'Reject'}`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const CreatorVerificationPanel: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const [submissions, setSubmissions] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingUser, setViewingUser] = useState<User | null>(null);

    const fetchSubmissions = useCallback(() => {
        setIsLoading(true);
        apiService.getPendingCreatorVerifications()
            .then(setSubmissions)
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    if (isLoading) return <p className="p-4 text-gray-500 dark:text-gray-400">Loading verification submissions...</p>;
    if (submissions.length === 0) return <p className="p-4 text-gray-500 dark:text-gray-400">No pending submissions.</p>;

    return (
        <div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {submissions.map(user => (
                    <li key={user.id} className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <div className="flex items-center space-x-3">
                            <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
                            <div>
                                <p className="font-semibold dark:text-gray-200">{user.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email} ({user.role})</p>
                            </div>
                        </div>
                        <button onClick={() => setViewingUser(user)} className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold">Review</button>
                    </li>
                ))}
            </ul>
            {viewingUser && (
                <CreatorVerificationModal
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

const UserManagementPanel: React.FC<{ users: User[], onUserSelect: (user: User) => void }> = ({ users, onUserSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.piNumber && u.piNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">User Management</h2>
                <input 
                    type="text" 
                    placeholder="Search users..." 
                    className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                        <tr>
                            <th className="p-4 font-medium text-gray-500 dark:text-gray-300">User</th>
                            <th className="p-4 font-medium text-gray-500 dark:text-gray-300">Role</th>
                            <th className="p-4 font-medium text-gray-500 dark:text-gray-300">Status</th>
                            <th className="p-4 font-medium text-gray-500 dark:text-gray-300">Joined</th>
                            <th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-4 flex items-center gap-3">
                                    <img src={user.avatar} alt="" className="w-8 h-8 rounded-full bg-gray-200" />
                                    <div>
                                        <div className="font-medium dark:text-gray-200">{user.name}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                    </div>
                                </td>
                                <td className="p-4 capitalize text-gray-600 dark:text-gray-300">{user.role}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 text-xs rounded-full ${user.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                        {user.isBlocked ? 'Blocked' : 'Active'}
                                    </span>
                                </td>
                                <td className="p-4 text-sm text-gray-500">
                                    N/A
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => onUserSelect(user)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">View</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const StaffManagementPanel: React.FC<{ staffUsers: User[], onUpdate: () => void, platformSettings: PlatformSettings }> = ({ staffUsers, onUpdate, platformSettings }) => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Staff Management</h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {staffUsers.map(staff => (
                        <li key={staff.id} className="p-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <img src={staff.avatar} alt="" className="w-10 h-10 rounded-full" />
                                <div>
                                    <p className="font-medium dark:text-gray-200">{staff.name}</p>
                                    <p className="text-sm text-gray-500">{staff.email}</p>
                                </div>
                            </div>
                            <span className="text-sm text-gray-500">{staff.staffPermissions?.join(', ') || 'No permissions'}</span>
                        </li>
                    ))}
                </ul>
            </div>
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
                            <th className="p-4">Title</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Brand</th>
                            <th className="p-4">Influencer/Partner</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Payment</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {collaborations.map(collab => (
                            <tr key={collab.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-4 font-medium dark:text-gray-200">{collab.title}</td>
                                <td className="p-4 text-sm text-gray-500">{collab.type}</td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{collab.customerName}</td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{collab.providerName}</td>
                                <td className="p-4"><span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 rounded-full">{collab.status}</span></td>
                                <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full ${collab.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{collab.paymentStatus}</span></td>
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

const UserDetailsModal: React.FC<{ user: User | null, onClose: () => void, onSendReset: (u: User) => void, onToggleBlock: (u: User) => void, allTransactions: Transaction[], allPayouts: PayoutRequest[], allCollabs: CombinedCollabItem[], influencerProfile: Influencer | null, onUpdate: () => void }> = ({ user, onClose, onSendReset, onToggleBlock }) => {
    if (!user) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold dark:text-gray-100">{user.name}</h2>
                    <button onClick={onClose} className="text-gray-500">&times;</button>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <img src={user.avatar} alt="" className="w-16 h-16 rounded-full" />
                        <div>
                            <p className="text-gray-600 dark:text-gray-300">{user.email}</p>
                            <p className="text-sm text-gray-500">{user.role}</p>
                        </div>
                    </div>
                    <div className="flex gap-4 pt-4 border-t dark:border-gray-700">
                        <button onClick={() => onSendReset(user)} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200">Send Password Reset</button>
                        <button onClick={() => onToggleBlock(user)} className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${user.isBlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                            {user.isBlocked ? 'Unblock User' : 'Block User'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, allUsers, allTransactions, allPayouts, allCollabs, allRefunds, allDailyPayouts, platformSettings, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isUserDetailsModalOpen, setIsUserDetailsModalOpen] = useState(false);
    const [selectedInfluencerProfile, setSelectedInfluencerProfile] = useState<Influencer | null>(null);

    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [isLoadingDisputes, setIsLoadingDisputes] = useState(false);
    
    const [paginatedUsers, setPaginatedUsers] = useState<User[]>([]);
    const [lastVisibleUser, setLastVisibleUser] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [isFetchingUsers, setIsFetchingUsers] = useState(false);
    const USER_PAGE_LIMIT = 20;

    const staffUsers = useMemo(() => allUsers.filter(u => u.role === 'staff'), [allUsers]);
    const regularUsers = useMemo(() => allUsers.filter(u => u.role !== 'staff'), [allUsers]);

    const fetchUsers = useCallback(async (loadMore = false) => {
        setIsFetchingUsers(true);
        const options: any = { pageLimit: USER_PAGE_LIMIT };
        if (loadMore && lastVisibleUser) {
            options.startAfterDoc = lastVisibleUser;
        }
        const { users, lastVisible } = await apiService.getUsersPaginated(options);
        setPaginatedUsers(prev => loadMore ? [...prev, ...users] : users);
        setLastVisibleUser(lastVisible);
        setIsFetchingUsers(false);
    }, [lastVisibleUser]);

    useEffect(() => {
        if (activeTab === 'user_management') {
            fetchUsers();
        }
        if (activeTab === 'disputes') {
            setIsLoadingDisputes(true);
            apiService.getDisputes().then(setDisputes).finally(() => setIsLoadingDisputes(false));
        }
    }, [activeTab, fetchUsers]);

    const handleOpenUserDetails = async (userToView: User) => {
        setSelectedUser(userToView);
        if (userToView.role === 'influencer') {
            const profile = await apiService.getInfluencerProfile(userToView.id);
            setSelectedInfluencerProfile(profile);
        }
        setIsUserDetailsModalOpen(true);
    };

    const handleCloseUserDetails = () => {
        setIsUserDetailsModalOpen(false);
        setSelectedUser(null);
        setSelectedInfluencerProfile(null);
    };

    const handleSendResetEmail = async (userToSend: User) => {
        try {
            await authService.sendPasswordResetEmail(userToSend.email);
            alert(`Password reset email sent to ${userToSend.email}.`);
        } catch (error) {
            console.error(error);
            alert("Failed to send reset email.");
        }
    };
    
    const handleToggleBlock = async (userToToggle: User) => {
        try {
            await apiService.updateUser(userToToggle.id, { isBlocked: !userToToggle.isBlocked });
            onUpdate(); 
        } catch (error) {
            console.error(error);
            alert("Failed to update user status.");
        }
    };

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
        { id: 'creator_verification', label: 'Creator Verification', icon: KycIcon, permission: 'kyc' },
        { id: 'payouts', label: 'Payouts & Refunds', icon: PaymentIcon, permission: 'financial' },
        { id: 'payment_history', label: 'Payment History', icon: PaymentIcon, permission: 'financial' },
        { id: 'community', label: 'Community', icon: CommunityIcon, permission: 'community' },
        { id: 'live_help', label: 'Live Help', icon: ChatBubbleLeftEllipsisIcon, permission: 'support' },
        { id: 'marketing', label: 'Marketing', icon: EnvelopeIcon, permission: 'marketing' },
        { id: 'disputes', label: 'Disputes', icon: ExclamationTriangleIcon, permission: 'support' },
        { id: 'discounts', label: 'Discount Settings', icon: SparklesIcon, permission: 'super_admin' },
        { id: 'platform_banners', label: 'Platform Banners', icon: BannerAdsIcon, permission: 'marketing' },
        { id: 'client_brands', label: 'Our Partners', icon: RocketIcon, permission: 'marketing' },
    ];
    
    const hasPermission = (permission?: StaffPermission) => {
        if (!permission) return true; 
        return user.staffPermissions?.includes('super_admin') || user.staffPermissions?.includes(permission);
    };

    const visibleTabs = tabs.filter(tab => hasPermission(tab.permission));
    
    return (
        <div className="flex h-full">
            <nav className="w-64 bg-gray-800 text-white p-4 space-y-2 flex-shrink-0 overflow-y-auto">
                 {visibleTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                            activeTab === tab.id
                                ? 'bg-gray-900'
                                : 'hover:bg-gray-700'
                        }`}
                    >
                        <tab.icon className="w-5 h-5 mr-3" />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>
            <main className="flex-1 bg-gray-100 dark:bg-gray-900 overflow-hidden">
                {/* Render Panels based on activeTab */}
                {activeTab === 'dashboard' && <DashboardPanel users={allUsers} collaborations={combinedCollaborations} transactions={allTransactions} payouts={allPayouts} dailyPayouts={allDailyPayouts} />}
                {activeTab === 'user_management' && <UserManagementPanel users={regularUsers} onUserSelect={handleOpenUserDetails} />}
                {activeTab === 'staff_management' && <StaffManagementPanel staffUsers={staffUsers} onUpdate={onUpdate} platformSettings={platformSettings} />}
                {activeTab === 'collaborations' && <CollaborationsPanel collaborations={combinedCollaborations} allTransactions={allTransactions} onUpdate={handleCollabUpdate} />}
                {activeTab === 'kyc' && <KycPanel onUpdate={onUpdate} />}
                {activeTab === 'creator_verification' && <CreatorVerificationPanel onUpdate={onUpdate} />}
                {activeTab === 'payouts' && <PayoutsPanel payouts={allPayouts} refunds={allRefunds} dailyPayouts={allDailyPayouts} collaborations={combinedCollaborations} allTransactions={allTransactions} allUsers={allUsers} onUpdate={onUpdate} />}
                {activeTab === 'payment_history' && <AdminPaymentHistoryPage transactions={allTransactions} payouts={allPayouts} allUsers={allUsers} collaborations={combinedCollaborations} />}
                {activeTab === 'community' && <CommunityManagementPanel />}
                {activeTab === 'live_help' && <LiveHelpPanel adminUser={user} />}
                {activeTab === 'marketing' && <MarketingPanel allUsers={allUsers} platformSettings={platformSettings} onUpdate={onUpdate} />}
                {activeTab === 'disputes' && <DisputesPanel disputes={disputes} allTransactions={allTransactions} onUpdate={() => apiService.getDisputes().then(setDisputes)} />}
                {activeTab === 'discounts' && <DiscountSettingsPanel settings={platformSettings} setSettings={() => {}} setIsDirty={() => {}} />}
                {activeTab === 'platform_banners' && <PlatformBannerPanel onUpdate={onUpdate} />}
                {activeTab === 'client_brands' && <PartnersPanel onUpdate={onUpdate} />}

                 {isUserDetailsModalOpen && (
                    <UserDetailsModal 
                        user={selectedUser} 
                        onClose={handleCloseUserDetails}
                        onSendReset={handleSendResetEmail}
                        onToggleBlock={handleToggleBlock}
                        allTransactions={allTransactions}
                        allPayouts={allPayouts}
                        allCollabs={combinedCollaborations}
                        influencerProfile={selectedInfluencerProfile}
                        onUpdate={onUpdate}
                    />
                 )}
            </main>
        </div>
    );
};
