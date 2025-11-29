






import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, BannerAdBookingRequest, AdBookingStatus, ConversationParticipant, PlatformSettings, BannerAd, AdSlotRequest, EmiItem } from '../types';
import { apiService } from '../services/apiService';
import PostBannerAdModal from './PostBannerAdModal';
import { Timestamp } from 'firebase/firestore';
import CashfreeModal from './PhonePeModal';
import DisputeModal from './DisputeModal';
import { TrashIcon, MessagesIcon, EyeIcon, SparklesIcon, BanknotesIcon } from './Icons';
import CollabDetailsModal from './CollabDetailsModal';
import CancellationPenaltyModal from './CancellationPenaltyModal';
import { calculateAdPricing, generateEmiSchedule } from '../services/utils';

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

// Updated Offer Modal for Brand (Counter Offer) - also uses Daily Rate
const OfferModal: React.FC<{ 
    type: 'accept' | 'recounter'; 
    req: AdRequest;
    platformSettings: PlatformSettings;
    providerName?: string; 
    onClose: () => void; 
    onConfirm: (dailyRate: number, totalAmount: string) => void; 
}> = ({ type, req, platformSettings, providerName, onClose, onConfirm }) => {
    const [dailyRate, setDailyRate] = useState('');
    const [calculations, setCalculations] = useState<any>(null);
    const name = providerName || 'Agency';

    useEffect(() => {
        if (dailyRate && !isNaN(Number(dailyRate))) {
            const pricingType = req.type === 'Live TV' ? 'ad_slot' : 'banner_booking';
            const pricing = calculateAdPricing(Number(dailyRate), req.startDate, req.endDate, platformSettings, pricingType);
            setCalculations(pricing);
        } else {
            setCalculations(null);
        }
    }, [dailyRate, req.startDate, req.endDate, platformSettings, req]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-100">{type === 'accept' ? 'Accept with Offer' : 'Send Counter Offer'}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  {type === 'recounter' && req.currentOffer?.dailyRate ? `${name}'s offer is ₹${req.currentOffer.dailyRate}/day.` : ''}
                </p>
                
                <div className="mb-4">
                    <label className="block text-xs font-bold text-red-600 mb-1">ENTER 24-HOUR RATE ONLY</label>
                    <input 
                        type="number" 
                        value={dailyRate} 
                        onChange={e => setDailyRate(e.target.value)} 
                        placeholder="e.g., 2000" 
                        className="w-full p-2 border-2 border-red-100 rounded-md focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 outline-none"
                    />
                    <p className="text-xs text-red-500 mt-1">* Do not enter total amount.</p>
                </div>

                {calculations && (
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md mb-4 text-sm space-y-1">
                        <div className="flex justify-between">
                            <span>Duration:</span>
                            <span className="font-bold">{calculations.durationDays} Days</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-300 pt-1 mt-1 font-bold text-indigo-600">
                            <span>Total Offer:</span>
                            <span>₹{calculations.finalAmount.toLocaleString()}</span>
                        </div>
                    </div>
                )}

                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    <button 
                        onClick={() => {
                            if(calculations) onConfirm(Number(dailyRate), `₹${calculations.finalAmount.toFixed(2)}`);
                        }} 
                        disabled={!calculations}
                        className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50"
                    >
                        Send Offer
                    </button>
                </div>
            </div>
        </div>
    );
};

