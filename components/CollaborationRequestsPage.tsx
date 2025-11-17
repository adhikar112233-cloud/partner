import React, { useState, useEffect, useMemo } from 'react';
import { User, CollaborationRequest, CollabRequestStatus, ProfileData, ConversationParticipant, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';

interface CollaborationRequestsPageProps {
    user: User; // The logged-in influencer
    platformSettings: PlatformSettings;
    onViewProfile: (profile: ProfileData) => void;
    onStartChat: (participant: ConversationParticipant) => void;
    onInitiatePayout: (collab: CollaborationRequest) => void;
}

const RequestStatusBadge: React.FC<{ status: CollabRequestStatus }> = ({ status }) => {
    const baseClasses = "px-3 py-1 text-xs font-medium rounded-full capitalize whitespace-nowrap";
    // FIX: Add missing 'refund_pending_admin_review' status to satisfy the type.
    const statusMap: Record<CollabRequestStatus, { text: string; classes: string }> = {
        pending: { text: "Pending", classes: "text-yellow-800 bg-yellow-100" },
        rejected: { text: "Rejected", classes: "text-red-800 bg-red-100" },
        influencer_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100" },
        brand_offer: { text: "Offer Received", classes: "text-purple-800 bg-purple-100" },
        agreement_reached: { text: "Agreement Reached", classes: "text-green-800 bg-green-100" },
        in_progress: { text: "In Progress", classes: "text-cyan-800 bg-cyan-100" },
        work_submitted: { text: "Work Submitted", classes: "text-indigo-800 bg-indigo-100" },
        completed: { text: "Completed", classes: "text-gray-800 bg-gray-100" },
        disputed: { text: "Dispute in Review", classes: "text-orange-800 bg-orange-100" },
        brand_decision_pending: { text: "Decision Pending", classes: "text-gray-800 bg-gray-100" },
        refund_pending_admin_review: { text: "Refund Under Review", classes: "text-blue-800 bg-blue-100" },
    };
    const { text, classes } = statusMap[status] || { text: status, classes: "text-gray-800 bg-gray-100" };
    return <span className={`${baseClasses} ${classes}`}>{text}</span>;
};

const OfferModal: React.FC<{ request: CollaborationRequest; type: 'accept' | 'recounter'; onClose: () => void; onConfirm: (amount: string) => void; }> = ({ request, type, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-100">{type === 'accept' ? 'Accept with Offer' : 'Send Counter Offer'}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Propose your fee for this collaboration with {request.brandName}.</p>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., 10000" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    <button onClick={() => onConfirm(amount)} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white">Send Offer</button>
                </div>
            </div>
        </div>
    );
};

const RejectModal: React.FC<{ onClose: () => void; onConfirm: (reason: string) => void; }> = ({ onClose, onConfirm }) => {
    const [reason, setReason] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-100">Reject Collaboration</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Please provide a reason for rejecting this offer (optional).</p>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    <button onClick={() => onConfirm(reason)} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white">Confirm Rejection</button>
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
     <li className="p-4 sm:p-6">
        <div className="flex items-start space-x-4">
            <button onClick={() => onViewProfile({ id: req.brandId, name: req.brandName, avatar: req.brandAvatar, role: 'brand', companyName: req.brandName })} className="rounded-full flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" aria-label={`View profile of ${req.brandName}`}>
                <img src={req.brandAvatar} alt={req.brandName} className="w-12 h-12 rounded-full object-cover" />
            </button>
            <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{req.title}</h3>
                        {req.collabId && <p className="text-xs font-mono text-gray-400">{req.collabId}</p>}
                    </div>
                    <RequestStatusBadge status={req.status} />
                </div>
                <p className="text-sm font-medium text-gray-600">From: {req.brandName}</p>
                <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{req.message}</p>
                {req.budget && <p className="text-sm font-semibold text-gray-500 mt-2">Initial Budget: {req.budget}</p>}
                {req.status === 'brand_offer' && <p className="text-sm font-semibold text-indigo-600 mt-2">Brand's Offer: {req.currentOffer?.amount}</p>}
                {renderStatusInfo(req)}
                {renderRequestActions(req)}
            </div>
        </div>
    </li>
);


const CollaborationRequestsPage: React.FC<CollaborationRequestsPageProps> = ({ user, platformSettings, onViewProfile, onStartChat, onInitiatePayout }) => {
    const [requests, setRequests] = useState<CollaborationRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<'offer' | 'reject' | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<CollaborationRequest | null>(null);
    const [filter, setFilter] = useState<'pending' | 'active' | 'archived'>('pending');

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = apiService.getCollabRequestsForInfluencerListener(
            user.id,
            (data) => {
                setRequests(data);
                setIsLoading(false);
                setError(null);
            },
            (err) => {
                console.error(err);
                setError("Failed to fetch collaboration requests.");
                setIsLoading(false);
            }
        );
        return () => unsubscribe();
    }, [user.id]);

    const handleUpdate = async (reqId: string, data: Partial<CollaborationRequest>) => {
        try {
            await apiService.updateCollaborationRequest(reqId, data, user.id);
        } catch (error) {
            console.error("Failed to update request:", error);
            // Optionally show an error message
        } finally {
            setModal(null);
            setSelectedRequest(null);
        }
    };
    
    const handleAction = (req: CollaborationRequest, action: 'message' | 'accept_with_offer' | 'reject_with_reason' | 'accept_offer' | 'recounter_offer' | 'reject_offer' | 'start_work' | 'complete_work' | 'get_payment') => {
        setSelectedRequest(req);
        switch(action) {
            case 'message':
                 onStartChat({ id: req.brandId, name: req.brandName, avatar: req.brandAvatar, role: 'brand', companyName: req.brandName });
                 break;
            case 'accept_with_offer':
            case 'recounter_offer':
                setModal('offer');
                break;
            case 'reject_with_reason':
            case 'reject_offer':
                setModal('reject');
                break;
            case 'accept_offer':
                 handleUpdate(req.id, { status: 'agreement_reached', finalAmount: req.currentOffer?.amount });
                 break;
            case 'start_work':
                handleUpdate(req.id, { workStatus: 'started' });
                break;
            case 'complete_work':
                handleUpdate(req.id, { status: 'work_submitted' });
                break;
            case 'get_payment':
                onInitiatePayout(req);
                break;
        }
    };

    const renderRequestActions = (req: CollaborationRequest) => {
        const actions: {label: string, action: Parameters<typeof handleAction>[1], style: string}[] = [];
        
        switch (req.status) {
            case 'pending':
                actions.push({ label: 'Message', action: 'message', style: 'bg-gray-200 text-gray-800' });
                actions.push({ label: 'Reject', action: 'reject_with_reason', style: 'bg-red-500 text-white' });
                actions.push({ label: 'Accept with Offer', action: 'accept_with_offer', style: 'bg-green-500 text-white' });
                break;
            case 'brand_offer':
                actions.push({ label: 'Message', action: 'message', style: 'bg-gray-200 text-gray-800' });
                actions.push({ label: 'Reject Offer', action: 'reject_offer', style: 'bg-red-500 text-white' });
                actions.push({ label: 'Send Counter-Offer', action: 'recounter_offer', style: 'bg-blue-500 text-white' });
                actions.push({ label: 'Accept Offer', action: 'accept_offer', style: 'bg-green-500 text-white' });
                break;
            case 'in_progress':
                 if (req.paymentStatus === 'paid' && !req.workStatus) {
                    actions.push({ label: 'Start Work', action: 'start_work', style: 'bg-indigo-600 text-white' });
                 }
                 if(req.workStatus === 'started') {
                    actions.push({ label: 'Complete Work', action: 'complete_work', style: 'bg-teal-500 text-white' });
                 }
                 break;
            case 'completed':
                 if (req.paymentStatus === 'paid') {
                    actions.push({ label: 'Get Payment', action: 'get_payment', style: 'bg-green-500 text-white' });
                 }
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
        let info: string | null = null;
        switch (req.status) {
            case 'influencer_offer': info = `You offered ${req.currentOffer?.amount}. Waiting for brand to respond.`; break;
            case 'agreement_reached': info = `Agreement reached for ${req.finalAmount}. Waiting for brand to complete payment.`; break;
            case 'in_progress': if(req.paymentStatus === 'paid') { info = "Brand's payment complete. Please start the work."; } break;
            case 'work_submitted': info = `Work submitted. Please wait 1-2 days for brand to confirm completion.`; break;
            case 'completed': 
                if (req.paymentStatus === 'payout_requested') info = "Payout requested. Under review by admin.";
                else if (req.paymentStatus === 'payout_complete') info = "Payment processed. Thank you!";
                else info = "Brand has confirmed completion. You can now request your payment.";
                break;
            case 'rejected': info = req.rejectionReason ? `Rejected. Reason: ${req.rejectionReason}` : 'Collaboration rejected.'; break;
            case 'refund_pending_admin_review': info = "The brand has requested a refund. An admin will review the case."; break;
        }
        
        if (!info) return null;

        return (
            <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-lg">
                <p>{info}</p>
            </div>
        );
    };
    
    const { active, pending, archived } = useMemo(() => {
        const active: CollaborationRequest[] = [];
        const pending: CollaborationRequest[] = [];
        const archived: CollaborationRequest[] = [];

        requests.forEach(req => {
            if (['in_progress', 'work_submitted', 'disputed', 'brand_decision_pending', 'refund_pending_admin_review'].includes(req.status)) {
                active.push(req);
            } else if (['completed', 'rejected'].includes(req.status)) {
                archived.push(req);
            } else { // Catches 'pending', 'brand_offer', 'influencer_offer', 'agreement_reached'
                pending.push(req);
            }
        });

        return { active, pending, archived };
    }, [requests]);
    
    const FilterButton: React.FC<{ label: string; filterType: typeof filter; count: number }> = ({ label, filterType, count }) => {
        const isActive = filter === filterType;
        return (
            <button
                onClick={() => setFilter(filterType)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    isActive ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
                {label}
                <span className={`px-2 py-0.5 text-xs rounded-full ${isActive ? 'bg-white text-indigo-600' : 'bg-gray-200 text-gray-700'}`}>
                    {count}
                </span>
            </button>
        );
    };

    const renderList = (list: CollaborationRequest[], title: string) => {
        if (list.length === 0) {
            return <div className="text-center py-10 bg-white rounded-lg shadow"><p className="text-gray-500">You have no {title.toLowerCase()}.</p></div>;
        }
        return (
            <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
                <ul className="divide-y divide-gray-200">
                    {list.map(req => <CollaborationItem key={req.id} req={req} onViewProfile={onViewProfile} renderStatusInfo={renderStatusInfo} renderRequestActions={renderRequestActions} />)}
                </ul>
            </div>
        );
    };


    if (isLoading) return <div className="text-center p-8">Loading requests...</div>;
    if (error) return <div className="text-center p-8 bg-red-100 text-red-700 rounded-lg">{error}</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Collaboration Requests</h1>
                <p className="text-gray-500 mt-1">Review and respond to partnership proposals from brands.</p>
            </div>

            <div className="flex space-x-2 p-1 bg-gray-50 rounded-lg border overflow-x-auto">
                <FilterButton label="Pending" filterType="pending" count={pending.length} />
                <FilterButton label="Active" filterType="active" count={active.length} />
                <FilterButton label="Archived and Complete" filterType="archived" count={archived.length} />
            </div>

            {requests.length === 0 ? (
                <div className="text-center py-10 col-span-full bg-white rounded-lg shadow"><p className="text-gray-500">You have no collaboration requests yet.</p></div>
            ) : (
                <div className="space-y-8">
                    {filter === 'pending' && renderList(pending, "pending requests")}
                    {filter === 'active' && renderList(active, "active collaborations")}
                    {filter === 'archived' && renderList(archived, "archived collaborations")}
                </div>
            )}
            {modal === 'offer' && selectedRequest && (
                <OfferModal request={selectedRequest} type={selectedRequest.status === 'pending' ? 'accept' : 'recounter'} onClose={() => setModal(null)} onConfirm={(amount) => handleUpdate(selectedRequest.id, { status: 'influencer_offer', currentOffer: { amount: `₹${amount}`, offeredBy: 'influencer' }})} />
            )}
             {modal === 'reject' && selectedRequest && (
                <RejectModal onClose={() => setModal(null)} onConfirm={(reason) => handleUpdate(selectedRequest.id, { status: 'rejected', rejectionReason: reason })} />
            )}
        </div>
    );
};

export default CollaborationRequestsPage;
