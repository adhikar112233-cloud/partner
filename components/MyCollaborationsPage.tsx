import React, { useState, useEffect, useMemo } from 'react';
import { User, CollaborationRequest, CollabRequestStatus, ProfileData, ConversationParticipant, PlatformSettings, AnyCollaboration } from '../types';
import { apiService } from '../services/apiService';
import CashfreeModal from './PhonePeModal';
import DisputeModal from './DisputeModal';

interface MyCollaborationsPageProps {
    user: User; // The logged-in brand
    platformSettings: PlatformSettings;
    onViewProfile: (profile: ProfileData) => void;
    onStartChat: (participant: ConversationParticipant) => void;
    onInitiateRefund: (collab: AnyCollaboration) => void;
}

const RequestStatusBadge: React.FC<{ status: CollabRequestStatus }> = ({ status }) => {
    const baseClasses = "px-3 py-1 text-xs font-medium rounded-full capitalize whitespace-nowrap";
    const statusMap: Record<CollabRequestStatus, { text: string; classes: string }> = {
        pending: { text: "Pending Influencer Response", classes: "text-yellow-800 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300" },
        rejected: { text: "Rejected", classes: "text-red-800 bg-red-100 dark:bg-red-900/50 dark:text-red-300" },
        influencer_offer: { text: "Offer Received", classes: "text-purple-800 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300" },
        brand_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300" },
        agreement_reached: { text: "Payment Pending", classes: "text-green-800 bg-green-100 dark:bg-green-900/50 dark:text-green-300" },
        in_progress: { text: "In Progress", classes: "text-cyan-800 bg-cyan-100 dark:bg-cyan-900/50 dark:text-cyan-300" },
        work_submitted: { text: "Work Submitted", classes: "text-indigo-800 bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-300" },
        completed: { text: "Completed", classes: "text-gray-800 bg-gray-100 dark:bg-gray-700 dark:text-gray-300" },
        disputed: { text: "Dispute in Review", classes: "text-orange-800 bg-orange-100 dark:bg-orange-900/50 dark:text-orange-300" },
        brand_decision_pending: { text: "Decision Pending", classes: "text-gray-800 bg-gray-100 dark:bg-gray-700 dark:text-gray-300" },
        refund_pending_admin_review: { text: "Refund Under Review", classes: "text-blue-800 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300" },
    };
    const { text, classes } = statusMap[status] || { text: status, classes: "text-gray-800 bg-gray-100 dark:bg-gray-700 dark:text-gray-300" };
    return <span className={`${baseClasses} ${classes}`}>{text}</span>;
};

const OfferModal: React.FC<{ request: CollaborationRequest; onClose: () => void; onConfirm: (amount: string) => void; }> = ({ request, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-100">Send Counter Offer</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Influencer's current offer is {request.currentOffer?.amount}. Propose a new amount.</p>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., 8000" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    <button onClick={() => onConfirm(amount)} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white">Send Offer</button>
                </div>
            </div>
        </div>
    );
};

