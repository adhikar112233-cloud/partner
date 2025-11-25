
import React, { useState, useEffect, useMemo } from 'react';
import { User, CampaignApplication, CampaignApplicationStatus, ConversationParticipant, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';

interface MyApplicationsPageProps {
    user: User; // The logged-in influencer
    platformSettings: PlatformSettings;
    onStartChat: (participant: ConversationParticipant) => void;
    onInitiatePayout: (collab: CampaignApplication) => void;
}

const ApplicationStatusBadge: React.FC<{ status: CampaignApplicationStatus }> = ({ status }) => {
    const baseClasses = "px-3 py-1 text-xs font-medium rounded-full capitalize";
    const statusMap: Record<CampaignApplicationStatus, { text: string; classes: string }> = {
        pending: { text: "Pending", classes: "text-yellow-800 bg-yellow-100" },
        influencer_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100" },
        brand_offer: { text: "Offer Received", classes: "text-purple-800 bg-purple-100" },
        pending_brand_review: { text: "Pending Review", classes: "text-yellow-800 bg-yellow-100" },
        rejected: { text: "Rejected", classes: "text-red-800 bg-red-100" },
        brand_counter_offer: { text: "Offer Received", classes: "text-purple-800 bg-purple-100" },
        influencer_counter_offer: { text: "Offer Sent", classes: "text-blue-800 bg-blue-100" },
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

const OfferModal: React.FC<{ currentOffer: string; onClose: () => void; onConfirm: (amount: string) => void; }> = ({ currentOffer, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">Send Counter Offer</h3>
                <p className="text-sm text-gray-600 mb-4">Brand's current offer is {currentOffer}. Propose a new amount.</p>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g., 12000" className="w-full p-2 border rounded-md"/>
                <div className="flex justify-end space-x-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200">Cancel</button>
                    <button onClick={() => onConfirm(amount)} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white">Send Offer</button>
                </div>
            </div>
        </div>
    );
};

const ApplicationItem: React.FC<{
    app: CampaignApplication;
    renderStatusInfo: (app: CampaignApplication) => React.ReactNode;
    renderActions: (app: CampaignApplication) => React.ReactNode;
}> = ({ app, renderStatusInfo, renderActions }) => (
     <li className="p-6">
        <div className="flex items-start space-x-4">
            <img src={app.brandAvatar} alt={app.brandName} className="w-12 h-12 rounded-full object-cover" />
            <div className="flex-1">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">{app.campaignTitle}</h3>
                    <ApplicationStatusBadge status={app.status} />
                </div>
                <p className="text-sm font-medium text-gray-600">Brand: {app.brandName}</p>
                {app.status === 'brand_counter_offer' && <p className="text-sm font-semibold text-indigo-600 mt-2">Brand's Offer: {app.currentOffer?.amount}</p>}
                {renderStatusInfo(app)}
                {renderActions(app)}
            </div>
        </div>
    </li>
);


// Fix: Changed to a named export to resolve module resolution error.
export const MyApplicationsPage: React.FC<MyApplicationsPageProps> = ({ user, platformSettings, onStartChat, onInitiatePayout }) => {
    const [applications, setApplications] = useState<CampaignApplication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<'offer' | null>(null);
    const [selectedApp, setSelectedApp] = useState<CampaignApplication | null>(null);
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
    
    const handleAction = (app: CampaignApplication, action: 'message' | 'accept_offer' | 'recounter_offer' | 'cancel' | 'start_work' | 'complete_work' | 'get_payment') => {
        setSelectedApp(app);
        switch(action) {
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
                if (window.confirm("Are you sure you want to cancel this application?")) {
                    handleUpdate(app.id, { status: 'rejected', rejectionReason: 'Cancelled by influencer.' });
                }
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
        const actions: {label: string, action: Parameters<typeof handleAction>[1], style: string}[] = [];
        
        switch (app.status) {
            case 'brand_counter_offer':
                actions.push({ label: 'Message', action: 'message', style: 'bg-gray-200 text-gray-800' });
                actions.push({ label: 'Cancel', action: 'cancel', style: 'bg-red-500 text-white' });
                actions.push({ label: 'Send Counter-Offer', action: 'recounter_offer', style: 'bg-blue-500 text-white' });
                actions.push({ label: 'Accept Offer', action: 'accept_offer', style: 'bg-green-500 text-white' });
                break;
            case 'in_progress':
                 if (app.paymentStatus === 'paid' && !app.workStatus) {
                    actions.push({ label: 'Start Work', action: 'start_work', style: 'bg-indigo-600 text-white' });
                 }
                 if(app.workStatus === 'started') {
                    actions.push({ label: 'Complete Work', action: 'complete_work', style: 'bg-teal-500 text-white' });
                 }
                 break;
            case 'completed':
                 if (app.paymentStatus === 'paid') {
                    actions.push({ label: 'Get Payment', action: 'get_payment', style: 'bg-green-500 text-white' });
                 }
                 break;
        }
        
        if (actions.length === 0) return null;

        return (
            <div className="mt-4 flex flex-wrap gap-3">
                {actions.map(a => (
                    <button key={a.label} onClick={() => handleAction(app, a.action)} className={`px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-80 ${a.style}`}>
                        {a.label}
                    </button>
                ))}
            </div>
        );
    };
    
    const renderStatusInfo = (app: CampaignApplication) => {
        let info = null;
        switch (app.status) {
            case 'influencer_counter_offer': info = `You offered ${app.currentOffer?.amount}. Waiting for brand to respond.`; break;
            case 'agreement_reached': info = `Agreement reached for ${app.finalAmount}. Waiting for brand to complete payment.`; break;
            case 'work_submitted': info = `Work submitted. Waiting for brand to confirm completion (1-2 days).`; break;
            case 'completed': 
                if (app.paymentStatus === 'payout_requested') info = "Payout requested. Under review by admin.";
                else if (app.paymentStatus === 'payout_complete') info = "Payment processed. Thank you!";
                break;
            case 'refund_pending_admin_review': info = "The brand has requested a refund. An admin will review the case."; break;
        }
        if (!info) return null;
        return <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-lg">{info}</div>;
    };

    const { active, pending, completed, archived } = useMemo(() => {
        const active: CampaignApplication[] = [];
        const pending: CampaignApplication[] = [];
        const completed: CampaignApplication[] = [];
        const archived: CampaignApplication[] = []; // for rejected

        applications.forEach(app => {
            if (['in_progress', 'work_submitted', 'disputed', 'brand_decision_pending', 'refund_pending_admin_review'].includes(app.status)) {
                active.push(app);
            } else if (app.status === 'completed') {
                completed.push(app);
            } else if (app.status === 'rejected') {
                archived.push(app);
            } else { // Catches 'pending_brand_review', 'brand_counter_offer', 'influencer_counter_offer', 'agreement_reached'
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

    const renderList = (list: CampaignApplication[], title: string) => {
        if (list.length === 0) {
            return <div className="text-center py-10 bg-white rounded-lg shadow"><p className="text-gray-500">You have no {title.toLowerCase()}.</p></div>;
        }
        return (
            <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
                <ul className="divide-y divide-gray-200">
                    {list.map(app => <ApplicationItem key={app.id} app={app} renderStatusInfo={renderStatusInfo} renderActions={renderActions} />)}
                </ul>
            </div>
        );
    };


    if (isLoading) return <div className="text-center p-8">Loading applications...</div>;
    if (error) return <div className="text-center p-8 bg-red-100 text-red-700 rounded-lg">{error}</div>;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">My Campaign Applications</h1>
                <p className="text-gray-500 mt-1">Track the status of your proposals to brands.</p>
            </div>
            
            <div className="flex space-x-2 p-1 bg-gray-50 rounded-lg border overflow-x-auto">
                <FilterButton label="Pending Applications" filterType="pending" count={pending.length} />
                <FilterButton label="Accepted & In Progress" filterType="active" count={active.length} />
                <FilterButton label="Completed Applications" filterType="completed" count={completed.length} />
                <FilterButton label="Archived" filterType="archived" count={archived.length} />
            </div>

            {applications.length === 0 ? (
                <div className="text-center py-10 col-span-full bg-white rounded-lg shadow"><p className="text-gray-500">You haven't applied to any campaigns yet.</p></div>
            ) : (
                <div className="space-y-8">
                    {filter === 'pending' && renderList(pending, "pending applications")}
                    {filter === 'active' && renderList(active, "accepted & in progress applications")}
                    {filter === 'completed' && renderList(completed, "completed applications")}
                    {filter === 'archived' && renderList(archived, "archived applications (rejected)")}
                </div>
            )}

            {modal === 'offer' && selectedApp && (
                <OfferModal currentOffer={selectedApp.currentOffer!.amount} onClose={() => setModal(null)} onConfirm={(amount) => handleUpdate(selectedApp.id, { status: 'influencer_counter_offer', currentOffer: { amount: `₹${amount}`, offeredBy: 'influencer' }})} />
            )}
        </div>
    );
};
