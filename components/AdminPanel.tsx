
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">KYC Verification for {user.name}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>
                <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-lg mb-2 dark:text-gray-200">Submitted Details</h3>
                        <dl className="text-sm space-y-2 dark:text-gray-300">
                            <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">Address:</dt><dd className="col-span-2">{kycDetails.address}</dd></div>
                            <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">Village/Town:</dt><dd className="col-span-2">{kycDetails.villageTown}</dd></div>
                            <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">Road/Area:</dt><dd className="col-span-2">{kycDetails.roadNameArea}</dd></div>
                            <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">PIN Code:</dt><dd className="col-span-2">{kycDetails.pincode}</dd></div>
                            <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">City:</dt><dd className="col-span-2">{kycDetails.city}</dd></div>
                            <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">District:</dt><dd className="col-span-2">{kycDetails.district}</dd></div>
                            <div className="grid grid-cols-3 gap-2"><dt className="text-gray-500 dark:text-gray-400">State:</dt><dd className="col-span-2">{kycDetails.state}</dd></div>
                        </dl>
                    </div>
                     <div>
                        <h3 className="font-semibold text-lg mb-2 dark:text-gray-200">Documents</h3>
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-medium text-gray-600 dark:text-gray-400">ID Proof</h4>
                                <a href={kycDetails.idProofUrl} target="_blank" rel="noopener noreferrer"><img src={kycDetails.idProofUrl} alt="ID Proof" className="mt-1 rounded-lg border dark:border-gray-600 max-h-60 w-auto" /></a>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-600 dark:text-gray-400">Live Selfie</h4>
                                <a href={kycDetails.selfieUrl} target="_blank" rel="noopener noreferrer"><img src={kycDetails.selfieUrl} alt="Live Selfie" className="mt-1 rounded-lg border dark:border-gray-600 max-h-60 w-auto" /></a>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-end gap-3">
                    <button onClick={() => handleAction('rejected')} disabled={isProcessing} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">Reject</button>
                    <button onClick={() => handleAction('approved')} disabled={isProcessing} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">Approve</button>
                </div>
            </div>
        </div>
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

    if (isLoading) return <p className="p-4 text-gray-500 dark:text-gray-400">Loading KYC submissions...</p>;
    if (submissions.length === 0) return <p className="p-4 text-gray-500 dark:text-gray-400">No pending KYC submissions.</p>;

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
        const dummyAdmin: User = { id: 'admin', name: 'Admin', email: '', role: 'staff', membership: {} as any, kycStatus: 'approved' };
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