const CollaborationItem: React.FC<{
    req: CollaborationRequest;
    onViewProfile: (profile: ProfileData) => void;
    renderStatusInfo: (req: CollaborationRequest) => React.ReactNode;
    renderRequestActions: (req: CollaborationRequest) => React.ReactNode;
}> = ({ req, onViewProfile, renderStatusInfo, renderRequestActions }) => (
    <li className="p-6">
        <div className="flex items-start space-x-4">
            <button onClick={() => onViewProfile({ id: req.influencerId, name: req.influencerName, avatar: req.influencerAvatar, role: 'influencer' })} className="rounded-full flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" aria-label={`View profile of ${req.influencerName}`}>
                <img src={req.influencerAvatar} alt={req.influencerName} className="w-12 h-12 rounded-full object-cover" />
            </button>
            <div className="flex-1">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{req.title}</h3>
                        {req.collabId && <p className="text-xs font-mono text-gray-400">{req.collabId}</p>}
                    </div>
                    <RequestStatusBadge status={req.status} />
                </div>
                <p className="text-sm font-medium text-gray-600">With: {req.influencerName}</p>
                <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{req.message}</p>
                {req.status === 'influencer_offer' && <p className="text-sm font-semibold text-indigo-600 mt-2">Influencer's Offer: {req.currentOffer?.amount}</p>}
                {renderStatusInfo(req)}
                {renderRequestActions(req)}
            </div>
        </div>
    </li>
);


const MyCollaborationsPage: React.FC<MyCollaborationsPageProps> = ({ user, platformSettings, onViewProfile, onStartChat, onInitiateRefund }) => {
    const [requests, setRequests] = useState<CollaborationRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<'offer' | 'dispute' | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<CollaborationRequest | null>(null);
    const [payingRequest, setPayingRequest] = useState<CollaborationRequest | null>(null);
    const [disputingRequest, setDisputingRequest] = useState<CollaborationRequest | null>(null);
    const [filter, setFilter] = useState<'pending' | 'active' | 'archived'>('pending');
    const [confirmAction, setConfirmAction] = useState<{req: CollaborationRequest, action: 'approve_payment'} | null>(null);

    const fetchRequests = () => {
        setIsLoading(true);
        const unsubscribe = apiService.getCollabRequestsForBrandListener(
            user.id,
            (data) => {
                setRequests(data);
                setIsLoading(false);
                setError(null);
            },
            (err) => {
                console.error(err);
                setError("Failed to fetch collaborations.");
                setIsLoading(false);
            }
        );
        return () => unsubscribe();
    }

    useEffect(() => {
        const unsubscribe = fetchRequests();
        return () => unsubscribe();
    }, [user.id]);

    const handleUpdate = async (reqId: string, data: Partial<CollaborationRequest>) => {
        try {
             await apiService.updateCollaborationRequest(reqId, data, user.id);
        } catch(err) {
            console.error("Update failed", err);
        } finally {
            setModal(null);
            setSelectedRequest(null);
        }
    };
    
    const handleAction = (req: CollaborationRequest, action: 'message' | 'accept_offer' | 'recounter_offer' | 'reject_offer' | 'pay_now' | 'work_complete' | 'work_incomplete' | 'brand_complete_disputed' | 'brand_request_refund') => {
        setSelectedRequest(req);
        switch(action) {
            case 'message':
                onStartChat({ id: req.influencerId, name: req.influencerName, avatar: req.influencerAvatar, role: 'influencer' });
                break;
            case 'recounter_offer':
                setModal('offer');
                break;
            case 'accept_offer':
                handleUpdate(req.id, { status: 'agreement_reached', finalAmount: req.currentOffer?.amount });
                break;
            case 'reject_offer':
                handleUpdate(req.id, { status: 'rejected', rejectionReason: 'Offer rejected by brand.' });
                break;
            case 'pay_now':
                setPayingRequest(req);
                break;
            case 'work_complete':
                handleUpdate(req.id, { status: 'completed' });
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
        handleUpdate(req.id, { status: 'completed' });
        setConfirmAction(null);
    };

    const renderRequestActions = (req: CollaborationRequest) => {
        const actions: {label: string, action: Parameters<typeof handleAction>[1], style: string}[] = [];
        
        switch (req.status) {
            case 'influencer_offer':
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
        
        if (actions.length === 0) return null;

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
    
    const renderStatusInfo = (req: CollaborationRequest) => {
        let info = null;
        switch (req.status) {
            case 'pending': info = `Waiting for ${req.influencerName} to respond to your request.`; break;
            case 'brand_offer': info = `You sent a counter-offer of ${req.currentOffer?.amount}.`; break;
            case 'in_progress': info = "Work is currently in progress."; break;
            case 'completed': info = `Collaboration complete. Payment status: ${req.paymentStatus || 'pending'}`; break;
            case 'rejected': info = req.rejectionReason ? `Rejected: ${req.rejectionReason}` : `Request Rejected`; break;
            case 'brand_decision_pending': info = `Admin has ruled in your favor. Please decide if the work can be marked as complete (to release payment) or if you want a refund.`; break;
            case 'refund_pending_admin_review': info = 'Your refund request is under review. A BIGYAPON agent will process it within 48 hours.'; break;
        }
        if (!info) return null;
        return <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-lg">{info}</div>;
    };

    const filteredRequests = useMemo(() => {
        const pending: CollaborationRequest[] = [];
        const active: CollaborationRequest[] = [];
        const archived: CollaborationRequest[] = [];
        requests.forEach(req => {
            if(['pending', 'influencer_offer', 'brand_offer', 'agreement_reached'].includes(req.status)) {
                pending.push(req);
            } else if (['in_progress', 'work_submitted', 'disputed', 'brand_decision_pending', 'refund_pending_admin_review'].includes(req.status)) {
                active.push(req);
            } else {
                archived.push(req);
            }
        });
        if (filter === 'pending') return pending;
        if (filter === 'active') return active;
        if (filter === 'archived') return archived;
        return [];
    }, [requests, filter]);

    if (isLoading) return <div className="text-center p-8">Loading collaborations...</div>;
    if (error) return <div className="text-center p-8 bg-red-100 text-red-700 rounded-lg">{error}</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">My Direct Collaborations</h1>
                <p className="text-gray-500 mt-1">Manage your one-on-one partnerships with influencers.</p>
            </div>
            
            <div className="flex space-x-2 p-1 bg-gray-50 rounded-lg border">
                 <button onClick={() => setFilter('pending')} className={`px-4 py-2 text-sm font-semibold rounded-lg ${filter === 'pending' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>Pending</button>
                 <button onClick={() => setFilter('active')} className={`px-4 py-2 text-sm font-semibold rounded-lg ${filter === 'active' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>Active</button>
                 <button onClick={() => setFilter('archived')} className={`px-4 py-2 text-sm font-semibold rounded-lg ${filter === 'archived' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>Archived and Complete</button>
            </div>
            
            {requests.length === 0 ? (
                 <div className="text-center py-10 col-span-full bg-white rounded-lg shadow"><p className="text-gray-500">You have no direct collaborations yet. Find an influencer to get started!</p></div>
            ) : (
                 <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
                    <ul className="divide-y divide-gray-200">
                        {filteredRequests.map(req => <CollaborationItem key={req.id} req={req} onViewProfile={onViewProfile} renderStatusInfo={renderStatusInfo} renderRequestActions={renderRequestActions} />)}
                    </ul>
                </div>
            )}

            {modal === 'offer' && selectedRequest && (
                <OfferModal request={selectedRequest} onClose={() => setModal(null)} onConfirm={(amount) => handleUpdate(selectedRequest.id, { status: 'brand_offer', currentOffer: { amount: `₹${amount}`, offeredBy: 'brand' }})} />
            )}
             {payingRequest && (
                <CashfreeModal
                    user={user}
                    collabType="direct"
                    baseAmount={parseFloat(payingRequest.finalAmount?.replace(/[^0-9.-]+/g, "") || "0")}
                    platformSettings={platformSettings}
                    onClose={() => {
                        setPayingRequest(null);
                        fetchRequests();
                    }}
                    transactionDetails={{
                        userId: user.id,
                        description: `Payment for collaboration: ${payingRequest.title}`,
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
                        <p className="text-gray-600 dark:text-gray-300 my-4">Are you sure you want to approve this work? This will mark the collaboration as complete and release the final payment to the influencer.</p>
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

export default MyCollaborationsPage;