// New Payment Selection Modal
const PaymentSelectionModal: React.FC<{
    req: AdRequest;
    user: User;
    platformSettings: PlatformSettings;
    onClose: () => void;
    onSelectOption: (option: 'full' | 'emi' | 'subscription') => void;
    isProcessing: boolean;
}> = ({ req, user, platformSettings, onClose, onSelectOption, isProcessing }) => {
    const dailyRate = req.dailyRate || req.currentOffer?.dailyRate || 0;
    const pricingType = req.type === 'Live TV' ? 'ad_slot' : 'banner_booking';
    const pricing = calculateAdPricing(dailyRate, req.startDate, req.endDate, platformSettings, pricingType);
    const emiSchedule = generateEmiSchedule(pricing.finalAmount, req.startDate, req.endDate);
    const monthlyAmount = emiSchedule.length > 0 ? emiSchedule[0].amount : pricing.finalAmount;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]">
                <h3 className="text-xl font-bold mb-4 dark:text-white">Choose Payment Option</h3>
                
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg mb-6 border border-indigo-100 dark:border-indigo-800">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-600 dark:text-gray-300 font-medium">Total Payable Amount</span>
                        <span className="text-xl font-extrabold text-indigo-700 dark:text-indigo-400">₹{pricing.finalAmount.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-500 text-right">Includes GST & Fees</p>
                </div>

                <div className="space-y-4">
                    {/* Option 1: Full Payment */}
                    <button 
                        onClick={() => onSelectOption('full')}
                        disabled={isProcessing}
                        className="w-full text-left p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group disabled:opacity-50"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="block font-bold text-gray-800 dark:text-white group-hover:text-indigo-600">One-Time Payment</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">Pay full amount now</span>
                            </div>
                            <div className="h-6 w-6 rounded-full border-2 border-gray-300 group-hover:border-indigo-500"></div>
                        </div>
                    </button>

                    {/* Option 2: Subscription (New) */}
                    <button 
                        onClick={() => onSelectOption('subscription')}
                        disabled={isProcessing}
                        className="w-full text-left p-4 border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl hover:border-indigo-500 transition-all group disabled:opacity-50 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">RECOMMENDED</div>
                        <div className="flex justify-between items-center mb-1">
                            <div>
                                <span className="block font-bold text-indigo-800 dark:text-indigo-300 group-hover:text-indigo-600">Subscribe (Auto-Pay)</span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">Recurring monthly payments</span>
                            </div>
                            <div className="h-6 w-6 rounded-full border-2 border-indigo-300 group-hover:border-indigo-500"></div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Set up auto-debit of <strong>₹{monthlyAmount.toLocaleString()}</strong> every month for {emiSchedule.length} months. No manual payments needed.
                        </p>
                    </button>

                    {/* Option 3: Manual EMI */}
                    <button 
                        onClick={() => onSelectOption('emi')}
                        disabled={isProcessing}
                        className="w-full text-left p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group disabled:opacity-50"
                    >
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <span className="block font-bold text-gray-800 dark:text-white group-hover:text-indigo-600">Manual EMI</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">Pay manually each month</span>
                            </div>
                            <div className="h-6 w-6 rounded-full border-2 border-gray-300 group-hover:border-indigo-500"></div>
                        </div>
                        
                        {/* EMI Preview */}
                        <div className="bg-gray-100 dark:bg-gray-900/50 p-3 rounded-lg space-y-2 text-xs">
                            {emiSchedule.map((emi, idx) => (
                                <div key={idx} className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-400 font-medium">
                                        {idx === 0 ? '1st EMI (Pay Now)' : `${idx + 1}${idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} EMI`}
                                    </span>
                                    <div className="text-right">
                                        <span className="block font-bold text-gray-800 dark:text-white">₹{emi.amount.toLocaleString()}</span>
                                        <span className="text-[10px] text-gray-500">{new Date(emi.dueDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </button>
                </div>

                <div className="mt-6 text-right">
                    <button onClick={onClose} disabled={isProcessing} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-sm">Cancel</button>
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
    const [isCreatingSub, setIsCreatingSub] = useState(false);
    
    // Modal states
    const [payingRequest, setPayingRequest] = useState<AdRequest | null>(null);
    const [emiPaymentItem, setEmiPaymentItem] = useState<EmiItem | null>(null); // Specific EMI being paid
    const [disputingRequest, setDisputingRequest] = useState<AdRequest | null>(null);
    const [modal, setModal] = useState<'offer' | 'dispute' | 'details' | 'payment_select' | null>(null);
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

    const handleAction = (req: AdRequest, action: 'message' | 'accept_offer' | 'recounter_offer' | 'reject_offer' | 'pay_now' | 'work_complete' | 'work_incomplete' | 'brand_complete_disputed' | 'brand_request_refund' | 'view_details' | 'pay_emi') => {
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
                handleUpdate(req, { status: 'agreement_reached', finalAmount: req.currentOffer?.amount, dailyRate: req.currentOffer?.dailyRate });
                break;
            case 'reject_offer':
                handleUpdate(req, { status: 'rejected', rejectionReason: 'Offer rejected by brand.' });
                break;
            case 'pay_now':
                // Open Payment Selection Modal
                setModal('payment_select');
                break;
            case 'pay_emi':
                // Logic to find the next pending EMI
                const nextEmi = req.emiSchedule?.find(e => e.status === 'pending' || e.status === 'overdue');
                if (nextEmi) {
                    setPayingRequest(req);
                    setEmiPaymentItem(nextEmi);
                } else {
                    alert("No pending EMIs found.");
                }
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

    const handlePaymentSelect = async (option: 'full' | 'emi' | 'subscription') => {
        if (!selectedRequest) return;
        
        const dailyRate = selectedRequest.dailyRate || selectedRequest.currentOffer?.dailyRate || 0;
        const pricingType = selectedRequest.type === 'Live TV' ? 'ad_slot' : 'banner_booking';
        const pricing = calculateAdPricing(dailyRate, selectedRequest.startDate, selectedRequest.endDate, platformSettings, pricingType);

        if (option === 'full') {
            setPayingRequest(selectedRequest);
            setEmiPaymentItem(null); 
            setModal(null);
        } else if (option === 'emi') {
            const schedule = generateEmiSchedule(pricing.finalAmount, selectedRequest.startDate, selectedRequest.endDate);
            await handleUpdate(selectedRequest, {
                paymentPlan: 'emi',
                emiSchedule: schedule,
                finalAmount: `₹${pricing.finalAmount.toFixed(2)}`
            });
            const firstEmi = schedule[0];
            setPayingRequest({...selectedRequest, paymentPlan: 'emi', emiSchedule: schedule, finalAmount: `₹${pricing.finalAmount.toFixed(2)}`});
            setEmiPaymentItem(firstEmi);
            setModal(null);
        } else if (option === 'subscription') {
            // Subscription Logic
            setIsCreatingSub(true);
            try {
                // Generate a schedule just to calculate monthly amount, backend handles recurrence
                const schedule = generateEmiSchedule(pricing.finalAmount, selectedRequest.startDate, selectedRequest.endDate);
                const monthlyAmount = schedule[0]?.amount || pricing.finalAmount;

                // Call Backend to Create Subscription
                const result = await apiService.createSubscription({
                    userId: user.id,
                    amount: monthlyAmount,
                    collabId: selectedRequest.id,
                    description: `Subscription for ${selectedRequest.campaignName}`,
                    phone: user.mobileNumber || '',
                    email: user.email,
                    returnUrl: window.location.href, // Redirect back here
                    isAdSlot: selectedRequest.type === 'Live TV'
                });

                if (result.authLink) {
                    // Update local state to mark as subscription planned
                    await handleUpdate(selectedRequest, {
                        paymentPlan: 'subscription',
                        subscriptionId: result.subscriptionId,
                        subscriptionLink: result.authLink,
                        finalAmount: `₹${pricing.finalAmount.toFixed(2)}`
                    });
                    
                    // Redirect to Cashfree Auth Link
                    window.location.href = result.authLink;
                } else {
                    throw new Error("No authorization link returned");
                }
            } catch (err: any) {
                console.error("Subscription setup failed:", err);
                alert(`Failed to set up subscription: ${err.message}`);
                setIsCreatingSub(false);
            }
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
                actions.push({ label: `Pay Now`, action: 'pay_now', style: 'text-green-600 hover:bg-green-50 font-bold', icon: <BanknotesIcon className="w-4 h-4" /> });
                break;
            case 'in_progress':
                // Check for pending EMIs
                if (req.paymentPlan === 'emi') {
                    const pendingEmi = req.emiSchedule?.find(e => e.status === 'pending' || e.status === 'overdue');
                    if (pendingEmi) {
                        actions.push({ 
                            label: `Pay EMI (₹${pendingEmi.amount.toLocaleString()})`, 
                            action: 'pay_emi', 
                            style: 'text-orange-600 bg-orange-100 hover:bg-orange-200 font-bold border-orange-200' 
                        });
                    }
                }
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

    // Helper function to display amounts clearly
    const getAmountDisplay = (req: AdRequest) => {
        if (req.finalAmount) {
            return (
                <div className="flex flex-col">
                    <span className="text-green-600 font-bold dark:text-green-400">{req.finalAmount}</span>
                    {req.dailyRate && <span className="text-xs text-gray-500">(@ ₹{req.dailyRate}/day)</span>}
                    {req.paymentPlan === 'emi' && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded inline-block mt-1 w-fit">EMI Plan</span>
                    )}
                    {req.paymentPlan === 'subscription' && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded inline-block mt-1 w-fit">Auto-Pay</span>
                    )}
                </div>
            );
        }
        if (req.currentOffer) {
            return (
                <div className="flex flex-col">
                    <span className="text-blue-600 font-bold dark:text-blue-400">{req.currentOffer.amount}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {req.currentOffer.offeredBy === 'agency' ? 'Agency Offer' : 'My Offer'}
                    </span>
                    {req.currentOffer.dailyRate && <span className="text-xs text-gray-400">Rate: ₹{req.currentOffer.dailyRate}/day</span>}
                </div>
            );
        }
        return <span className="text-gray-500 dark:text-gray-400">Negotiating...</span>;
    };

    const renderTable = (list: AdRequest[]) => (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Provider / Campaign</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Collab ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
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

            {/* Modals */}
            {modal === 'details' && selectedRequest && (
                <CollabDetailsModal collab={selectedRequest} onClose={() => { setModal(null); setSelectedRequest(null); }} />
            )}
            
            {modal === 'offer' && selectedRequest && (
                <OfferModal 
                    type={selectedRequest.status === 'agency_offer' ? 'accept' : 'recounter'} 
                    req={selectedRequest}
                    platformSettings={platformSettings}
                    providerName={selectedRequest.type === 'Live TV' ? (selectedRequest as AdSlotRequest).liveTvName : (selectedRequest as BannerAdBookingRequest).agencyName}
                    onClose={() => setModal(null)} 
                    onConfirm={(dailyRate, totalAmount) => handleUpdate(selectedRequest, { status: 'brand_offer', currentOffer: { amount: totalAmount, dailyRate: dailyRate, offeredBy: 'brand' }, dailyRate: dailyRate })} 
                />
            )}

            {modal === 'payment_select' && selectedRequest && (
                <PaymentSelectionModal
                    req={selectedRequest}
                    user={user}
                    platformSettings={platformSettings}
                    onClose={() => setModal(null)}
                    onSelectOption={handlePaymentSelect}
                    isProcessing={isCreatingSub}
                />
            )}

             {payingRequest && (
                <CashfreeModal
                    user={user}
                    collabType={payingRequest.type === 'Live TV' ? 'ad_slot' : 'banner_booking'}
                    baseAmount={emiPaymentItem ? emiPaymentItem.amount : parseFloat(payingRequest.finalAmount?.replace(/[^0-9.-]+/g, "") || "0")}
                    platformSettings={platformSettings}
                    onClose={() => {
                        setPayingRequest(null);
                        setEmiPaymentItem(null);
                        fetchRequests();
                    }}
                    transactionDetails={{
                        userId: user.id,
                        description: emiPaymentItem ? `${payingRequest.campaignName} - ${emiPaymentItem.description}` : `Full Payment: ${payingRequest.campaignName}`,
                        relatedId: payingRequest.id,
                        collabId: payingRequest.collabId,
                        // Pass specific EMI ID if applicable to update status
                        additionalMeta: emiPaymentItem ? { emiId: emiPaymentItem.id } : undefined
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
                        <p className="text-gray-600 dark:text-gray-300 my-4">Are you sure you want to approve this work? This will mark the collaboration as complete.</p>
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