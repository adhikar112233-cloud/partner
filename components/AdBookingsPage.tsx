
import React, { useState, useEffect, useMemo } from 'react';
import { User, BannerAdBookingRequest, AdBookingStatus, ConversationParticipant, PlatformSettings, BannerAd } from '../types';
import { apiService } from '../services/apiService';
import PostBannerAdModal from './PostBannerAdModal';
import { SparklesIcon, TrashIcon, MessagesIcon, EyeIcon } from './Icons';
import CashfreeModal from './PhonePeModal';
import CollabDetailsModal from './CollabDetailsModal';

interface AdBookingsPageProps {
    user: User; // The Banner Agency user
    platformSettings: PlatformSettings;
    onStartChat: (participant: ConversationParticipant) => void;
    onInitiatePayout: (collab: BannerAdBookingRequest) => void;
}

const RequestStatusBadge: React.FC<{ status: AdBookingStatus }> = ({ status }) => {
    const baseClasses = "px-3 py-1 text-xs font-medium rounded-full capitalize whitespace-nowrap";
    const statusMap: Record<AdBookingStatus, { text: string; classes: string }> = {
        pending: { text: "Pending", classes: "text-yellow-800 bg-yellow-100" },
        influencer_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100" },
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

const FilterButton: React.FC<{ label: string; filterType: 'pending' | 'processing' | 'completed'; count: number; activeFilter: string; onClick: (f: any) => void }> = ({ label, filterType, count, activeFilter, onClick }) => {
    const isActive = activeFilter === filterType;
    return (
        <button
            onClick={() => onClick(filterType)}
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

const AdBookingsPage: React.FC<AdBookingsPageProps> = ({ user, platformSettings, onStartChat, onInitiatePayout }) => {
    const [activeTab, setActiveTab] = useState<'requests' | 'my_ads'>('requests');
    const [requests, setRequests] = useState<BannerAdBookingRequest[]>([]);
    const [myAds, setMyAds] = useState<BannerAd[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<'offer' | 'post_ad' | 'details' | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<BannerAdBookingRequest | null>(null);
    const [filter, setFilter] = useState<'pending' | 'processing' | 'completed'>('pending');
    const [boostingAd, setBoostingAd] = useState<BannerAd | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [reqs, ads] = await Promise.all([
                apiService.getBannerAdBookingRequestsForAgency(user.id),
                apiService.getBannerAdsForAgency(user.id)
            ]);
            setRequests(reqs);
            setMyAds(ads);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch data.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user.id]);

    const { pendingRequests, processingRequests, completedRequests } = useMemo(() => {
        const pending: BannerAdBookingRequest[] = [];
        const processing: BannerAdBookingRequest[] = [];
        const completed: BannerAdBookingRequest[] = [];

        const pendingStatuses: AdBookingStatus[] = ['pending_approval', 'agency_offer', 'brand_offer'];
        const processingStatuses: AdBookingStatus[] = ['in_progress', 'work_submitted', 'disputed', 'brand_decision_pending', 'refund_pending_admin_review', 'agreement_reached'];
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

    const handleUpdate = async (reqId: string, data: Partial<BannerAdBookingRequest>) => {
        setRequests(prev => prev.map(req => req.id === reqId ? { ...req, ...data } : req));
        await apiService.updateBannerAdBookingRequest(reqId, data, user.id);
        setModal(null);
        setSelectedRequest(null);
    };

    const handleAction = (req: BannerAdBookingRequest, action: 'message' | 'accept_with_offer' | 'reject' | 'accept_offer' | 'recounter_offer' | 'start_work' | 'complete_work' | 'get_payment' | 'cancel' | 'cancel_active' | 'view_details') => {
        setSelectedRequest(req);
        switch(action) {
            case 'view_details':
                setModal('details');
                break;
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
            case 'cancel_active':
                const penalty = platformSettings.cancellationPenaltyAmount || 0;
                if (window.confirm(`⚠️ Warning: Cancelling this collaboration will incur a penalty of ₹${penalty}, which will be deducted from your next payout.\n\nAre you sure you want to proceed with cancellation?`)) {
                    setIsLoading(true);
                    apiService.cancelCollaboration(user.id, req.id, 'banner_ad_booking_requests', 'Cancelled by Banner Agency.', penalty)
                        .then(() => {
                            fetchData(); 
                        })
                        .catch((err) => {
                            console.error(err);
                            alert("Failed to cancel collaboration. Please try again.");
                        })
                        .finally(() => setIsLoading(false));
                }
                break;
        }
    };

    // Calculate Boost Price for Ads
    const adBoostPrice = useMemo(() => {
        const originalPrice = platformSettings.boostPrices.banner;
        const discountSetting = platformSettings.discountSettings?.brandBannerBoost; // Assuming same setting used for agency ad boost
        if (discountSetting?.isEnabled && discountSetting.percentage > 0) {
            return Math.floor(originalPrice * (1 - discountSetting.percentage / 100));
        }
        return originalPrice;
    }, [platformSettings]);

    const renderRequestActions = (req: BannerAdBookingRequest) => {
        const actions: {label: string, action: Parameters<typeof handleAction>[1], style: string, disabled?: boolean, title?: string, icon?: any}[] = [];
        const isEndDatePassed = new Date(req.endDate) < new Date();

        actions.push({ label: 'Details', action: 'view_details', style: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700', icon: <EyeIcon className="w-4 h-4" /> });
        actions.push({ label: 'Message', action: 'message', style: 'text-indigo-600 hover:bg-indigo-50', icon: <MessagesIcon className="w-4 h-4" /> });

        switch (req.status) {
            case 'pending_approval':
                actions.push({ label: 'Reject', action: 'reject', style: 'text-red-600 hover:bg-red-50' });
                actions.push({ label: 'Accept & Offer', action: 'accept_with_offer', style: 'text-green-600 hover:bg-green-50' });
                break;
            case 'brand_offer':
                actions.push({ label: 'Cancel', action: 'cancel', style: 'text-red-600 hover:bg-red-50' });
                actions.push({ label: 'Counter', action: 'recounter_offer', style: 'text-blue-600 hover:bg-blue-50' });
                actions.push({ label: 'Accept', action: 'accept_offer', style: 'text-green-600 hover:bg-green-50' });
                break;
            case 'agreement_reached':
                 actions.push({ label: 'Cancel', action: 'cancel_active', style: 'text-red-600 hover:bg-red-50' });
                 break;
            case 'in_progress':
                actions.push({ label: 'Cancel', action: 'cancel_active', style: 'text-red-600 hover:bg-red-50' });
                if (req.paymentStatus === 'paid' && !req.workStatus) {
                    actions.push({ label: 'Start Work', action: 'start_work', style: 'text-indigo-600 hover:bg-indigo-50 font-bold' });
                }
                if (req.workStatus === 'started') {
                    actions.push({ 
                        label: 'Complete', 
                        action: 'complete_work', 
                        style: 'text-teal-600 hover:bg-teal-50 font-bold', 
                        disabled: !isEndDatePassed,
                        title: isEndDatePassed ? 'Mark as complete' : `Active until ${req.endDate}`
                    });
                }
                break;
            case 'completed':
                 if (req.paymentStatus === 'paid') {
                    actions.push({ label: 'Get Payment', action: 'get_payment', style: 'text-green-600 hover:bg-green-50 font-bold' });
                 }
                 break;
        }

        if (actions.length === 0) return null;

        return (
            <div className="flex flex-wrap gap-2">
                {actions.map(a => (
                    <button key={a.label} onClick={() => handleAction(req, a.action)} disabled={a.disabled} title={a.title} className={`px-3 py-1 text-xs font-semibold rounded border border-gray-200 dark:border-gray-600 flex items-center gap-1 ${a.style} ${a.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {a.icon} {a.label}
                    </button>
                ))}
            </div>
        );
    };

    const renderRequestsList = (list: BannerAdBookingRequest[], title: string) => {
        if (list.length === 0) {
            return <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow"><p className="text-gray-500 dark:text-gray-400">No {title.toLowerCase()} found.</p></div>;
        }
        return (
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {list.map(req => (
                        <li key={req.id} className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-4">
                                <img src={req.brandAvatar} alt={req.brandName} className="w-12 h-12 rounded-full object-cover flex-shrink-0 mb-4 sm:mb-0" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{req.campaignName}</h3>
                                        <RequestStatusBadge status={req.status} />
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">From: {req.brandName}</p>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm dark:text-gray-300">
                                        <div><span className="font-semibold text-gray-500 dark:text-gray-400">Ad Location:</span> {req.bannerAdLocation}</div>
                                        {req.status === 'brand_offer' && <div className="col-span-full text-indigo-600 dark:text-indigo-400"><span className="font-semibold">Brand's Offer:</span> {req.currentOffer?.amount}</div>}
                                    </div>
                                    <div className="mt-4">
                                        {renderRequestActions(req)}
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">My Banner Ads</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your ad spaces and incoming booking requests.</p>
                </div>
                <button onClick={() => setModal('post_ad')} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 shadow-md">
                    + Post New Ad
                </button>
            </div>

            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button 
                    onClick={() => setActiveTab('requests')} 
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'requests' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    Booking Requests
                </button>
                <button 
                    onClick={() => setActiveTab('my_ads')} 
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'my_ads' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    My Posted Ads
                </button>
            </div>

            {isLoading && <p className="text-center p-8 dark:text-gray-300">Loading...</p>}
            {error && <p className="text-center p-8 bg-red-100 text-red-700 rounded-lg">{error}</p>}

            {!isLoading && activeTab === 'requests' && (
                <div className="space-y-6">
                    <div className="flex space-x-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-x-auto">
                        <FilterButton label="Pending" filterType="pending" count={pendingRequests.length} activeFilter={filter} onClick={setFilter} />
                        <FilterButton label="Processing" filterType="processing" count={processingRequests.length} activeFilter={filter} onClick={setFilter} />
                        <FilterButton label="Completed" filterType="completed" count={completedRequests.length} activeFilter={filter} onClick={setFilter} />
                    </div>
                    
                    {filter === 'pending' && renderRequestsList(pendingRequests, "pending requests")}
                    {filter === 'processing' && renderRequestsList(processingRequests, "processing & running ads")}
                    {filter === 'completed' && renderRequestsList(completedRequests, "completed ads")}
                </div>
            )}

            {!isLoading && activeTab === 'my_ads' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myAds.map(ad => (
                        <div key={ad.id} className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
                            {ad.isBoosted && (
                                <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full flex items-center shadow-md z-10">
                                    <SparklesIcon className="w-4 h-4 mr-1" /> Boosted
                                </div>
                            )}
                            <img src={ad.photoUrl} alt={ad.location} className="w-full h-40 object-cover" />
                            <div className="p-4 flex-grow flex flex-col">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{ad.location}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{ad.address}</p>
                                <div className="mt-4 text-sm dark:text-gray-300">
                                    <p><strong>Size:</strong> {ad.size}</p>
                                    <p><strong>Fee:</strong> ₹{ad.feePerDay}/day</p>
                                    <p><strong>Type:</strong> {ad.bannerType}</p>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-between items-center">
                                <button className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm flex items-center">
                                    <TrashIcon className="w-4 h-4 mr-1" /> Delete
                                </button>
                                {!ad.isBoosted && (
                                    <button onClick={() => setBoostingAd(ad)} className="text-purple-600 hover:text-purple-800 dark:text-purple-400 text-sm flex items-center font-semibold">
                                        <SparklesIcon className="w-4 h-4 mr-1" /> Boost Ad
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {myAds.length === 0 && (
                        <div className="col-span-full text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow">
                            <p className="text-gray-500 dark:text-gray-400">You haven't posted any ads yet.</p>
                            <button onClick={() => setModal('post_ad')} className="mt-4 px-4 py-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded">Post your first ad</button>
                        </div>
                    )}
                </div>
            )}

            {modal === 'details' && selectedRequest && (
                <CollabDetailsModal collab={selectedRequest} onClose={() => { setModal(null); setSelectedRequest(null); }} />
            )}

            {modal === 'offer' && selectedRequest && (
                <OfferModal type={selectedRequest.status === 'agency_offer' ? 'accept' : 'recounter'} currentOffer={selectedRequest.currentOffer?.amount} onClose={() => setModal(null)} onConfirm={(amount) => handleUpdate(selectedRequest.id, { status: 'brand_offer', currentOffer: { amount: `₹${amount}`, offeredBy: 'brand' }})} />
            )}

            {modal === 'post_ad' && (
                <PostBannerAdModal 
                    user={user}
                    onClose={() => setModal(null)}
                    onAdPosted={fetchData}
                />
            )}

            {boostingAd && (
                <CashfreeModal
                    user={user}
                    collabType="boost_banner"
                    baseAmount={adBoostPrice}
                    platformSettings={platformSettings}
                    onClose={() => {
                        setBoostingAd(null);
                        fetchData();
                    }}
                    transactionDetails={{
                        userId: user.id,
                        description: `Banner Ad Boost: ${boostingAd.location}`,
                        relatedId: boostingAd.id,
                    }}
                />
            )}
        </div>
    );
};

export default AdBookingsPage;
