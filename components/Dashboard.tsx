
import React, { useState, useEffect, useMemo } from 'react';
import { User, View, CollaborationStatusItem, CollabRequestStatus, CampaignApplication, CollaborationRequest, PlatformSettings, PlatformBanner, AdSlotRequest, BannerAdBookingRequest } from '../types';
import { InfluencersIcon, SparklesIcon, CollabIcon, SettingsIcon, AdminIcon as CompletedIcon } from './Icons';
import { generateDashboardTip } from '../services/geminiService';
import { apiService } from '../services/apiService';
import { Timestamp } from 'firebase/firestore';


interface DashboardProps {
  user: User;
  setActiveView: (view: View) => void;
  platformSettings: PlatformSettings;
  banners: PlatformBanner[];
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-lg flex flex-col items-center text-center space-y-2">
        <div className="bg-indigo-100 dark:bg-gray-700 p-3 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        </div>
    </div>
);

const StatusBadge: React.FC<{ status: CollaborationStatusItem['status'] }> = ({ status }) => {
    const baseClasses = "px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap";
    if (status === 'agreement_reached' || status === 'completed') return <span className={`${baseClasses} text-green-800 bg-green-100 dark:bg-green-900/50 dark:text-green-300`}>Accepted</span>;
    if (status === 'rejected') return <span className={`${baseClasses} text-red-800 bg-red-100 dark:bg-red-900/50 dark:text-red-300`}>Rejected</span>;
    if (['in_progress', 'work_submitted'].includes(status)) return <span className={`${baseClasses} text-blue-800 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300`}>In Progress</span>;
    return <span className={`${baseClasses} text-yellow-800 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300`}>Pending</span>;
};

const getFriendlyType = (type: CollaborationStatusItem['type']) => {
    if (type.startsWith('collab-request')) return 'Direct';
    if (type.startsWith('campaign-application')) return 'Campaign';
    if (type.startsWith('ad-slot')) return 'Live TV';
    if (type.startsWith('banner-booking')) return 'Banner Ad';
    return 'Collab';
};

const CollabListSection: React.FC<{
  title: string;
  items: CollaborationStatusItem[];
  isLoading: boolean;
  setActiveView: (view: View) => void;
  seeAllView: View;
  emptyText: string;
  isOpen: boolean;
  onToggle: () => void;
  count: number;
}> = ({ title, items, isLoading, setActiveView, seeAllView, emptyText, isOpen, onToggle, count }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
        <div className="p-4 sm:p-6 cursor-pointer" onClick={onToggle}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h3>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-gray-700 dark:text-gray-200">{count}</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={(e) => { e.stopPropagation(); setActiveView(seeAllView); }}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                        See all
                    </button>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
        {isOpen && (
            <div className="border-t border-gray-200 dark:border-gray-700">
                <div className="p-4 sm:p-6 space-y-3">
                    {isLoading ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading activity...</p>
                    ) : items.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{emptyText}</p>
                    ) : (
                        items.slice(0, 5).map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveView(item.view)}
                                className="w-full flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors"
                            >
                                <img src={item.partnerAvatar} alt={item.partnerName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{item.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        With: {item.partnerName}
                                        <span className="mx-1">&bull;</span>
                                        <span className="capitalize">{getFriendlyType(item.type)}</span>
                                    </p>
                                </div>
                                <StatusBadge status={item.status} />
                            </button>
                        ))
                    )}
                </div>
            </div>
        )}
    </div>
);

const getTime = (ts: any): number => {
    if (!ts) return 0;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).getTime();
    return 0;
};

