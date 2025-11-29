
import React, { useState, useEffect, useMemo } from 'react';
import { User, CampaignApplication, CampaignApplicationStatus, ConversationParticipant, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { TrashIcon, MessagesIcon, EyeIcon } from './Icons';
import CollabDetailsModal from './CollabDetailsModal';
import CancellationPenaltyModal from './CancellationPenaltyModal';

interface MyApplicationsPageProps {
    user: User; // The logged-in influencer
    platformSettings: PlatformSettings;
    onStartChat: (participant: ConversationParticipant) => void;
    onInitiatePayout: (collab: CampaignApplication) => void;
    refreshUser?: () => void;
}

const ApplicationStatusBadge: React.FC<{ status: CampaignApplicationStatus }> = ({ status }) => {
    const baseClasses = "px-3 py-1 text-xs font-medium rounded-full capitalize";
    const statusMap: Record<CampaignApplicationStatus, { text: string; classes: string }> = {
        pending: { text: "Pending", classes: "text-yellow-800 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300" },
        influencer_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300" },
        brand_offer: { text: "Offer Received", classes: "text-purple-800 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300" },
        pending_brand_review: { text: "Pending Review", classes: "text-yellow-800 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300" },
        rejected: { text: "Rejected", classes: "text-red-800 bg-red-100 dark:bg-red-900/50 dark:text-red-300" },
        brand_counter_offer: { text: "Offer Received", classes: "text-purple-800 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-300" },
        influencer_counter_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300" },
        agreement_reached: { text: "Agreement Reached", classes: "text-green-800 bg-green-100 dark:bg-green-900/50 dark:text-green-300" },
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

// ... (OfferModal remains unchanged)
const OfferModal: React.FC<{ currentOffer: string; onClose: () => void; onConfirm: (amount: string) => void; }> = ({ currentOffer, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-100">Send Counter Offer</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Brand's current offer is {currentOffer}. Propose a new amount.</p>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., 12000" className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    <button onClick={() => onConfirm(amount)} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white">Send Offer</button>
                </div>
            </div>
        </div>
    );
};

export const MyApplicationsPage: React.FC<MyApplicationsPageProps> = ({ user, platformSettings, onStartChat, onInitiatePayout, refreshUser }) => {
    // ... (rest of the component logic)
    const [applications, setApplications] = useState<CampaignApplication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<'offer' | 'details' | null>(null);
    const [selectedApp, setSelectedApp] = useState<CampaignApplication | null>(null);
    const [cancellingApp, setCancellingApp] = useState<CampaignApplication | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [filter, setFilter] = useState<'pending' | 'active' | 'completed' | 'archived'>('pending');

    const fetchApplications = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getCampaignApplicationsForInfluencer(user.id);
            setApplications(data);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch your applications.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, [user.id]);

    const handleUpdate = async (appId: string, data: Partial<CampaignApplication>) => {
        setApplications(prev => prev.map(app => app.id === appId ? { ...app, ...data } : app));
        await apiService.updateCampaignApplication(appId, data, user.id);
        setModal(null);
        setSelectedApp(null);
    };

    const handleDelete = async (appId: string) => {
        if(window.confirm("Are you sure you want to delete this application history?")) {
            try {
                await apiService.deleteCollaboration(appId, 'campaign_applications');
                fetchApplications();
            } catch (err) {
                console.error("Delete failed", err);
            }
        }
    };
    
    const handleConfirmCancellation = async (reason: string) => {
        if (!cancellingApp) return;
        setIsCancelling(true);
        const penalty = platformSettings.cancellationPenaltyAmount || 0;
        
        try {
            await apiService.cancelCollaboration(
                user.id, 
                cancellingApp.id, 
                'campaign_applications', 
                reason, 
                penalty
            );
            setCancellingApp(null);
            fetchApplications();
            if (refreshUser) refreshUser(); // Update penalty balance immediately
        } catch (err) {
            console.error(err);
            alert("Failed to cancel collaboration. Please try again.");
        } finally {
            setIsCancelling(false);
        }
    };

    const handleAction = (app: CampaignApplication, action: 'message' | 'accept_offer' | 'recounter_offer' | 'cancel' | 'start_work' | 'complete_work' | 'get_payment' | 'view_details') => {
        setSelectedApp(app);
        switch(action) {
            case 'view_details':
                setModal('details');
                break;
            case 'message':
                 onStartChat({ id: app.brandId, name: app.brandName, avatar: app.brandAvatar, role: 'brand' });
                 break;
            case 'recounter_offer':
                setModal('offer');
                break;
            case 'accept_offer':
                 handleUpdate(app.id, { status: 'agreement_reached', finalAmount: app.currentOffer?.amount });
                 break;
            case 'cancel':
                setCancellingApp(app);
                break;
            case 'start_work':
                handleUpdate(app.id, { workStatus: 'started' });
                break;
            case 'complete_work':
                handleUpdate(app.id, { status: 'work_submitted' });
                break;
            case 'get_payment':
                onInitiatePayout(app);
                break;
        }
    };

    const renderActions = (app: CampaignApplication) => {
        const actions: {label: string, action: Parameters<typeof handleAction>[1], style: string, icon?: any}[] = [];
        
        actions.push({ label: 'Details', action: 'view_details', style: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700', icon: <EyeIcon className="w-4 h-4" /> });
        actions.push({ label: 'Message', action: 'message', style: 'text-indigo-600 hover:bg-indigo-50', icon: <MessagesIcon className="w-4 h-4" /> });

        switch (app.status) {
            case 'brand_counter_offer':
                actions.push({ label: 'Cancel', action: 'cancel', style: 'text-red-600 hover:bg-red-50' });
                actions.push({ label: 'Counter', action: 'recounter_offer', style: 'text-blue-600 hover:bg-blue-50' });
                actions.push({ label: 'Accept', action: 'accept_offer', style: 'text-green-600 hover:bg-green-50' });
                break;
            case 'agreement_reached': // Added for active cancellation
            case 'in_progress':
                 actions.push({ label: 'Cancel Booking', action: 'cancel', style: 'text-red-600 hover:bg-red-50 font-bold border-red-200' });
                 if (app.paymentStatus === 'paid' && !app.workStatus) {
                    actions.push({ label: 'Start Work', action: 'start_work', style: 'text-indigo-600 hover:bg-indigo-50 font-bold' });
                 }
                 if(app.workStatus === 'started') {
                    actions.push({ label: 'Complete', action: 'complete_work', style: 'text-teal-600 hover:bg-teal-50 font-bold' });
                 }
                 break;
            case 'completed':
                 // Strictly check payment status
                 if (app.paymentStatus === 'payout_requested') {
                    return <span className="px-3 py-1 text-xs font-bold rounded border border-yellow-200 bg-yellow-50 text-yellow-800">Payout Pending</span>;
                 } else if (app.paymentStatus === 'payout_complete') {
                    return <span className="px-3 py-1 text-xs font-bold rounded border border-green-200 bg-green-50 text-green-800">Paid Out</span>;
                 } else if (app.paymentStatus === 'paid') {
                    actions.push({ label: 'Get Payment', action: 'get_payment', style: 'text-green-600 hover:bg-green-50 font-bold' });
                 }
                 break;
        }
        
        return (
            <div className="flex flex-wrap gap-2">
                {actions.map(a => (
                    <button key={a.label} onClick={() => handleAction(app, a.action)} className={`px-3 py-1 text-xs font-semibold rounded border border-gray-200 dark:border-gray-600 flex items-center gap-1 ${a.style}`}>
                        {a.icon} {a.label}
                    </button>
                ))}
            </div>
        );
    };

    // Helper function to display amounts clearly
    const getAmountDisplay = (app: CampaignApplication) => {
        if (app.finalAmount) {
            return <span className="text-green-600 font-bold dark:text-green-400">{app.finalAmount}</span>;
        }
        if (app.currentOffer) {
            return (
                <div className="flex flex-col">
                    <span className="text-blue-600 font-bold dark:text-blue-400">{app.currentOffer.amount}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {app.currentOffer.offeredBy === 'influencer' ? 'My Offer' : 'Brand Offer'}
                    </span>
                </div>
            );
        }
        return <span className="text-gray-500 dark:text-gray-400">Negotiating...</span>;
    };

    const { active, pending, completed, archived } = useMemo(() => {
        const active: CampaignApplication[] = [];
        const pending: CampaignApplication[] = [];
        const completed: CampaignApplication[] = [];
        const archived: CampaignApplication[] = []; 

        applications.forEach(app => {
            if (['in_progress', 'work_submitted', 'disputed', 'brand_decision_pending', 'refund_pending_admin_review', 'agreement_reached'].includes(app.status)) {
                active.push(app);
            } else if (app.status === 'completed') {
                completed.push(app);
            } else if (app.status === 'rejected') {
                archived.push(app);
            } else { 
                pending.push(app);
            }
        });

        return { active, pending, completed, archived };
    }, [applications]);
    
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

    const renderTable = (data: CampaignApplication[]) => (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Brand / Campaign</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Collab ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.map((app) => (
                        <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                        <img className="h-10 w-10 rounded-full object-cover" src={app.brandAvatar} alt="" />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{app.brandName}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{app.campaignTitle}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                {app.collabId || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {getAmountDisplay(app)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <ApplicationStatusBadge status={app.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-2">
                                    {renderActions(app)}
                                    {['completed', 'rejected'].includes(app.status) && (
                                        <button 
                                            onClick={() => handleDelete(app.id)}
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

    if (isLoading) return <div className="text-center p-8">Loading applications...</div>;
    if (error) return <div className="text-center p-8 bg-red-100 text-red-700 rounded-lg">{error}</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">My Campaign Applications</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Track the status of your proposals to brands.</p>
            </div>
            
            <div className="flex space-x-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-x-auto">
                <FilterButton label="Pending Applications" filterType="pending" count={pending.length} />
                <FilterButton label="Accepted & In Progress" filterType="active" count={active.length} />
                <FilterButton label="Completed Applications" filterType="completed" count={completed.length} />
                <FilterButton label="Archived" filterType="archived" count={archived.length} />
            </div>

            {applications.length === 0 ? (
                <div className="text-center py-10 col-span-full bg-white dark:bg-gray-800 rounded-lg shadow"><p className="text-gray-500 dark:text-gray-400">You haven't applied to any campaigns yet.</p></div>
            ) : (
                <>
                    {filter === 'pending' && renderTable(pending)}
                    {filter === 'active' && renderTable(active)}
                    {filter === 'completed' && renderTable(completed)}
                    {filter === 'archived' && renderTable(archived)}
                </>
            )}

            {modal === 'details' && selectedApp && (
                <CollabDetailsModal collab={selectedApp} onClose={() => { setModal(null); setSelectedApp(null); }} />
            )}
            {modal === 'offer' && selectedApp && (
                <OfferModal currentOffer={selectedApp.currentOffer!.amount} onClose={() => setModal(null)} onConfirm={(amount) => handleUpdate(selectedApp.id, { status: 'influencer_counter_offer', currentOffer: { amount: `₹${amount}`, offeredBy: 'influencer' }})} />
            )}
            
            <CancellationPenaltyModal 
                isOpen={!!cancellingApp}
                onClose={() => setCancellingApp(null)}
                onConfirm={handleConfirmCancellation}
                penaltyAmount={platformSettings.cancellationPenaltyAmount || 0}
                isProcessing={isCancelling}
            />
        </div>
    );
};
export default MyApplicationsPage;
