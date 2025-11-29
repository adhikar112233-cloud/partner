
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, BannerAdBookingRequest, AdBookingStatus, ConversationParticipant, PlatformSettings, BannerAd, AdSlotRequest } from '../types';
import { apiService } from '../services/apiService';
import PostBannerAdModal from './PostBannerAdModal';
import { Timestamp } from 'firebase/firestore';
import CashfreeModal from './PhonePeModal';
import DisputeModal from './DisputeModal';
import { TrashIcon, MessagesIcon, EyeIcon, SparklesIcon } from './Icons';
import CollabDetailsModal from './CollabDetailsModal';
import CancellationPenaltyModal from './CancellationPenaltyModal';

type AdRequest = (AdSlotRequest & { type: 'Live TV' }) | (BannerAdBookingRequest & { type: 'Banner Ad' });

interface MyAdBookingsPageProps {
    user: User; // The logged-in brand
    platformSettings: PlatformSettings;
    onStartChat: (participant: ConversationParticipant) => void;
    onInitiateRefund: (collab: BannerAdBookingRequest | AdSlotRequest) => void;
}

const RequestStatusBadge: React.FC<{ status: AdBookingStatus }> = ({ status }) => {
    const baseClasses = "px-3 py-1 text-xs font-medium rounded-full capitalize whitespace-nowrap";
    const statusMap: Record<AdBookingStatus, { text: string; classes: string }> = {
        pending: { text: "Pending", classes: "text-yellow-800 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300" }, 
        influencer_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300" }, 
        pending_approval: { text: "Pending Approval", classes: "text-yellow-800 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300" },
        rejected: { text: "Rejected", classes: "text-red-800 bg-red-100 dark:bg-red-900/50 dark:text-red-300" },
        agency_offer: { text: "Offer Received", classes: "text-purple-800 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300" },
        brand_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300" },
        agreement_reached: { text: "Payment Pending", classes: "text-green-800 bg-green-100 dark:bg-green-900/50 dark:text-green-300" },
        in_progress: { text: "In Progress", classes: "text-cyan-800 bg-cyan-100 dark:bg-cyan-900/50 dark:text-cyan-300" },
        work_submitted: { text: "Work Submitted", classes: "text-indigo-800 bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-300" },
        completed: { text: "Completed", classes: "text-gray-800 bg-gray-100 dark:bg-gray-700 dark:text-gray-300" },
        disputed: { text: "Dispute in Review", classes: "text-orange-800 bg-orange-100 dark:bg-orange-900/50 dark:text-orange-300" },
        brand_decision_pending: { text: "Decision Pending", classes: "text-gray-800 bg-gray-100 dark:bg-gray-700 dark:text-gray-300" },
        refund_pending_admin_review: { text: "Refund Under Review", classes: "text-blue-800 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300" },
    };
    const { text, classes } = statusMap[status] || { text: status.replace(/_/g, ' '), classes: "text-gray-800 bg-gray-100 dark:bg-gray-700 dark:text-gray-300" };
    return <span className={`${baseClasses} ${classes}`}>{text}</span>;
};

const OfferModal: React.FC<{ type: 'accept' | 'recounter'; currentOffer?: string; onClose: () => void; onConfirm: (amount: string) => void; }> = ({ type, currentOffer, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-100">{type === 'accept' ? 'Accept with Offer' : 'Send Counter Offer'}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {type === 'recounter' && currentOffer ? `Agency's offer is ${currentOffer}. ` : ''}
                  Propose your fee for this ad booking.
                </p>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., 25000" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    <button onClick={() => onConfirm(amount)} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white">Send Offer</button>
                </div>
            </div>
        </div>
    );
};

const TabButton: React.FC<{
    label: string;
    count: number;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, count, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex-1 justify-center ${
                isActive ? 'bg-white text-indigo-700 shadow' : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
        >
            {label}
            <span className={`px-2 py-0.5 text-xs rounded-full ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-700'}`}>
                {count}
            </span>
        </button>
    );
};


