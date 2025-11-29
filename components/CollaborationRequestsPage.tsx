
import React, { useState, useEffect, useMemo } from 'react';
import { User, CollaborationRequest, CollabRequestStatus, ProfileData, ConversationParticipant, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { TrashIcon, MessagesIcon, EyeIcon } from './Icons';
import CollabDetailsModal from './CollabDetailsModal';
import CancellationPenaltyModal from './CancellationPenaltyModal';

interface CollaborationRequestsPageProps {
    user: User; // The logged-in influencer
    platformSettings: PlatformSettings;
    onViewProfile: (profile: ProfileData) => void;
    onStartChat: (participant: ConversationParticipant) => void;
    onInitiatePayout: (collab: CollaborationRequest) => void;
    refreshUser?: () => void;
}

const RequestStatusBadge: React.FC<{ status: CollabRequestStatus }> = ({ status }) => {
    const baseClasses = "px-3 py-1 text-xs font-medium rounded-full capitalize whitespace-nowrap";
    const statusMap: Record<CollabRequestStatus, { text: string; classes: string }> = {
        pending: { text: "Pending", classes: "text-yellow-800 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300" },
        rejected: { text: "Rejected", classes: "text-red-800 bg-red-100 dark:bg-red-900/50 dark:text-red-300" },
        influencer_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300" },
        brand_offer: { text: "Offer Received", classes: "text-purple-800 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300" },
        agreement_reached: { text: "Agreement Reached", classes: "text-green-800 bg-green-100 dark:bg-green-900/50 dark:text-green-300" },
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

// ... (OfferModal and RejectModal components remain unchanged)
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

const CollaborationRequestsPage: React.FC<CollaborationRequestsPageProps> = ({ user, platformSettings, onViewProfile, onStartChat, onInitiatePayout, refreshUser }) => {
    const [requests, setRequests] = useState<CollaborationRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<'offer' | 'reject' | 'details' | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<CollaborationRequest | null>(null);
    const [filter, setFilter] = useState<'pending' | 'active' | 'archived'>('pending');
    
    // Cancellation State
    const [cancellingReq, setCancellingReq] = useState<CollaborationRequest | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);

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
        } finally {
            setModal(null);
            setSelectedRequest(null);
        }
    };

    const handleDelete = async (reqId: string) => {
        if(window.confirm("Are you sure you want to delete this history?")) {
            try {
                await apiService.deleteCollaboration(reqId, 'collaboration_requests');
            } catch (err) {
                console.error("Delete failed", err);
            }
        }
    };
    
    const handleConfirmCancellation = async (reason: string) => {
        if (!cancellingReq) return;
        setIsCancelling(true);
        const penalty = platformSettings.cancellationPenaltyAmount || 0;
        
        try {
            await apiService.cancelCollaboration(
                user.id, 
                cancellingReq.id, 
                'collaboration_requests', 
                reason, 
                penalty
            );
            setCancellingReq(null);
            if (refreshUser) refreshUser(); // Update penalty balance immediately
        } catch (err) {
            console.error(err);
            alert("Failed to cancel collaboration. Please try again.");
        } finally {
            setIsCancelling(false);
        }
    };
    
    const handleAction = (req: CollaborationRequest, action: 'message' | 'accept_with_offer' | 'reject_with_reason' | 'accept_offer' | 'recounter_offer' | 'reject_offer' | 'start_work' | 'complete_work' | 'get_payment' | 'view_details' | 'cancel') => {
        setSelectedRequest(req);
        switch(action) {
            case 'view_details':
                setModal('details');
                break;
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
            case 'cancel':
                setCancellingReq(req);
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
        const actions: {label: string, action: Parameters<typeof handleAction>[1], style: string, icon?: any}[] = [];
        
        actions.push({ label: 'Details', action: 'view_details', style: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700', icon: <EyeIcon className="w-4 h-4" /> });
        actions.push({ label: 'Message', action: 'message', style: 'text-indigo-600 hover:bg-indigo-50', icon: <MessagesIcon className="w-4 h-4" /> });

        switch (req.status) {
            case 'pending':
                actions.push({ label: 'Reject', action: 'reject_with_reason', style: 'text-red-600 hover:bg-red-50' });
                actions.push({ label: 'Accept & Offer', action: 'accept_with_offer', style: 'text-green-600 hover:bg-green-50' });
                break;
            case 'brand_offer':
                actions.push({ label: 'Reject', action: 'reject_offer', style: 'text-red-600 hover:bg-red-50' });
                actions.push({ label: 'Counter', action: 'recounter_offer', style: 'text-blue-600 hover:bg-blue-50' });
                actions.push({ label: 'Accept', action: 'accept_offer', style: 'text-green-600 hover:bg-green-50' });
                break;
            case 'agreement_reached':
            case 'in_progress':
                 actions.push({ label: 'Cancel Booking', action: 'cancel', style: 'text-red-600 hover:bg-red-50 font-bold border-red-200' });
                 if (req.paymentStatus === 'paid' && !req.workStatus) {
                    actions.push({ label: 'Start Work', action: 'start_work', style: 'text-indigo-600 hover:bg-indigo-50 font-bold' });
                 }
                 if(req.workStatus === 'started') {
                    actions.push({ label: 'Complete', action: 'complete_work', style: 'text-teal-600 hover:bg-teal-50 font-bold' });
                 }
                 break;
            case 'completed':
                 if (req.paymentStatus === 'paid') {
                    actions.push({ label: 'Get Payment', action: 'get_payment', style: 'text-green-600 hover:bg-green-50 font-bold' });
                 } else if (req.paymentStatus === 'payout_requested') {
                    return <span className="px-3 py-1 text-xs font-bold rounded border border-yellow-200 bg-yellow-50 text-yellow-800">Payout Pending</span>;
                 } else if (req.paymentStatus === 'payout_complete') {
                    return <span className="px-3 py-1 text-xs font-bold rounded border border-green-200 bg-green-50 text-green-800">Paid Out</span>;
                 }
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
    
    // Helper function to display amounts clearly
    const getAmountDisplay = (req: CollaborationRequest) => {
        if (req.finalAmount) {
            return <span className="text-green-600 font-bold dark:text-green-400">{req.finalAmount}</span>;
        }
        if (req.currentOffer) {
            return (
                <div className="flex flex-col">
                    <span className="text-blue-600 font-bold dark:text-blue-400">{req.currentOffer.amount}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {req.currentOffer.offeredBy === 'influencer' ? 'My Offer' : 'Brand Offer'}
                    </span>
                </div>
            );
        }
        return <span className="text-gray-500 dark:text-gray-400">{req.budget || 'N/A'}</span>;
    };

    const { active, pending, archived } = useMemo(() => {
        const active: CollaborationRequest[] = [];
        const pending: CollaborationRequest[] = [];
        const archived: CollaborationRequest[] = [];

        requests.forEach(req => {
            if (['in_progress', 'work_submitted', 'disputed', 'brand_decision_pending', 'refund_pending_admin_review', 'agreement_reached'].includes(req.status)) {
                active.push(req);
            } else if (['completed', 'rejected'].includes(req.status)) {
                archived.push(req);
            } else { 
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
                    isActive ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
            >
                {label}
                <span className={`px-2 py-0.5 text-xs rounded-full ${isActive ? 'bg-white text-indigo-600' : 'bg-gray-200 text-gray-700'}`}>
                    {count}
                </span>
            </button>
        );
    };

    const renderTable = (data: CollaborationRequest[]) => (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Brand / Request</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Collab ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                        <img className="h-10 w-10 rounded-full object-cover" src={req.brandAvatar} alt="" />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{req.brandName}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{req.title}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                {req.collabId || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {getAmountDisplay(req)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <RequestStatusBadge status={req.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-2">
                                    {renderRequestActions(req)}
                                    {['completed', 'rejected'].includes(req.status) && (
                                        <button 
                                            onClick={() => handleDelete(req.id)}
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

    if (isLoading) return <div className="text-center p-8">Loading requests...</div>;
    if (error) return <div className="text-center p-8 bg-red-100 text-red-700 rounded-lg">{error}</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Collaboration Requests</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Review and respond to partnership proposals from brands.</p>
            </div>

            <div className="flex space-x-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-x-auto">
                <FilterButton label="Pending" filterType="pending" count={pending.length} />
                <FilterButton label="Active" filterType="active" count={active.length} />
                <FilterButton label="Archived and Complete" filterType="archived" count={archived.length} />
            </div>

            {requests.length === 0 ? (
                <div className="text-center py-10 col-span-full bg-white dark:bg-gray-800 rounded-lg shadow"><p className="text-gray-500 dark:text-gray-400">You have no collaboration requests yet.</p></div>
            ) : (
                <>
                    {filter === 'pending' && renderTable(pending)}
                    {filter === 'active' && renderTable(active)}
                    {filter === 'archived' && renderTable(archived)}
                </>
            )}
            
            {modal === 'details' && selectedRequest && (
                <CollabDetailsModal collab={selectedRequest} onClose={() => { setModal(null); setSelectedRequest(null); }} />
            )}
            {modal === 'offer' && selectedRequest && (
                <OfferModal request={selectedRequest} type={selectedRequest.status === 'pending' ? 'accept' : 'recounter'} onClose={() => setModal(null)} onConfirm={(amount) => handleUpdate(selectedRequest.id, { status: 'influencer_offer', currentOffer: { amount: `₹${amount}`, offeredBy: 'influencer' }})} />
            )}
             {modal === 'reject' && selectedRequest && (
                <RejectModal onClose={() => setModal(null)} onConfirm={(reason) => handleUpdate(selectedRequest.id, { status: 'rejected', rejectionReason: reason })} />
            )}
            
            <CancellationPenaltyModal 
                isOpen={!!cancellingReq}
                onClose={() => setCancellingReq(null)}
                onConfirm={handleConfirmCancellation}
                penaltyAmount={platformSettings.cancellationPenaltyAmount || 0}
                isProcessing={isCancelling}
            />
        </div>
    );
};

export default CollaborationRequestsPage;
