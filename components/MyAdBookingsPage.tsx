import React, { useState, useEffect, useMemo } from 'react';
import { User, AdSlotRequest, BannerAdBookingRequest, AdBookingStatus, ConversationParticipant, PlatformSettings, AnyCollaboration } from '../types';
import { Timestamp } from 'firebase/firestore';
import { apiService } from '../services/apiService';
import CashfreeModal from './PhonePeModal';
import DisputeModal from './DisputeModal';

type AdRequest = (AdSlotRequest & { type: 'Live TV' }) | (BannerAdBookingRequest & { type: 'Banner Ad' });

interface MyAdBookingsPageProps {
    user: User; // The logged-in brand
    platformSettings: PlatformSettings;
    onStartChat: (participant: ConversationParticipant) => void;
    onInitiateRefund: (collab: AnyCollaboration) => void;
}

const RequestStatusBadge: React.FC<{ status: AdBookingStatus }> = ({ status }) => {
    const baseClasses = "px-3 py-1 text-xs font-medium rounded-full capitalize whitespace-nowrap";
    const statusMap: Record<AdBookingStatus, { text: string; classes: string }> = {
        pending_approval: { text: "Pending Approval", classes: "text-yellow-800 bg-yellow-100" },
        rejected: { text: "Rejected", classes: "text-red-800 bg-red-100" },
        agency_offer: { text: "Offer Received", classes: "text-purple-800 bg-purple-100" },
        brand_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100" },
        agreement_reached: { text: "Payment Pending", classes: "text-green-800 bg-green-100" },
        in_progress: { text: "In Progress", classes: "text-cyan-800 bg-cyan-100" },
        work_submitted: { text: "Work Submitted", classes: "text-indigo-800 bg-indigo-100" },
        completed: { text: "Completed", classes: "text-gray-800 bg-gray-100" },
        disputed: { text: "Dispute in Review", classes: "text-orange-800 bg-orange-100" },
        brand_decision_pending: { text: "Decision Pending", classes: "text-gray-800 bg-gray-100" },
        refund_pending_admin_review: { text: "Refund Under Review", classes: "text-blue-800 bg-blue-100" },
    };
    const { text, classes } = statusMap[status] || { text: status.replace(/_/g, ' '), classes: "text-gray-800 bg-gray-100" };
    return <span className={`${baseClasses} ${classes}`}>{text}</span>;
};

const OfferModal: React.FC<{ request: AdRequest; onClose: () => void; onConfirm: (amount: string) => void; }> = ({ request, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">Send Counter Offer</h3>
                <p className="text-sm text-gray-600 mb-4">Agency's current offer is {request.currentOffer?.amount}. Propose a new amount.</p>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., 8000" className="w-full p-2 border rounded-md"/>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200">Cancel</button>
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
                isActive ? 'bg-white text-indigo-700 shadow' : 'text-gray-600 hover:bg-gray-200'
            }`}
        >
            {label}
            <span className={`px-2 py-0.5 text-xs rounded-full ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-700'}`}>
                {count}
            </span>
        </button>
    );
};