export const MyAdBookingsPage: React.FC<MyAdBookingsPageProps> = ({ user, platformSettings, onStartChat, onInitiateRefund }) => {
    const [requests, setRequests] = useState<AdRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payingRequest, setPayingRequest] = useState<AdRequest | null>(null);
    const [disputingRequest, setDisputingRequest] = useState<AdRequest | null>(null);
    const [modal, setModal] = useState<'offer' | 'dispute' | 'details' | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<AdRequest | null>(null);
    const [confirmAction, setConfirmAction] = useState<{req: AdRequest, action: 'approve_payment'} | null>(null);
    const [activeTab, setActiveTab] = useState<'pending' | 'inProgress' | 'completed'>('pending');

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const [tvRequests, bannerRequests] = await Promise.all([
                apiService.getAdSlotRequestsForBrand(user.id),
                apiService.getBannerAdBookingRequestsForBrand(user.id)
            ]);
            const combined: AdRequest[] = [
                ...tvRequests.map(r => ({...r, type: 'Live TV' as const})),
                ...bannerRequests.map(r => ({...r, type: 'Banner Ad' as const}))
            ];
            combined.sort((a, b) => {
                const timeB = (b.timestamp && typeof (b.timestamp as Timestamp).toMillis === 'function') ? (b.timestamp as Timestamp).toMillis() : 0;
                const timeA = (a.timestamp && typeof (a.timestamp as Timestamp).toMillis === 'function') ? (a.timestamp as Timestamp).toMillis() : 0;
                return timeB - timeA;
            });
            setRequests(combined);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch your ad bookings.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [user.id]);

    const { pending, inProgress, completed } = useMemo(() => {
        const pendingReqs: AdRequest[] = [];
        const inProgressReqs: AdRequest[] = [];
        const completedReqs: AdRequest[] = [];

        const pendingStatuses: AdBookingStatus[] = ['pending_approval', 'agency_offer', 'brand_offer', 'agreement_reached'];
        const inProgressStatuses: AdBookingStatus[] = ['in_progress', 'work_submitted', 'disputed', 'brand_decision_pending', 'refund_pending_admin_review'];
        const completedStatuses: AdBookingStatus[] = ['completed', 'rejected'];

        requests.forEach(req => {
            if (pendingStatuses.includes(req.status)) {
                pendingReqs.push(req);
            } else if (inProgressStatuses.includes(req.status)) {
                inProgressReqs.push(req);
            } else if (completedStatuses.includes(req.status)) {
                completedReqs.push(req);
            }
        });
        return { pending: pendingReqs, inProgress: inProgressReqs, completed: completedReqs };
    }, [requests]);

    const handleUpdate = async (req: AdRequest, data: Partial<AdSlotRequest | BannerAdBookingRequest>) => {
        try {
            if (req.type === 'Live TV') {
                await apiService.updateAdSlotRequest(req.id, data, user.id);
            } else {
                await apiService.updateBannerAdBookingRequest(req.id, data, user.id);
            }
            fetchRequests();
        } catch (e) {
            console.error("Failed to update ad booking:", e);
        } finally {
            setModal(null);
            setSelectedRequest(null);
        }
    };

    const handleDelete = async (req: AdRequest) => {
        if(window.confirm("Are you sure you want to delete this from history? This cannot be undone.")) {
            try {
                const collectionName = req.type === 'Live TV' ? 'ad_slot_requests' : 'banner_ad_booking_requests';
                await apiService.deleteCollaboration(req.id, collectionName);
                fetchRequests();
            } catch (err) {
                console.error("Delete failed", err);
            }
        }
    };

    const handleAction = (req: AdRequest, action: 'message' | 'accept_offer' | 'recounter_offer' | 'reject_offer' | 'pay_now' | 'work_complete' | 'work_incomplete' | 'brand_complete_disputed' | 'brand_request_refund' | 'view_details') => {
        const agencyId = req.type === 'Live TV' ? req.liveTvId : req.agencyId;
        const agencyName = req.type === 'Live TV' ? (req as AdSlotRequest).liveTvName : (req as BannerAdBookingRequest).agencyName;
        const agencyAvatar = req.type === 'Live TV' ? (req as AdSlotRequest).liveTvAvatar : (req as BannerAdBookingRequest).agencyAvatar;

        setSelectedRequest(req);
        
        switch(action) {
            case 'view_details':
                setModal('details');
                break;
            case 'message':
                onStartChat({ id: agencyId, name: agencyName, avatar: agencyAvatar, role: req.type === 'Live TV' ? 'livetv' : 'banneragency' });
                break;
            case 'recounter_offer':
                setModal('offer');
                break;
            case 'accept_offer':
                handleUpdate(req, { status: 'agreement_reached', finalAmount: req.currentOffer?.amount });
                break;
            case 'reject_offer':
                handleUpdate(req, { status: 'rejected', rejectionReason: 'Offer rejected by brand.' });
                break;
            case 'pay_now':
                setPayingRequest(req);
                break;
            case 'work_complete':
                handleUpdate(req, { status: 'completed' });
                break;
            case 'work_incomplete':
                setDisputingRequest(req);
                break;
            case 'brand_complete_disputed':
                setConfirmAction({ req, action: 'approve_payment' });
                break;
            case 'brand_request_refund':
                onInitiateRefund(req);
                break;
        }
    };

    const executeConfirmAction = () => {
        if (!confirmAction) return;
        const { req } = confirmAction;
        handleUpdate(req, { status: 'completed' });
        setConfirmAction(null);
    };

    const renderRequestActions = (req: AdRequest) => {
        const actions: {label: string, action: Parameters<typeof handleAction>[1], style: string, icon?: any}[] = [];
        
        actions.push({ label: 'Details', action: 'view_details', style: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700', icon: <EyeIcon className="w-4 h-4" /> });
        actions.push({ label: 'Message', action: 'message', style: 'text-indigo-600 hover:bg-indigo-50', icon: <MessagesIcon className="w-4 h-4" /> });

        switch (req.status) {
            case 'agency_offer':
                actions.push({ label: 'Reject', action: 'reject_offer', style: 'text-red-600 hover:bg-red-50' });
                actions.push({ label: 'Counter', action: 'recounter_offer', style: 'text-blue-600 hover:bg-blue-50' });
                actions.push({ label: 'Accept', action: 'accept_offer', style: 'text-green-600 hover:bg-green-50' });
                break;
            case 'agreement_reached':
                actions.push({ label: `Pay Now`, action: 'pay_now', style: 'text-green-600 hover:bg-green-50 font-bold' });
                break;
            case 'work_submitted':
                actions.push({ label: 'Complete', action: 'work_complete', style: 'text-green-600 hover:bg-green-50' });
                actions.push({ label: 'Dispute', action: 'work_incomplete', style: 'text-orange-600 hover:bg-orange-50' });
                break;
            case 'brand_decision_pending':
                actions.push({ label: 'Refund', action: 'brand_request_refund', style: 'text-red-600 hover:bg-red-50' });
                actions.push({ label: 'Approve', action: 'brand_complete_disputed', style: 'text-green-600 hover:bg-green-50' });
                break;
        }
        
        return (
            <div className="flex flex-wrap gap-2">
                {actions.map(a => (
                    <button key={a.label} onClick={() => handleAction(req, a.action)} className={`px-3 py-1 text-xs font-semibold rounded border border-gray-200 dark:border-gray-600 flex items-center gap-1 ${a.style}`}>
                        {a.icon} {a.label}
                    </button>
                ))}
            </div>
        );
    };

    const renderTable = (list: AdRequest[]) => (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Provider / Campaign</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Collab ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {list.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                        <img 
                                            className="h-10 w-10 rounded-full object-cover" 
                                            src={req.type === 'Live TV' ? (req as AdSlotRequest).liveTvAvatar : (req as BannerAdBookingRequest).agencyAvatar} 
                                            alt="" 
                                        />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {req.type === 'Live TV' ? (req as AdSlotRequest).liveTvName : (req as BannerAdBookingRequest).agencyName}
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{req.campaignName}</div>
                                        <span className="text-xs text-indigo-500 bg-indigo-50 px-1 rounded">{req.type}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                {req.collabId || req.id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <RequestStatusBadge status={req.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-2">
                                    {renderRequestActions(req)}
                                    {['completed', 'rejected'].includes(req.status) && (
                                        <button 
                                            onClick={() => handleDelete(req)}
                                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title="Delete from History"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const currentList = activeTab === 'pending' ? pending : activeTab === 'inProgress' ? inProgress : completed;

    if (isLoading) return <div className="text-center p-8">Loading ad bookings...</div>;
    if (error) return <div className="text-center p-8 bg-red-100 text-red-700 rounded-lg">{error}</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">My Ad Bookings</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Track your Live TV and Banner Ad campaigns.</p>
            </div>
            
            <div className="flex space-x-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-x-auto">
                <TabButton label="Pending" count={pending.length} isActive={activeTab === 'pending'} onClick={() => setActiveTab('pending')} />
                <TabButton label="In Progress" count={inProgress.length} isActive={activeTab === 'inProgress'} onClick={() => setActiveTab('inProgress')} />
                <TabButton label="Completed" count={completed.length} isActive={activeTab === 'completed'} onClick={() => setActiveTab('completed')} />
            </div>
            
            {currentList.length === 0 ? (
                 <div className="text-center py-10 col-span-full bg-white dark:bg-gray-800 rounded-lg shadow"><p className="text-gray-500 dark:text-gray-400">No bookings in this category.</p></div>
            ) : (
                 renderTable(currentList)
            )}

            {modal === 'details' && selectedRequest && (
                <CollabDetailsModal collab={selectedRequest} onClose={() => { setModal(null); setSelectedRequest(null); }} />
            )}
            {modal === 'offer' && selectedRequest && (
                <OfferModal type={selectedRequest.status === 'agency_offer' ? 'accept' : 'recounter'} currentOffer={selectedRequest.currentOffer?.amount} onClose={() => setModal(null)} onConfirm={(amount) => handleUpdate(selectedRequest, { status: 'brand_offer', currentOffer: { amount: `₹${amount}`, offeredBy: 'brand' }})} />
            )}
             {payingRequest && (
                <CashfreeModal
                    user={user}
                    collabType={payingRequest.type === 'Live TV' ? 'ad_slot' : 'banner_booking'}
                    baseAmount={parseFloat(payingRequest.finalAmount?.replace(/[^0-9.-]+/g, "") || "0")}
                    platformSettings={platformSettings}
                    onClose={() => {
                        setPayingRequest(null);
                        fetchRequests();
                    }}
                    transactionDetails={{
                        userId: user.id,
                        description: `Payment for ${payingRequest.type}: ${payingRequest.campaignName}`,
                        relatedId: payingRequest.id,
                        collabId: payingRequest.collabId,
                    }}
                />
            )}
            {disputingRequest && (
                <DisputeModal
                    user={user}
                    collaboration={disputingRequest}
                    onClose={() => setDisputingRequest(null)}
                    onDisputeSubmitted={() => {
                        setDisputingRequest(null);
                        fetchRequests();
                    }}
                />
            )}
            {confirmAction && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold dark:text-gray-100">Confirm Action</h3>
                        <p className="text-gray-600 dark:text-gray-300 my-4">Are you sure you want to approve this work? This will mark the collaboration as complete and release the final payment to the agency.</p>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                            <button onClick={executeConfirmAction} className="px-4 py-2 text-sm rounded-md bg-green-600 text-white">Confirm &amp; Approve</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyAdBookingsPage;