const DisputesPanel: React.FC<{ disputes: Dispute[], allTransactions: Transaction[], onUpdate: () => void }> = ({ disputes, allTransactions, onUpdate }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const getRelatedTransaction = (collabId: string | undefined, docId: string) => {
        return allTransactions.find(t => t.relatedId === docId || (collabId && t.collabId === collabId));
    };

    const filteredDisputes = useMemo(() => {
        if (!searchTerm.trim()) return disputes;
        const lower = searchTerm.toLowerCase();
        return disputes.filter(d => 
            d.disputedByName.toLowerCase().includes(lower) ||
            d.disputedAgainstName.toLowerCase().includes(lower) ||
            d.reason.toLowerCase().includes(lower) ||
            d.collaborationTitle.toLowerCase().includes(lower) ||
            (d.collabId && d.collabId.toLowerCase().includes(lower))
        );
    }, [disputes, searchTerm]);

    return (
        <div className="p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Disputes Management</h2>
            <div className="mb-4">
                <input 
                    type="text" 
                    placeholder="Search disputes..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                />
            </div>
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Raised By</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Against</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Reason</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Order ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Payment Ref ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredDisputes.map(dispute => {
                            const tx = getRelatedTransaction(dispute.collabId, dispute.collaborationId);
                            const refId = tx?.paymentGatewayDetails?.razorpayPaymentId || tx?.paymentGatewayDetails?.referenceId || tx?.paymentGatewayDetails?.payment_id || 'N/A';
                            
                            return (
                                <tr key={dispute.id}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{toJsDate(dispute.timestamp)?.toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{dispute.disputedByName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{dispute.disputedAgainstName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={dispute.reason}>{dispute.reason}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">{tx?.transactionId || 'N/A'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">{refId}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${dispute.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                            {dispute.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredDisputes.length === 0 && <p className="p-6 text-center text-gray-500">No disputes found.</p>}
            </div>
        </div>
    );
};

const DetailsModal: React.FC<{ data: object, onClose: () => void }> = ({ data, onClose }) => {
    const replacer = (key: string, value: any) => {
        if (value && typeof value === 'object' && value.toDate instanceof Function) {
            return value.toDate().toISOString();
        }
        return value;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Collaboration Details</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                    <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-4 rounded">{JSON.stringify(data, replacer, 2)}</pre>
                </div>
            </div>
        </div>
    );
};

const ConversationModal: React.FC<{ collab: AnyCollaboration, onClose: () => void }> = ({ collab, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const getParticipantIds = () => {
        if ('brandId' in collab) {
            if ('influencerId' in collab) return [collab.brandId, collab.influencerId];
            if ('liveTvId' in collab) return [collab.brandId, (collab as AdSlotRequest).liveTvId];
            if ('agencyId' in collab) return [collab.brandId, (collab as BannerAdBookingRequest).agencyId];
        }
        return [];
    };

    const [brandId] = getParticipantIds();

    useEffect(() => {
        const [userId1, userId2] = getParticipantIds();
        if (userId1 && userId2) {
            apiService.getMessages(userId1, userId2)
                .then(setMessages)
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, [collab]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Conversation</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {isLoading ? <p>Loading messages...</p> : messages.length === 0 ? <p>No messages found.</p> :
                        messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.senderId === brandId ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs px-4 py-3 rounded-2xl ${msg.senderId === brandId ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200'}`}>
                                    <p className="text-sm">{msg.text}</p>
                                    <p className={`text-xs mt-1 text-right ${msg.senderId === brandId ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>{msg.timestamp}</p>
                                </div>
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    );
};

const CollaborationsPanel: React.FC<{ collaborations: CombinedCollabItem[], allTransactions: Transaction[], onUpdate: (id: string, type: string, data: Partial<AnyCollaboration>) => void }> = ({ collaborations, allTransactions, onUpdate }) => {
    const [viewingDetails, setViewingDetails] = useState<AnyCollaboration | null>(null);
    const [viewingConversation, setViewingConversation] = useState<AnyCollaboration | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const bookingStatuses = [...new Set([
        'pending', 'rejected', 'influencer_offer', 'brand_offer', 'agreement_reached',
        'in_progress', 'work_submitted', 'completed', 'disputed', 'brand_decision_pending', 'refund_pending_admin_review',
        'pending_brand_review', 'brand_counter_offer', 'influencer_counter_offer', 'pending_approval', 'agency_offer'
    ])];

    const filteredCollaborations = useMemo(() => {
        if (!searchTerm) return collaborations;
        const lowercasedFilter = searchTerm.toLowerCase();
        return collaborations.filter(item => 
            item.customerName.toLowerCase().includes(lowercasedFilter) ||
            item.providerName.toLowerCase().includes(lowercasedFilter) ||
            item.title.toLowerCase().includes(lowercasedFilter) ||
            item.id.toLowerCase().includes(lowercasedFilter) ||
            (item.customerPiNumber && item.customerPiNumber.toLowerCase().includes(lowercasedFilter)) ||
            (item.providerPiNumber && item.providerPiNumber.toLowerCase().includes(lowercasedFilter)) ||
            (item.originalData.collabId && item.originalData.collabId.toLowerCase().includes(lowercasedFilter))
        );
    }, [collaborations, searchTerm]);

    const handleStatusChange = (item: CombinedCollabItem, newStatus: string) => {
        onUpdate(item.id, item.type, { status: newStatus as any });
    };

    const handlePaymentChange = (item: CombinedCollabItem, newStatus: 'Paid' | 'Unpaid') => {
        onUpdate(item.id, item.type, { paymentStatus: newStatus === 'Paid' ? 'paid' : undefined });
    };
    
    const handlePayoutChange = (item: CombinedCollabItem, newStatus: string) => {
        let paymentStatusUpdate: AnyCollaboration['paymentStatus'];
        if (newStatus === 'Requested') paymentStatusUpdate = 'payout_requested';
        else if (newStatus === 'Completed') paymentStatusUpdate = 'payout_complete';
        else paymentStatusUpdate = 'paid';
        
        onUpdate(item.id, item.type, { paymentStatus: paymentStatusUpdate });
    };

    const getRelatedTransaction = (collabId: string | undefined, docId: string) => {
        return allTransactions.find(t => t.relatedId === docId || (collabId && t.collabId === collabId));
    };

    return (
        <div className="h-full overflow-auto p-4">
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by customer, provider, title, ID or PI number..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-inner overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Collab ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gateway Ref</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Booking Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payout</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-200">
                            {filteredCollaborations.map(item => (
                                <tr key={item.id}>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <img className="h-8 w-8 rounded-full" src={item.customerAvatar} alt="" />
                                            <div className="ml-2">
                                                <div className="text-sm font-medium">{item.customerName}</div>
                                                {item.customerPiNumber && <div className="text-xs text-gray-400 font-mono">{item.customerPiNumber}</div>}
                                                <div className="text-xs text-gray-500">{item.title}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <img className="h-8 w-8 rounded-full" src={item.providerAvatar} alt="" />
                                            <div className="ml-2">
                                                <div className="text-sm font-medium">{item.providerName}</div>
                                                {item.providerPiNumber && <div className="text-xs text-gray-400 font-mono">{item.providerPiNumber}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">{item.date?.toLocaleDateString()}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <div className="text-xs font-mono" title={item.id}>
                                            {item.originalData.collabId || item.id}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        {(() => {
                                            const tx = getRelatedTransaction(item.originalData.collabId, item.id);
                                            return tx ? <span className="font-mono text-xs">{tx.transactionId}</span> : '-';
                                        })()}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        {(() => {
                                            const tx = getRelatedTransaction(item.originalData.collabId, item.id);
                                            const ref = tx?.paymentGatewayDetails?.razorpayPaymentId || tx?.paymentGatewayDetails?.referenceId;
                                            return ref ? <span className="font-mono text-xs">{ref}</span> : '-';
                                        })()}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <select value={item.status} onChange={(e) => handleStatusChange(item, e.target.value)} className="w-full text-sm rounded-md border-gray-300 dark:bg-gray-600 dark:border-gray-500 capitalize">
                                            {bookingStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <select value={item.paymentStatus} onChange={(e) => handlePaymentChange(item, e.target.value as any)} className="w-full text-sm rounded-md border-gray-300 dark:bg-gray-600 dark:border-gray-500">
                                            <option value="Unpaid">Unpaid</option>
                                            <option value="Paid">Paid</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <select value={item.payoutStatus} onChange={(e) => handlePayoutChange(item, e.target.value)} className="w-full text-sm rounded-md border-gray-300 dark:bg-gray-600 dark:border-gray-500">
                                            <option value="N/A">N/A</option>
                                            <option value="Requested">Requested</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm space-x-2">
                                        <button onClick={() => setViewingDetails(item.originalData)} className="text-indigo-600 hover:underline">Details</button>
                                        <button onClick={() => setViewingConversation(item.originalData)} className="text-indigo-600 hover:underline">Message</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {viewingDetails && <DetailsModal data={viewingDetails} onClose={() => setViewingDetails(null)} />}
            {viewingConversation && <ConversationModal collab={viewingConversation} onClose={() => setViewingConversation(null)} />}
        </div>
    );
};

const DashboardPanel: React.FC<{ users: User[], collaborations: CombinedCollabItem[], transactions: Transaction[], payouts: PayoutRequest[], dailyPayouts: DailyPayoutRequest[] }> = ({ users, collaborations, transactions, payouts, dailyPayouts }) => {
    const totalUsers = users.length;
    const totalTransactions = transactions.length;
    const totalCollabs = collaborations.length;

    const totalRevenue = transactions.reduce((sum, t) => t.status === 'completed' ? sum + t.amount : sum, 0);

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{totalUsers}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">₹{totalRevenue.toLocaleString()}</p>
                </div>
                 <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-500">Total Collaborations</h3>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{totalCollabs}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-sm font-medium text-gray-500">Pending Payouts</h3>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{payouts.filter(p => p.status === 'pending').length + dailyPayouts.filter(d => d.status === 'pending').length}</p>
                </div>
            </div>
        </div>
    );
};

const DiscountSettingsPanel: React.FC<{ 
    settings: PlatformSettings;
    setSettings: React.Dispatch<React.SetStateAction<PlatformSettings>>;
    setIsDirty: (isDirty: boolean) => void;
}> = ({ settings, setSettings, setIsDirty }) => {
    
    type DiscountType = keyof PlatformSettings['discountSettings'];
    
    const handleDiscountChange = (discountType: DiscountType, key: keyof DiscountSetting, value: boolean | number) => {
        const newSettings = {
            ...settings,
            discountSettings: {
                ...settings.discountSettings,
                [discountType]: {
                    ...settings.discountSettings[discountType],
                    [key]: value,
                },
            },
        };
        setSettings(newSettings);
        setIsDirty(true);
    };

    const discountConfigs: { key: DiscountType; label: string }[] = [
        { key: 'creatorProfileBoost', label: 'Creator Profile Boost' },
        { key: 'brandMembership', label: 'Brand Membership' },
        { key: 'creatorMembership', label: 'Creator Membership' },
        { key: 'brandCampaignBoost', label: 'Brand Campaign Boost' },
    ];

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Discount Management</h3>
            <div className="space-y-6">
                {discountConfigs.map(({ key, label }) => (
                    <div key={key} className="p-4 border rounded-md">
                        <h4 className="font-semibold">{label}</h4>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                            <div className="flex items-center gap-2">
                                <label className="text-sm">Enable Discount:</label>
                                <ToggleSwitch
                                    enabled={settings.discountSettings[key].isEnabled}
                                    onChange={(val) => handleDiscountChange(key, 'isEnabled', val)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm">Percentage (%):</label>
                                <input
                                    type="number"
                                    value={settings.discountSettings[key].percentage}
                                    onChange={(e) => handleDiscountChange(key, 'percentage', Number(e.target.value))}
                                    className="w-full p-1 border rounded-md text-sm"
                                    disabled={!settings.discountSettings[key].isEnabled}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ConfirmationModal: React.FC<{
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    confirmClass?: string;
}> = ({ message, onConfirm, onCancel, confirmText = 'Confirm', confirmClass = 'bg-red-600 hover:bg-red-700' }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Confirm Action</h3>
                <p className="my-4 text-gray-600 dark:text-gray-300">{message}</p>
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-50">Cancel</button>
                    <button onClick={onConfirm} className={`px-4 py-2 text-white rounded-lg ${confirmClass}`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

const UserDetailsModal: React.FC<{ 
    user: User | null; 
    onClose: () => void;
    onSendReset: (user: User) => void;
    onToggleBlock: (user: User) => void;
    allTransactions: Transaction[];
    allPayouts: PayoutRequest[];
    allCollabs: CombinedCollabItem[];
    influencerProfile: Influencer | null;
    onUpdate: () => void;
}> = ({ user, onClose, onSendReset, onToggleBlock, allTransactions, allPayouts, allCollabs, influencerProfile, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'financials' | 'collaborations' | 'socials' | 'kyc' | 'verification'>('profile');
    const [confirmationAction, setConfirmationAction] = useState<{ action: 'block' | 'unblock' | 'reset' | 'activate_membership' | 'deactivate_membership', user: User } | null>(null);

    const handleToggleMembership = async (userToUpdate: User, activate: boolean) => {
        try {
            await apiService.updateUserMembership(userToUpdate.id, activate);
            onUpdate();
        } catch (err) {
            console.error("Failed to update membership:", err);
            alert("Failed to update membership status.");
        }
    };

    const executeConfirmation = () => {
        if (!confirmationAction) return;
        const { action, user } = confirmationAction;
    
        if (action === 'reset') onSendReset(user);
        if (action === 'block' || action === 'unblock') onToggleBlock(user);
        if (action === 'activate_membership' || action === 'deactivate_membership') {
            handleToggleMembership(user, action === 'activate_membership');
        }
    
        setConfirmationAction(null);
    };

    const paymentHistory = useMemo(() => {
        if (!user) return [];
        const userTransactions = allTransactions.filter(t => t.userId === user.id);
        const userPayouts = allPayouts.filter(p => p.userId === user.id);
        
        const combined = [
            ...userTransactions.map(t => ({ ...t, type: 'Payment', date: toJsDate(t.timestamp) })),
            ...userPayouts.map(p => ({ ...p, type: 'Payout', date: toJsDate(p.timestamp) })),
        ];
        
        return combined.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    }, [user, allTransactions, allPayouts]);

    const latestBankDetails = useMemo(() => {
        if (!user) return null;
        const userPayouts = allPayouts.filter(p => p.userId === user.id).sort((a,b) => (b.timestamp as Timestamp).toMillis() - (a.timestamp as Timestamp).toMillis());
        for (const payout of userPayouts) {
            if (payout.bankDetails) return { type: 'Bank', details: payout.bankDetails };
            if (payout.upiId) return { type: 'UPI', details: payout.upiId };
        }
        return null;
    }, [user, allPayouts]);
    
    const collaborationHistory = useMemo(() => {
        if (!user) return [];
        return allCollabs.filter(c => c.originalData.brandId === user.id || ('influencerId' in c.originalData && c.originalData.influencerId === user.id) || ('agencyId' in c.originalData && c.originalData.agencyId === user.id) || ('liveTvId' in c.originalData && c.originalData.liveTvId === user.id));
    }, [user, allCollabs]);

    const getRelatedTransaction = (collabId: string | undefined, docId: string) => {
        return allTransactions.find(t => t.relatedId === docId || (collabId && t.collabId === collabId));
    };

    const socialLinks = useMemo(() => {
        if (!influencerProfile || !influencerProfile.socialMediaLinks) return [];
        return influencerProfile.socialMediaLinks.split(',').map(s => s.trim()).filter(Boolean);
    }, [influencerProfile]);
    
    if (!user) return null;

    const tabs: {
        id: 'profile' | 'financials' | 'collaborations' | 'socials' | 'kyc' | 'verification';
        label: string;
        icon: React.FC<{ className?: string }>;
    }[] = [
        { id: 'profile', label: 'Profile', icon: ProfileIcon },
        { id: 'financials', label: 'Financials', icon: PaymentIcon },
        { id: 'collaborations', label: 'Collaborations', icon: CollabIcon },
    ];
    if (user.role === 'influencer') {
        tabs.push({ id: 'socials', label: 'Socials', icon: SocialsIcon });
    }
    if (user.kycStatus !== 'not_submitted') {
        tabs.push({ id: 'kyc', label: 'KYC Details', icon: KycIcon });
    }
    if (user.creatorVerificationStatus && user.creatorVerificationStatus !== 'not_submitted') {
        tabs.push({ id: 'verification', label: 'Verification Info', icon: SparklesIcon });
    }

    const DetailRow: React.FC<{ label: string; value?: React.ReactNode; children?: React.ReactNode }> = ({ label, value, children }) => (
        <div className="py-2 grid grid-cols-3 gap-4">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 col-span-2 sm:mt-0">{value || children || 'N/A'}</dd>
        </div>
    );
    
    const HistoryTable: React.FC<{ items: any[], columns: { header: string, accessor: (item: any) => React.ReactNode }[] }> = ({ items, columns }) => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                        {columns.map(col => <th key={col.header} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{col.header}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {items.map((item, index) => (
                        <tr key={index}>
                            {columns.map(col => <td key={col.header} className="px-4 py-3 whitespace-nowrap text-sm">{col.accessor(item)}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const KycDetailsView: React.FC<{ user: User, onAction: () => void }> = ({ user, onAction }) => {
        const [isProcessing, setIsProcessing] = useState(false);
        const kycDetails = user.kycDetails;

        const handleKycAction = async (status: 'approved' | 'rejected') => {
            let reason: string | undefined;
            if (status === 'rejected') {
                reason = prompt("Please provide a reason for rejection:");
                if (reason === null) return; // User cancelled
            }

            if (!window.confirm(`Are you sure you want to ${status} this KYC submission?`)) return;

            setIsProcessing(true);
            try {
                await apiService.updateKycStatus(user.id, status, reason);
                onAction(); // This will call onUpdate and onClose
            } catch (error) {
                console.error(`Failed to ${status} KYC`, error);
                alert(`Could not ${status} KYC. Please try again.`);
            } finally {
                setIsProcessing(false);
            }
        };

        if (!kycDetails) {
            return <p className="p-4 text-gray-500">No KYC details have been submitted for this user.</p>;
        }

        return (
            <div className="space-y-6">
                <dl className="divide-y divide-gray-200 dark:divide-gray-700">
                    <DetailRow label="Address" value={kycDetails.address} />
                    <DetailRow label="Village/Town" value={kycDetails.villageTown} />
                    <DetailRow label="Road/Area" value={kycDetails.roadNameArea} />
                    <DetailRow label="PIN Code" value={kycDetails.pincode} />
                    <DetailRow label="City" value={kycDetails.city} />
                    <DetailRow label="District" value={kycDetails.district} />
                    <DetailRow label="State" value={kycDetails.state} />
                    {kycDetails.rejectionReason && <DetailRow label="Rejection Reason"><span className="text-red-600">{kycDetails.rejectionReason}</span></DetailRow>}
                </dl>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="font-medium text-gray-600 dark:text-gray-400 mb-2">ID Proof</h4>
                        {kycDetails.idProofUrl ? (
                            <a href={kycDetails.idProofUrl} target="_blank" rel="noopener noreferrer">
                                <img src={kycDetails.idProofUrl} alt="ID Proof" className="rounded-lg border dark:border-gray-600 max-h-60 w-auto cursor-pointer" />
                            </a>
                        ) : <p className="text-sm text-gray-500">Not provided.</p>}
                    </div>
                     <div>
                        <h4 className="font-medium text-gray-600 dark:text-gray-400 mb-2">Live Selfie</h4>
                        {kycDetails.selfieUrl ? (
                            <a href={kycDetails.selfieUrl} target="_blank" rel="noopener noreferrer">
                                <img src={kycDetails.selfieUrl} alt="Live Selfie" className="rounded-lg border dark:border-gray-600 max-h-60 w-auto cursor-pointer" />
                            </a>
                        ) : <p className="text-sm text-gray-500">Not provided.</p>}
                    </div>
                </div>

                {user.kycStatus === 'pending' && (
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
                        <button onClick={() => handleKycAction('rejected')} disabled={isProcessing} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">Reject</button>
                        <button onClick={() => handleKycAction('approved')} disabled={isProcessing} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">Approve</button>
                    </div>
                )}
            </div>
        );
    };

    const CreatorVerificationView: React.FC<{ user: User, onAction: () => void }> = ({ user, onAction }) => {
        const [isProcessing, setIsProcessing] = useState(false);
        const details = user.creatorVerificationDetails;

        const handleVerificationAction = async (status: 'approved' | 'rejected') => {
            let reason: string | undefined;
            if (status === 'rejected') {
                reason = prompt("Please provide a reason for rejection:");
                if (reason === null) return; // User cancelled
            }

            if (!window.confirm(`Are you sure you want to ${status} this verification?`)) return;

            setIsProcessing(true);
            try {
                await apiService.updateCreatorVerificationStatus(user.id, status, reason);
                onAction(); 
            } catch (error) {
                console.error(`Failed to ${status} verification`, error);
                alert(`Could not ${status} verification. Please try again.`);
            } finally {
                setIsProcessing(false);
            }
        };

        if (!details) {
            return <p className="p-4 text-gray-500">No verification details have been submitted for this user.</p>;
        }

        return (
            <div className="space-y-6">
                <dl className="divide-y divide-gray-200 dark:divide-gray-700">
                    {user.role === 'influencer' && (
                        <>
                             <DetailRow label="Social Media Links" value={<pre className="whitespace-pre-wrap font-sans">{details.socialMediaLinks}</pre>} />
                             <DetailRow label="ID Number" value={details.idNumber} />
                        </>
                    )}
                    {(user.role === 'livetv' || user.role === 'banneragency') && (
                        <>
                            <DetailRow label="Registration No." value={details.registrationNo} />
                            <DetailRow label="MSME No." value={details.msmeNo} />
                            <DetailRow label="Business PAN" value={details.businessPan} />
                            <DetailRow label="Trade License" value={details.tradeLicenseNo} />
                        </>
                    )}
                    {details.rejectionReason && <DetailRow label="Rejection Reason"><span className="text-red-600">{details.rejectionReason}</span></DetailRow>}
                </dl>

                {user.creatorVerificationStatus === 'pending' && (
                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-600">
                        <button onClick={() => handleVerificationAction('rejected')} disabled={isProcessing} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">Reject</button>
                        <button onClick={() => handleVerificationAction('approved')} disabled={isProcessing} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">Approve</button>
                    </div>
                )}
            </div>
        );
    };

    const isMembershipActive = !!(user.membership?.isActive && user.membership.expiresAt && toJsDate(user.membership.expiresAt)! > new Date());
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full" />
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{user.name}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>

                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
                        {tabs.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                <tab.icon className="w-5 h-5" /> {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    {activeTab === 'profile' && (
                        <dl className="divide-y divide-gray-200 dark:divide-gray-700">
                            <DetailRow label="Full Name" value={user.name} />
                            <DetailRow label="Profile ID" value={<span className="font-mono">{user.piNumber}</span>} />
                            <DetailRow label="Email" value={user.email} />
                            <DetailRow label="Mobile" value={user.mobileNumber} />
                            <DetailRow label="Company" value={user.companyName} />
                            <DetailRow label="Role" value={<span className="capitalize">{user.role}</span>} />
                            <DetailRow label="KYC Status">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.kycStatus === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {user.kycStatus.replace('_', ' ')}
                                </span>
                            </DetailRow>
                             <DetailRow label="Creator Verification">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.creatorVerificationStatus === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {user.creatorVerificationStatus?.replace('_', ' ')}
                                </span>
                            </DetailRow>
                        </dl>
                    )}
                    {activeTab === 'financials' && (
                        <div>
                             <DetailRow label="Last Known Payment Details">
                                {latestBankDetails ? (
                                    <pre className="text-xs font-mono whitespace-pre-wrap bg-gray-50 p-2 rounded">{latestBankDetails.details}</pre>
                                ) : (
                                    'No payout details found.'
                                )}
                            </DetailRow>
                            <h4 className="font-bold my-4">History</h4>
                            {paymentHistory.length === 0 ? <p className="text-sm text-gray-500">No transactions found.</p> :
                                <HistoryTable
                                    items={paymentHistory}
                                    columns={[
                                        { header: 'Date', accessor: item => item.date?.toLocaleDateString() },
                                        { header: 'Order ID', accessor: item => <span className="font-mono text-xs">{item.transactionId}</span> },
                                        { header: 'Gateway Ref', accessor: item => {
                                             const ref = item.paymentGatewayDetails?.razorpayPaymentId || item.paymentGatewayDetails?.referenceId;
                                             return ref ? <span className="font-mono text-xs">{ref}</span> : '-';
                                        }},
                                        { header: 'Collab ID', accessor: item => <span className="font-mono text-xs">{item.collabId || '-'}</span> },
                                        { header: 'Type', accessor: item => <span className={`font-semibold ${item.type === 'Payment' ? 'text-red-600' : 'text-green-600'}`}>{item.type}</span> },
                                        { header: 'Amount', accessor: item => `₹${item.amount.toLocaleString()}` },
                                        { header: 'Status', accessor: item => <PayoutStatusBadge status={item.status} /> },
                                        { header: 'Description', accessor: item => <span className="max-w-xs truncate block">{item.description}</span> },
                                    ]}
                                />
                            }
                        </div>
                    )}
                    {activeTab === 'collaborations' && (
                         <div>
                            {collaborationHistory.length === 0 ? <p className="text-sm text-gray-500">No collaborations found.</p> :
                                <HistoryTable
                                    items={collaborationHistory}
                                    columns={[
                                        { header: 'Date', accessor: item => item.date?.toLocaleDateString() },
                                        { header: 'Collab ID', accessor: item => <span className="font-mono text-xs" title={item.id}>{item.originalData.collabId || item.id}</span> },
                                        { header: 'Title', accessor: item => item.title },
                                        { header: 'Order ID', accessor: item => {
                                            const tx = getRelatedTransaction(item.originalData.collabId, item.id);
                                            return tx ? <span className="font-mono text-xs">{tx.transactionId}</span> : '-';
                                        }},
                                        { header: 'Gateway Ref', accessor: item => {
                                            const tx = getRelatedTransaction(item.originalData.collabId, item.id);
                                            const ref = tx?.paymentGatewayDetails?.razorpayPaymentId || tx?.paymentGatewayDetails?.referenceId;
                                            return ref ? <span className="font-mono text-xs">{ref}</span> : '-';
                                        }},
                                        { header: 'Type', accessor: item => item.type },
                                        { header: 'Status', accessor: item => <span className="capitalize">{item.status.replace(/_/g, ' ')}</span> },
                                        { header: 'Payment', accessor: item => item.paymentStatus },
                                    ]}
                                />
                            }
                        </div>
                    )}
                    {activeTab === 'socials' && (
                        <div>
                            {socialLinks.length === 0 ? <p className="text-sm text-gray-500">No social media links provided.</p> :
                                <ul className="space-y-2">
                                    {socialLinks.map((link, i) => (
                                        <li key={i}><a href={link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate block">{link}</a></li>
                                    ))}
                                </ul>
                            }
                        </div>
                    )}
                    {activeTab === 'kyc' && <KycDetailsView user={user} onAction={() => { onUpdate(); onClose(); }} />}
                    {activeTab === 'verification' && <CreatorVerificationView user={user} onAction={() => { onUpdate(); onClose(); }} />}
                </div>
                
                <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                    <div className="flex gap-2">
                        <button onClick={() => setConfirmationAction({ action: 'reset', user })} className="px-3 py-2 text-sm text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200">Send Reset Email</button>
                        {user.role !== 'staff' && (
                            <button 
                                onClick={() => setConfirmationAction({ action: isMembershipActive ? 'deactivate_membership' : 'activate_membership', user })} 
                                className={`px-3 py-2 text-sm text-white rounded-md ${isMembershipActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                            >
                                {isMembershipActive ? 'Deactivate Membership' : 'Activate Membership'}
                            </button>
                        )}
                    </div>
                    <button 
                        onClick={() => setConfirmationAction({ action: user.isBlocked ? 'unblock' : 'block', user })} 
                        className={`px-4 py-2 text-sm font-semibold text-white rounded-md ${user.isBlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                        {user.isBlocked ? 'Unblock User' : 'Block User'}
                    </button>
                </div>
            </div>

            {confirmationAction && (
                <ConfirmationModal 
                    message={`Are you sure you want to ${confirmationAction.action.replace('_', ' ')} for ${confirmationAction.user.name}?`}
                    onConfirm={executeConfirmation}
                    onCancel={() => setConfirmationAction(null)}
                    confirmClass={confirmationAction.action.includes('block') ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                    confirmText="Confirm"
                />
            )}
        </div>
    );
};

const UserManagementPanel: React.FC<{
    users: User[];
    onUserSelect: (user: User) => void;
}> = ({ users, onUserSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        const lowercasedFilter = searchTerm.toLowerCase();
        return users.filter(user =>
            user.name.toLowerCase().includes(lowercasedFilter) ||
            user.email.toLowerCase().includes(lowercasedFilter) ||
            (user.piNumber && user.piNumber.toLowerCase().includes(lowercasedFilter)) ||
            user.role.toLowerCase().includes(lowercasedFilter)
        );
    }, [users, searchTerm]);

    const KycStatusBadge: React.FC<{ status: KycStatus }> = ({ status }) => {
        const colors = {
            approved: "bg-green-100 text-green-800",
            pending: "bg-yellow-100 text-yellow-800",
            rejected: "bg-red-100 text-red-800",
            not_submitted: "bg-gray-100 text-gray-800",
        };
        return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status]} capitalize`}>{status.replace('_', ' ')}</span>;
    };

    return (
        <div className="p-6 h-full flex flex-col bg-gray-100 dark:bg-gray-900">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">User Management</h2>
            <input
                type="text"
                placeholder="Search by name, email, role, or PI number..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full p-2 border rounded-lg mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            />
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">KYC</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <img className="h-10 w-10 rounded-full" src={user.avatar} alt={user.name} />
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{user.piNumber}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{user.role}</td>
                                <td className="px-6 py-4 whitespace-nowrap"><KycStatusBadge status={user.kycStatus} /></td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                        {user.isBlocked ? 'Blocked' : 'Active'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => onUserSelect(user)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                                        View Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredUsers.length === 0 && <p className="text-center p-6 text-gray-500">No users found.</p>}
            </div>
        </div>
    );
};

const allPermissions: StaffPermission[] = ['analytics', 'user_management', 'collaborations', 'kyc', 'financial', 'community', 'support', 'marketing', 'live_help'];

const StaffPermissionsModal: React.FC<{
    staffMember: User;
    onClose: () => void;
    onSave: (userId: string, permissions: StaffPermission[]) => Promise<void>;
}> = ({ staffMember, onClose, onSave }) => {
    const [permissions, setPermissions] = useState<StaffPermission[]>(staffMember.staffPermissions || []);
    const [isSaving, setIsSaving] = useState(false);

    const handleToggle = (permission: StaffPermission) => {
        setPermissions(prev => prev.includes(permission) ? prev.filter(p => p !== permission) : [...prev, permission]);
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(staffMember.id, permissions);
        setIsSaving(false);
    };
    
    const isSuperAdmin = staffMember.staffPermissions?.includes('super_admin');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-lg font-bold mb-4">Manage Permissions for {staffMember.name}</h3>
                {isSuperAdmin ? (
                     <div className="p-4 bg-blue-50 text-blue-800 rounded-md">This user is a Super Admin and has all permissions.</div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {allPermissions.map(permission => (
                            <div key={permission} className="flex items-center">
                                <input
                                    id={permission}
                                    type="checkbox"
                                    checked={permissions.includes(permission)}
                                    onChange={() => handleToggle(permission)}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor={permission} className="ml-3 block text-sm font-medium text-gray-700 capitalize">{permission.replace('_', ' ')}</label>
                            </div>
                        ))}
                    </div>
                )}
                 <div className="flex justify-end space-x-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200">Cancel</button>
                    {!isSuperAdmin && <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button>}
                </div>
            </div>
        </div>
    );
};

const AddStaffModal: React.FC<{
    onClose: () => void;
    onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            setIsLoading(false);
            return;
        }

        let secondaryApp;
        try {
            const appName = "SecondaryAppForStaffCreation";
            try {
                secondaryApp = initializeApp(firebaseConfig, appName);
            } catch (e: any) {
                if (e.code === 'app/duplicate-app') {
                    secondaryApp = initializeApp(firebaseConfig, `${appName}_${Date.now()}`);
                } else {
                    throw e;
                }
            }

            const secondaryAuth = getAuth(secondaryApp);
            const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            
            await signOut(secondaryAuth);

            await setDoc(doc(db, 'users', cred.user.uid), {
                name,
                email,
                role: 'staff',
                staffPermissions: [], 
                isBlocked: false,
                createdAt: Timestamp.now(),
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
                kycStatus: 'not_submitted', 
            });

            alert("Staff account created successfully.");
            onSuccess();
            onClose();

        } catch (err: any) {
            console.error("Error creating staff:", err);
            if (err.code === 'auth/email-already-in-use') {
                setError("This email is already registered.");
            } else {
                setError(err.message || "Failed to create staff account.");
            }
        } finally {
            setIsLoading(false);
            if (secondaryApp) {
                await deleteApp(secondaryApp).catch(console.error);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Add New Staff</h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            required 
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            required 
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            required 
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Min. 8 characters.</p>
                    </div>

                    {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

                    <button 
                        type="submit" 
                        disabled={isLoading} 
                        className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isLoading ? 'Creating...' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const StaffManagementPanel: React.FC<{
    staffUsers: User[];
    onUpdate: () => void;
    platformSettings: PlatformSettings;
}> = ({ staffUsers, onUpdate, platformSettings }) => {
    const [editingStaff, setEditingStaff] = useState<User | null>(null);
    const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);

    const handleSavePermissions = async (userId: string, permissions: StaffPermission[]) => {
        await apiService.updateUser(userId, { staffPermissions: permissions });
        onUpdate();
        setEditingStaff(null);
    };

    const handleAddStaffClick = () => {
        if (!platformSettings.isStaffRegistrationEnabled) {
            alert("Staff registration is currently disabled in settings.");
            return;
        }
        setIsAddStaffModalOpen(true);
    };

    return (
        <div className="p-6 h-full flex flex-col bg-gray-100 dark:bg-gray-900">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Staff Management</h2>
                <button onClick={handleAddStaffClick} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50" disabled={!platformSettings.isStaffRegistrationEnabled} title={!platformSettings.isStaffRegistrationEnabled ? "Enable in Settings to add staff" : ""}>
                    Add New Staff
                </button>
            </div>
             <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                 <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {staffUsers.map(staff => (
                            <tr key={staff.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <img className="h-10 w-10 rounded-full" src={staff.avatar} alt={staff.name} />
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{staff.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{staff.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {staff.staffPermissions?.includes('super_admin') ? (
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-200 text-purple-800">Super Admin</span>
                                        ) : (
                                            (staff.staffPermissions || []).map(p => <span key={p} className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-700">{p.replace('_', ' ')}</span>)
                                        )}
                                    </div>
                                </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => setEditingStaff(staff)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Manage Permissions</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
             {editingStaff && <StaffPermissionsModal staffMember={editingStaff} onClose={() => setEditingStaff(null)} onSave={handleSavePermissions} />}
             {isAddStaffModalOpen && <AddStaffModal onClose={() => setIsAddStaffModalOpen(false)} onSuccess={onUpdate} />}
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