const Dashboard: React.FC<DashboardProps> = ({ user, setActiveView, platformSettings, banners }) => {
    const [aiTip, setAiTip] = useState<string>('');
    const [isGeneratingTip, setIsGeneratingTip] = useState(false);
    const [collabItems, setCollabItems] = useState<CollaborationStatusItem[]>([]);
    const [isCollabLoading, setIsCollabLoading] = useState(true);
    const [openSection, setOpenSection] = useState<'pending' | 'inProgress' | 'completed' | null>(null);

    const toggleSection = (section: 'pending' | 'inProgress' | 'completed') => {
        setOpenSection(prev => (prev === section ? null : section));
    };

    useEffect(() => {
        const fetchCollaborationStatus = async () => {
            setIsCollabLoading(true);
            let rawItems: any[] = [];
            
            try {
                switch (user.role) {
                    case 'brand':
                        const sentRequests = await apiService.getCollabRequestsForBrand(user.id);
                        const campaigns = await apiService.getCampaignsForBrand(user.id);
                        const appPromises = campaigns.map(c => apiService.getApplicationsForCampaign(c.id));
                        const campaignApps = (await Promise.all(appPromises)).flat();
                        const adSlots = await apiService.getAdSlotRequestsForBrand(user.id);
                        const bannerBookings = await apiService.getBannerAdBookingRequestsForBrand(user.id);
                        rawItems = [...sentRequests, ...campaignApps, ...adSlots, ...bannerBookings];
                        break;
                    case 'influencer':
                        const receivedRequests = await apiService.getCollabRequestsForInfluencer(user.id);
                        const sentApps = await apiService.getCampaignApplicationsForInfluencer(user.id);
                        rawItems = [...receivedRequests, ...sentApps];
                        break;
                    case 'livetv':
                        rawItems = await apiService.getAdSlotRequestsForLiveTv(user.id);
                        break;
                    case 'banneragency':
                        rawItems = await apiService.getBannerAdBookingRequestsForAgency(user.id);
                        break;
                }

                const mappedItems = rawItems.map((item): CollaborationStatusItem | null => {
                    if ('campaignId' in item && 'influencerId' in item) { // CampaignApplication
                        const app = item as CampaignApplication;
                        if(user.role === 'brand') { // App received by brand
                            return { id: app.id, title: app.campaignTitle, partnerName: app.influencerName, partnerAvatar: app.influencerAvatar, status: app.status, timestamp: app.timestamp, type: 'campaign-application-received', view: View.CAMPAIGNS };
                        } else { // App sent by influencer
                            return { id: app.id, title: app.campaignTitle, partnerName: app.brandName, partnerAvatar: app.brandAvatar, status: app.status, timestamp: app.timestamp, type: 'campaign-application-sent', view: View.MY_APPLICATIONS };
                        }
                    }
                    if ('influencerId' in item && 'brandId' in item) { // CollaborationRequest
                        const req = item as CollaborationRequest;
                        if(user.role === 'brand') { // Request sent by brand
                             return { id: req.id, title: req.title, partnerName: req.influencerName, partnerAvatar: req.influencerAvatar, status: req.status, timestamp: req.timestamp, type: 'collab-request-sent', view: View.MY_COLLABORATIONS };
                        } else { // Request received by influencer
                             return { id: req.id, title: req.title, partnerName: req.brandName, partnerAvatar: req.brandAvatar, status: req.status, timestamp: req.timestamp, type: 'collab-request-received', view: View.COLLAB_REQUESTS };
                        }
                    }
                    if ('liveTvId' in item) { // AdSlotRequest
                        const req = item as AdSlotRequest;
                        if(user.role === 'brand') {
                            return { id: req.id, title: req.campaignName, partnerName: req.liveTvName, partnerAvatar: req.liveTvAvatar, status: req.status, timestamp: req.timestamp, type: 'ad-slot-request', view: View.AD_BOOKINGS };
                        } else {
                            return { id: req.id, title: req.campaignName, partnerName: req.brandName, partnerAvatar: req.brandAvatar, status: req.status, timestamp: req.timestamp, type: 'ad-slot-request', view: View.LIVETV };
                        }
                    }
                    if ('agencyId' in item) { // BannerAdBookingRequest
                        const req = item as BannerAdBookingRequest;
                         if(user.role === 'brand') {
                            return { id: req.id, title: req.campaignName, partnerName: req.agencyName, partnerAvatar: req.agencyAvatar, status: req.status, timestamp: req.timestamp, type: 'banner-booking-request', view: View.AD_BOOKINGS };
                         } else {
                            return { id: req.id, title: req.campaignName, partnerName: req.brandName, partnerAvatar: req.brandAvatar, status: req.status, timestamp: req.timestamp, type: 'banner-booking-request', view: View.BANNERADS };
                         }
                    }
                    return null;
                }).filter((i): i is CollaborationStatusItem => i !== null);
                
                mappedItems.sort((a, b) => getTime(b.timestamp) - getTime(a.timestamp));
                setCollabItems(mappedItems);

            } catch (error) {
                console.error("Failed to fetch collaboration statuses:", error);
            } finally {
                setIsCollabLoading(false);
            }
        };

        fetchCollaborationStatus();
    }, [user]);

    const { pendingCollabs, inProgressCollabs, completedCollabs } = useMemo(() => {
        const pending: CollaborationStatusItem[] = [];
        const inProgress: CollaborationStatusItem[] = [];
        const completed: CollaborationStatusItem[] = [];

        const pendingStatuses: string[] = ['pending', 'influencer_offer', 'brand_offer', 'agreement_reached', 'pending_brand_review', 'brand_counter_offer', 'influencer_counter_offer', 'pending_approval', 'agency_offer'];
        const inProgressStatuses: string[] = ['in_progress', 'work_submitted', 'disputed', 'brand_decision_pending', 'refund_pending_admin_review'];
        const completedStatuses: string[] = ['completed'];

        collabItems.forEach(item => {
            if (pendingStatuses.includes(item.status)) {
                pending.push(item);
            } else if (inProgressStatuses.includes(item.status)) {
                inProgress.push(item);
            } else if (completedStatuses.includes(item.status)) {
                completed.push(item);
            }
        });

        return { pendingCollabs: pending, inProgressCollabs: inProgress, completedCollabs: completed };
    }, [collabItems]);

    const handleGenerateTip = async () => {
        setIsGeneratingTip(true);
        setAiTip('');
        const tip = await generateDashboardTip(user.role, user.name);
        setAiTip(tip);
        setIsGeneratingTip(false);
    };

    const getSeeAllViewForRole = () => {
        switch(user.role) {
            case 'brand': return View.MY_COLLABORATIONS;
            case 'influencer': return View.MY_APPLICATIONS;
            case 'livetv': return View.LIVETV;
            case 'banneragency': return View.BANNERADS;
            default: return View.DASHBOARD;
        }
    };
    
    return (
        <div className="space-y-6">
            
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">Welcome back, {user.name}!</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm sm:text-base">Here's a snapshot of your BIGYAPON dashboard.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-6">
                <StatCard title="Pending Actions" value={pendingCollabs.length.toString()} icon={<CollabIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />} />
                <StatCard title="Work In Progress" value={inProgressCollabs.length.toString()} icon={<SettingsIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />} />
                <StatCard title="Completed Collabs" value={completedCollabs.length.toString()} icon={<CompletedIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />} />
            </div>

            <CollabListSection
                title="Pending Collaborations"
                items={pendingCollabs}
                isLoading={isCollabLoading}
                setActiveView={setActiveView}
                seeAllView={getSeeAllViewForRole()}
                emptyText="No collaborations are currently pending action."
                isOpen={openSection === 'pending'}
                onToggle={() => toggleSection('pending')}
                count={pendingCollabs.length}
            />

            <CollabListSection
                title="Work In Progress"
                items={inProgressCollabs}
                isLoading={isCollabLoading}
                setActiveView={setActiveView}
                seeAllView={getSeeAllViewForRole()}
                emptyText="No collaborations are currently in progress."
                isOpen={openSection === 'inProgress'}
                onToggle={() => toggleSection('inProgress')}
                count={inProgressCollabs.length}
            />
            
            <CollabListSection
                title="Completed Collaborations"
                items={completedCollabs}
                isLoading={isCollabLoading}
                setActiveView={setActiveView}
                seeAllView={getSeeAllViewForRole()}
                emptyText="You have no completed collaborations yet."
                isOpen={openSection === 'completed'}
                onToggle={() => toggleSection('completed')}
                count={completedCollabs.length}
            />

            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                         <div className="bg-indigo-100 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 p-3 rounded-full flex-shrink-0">
                            <SparklesIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">AI-Powered Pro Tip</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Get a personalized tip to boost your success.</p>
                        </div>
                    </div>
                    <button onClick={handleGenerateTip} disabled={isGeneratingTip} className="flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 whitespace-nowrap">
                        <SparklesIcon className={`w-5 h-5 mr-2 ${isGeneratingTip ? 'animate-spin' : ''}`} />
                        {isGeneratingTip ? 'Generating...' : 'Get Tip'}
                    </button>
                </div>
                {aiTip && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 border-l-4 border-teal-400 rounded-r-lg">
                        <p className="text-gray-700 dark:text-gray-200 text-sm">{aiTip}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
