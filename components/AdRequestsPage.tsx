
import React, { useState, useEffect, useMemo } from 'react';
import { User, AdSlotRequest, AdBookingStatus, ConversationParticipant, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';

interface AdRequestsPageProps {
    user: User; // The Live TV user
    platformSettings: PlatformSettings;
    onStartChat: (participant: ConversationParticipant) => void;
    onInitiatePayout: (collab: AdSlotRequest) => void;
}

const RequestStatusBadge: React.FC<{ status: AdBookingStatus }> = ({ status }) => {
    const baseClasses = "px-3 py-1 text-xs font-medium rounded-full capitalize";
    const statusMap: Record<AdBookingStatus, { text: string; classes: string }> = {
        pending: { text: "Pending", classes: "text-yellow-800 bg-yellow-100" }, // From CollabRequestStatus
        influencer_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100" }, // From CollabRequestStatus
        pending_approval: { text: "Pending Approval", classes: "text-yellow-800 bg-yellow-100" },
        rejected: { text: "Rejected", classes: "text-red-800 bg-red-100" },
        agency_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100" },
        brand_offer: { text: "Offer Received", classes: "text-purple-800 bg-purple-100" },
        agreement_reached: { text: "Agreement Reached", classes: "text-green-800 bg-green-100" },
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

const OfferModal: React.FC<{ type: 'accept' | 'recounter'; currentOffer?: string; onClose: () => void; onConfirm: (amount: string) => void; }> = ({ type, currentOffer, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-100">{type === 'accept' ? 'Accept with Offer' : 'Send Counter Offer'}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {type === 'recounter' && currentOffer ? `Brand's offer is ${currentOffer}. ` : ''}
                  Propose your fee for this ad slot.
                </p>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., 50000" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    <button onClick={() => onConfirm(amount)} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white">Send Offer</button>
                </div>
            </div>
        </div>
    );
};

type FilterType = 'pending' | 'processing' | 'completed';

const AdRequestsPage: React.FC<AdRequestsPageProps> = ({ user, platformSettings, onStartChat, onInitiatePayout }) => {
    const [requests, setRequests] = useState<AdSlotRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<'offer' | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<AdSlotRequest | null>(null);
    const [filter, setFilter] = useState<FilterType>('pending');

    const fetchRequests = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiService.getAdSlotRequestsForLiveTv(user.id);
            setRequests(data);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch ad requests.");
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchRequests();
    }, [user.id]);

    const { pendingRequests, processingRequests, completedRequests } = useMemo(() => {
        const pending: AdSlotRequest[] = [];
        const processing: AdSlotRequest[] = [];
        const completed: AdSlotRequest[] = [];

        const pendingStatuses: AdBookingStatus[] = ['pending_approval', 'agency_offer', 'brand_offer', 'agreement_reached'];
        const processingStatuses: AdBookingStatus[] = ['in_progress', 'work_submitted', 'disputed', 'brand_decision_pending', 'refund_pending_admin_review'];
        const completedStatuses: AdBookingStatus[] = ['completed', 'rejected'];

        requests.forEach(req => {
            if (pendingStatuses.includes(req.status)) {
                pending.push(req);
            } else if (processingStatuses.includes(req.status)) {
                processing.push(req);
            } else if (completedStatuses.includes(req.status)) {
                completed.push(req);
            }
        });

        return { pendingRequests: pending, processingRequests: processing, completedRequests: completed };
    }, [requests]);

    const handleUpdate = async (reqId: string, data: Partial<AdSlotRequest>) => {
        setRequests(prev => prev.map(req => req.id === reqId ? { ...req, ...data } : req));
        await apiService.updateAdSlotRequest(reqId, data, user.id);
        setModal(null);
        setSelectedRequest(null);
    };

    const handleAction = (req: AdSlotRequest, action: 'message' | 'accept_with_offer' | 'reject' | 'accept_offer' | 'recounter_offer' | 'start_work' | 'complete_work' | 'get_payment' | 'cancel') => {
        setSelectedRequest(req);
        switch(action) {
            case 'message':
                onStartChat({ id: req.brandId, name: req.brandName, avatar: req.brandAvatar, role: 'brand' });
                break;
            case 'accept_with_offer':
            case 'recounter_offer':
                setModal('offer');
                break;
            case 'reject':
            case 'cancel':
                const reason = prompt("Reason for rejection/cancellation (optional):");
                handleUpdate(req.id, { status: 'rejected', rejectionReason: reason || "Not specified" });
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

    const renderRequestActions = (req: AdSlotRequest) => {
        const actions: {label: string, action: Parameters<typeof handleAction>[1], style: string, disabled?: boolean, title?: string}[] = [];
        const isEndDatePassed = new Date(req.endDate) < new Date();

        switch (req.status) {
            case 'pending_approval':
                actions.push({ label: 'Message', action: 'message', style: 'bg-gray-200 text-gray-800' });
                actions.push({ label: 'Reject', action: 'reject', style: 'bg-red-500 text-white' });
                actions.push({ label: 'Accept with Offer', action: 'accept_with_offer', style: 'bg-green-500 text-white' });
                break;
            case 'brand_offer':
                actions.push({ label: 'Message', action: 'message', style: 'bg-gray-200 text-gray-800' });
                actions.push({ label: 'Cancel Collab', action: 'cancel', style: 'bg-red-500 text-white' });
                actions.push({ label: 'Counter Offer', action: 'recounter_offer', style: 'bg-blue-500 text-white' });
                actions.push({ label: 'Accept Offer', action: 'accept_offer', style: 'bg-green-500 text-white' });
                break;
            case 'in_progress':
                if (req.paymentStatus === 'paid' && !req.workStatus) {
                    actions.push({ label: 'Start Work', action: 'start_work', style: 'bg-indigo-600 text-white' });
                }
                if (req.workStatus === 'started') {
                    actions.push({ 
                        label: 'Complete Work', 
                        action: 'complete_work', 
                        style: 'bg-teal-500 text-white', 
                        disabled: !isEndDatePassed,
                        title: isEndDatePassed ? 'Mark the ad campaign as complete' : `This button will be active on ${req.endDate}`
                    });
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
                    <button key={a.label} onClick={() => handleAction(req, a.action)} disabled={a.disabled} title={a.title} className={`px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-80 ${a.style} ${a.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {a.label}
                    </button>
                ))}
            </div>
        );
    };

    const FilterButton: React.FC<{ label: string; filterType: FilterType; count: number }> = ({ label, filterType, count }) => {
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

    const renderList = (list: AdSlotRequest[], title: string) => {
        if (list.length === 0) {
            return <div className="text-center py-10 bg-white rounded-lg shadow"><p className="text-gray-500">You have no {title.toLowerCase()}.</p></div>;
        }
        return (
            <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
                <ul className="divide-y divide-gray-200">
                    {list.map(req => (
                        <li key={req.id} className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-4">
                                <img src={req.brandAvatar} alt={req.brandName} className="w-12 h-12 rounded-full object-cover flex-shrink-0 mb-4 sm:mb-0" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-gray-800">{req.campaignName}</h3>
                                        <RequestStatusBadge status={req.status} />
                                    </div>
                                    <p className="text-sm font-medium text-gray-600">From: {req.brandName}</p>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                        <div><span className="font-semibold text-gray-500">Ad Type:</span> {req.adType}</div>
                                        <div><span className="font-semibold text-gray-500">Dates:</span> {req.startDate} to {req.endDate}</div>
                                        {req.status === 'brand_offer' && <div className="col-span-full text-indigo-600"><span className="font-semibold">Brand's Offer:</span> {req.currentOffer?.amount}</div>}
                                    </div>
                                    {renderRequestActions(req)}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    if (isLoading) return <div className="text-center p-8">Loading ad requests...</div>;
    if (error) return <div className="text-center p-8 bg-red-100 text-red-700 rounded-lg">{error}</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Collaboration Status</h1>
                <p className="text-gray-500 mt-1">Review and manage incoming advertising proposals from brands.</p>
            </div>

            <div className="flex space-x-2 p-1 bg-gray-50 rounded-lg border overflow-x-auto">
                <FilterButton label="Pending Requests" filterType="pending" count={pendingRequests.length} />
                <FilterButton label="Processing & Running Ads" filterType="processing" count={processingRequests.length} />
                <FilterButton label="Completed Ads" filterType="completed" count={completedRequests.length} />
            </div>

            {requests.length === 0 ? (
                <div className="text-center py-10 col-span-full bg-white rounded-lg shadow">
                    <p className="text-gray-500">You have no ad slot requests yet.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {filter === 'pending' && renderList(pendingRequests, "pending requests")}
                    {filter === 'processing' && renderList(processingRequests, "processing & running ads")}
                    {filter === 'completed' && renderList(completedRequests, "completed ads")}
                </div>
            )}
            
             {modal === 'offer' && selectedRequest && (
                <OfferModal type={selectedRequest.status === 'pending_approval' ? 'accept' : 'recounter'} currentOffer={selectedRequest.currentOffer?.amount} onClose={() => setModal(null)} onConfirm={(amount) => handleUpdate(selectedRequest.id, { status: 'agency_offer', currentOffer: { amount: `₹${amount}`, offeredBy: 'agency' }})} />
            )}
        </div>
    );
};

export default AdRequestsPage;