const MyAdBookingsPage: React.FC<MyAdBookingsPageProps> = ({ user, platformSettings, onStartChat, onInitiateRefund }) => {
    const [requests, setRequests] = useState<AdRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payingRequest, setPayingRequest] = useState<AdRequest | null>(null);
    const [disputingRequest, setDisputingRequest] = useState<AdRequest | null>(null);
    const [modal, setModal] = useState<'offer' | 'dispute' | null>(null);
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

    const handleAction = (req: AdRequest, action: 'message' | 'accept_offer' | 'recounter_offer' | 'reject_offer' | 'pay_now' | 'work_complete' | 'work_incomplete' | 'brand_complete_disputed' | 'brand_request_refund') => {
        const agencyId = req.type === 'Live TV' ? req.liveTvId : req.agencyId;
        const agencyName = req.type === 'Live TV' ? (req as AdSlotRequest).liveTvName : (req as BannerAdBookingRequest).agencyName;
        const agencyAvatar = req.type === 'Live TV' ? (req as AdSlotRequest).liveTvAvatar : (req as BannerAdBookingRequest).agencyAvatar;

        setSelectedRequest(req);
        
        switch(action) {
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

    const renderStatusInfo = (req: AdRequest) => {
        let info = null;
        switch (req.status) {
            case 'pending_approval': info = `Waiting for ${req.type === 'Live TV' ? 'channel' : 'agency'} to respond.`; break;
            case 'brand_offer': info = `You sent a counter-offer of ${req.currentOffer?.amount}.`; break;
            case 'in_progress': info = "Work is currently in progress."; break;
            case 'completed': 
                if (req.paymentStatus === 'paid') info = `Collaboration complete. Payment status: paid`;
                else info = `Collaboration complete.`;
                break;
            case 'rejected': info = req.rejectionReason ? `Rejected: ${req.rejectionReason}` : `Request Rejected`; break;
            case 'brand_decision_pending': info = `Admin has ruled in your favor. Please decide if the work can be marked as complete (to release payment) or if you want a refund.`; break;
            case 'refund_pending_admin_review': info = `Your refund request is under review. A BIGYAPON agent will process it within 48 hours.`; break;
        }
        if (!info) return null;
        return <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-lg">{info}</div>;
    };

    const renderRequestActions = (req: AdRequest) => {
        const actions: {label: string, action: Parameters<typeof handleAction>[1], style: string}[] = [];
        
        switch (req.status) {
            case 'agency_offer':
                actions.push({ label: 'Message', action: 'message', style: 'bg-gray-200 text-gray-800' });
                actions.push({ label: 'Reject Offer', action: 'reject_offer', style: 'bg-red-500 text-white' });
                actions.push({ label: 'Counter-Offer', action: 'recounter_offer', style: 'bg-blue-500 text-white' });
                actions.push({ label: 'Accept Offer', action: 'accept_offer', style: 'bg-green-500 text-white' });
                break;
            case 'agreement_reached':
                actions.push({ label: `Pay Now: ${req.finalAmount}`, action: 'pay_now', style: 'bg-green-600 text-white' });
                break;
            case 'work_submitted':
                actions.push({ label: 'Mark as Complete', action: 'work_complete', style: 'bg-green-500 text-white' });
                actions.push({ label: 'Dispute/Incomplete', action: 'work_incomplete', style: 'bg-orange-500 text-white' });
                break;
            case 'brand_decision_pending':
                actions.push({ label: 'Request Full Refund', action: 'brand_request_refund', style: 'bg-red-500 text-white' });
                actions.push({ label: 'Approve Payment', action: 'brand_complete_disputed', style: 'bg-green-500 text-white' });
                break;
        }
        
        return (
            <div className="mt-4 flex flex-wrap gap-3">
                {actions.map(a => (
                    <button key={a.label} onClick={() => handleAction(req, a.action)} className={`px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-80 ${a.style}`}>
                        {a.label}
                    </button>
                ))}
            </div>
        );
    };

    const AdBookingCard: React.FC<{ request: AdRequest }> = ({ request: req }) => (
        <li className="p-6 bg-white rounded-lg shadow-sm">
            <div className="flex justify-between items-start">
                <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${req.type === 'Live TV' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                        {req.type}
                    </span>
                    <h3 className="text-lg font-bold text-gray-800 mt-1">{req.campaignName}</h3>
                    {req.collabId && <p className="text-xs font-mono text-gray-400 mt-1">{req.collabId}</p>}
                    <p className="text-sm text-gray-500">
                        {req.type === 'Live TV' ? (req as AdSlotRequest).adType : (req as BannerAdBookingRequest).bannerAdLocation}
                    </p>
                </div>
                <RequestStatusBadge status={req.status} />
            </div>
            <div className="mt-4">
                {req.status === 'agency_offer' && <p className="text-sm font-semibold text-indigo-600">Agency's Offer: {req.currentOffer?.amount}</p>}
                {renderStatusInfo(req)}
                {renderRequestActions(req)}
            </div>
        </li>
    );

    const lists = {
        pending,
        inProgress,
        completed,
    };
    
    const currentList = lists[activeTab];

    if (isLoading) return <div className="text-center p-8">Loading ad bookings...</div>;
    if (error) return <div className="text-center p-8 bg-red-100 text-red-700 rounded-lg">{error}</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">My Ad Bookings</h1>
                <p className="text-gray-500 mt-1">Manage your Live TV and Banner Ad collaborations.</p>
            </div>

            <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg border">
                <TabButton label="Pending" count={pending.length} isActive={activeTab === 'pending'} onClick={() => setActiveTab('pending')} />
                <TabButton label="In Progress" count={inProgress.length} isActive={activeTab === 'inProgress'} onClick={() => setActiveTab('inProgress')} />
                <TabButton label="Completed & Archived" count={completed.length} isActive={activeTab === 'completed'} onClick={() => setActiveTab('completed')} />
            </div>

            {currentList.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-lg shadow"><p className="text-gray-500">No ad bookings in this category.</p></div>
            ) : (
                <ul className="space-y-4">
                    {currentList.map(req => (
                        <AdBookingCard key={req.id} request={req} />
                    ))}
                </ul>
            )}

            {modal === 'offer' && selectedRequest && (
                <OfferModal request={selectedRequest} onClose={() => setModal(null)} onConfirm={(amount) => handleUpdate(selectedRequest, { status: 'brand_offer', currentOffer: { amount: `₹${amount}`, offeredBy: 'brand' }})} />
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
                        <p className="text-gray-600 dark:text-gray-300 my-4">Are you sure you want to approve this work? This will mark the collaboration as complete and release the final payment to the agency/channel.</p>
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