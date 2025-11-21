import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { isFirebaseConfigured, db, auth, firebaseConfig } from '../services/firebase';
import { authService } from '../services/authService';
import { apiService } from '../services/apiService';
import { User, View, Influencer, PlatformSettings, ProfileData, ConversationParticipant, LiveTvChannel, Transaction, PayoutRequest, AnyCollaboration, PlatformBanner, RefundRequest, DailyPayoutRequest, AppNotification, CreatorVerificationStatus } from '../types';
import { Timestamp, doc, getDoc, QueryDocumentSnapshot, DocumentData, query, collection, where, limit, getDocs } from 'firebase/firestore';

import LoginPage from './LoginPage';
import Sidebar from './Sidebar';
import Header from './Header';
import InfluencerCard from './InfluencerCard';
import ChatWindow from './ChatWindow';
import { findInfluencersWithAI } from '../services/geminiService';
import { SparklesIcon, LogoIcon, SearchIcon } from './Icons';
import Dashboard from './Dashboard';
import ProfilePage from './ProfilePage';
import SettingsPanel from './SettingsPanel';
import { AdminPanel } from './AdminPanel';
import PostLoginWelcomePage from './PostLoginWelcomePage';
import SendMessageModal from './SendMessageModal';
import CollabRequestModal from './CollabRequestModal';
import CollaborationRequestsPage from './CollaborationRequestsPage';
import ProfileDetailDrawer from './ProfileDetailDrawer';
import CampaignsPage from './CampaignsPage';
import DiscoverCampaignsPage from './DiscoverCampaignsPage';
import LiveTvPageForBrand from './LiveTvPageForBrand';
import AdRequestsPage from './AdRequestsPage';
import BannerAdsPageForBrand from './BannerAdsPageForBrand';
import AdBookingsPage from './AdBookingsPage';
import UserSupportPage from './UserSupportPage';
import SupportAdminPage from './SupportAdminPage';
import MembershipPage from './MembershipPage';
import MyCollaborationsPage from './MyCollaborationsPage';
import { MyApplicationsPage } from './MyApplicationsPage';
import MyAdBookingsPage from './MyAdBookingsPage';
import DailyPayoutRequestModal from './DailyPayoutRequestModal';
import CommunityPage from './CommunityPage';
import SocialMediaFab from './SocialMediaFab';
import PaymentHistoryPage from './PaymentHistoryPage';
import KycPage from './KycPage';
import PayoutRequestPage from './PayoutRequestPage';
import RefundRequestPage from './RefundRequestPage';
import BoostPage from './BoostPage';
import LiveHelpChat from './LiveHelpChat';
import { NotificationManager } from './NotificationManager';
import ClickableImageBanner from './ClickableImageBanner';
import CreatorVerificationPage from './CreatorVerificationPage';
import ActivityFeed from './ActivityFeed';
import OurPartnersPage from './OurPartnersPage';
import PaymentSuccessPage from './PaymentSuccessPage';

const FirebaseConfigError: React.FC = () => (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-xl border-2 border-red-200">
            <h1 className="text-2xl font-bold text-red-800">🔥 Firebase Configuration Required</h1>
            <p className="mt-4 text-gray-700">
                This application requires a connection to a Firebase project to function, but it hasn't been configured yet.
            </p>
            <p className="mt-2 text-gray-600">
                To get started, please open the file <code className="bg-red-100 text-red-900 px-2 py-1 rounded font-mono text-sm">services/firebase.ts</code> in your code editor and replace the placeholder values with your actual Firebase project credentials.
            </p>
            <p className="mt-4 text-sm text-gray-500">
                You can find your project configuration in the Firebase Console under Project Settings.
            </p>
        </div>
    </div>
);

const DatabaseConfigError: React.FC<{ message: string }> = ({ message }) => {
    const projectId = firebaseConfig?.projectId || "your-project-id";
    const lowerMessage = message.toLowerCase();
    const isApiNotEnabled = lowerMessage.includes("cloud firestore api") || lowerMessage.includes("datastore.googleapis.com");
    const isPermissionDenied = lowerMessage.includes("permission-denied") || lowerMessage.includes("insufficient permissions") || lowerMessage.includes("missing or insufficient permissions");
    const isOfflineOrProjectNotFound = lowerMessage.includes("offline") || lowerMessage.includes("project not found");

    const getErrorDetails = () => {
        if (isPermissionDenied) {
            return {
                title: "Permission Denied",
                description: "Your Firestore Security Rules are blocking access.",
                fixTitle: "How to Fix: Update Security Rules",
                fixSteps: (
                    <>
                        <p>To allow this app to work, you need to allow read/write access in your Firestore Security Rules.</p>
                        <ol className="list-decimal list-inside space-y-3 mt-3">
                            <li>Go to the <a href={`https://console.firebase.google.com/project/${projectId}/firestore/rules`} target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">Firestore Rules Tab</a> for project <strong>{projectId}</strong>.</li>
                            <li><strong>Delete</strong> the existing rules and <strong>paste</strong> the following:</li>
                        </ol>
                        <pre className="bg-gray-800 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono border border-gray-700 shadow-inner my-3">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                        </pre>
                        <p className="text-sm bg-yellow-50 p-3 rounded border border-yellow-200 text-yellow-800">
                            <strong>Note:</strong> These rules allow <strong>public access</strong>. This is fine for development but should be restricted for production.
                        </p>
                        <p className="mt-2">Click <strong>Publish</strong>, wait 30 seconds, and then reload this page.</p>
                    </>
                )
            };
        }
        
        if (isApiNotEnabled || isOfflineOrProjectNotFound) {
             return {
                title: "Database Not Found",
                description: isOfflineOrProjectNotFound ? `The project ID "${projectId}" might be incorrect or the database doesn't exist.` : `The Firestore database has not been created or enabled for project "${projectId}".`,
                fixTitle: "How to Fix: Create Firestore Database",
                fixSteps: (
                    <ol className="list-decimal list-inside space-y-4 text-gray-700">
                        <li className="pl-2">
                            <strong>Open Firebase Console:</strong> Go to <a href={`https://console.firebase.google.com/project/${projectId}/firestore`} target="_blank" rel="noreferrer" className="text-indigo-600 underline font-medium">Firestore Database for {projectId}</a>.
                        </li>
                        <li className="pl-2">
                            <strong>Create Database:</strong> Click the <strong>Create Database</strong> button.
                        </li>
                        <li className="pl-2">
                            <strong>Select Test Mode:</strong> When prompted, select <strong>Start in Test Mode</strong>. This sets the correct permissions for development.
                        </li>
                        <li className="pl-2">
                            <strong>Location:</strong> Choose a location and click <strong>Enable</strong>. Wait a minute for it to provision.
                        </li>
                    </ol>
                )
            };
        }

        return {
            title: "Database Connection Issue",
            description: "An unexpected error occurred while trying to connect to Firestore.",
            fixTitle: "Troubleshooting Steps",
            fixSteps: (
                 <ol className="list-decimal list-inside space-y-2">
                    <li>Verify the <strong>projectId</strong> in <code>../services/firebase.ts</code> matches your Firebase project.</li>
                    <li>Ensure you have an active internet connection.</li>
                    <li>Check the <a href="https://status.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Firebase Status Dashboard</a> for outages.</li>
                </ol>
            )
        };
    };

    const { title, description, fixTitle, fixSteps } = getErrorDetails();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="max-w-3xl w-full bg-white rounded-2xl shadow-xl p-8 border-t-4 border-indigo-600">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-red-100 text-red-600 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                        <p className="text-gray-500">{description}</p>
                    </div>
                </div>

                <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm text-red-800 mb-6 break-all border border-gray-300">
                    <strong>Error:</strong> {message}
                </div>
                
                 <div className="space-y-4 text-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-2">{fixTitle}</h3>
                    {fixSteps}
                </div>

                <div className="mt-8 flex justify-center">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        I've Fixed It - Reload App
                    </button>
                </div>
            </div>
        </div>
    );
}

const MaintenancePage: React.FC = () => (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl text-center">
            <LogoIcon showTagline />
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-8">Down for Maintenance</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
                BIGYAPON is currently undergoing scheduled maintenance. We'll be back online shortly. Thank you for your patience!
            </p>
        </div>
    </div>
);

const NotificationBanner: React.FC<{ text: string }> = ({ text }) => (
    <div className="bg-indigo-600 text-white text-sm font-medium text-center p-2">
        {text}
    </div>
);

const KycRejectedBanner: React.FC<{ onResubmit: () => void, reason?: string }> = ({ onResubmit, reason }) => (
    <div className="bg-red-600 text-white text-sm font-medium p-3">
        <div className="container mx-auto flex justify-between items-center">
            <div>
                <p className="font-bold">KYC Verification Required</p>
                <p>Your previous submission was rejected. {reason ? `Reason: ${reason}` : 'Please update your details.'}</p>
            </div>
            <button onClick={onResubmit} className="px-4 py-1.5 font-semibold text-red-600 bg-white rounded-md shadow-sm hover:bg-gray-100 transition-colors flex-shrink-0">
                Resubmit KYC
            </button>
        </div>
    </div>
);

const MembershipInactiveBanner: React.FC<{ onUpgrade: () => void }> = ({ onUpgrade }) => (
    <div className="bg-yellow-500 text-white text-sm font-medium p-3">
        <div className="container mx-auto flex justify-between items-center gap-4">
            <p>Your membership is inactive. Your profile is not visible to brands/customers until you upgrade your membership.</p>
            <button onClick={onUpgrade} className="px-4 py-1.5 font-semibold text-yellow-600 bg-white rounded-md shadow-sm hover:bg-gray-100 transition-colors flex-shrink-0 whitespace-nowrap">
                Upgrade to Membership
            </button>
        </div>
    </div>
);

const CreatorVerificationBanner: React.FC<{
    status: CreatorVerificationStatus;
    onVerify: () => void;
    reason?: string;
}> = ({ status, onVerify, reason }) => {
    const isRejected = status === 'rejected';
    const bgColor = isRejected ? 'bg-red-600' : 'bg-yellow-500';
    const textColor = 'text-white';
    const buttonBg = 'bg-white';
    const buttonTextColor = isRejected ? 'text-red-600' : 'text-yellow-600';

    return (
        <div className={`${bgColor} ${textColor} text-sm font-medium p-3`}>
            <div className="container mx-auto flex justify-between items-center gap-4">
                <div>
                    <p className="font-bold">{isRejected ? 'Verification Rejected' : 'Creator Verification Required'}</p>
                    <p>{isRejected ? `Reason: ${reason || 'Please review and resubmit your details.'}` : "You're unverified. Brands have low trust in unverified creators. Please verify your identity."}</p>
                </div>
                <button
                    onClick={onVerify}
                    className={`px-4 py-1.5 font-semibold ${buttonBg} ${buttonTextColor} rounded-md shadow-sm hover:bg-gray-100 transition-colors flex-shrink-0 whitespace-nowrap`}
                >
                    {isRejected ? 'Resubmit Now' : 'Verify Now'}
                </button>
            </div>
        </div>
    );
};

const INFLUENCER_PAGE_LIMIT = 12;

const App: React.FC = () => {
  if (!isFirebaseConfigured) {
    return <FirebaseConfigError />;
  }

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>(View.DASHBOARD);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [liveTvChannels, setLiveTvChannels] = useState<LiveTvChannel[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredInfluencers, setFilteredInfluencers] = useState<Influencer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [platformBanners, setPlatformBanners] = useState<PlatformBanner[]>([]);
  
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allPayouts, setAllPayouts] = useState<PayoutRequest[]>([]);
  const [allCollabs, setAllCollabs] = useState<AnyCollaboration[]>([]);
  const [allRefunds, setAllRefunds] = useState<RefundRequest[]>([]);
  const [allDailyPayouts, setAllDailyPayouts] = useState<DailyPayoutRequest[]>([]);

  const [lastInfluencerDoc, setLastInfluencerDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreInfluencers, setHasMoreInfluencers] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [activeChat, setActiveChat] = useState<Influencer | null>(null);
  const [collabRequestInfluencer, setCollabRequestInfluencer] = useState<Influencer | null>(null);
  const [viewingProfile, setViewingProfile] = useState<ProfileData | null>(null);
  const [payoutRequestCollab, setPayoutRequestCollab] = useState<AnyCollaboration | null>(null);
  const [refundingCollab, setRefundingCollab] = useState<AnyCollaboration | null>(null);
  const [liveHelpSessionId, setLiveHelpSessionId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isFeedOpen, setIsFeedOpen] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const refreshPlatformSettings = useCallback(() => {
    apiService.getPlatformSettings()
      .then((settings) => {
        setPlatformSettings(settings);
        setConfigError(null);
      })
      .catch(err => {
        console.error("Failed to reload platform settings:", err);
        if (err.message && (err.message.includes("Cloud Firestore API") || err.code === "permission-denied" || err.message.includes("permission-denied"))) {
             setConfigError("Permission denied: The Firestore database has not been initialized in the Firebase Console for project 'collabzz-757f1', or access is denied.");
        } else {
             setConfigError(err.message || "An unexpected error occurred while connecting to the database.");
        }
    });
  }, []);

  useEffect(() => {
    refreshPlatformSettings();
    apiService.getActivePlatformBanners().then(setPlatformBanners).catch(err => {
        console.error("Failed to fetch platform banners:", err);
    });
  }, [refreshPlatformSettings]);

 const refreshUser = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const profileData = userDoc.data();
                const refreshedUser: User = {
                    id: firebaseUser.uid,
                    email: firebaseUser.email || profileData.email,
                    ...profileData
                } as User;
                setUser(refreshedUser);
            }
        } catch (error) {
            console.error("Failed to refresh user profile", error);
        }
    }
}, []);

  const refreshAllData = useCallback(async () => {
      if (user && platformSettings) {
        await apiService.initializeFirestoreData();
        
        if (user.role === 'brand' || user.role === 'influencer' || user.role === 'livetv' || user.role === 'banneragency') {
          const influencerResult = await apiService.getInfluencersPaginated(platformSettings, { limit: INFLUENCER_PAGE_LIMIT });
          setInfluencers(influencerResult.influencers);
          setFilteredInfluencers(influencerResult.influencers);
          setLastInfluencerDoc(influencerResult.lastVisible);
          setHasMoreInfluencers(influencerResult.influencers.length === INFLUENCER_PAGE_LIMIT);
          
          const channelData = await apiService.getLiveTvChannels(platformSettings);
          setLiveTvChannels(channelData);
        }

        if (user.role === 'staff') {
            const [
                allUserData, transactions, payouts, direct, campaign, adslot, banner, refunds, dailyPayouts
            ] = await Promise.all([
                apiService.getAllUsers(),
                apiService.getAllTransactions(),
                apiService.getAllPayouts(),
                apiService.getAllCollaborationRequests(),
                apiService.getAllCampaignApplications(),
                apiService.getAllAdSlotRequests(),
                apiService.getAllBannerAdBookingRequests(),
                apiService.getAllRefunds(),
                apiService.getAllDailyPayouts(),
            ]);
            setAllUsers(allUserData);
            setAllTransactions(transactions);
            setAllPayouts(payouts);
            setAllCollabs([...direct, ...campaign, ...adslot, ...banner]);
            setAllRefunds(refunds);
            setAllDailyPayouts(dailyPayouts);
        } else {
            const allUserData = await apiService.getAllUsers();
            setAllUsers(allUserData);
        }
      }
    }, [user, platformSettings]);

  const loadMoreInfluencers = useCallback(async () => {
    if (!platformSettings || !hasMoreInfluencers || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
        const result = await apiService.getInfluencersPaginated(platformSettings, {
            limit: INFLUENCER_PAGE_LIMIT,
            startAfterDoc: lastInfluencerDoc!,
        });

        setInfluencers(prev => [...prev, ...result.influencers]);
        if (!searchQuery) {
            setFilteredInfluencers(prev => [...prev, ...result.influencers]);
        }
        setLastInfluencerDoc(result.lastVisible);
        setHasMoreInfluencers(result.influencers.length === INFLUENCER_PAGE_LIMIT);
    } catch (error) {
        console.error("Failed to load more influencers:", error);
    } finally {
        setIsLoadingMore(false);
    }
  }, [platformSettings, hasMoreInfluencers, isLoadingMore, lastInfluencerDoc, searchQuery]);

  useEffect(() => {
    const unsubscribe = authService.onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        if (firebaseUser.kycStatus !== 'not_submitted') {
            const hasSeenWelcome = sessionStorage.getItem('hasSeenWelcome');
            if (!hasSeenWelcome) {
                setShowWelcome(true);
                sessionStorage.setItem('hasSeenWelcome', 'true');
            }
        }
        switch (firebaseUser.role) {
            case 'staff': setActiveView(View.ADMIN); break;
            case 'brand': setActiveView(View.INFLUENCERS); break;
            default: setActiveView(View.DASHBOARD); break;
        }
      } else {
        sessionStorage.removeItem('hasSeenWelcome');
        setActiveView(View.DASHBOARD);
        setActiveChat(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
      refreshAllData();
  }, [refreshAllData]);

  useEffect(() => {
    if (user) {
        const unsubscribe = apiService.getNotificationsForUserListener(
            user.id,
            (newNotifications) => {
                setNotifications(newNotifications);
            },
            (error) => {
                console.error("Failed to listen for notifications:", error);
            }
        );
        return () => unsubscribe();
    }
  }, [user]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.isRead) {
        apiService.markNotificationAsRead(notification.id);
    }
    setActiveView(notification.view);
    setIsFeedOpen(false);
  };
  
  const handleMarkAllAsRead = () => {
    if (user) {
        apiService.markAllNotificationsAsRead(user.id);
    }
  };
  
  const handleMembershipActivated = () => {
      refreshUser();
      setActiveView(View.DASHBOARD);
  };

  const handleProfileUpdate = (updatedUser: User) => {
    setUser(updatedUser);
  };
  
  const handleAiSearch = async () => {
      if (!searchQuery.trim()) {
        setFilteredInfluencers(influencers);
        return;
      }
      setIsAiSearching(true);
      try {
        const matchingIds = await findInfluencersWithAI(searchQuery, influencers);
        const matches = influencers.filter(inf => matchingIds.includes(inf.id));
        setFilteredInfluencers(matches);
      } catch (error) {
        console.error("AI Search failed:", error);
      } finally {
        setIsAiSearching(false);
      }
  };

  const handleViewProfileClick = (profile: ProfileData) => {
    if (user && profile.id !== user.id) {
        setViewingProfile(profile);
    }
  };
  
  const handleConversationSelected = (participant: ConversationParticipant) => {
    const tempChatPartner: Influencer = {
      id: participant.id,
      name: participant.name,
      avatar: participant.avatar,
      handle: participant.handle || participant.companyName || '',
      bio: '',
      followers: 0,
      niche: '',
      engagementRate: 0,
    };
    setActiveChat(tempChatPartner);
  };

  const handleSendMessageFromDrawer = (profile: ProfileData) => {
      setViewingProfile(null);
      const chatPartner = influencers.find(i => i.id === profile.id);
      if (chatPartner) {
          setActiveChat(chatPartner);
      } else {
          const tempChatPartner: Influencer = {
              id: profile.id,
              name: profile.name,
              avatar: profile.avatar,
              handle: profile.handle || profile.companyName || '',
              bio: profile.bio || '',
              followers: 0,
              niche: '',
              engagementRate: 0,
          };
          setActiveChat(tempChatPartner);
      }
  };

  const handleInitiatePayout = async (collab: AnyCollaboration) => {
      try {
        const freshSettings = await apiService.getPlatformSettings();
        setPlatformSettings(freshSettings);
        setPayoutRequestCollab(collab);
        setActiveView(View.PAYOUT_REQUEST);
      } catch (error) {
        console.error("Failed to refresh settings before showing payout page:", error);
        setPayoutRequestCollab(collab);
        setActiveView(View.PAYOUT_REQUEST);
      }
  };

  const handleInitiateRefund = (collab: AnyCollaboration) => {
      setRefundingCollab(collab);
      setActiveView(View.REFUND_REQUEST);
  };
  
  const handleStartLiveHelp = (sessionId: string) => {
    setLiveHelpSessionId(sessionId);
  };

  if (configError) {
      return <DatabaseConfigError message={configError} />;
  }

  if (isLoading || !platformSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Loading BIGYAPON...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage platformSettings={platformSettings} />;
  }

  if (platformSettings.isMaintenanceModeEnabled && user.role !== 'staff') {
    return <MaintenancePage />;
  }

  if (user.kycStatus === 'not_submitted') {
      return <KycPage user={user} onKycSubmitted={refreshUser} platformSettings={platformSettings} />
  }

  if (showWelcome && platformSettings.isWelcomeMessageEnabled) {
      return <PostLoginWelcomePage user={user} settings={platformSettings} onContinue={() => setShowWelcome(false)} />
  }

  const isCreator = user && ['influencer', 'livetv', 'banneragency'].includes(user.role);
  const isMembershipValid = user && user.membership?.isActive && user.membership?.expiresAt && (user.membership.expiresAt as Timestamp).toDate() > new Date();
  const showMembershipBanner = platformSettings && isCreator && !isMembershipValid && platformSettings.isCreatorMembershipEnabled;
  const showCreatorVerificationBanner = isCreator && (user.creatorVerificationStatus === 'not_submitted' || user.creatorVerificationStatus === 'rejected');

  const renderContent = () => {
    switch (activeView) {
      case View.PARTNERS:
        return <OurPartnersPage />;
      case View.CREATOR_VERIFICATION:
        return <CreatorVerificationPage 
            user={user} 
            onVerificationSubmitted={() => {
                refreshUser();
                setActiveView(View.PROFILE);
            }}
            onBack={() => setActiveView(View.PROFILE)}
        />;
      case View.BOOST_PROFILE:
        return <BoostPage user={user} platformSettings={platformSettings} onBoostActivated={refreshAllData} />;
      case View.KYC:
          return <KycPage user={user} onKycSubmitted={refreshUser} isResubmit={true} platformSettings={platformSettings} />;
      case View.PAYOUT_REQUEST:
          if (!payoutRequestCollab) {
              setActiveView(View.DASHBOARD);
              return <Dashboard user={user} setActiveView={setActiveView} platformSettings={platformSettings} banners={platformBanners} />;
          }
          return <PayoutRequestPage 
                    user={user}
                    collaboration={payoutRequestCollab}
                    platformSettings={platformSettings}
                    onClose={() => {
                        setActiveView(View.DASHBOARD);
                        setPayoutRequestCollab(null);
                    }}
                    onSubmitted={() => {
                        alert("Payout request submitted successfully for review!");
                        setActiveView(View.DASHBOARD);
                        setPayoutRequestCollab(null);
                        refreshAllData();
                    }}
                 />;
      case View.REFUND_REQUEST:
        if (!refundingCollab) {
             setActiveView(View.MY_COLLABORATIONS);
             return <Dashboard user={user} setActiveView={setActiveView} platformSettings={platformSettings} banners={platformBanners} />;
        }
        return <RefundRequestPage
                  user={user}
                  collaboration={refundingCollab}
                  onClose={() => {
                      setActiveView(View.MY_COLLABORATIONS);
                      setRefundingCollab(null);
                  }}
                  onSubmitted={() => {
                      alert("Refund request submitted successfully for admin review.");
                      setActiveView(View.MY_COLLABORATIONS);
                      setRefundingCollab(null);
                      refreshAllData();
                  }}
               />;
      case View.PAYMENT_SUCCESS:
        return <PaymentSuccessPage user={user} onComplete={() => {
            window.history.replaceState({}, document.title, window.location.pathname);
            refreshAllData();
            setActiveView(View.DASHBOARD);
        }} />;
      case View.INFLUENCERS:
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Discover Influencers</h2>
            <div className="mb-6 relative mt-2">
              <input
                type="text"
                placeholder="Describe the influencer you're looking for (e.g., 'fitness coach with over 100k followers')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
                className="w-full p-4 pr-28 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
              />
              <button
                onClick={handleAiSearch}
                disabled={isAiSearching}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50"
              >
                <SparklesIcon className={`w-5 h-5 mr-2 ${isAiSearching ? 'animate-spin' : ''}`} />
                {isAiSearching ? 'Searching...' : 'AI Search'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredInfluencers.map(influencer => (
                <InfluencerCard 
                  key={influencer.id} 
                  influencer={influencer}
                  onStartChat={setActiveChat}
                  onSendCollabRequest={setCollabRequestInfluencer}
                  onViewProfile={handleViewProfileClick}
                />
              ))}
            </div>
            {hasMoreInfluencers && (
                <div className="mt-8 text-center">
                    <button onClick={loadMoreInfluencers} disabled={isLoadingMore} className="px-6 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50">
                        {isLoadingMore ? 'Loading...' : 'Load More Influencers'}
                    </button>
                </div>
            )}
          </div>
        );
      case View.DISCOVER_LIVETV:
        return <LiveTvPageForBrand user={user} channels={liveTvChannels} />;
      case View.DISCOVER_BANNERADS:
        return <BannerAdsPageForBrand user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} />;
      case View.ADMIN:
        return <AdminPanel 
                    user={user} 
                    allUsers={allUsers} 
                    allTransactions={allTransactions} 
                    allPayouts={allPayouts} 
                    allCollabs={allCollabs}
                    allRefunds={allRefunds}
                    allDailyPayouts={allDailyPayouts}
                    platformSettings={platformSettings} 
                    onUpdate={refreshAllData} 
                />;
      case View.SETTINGS:
        if (user.role === 'staff') return <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl overflow-hidden"><SettingsPanel onSettingsUpdate={refreshPlatformSettings} /></div>;
        return <ProfilePage user={user} onProfileUpdate={handleProfileUpdate} onGoToMembership={() => setActiveView(View.MEMBERSHIP)} platformSettings={platformSettings} onGoToDashboard={() => setActiveView(View.DASHBOARD)} setActiveView={setActiveView} />;
      case View.PROFILE:
        return <ProfilePage user={user} onProfileUpdate={handleProfileUpdate} onGoToMembership={() => setActiveView(View.MEMBERSHIP)} platformSettings={platformSettings} onGoToDashboard={() => setActiveView(View.DASHBOARD)} setActiveView={setActiveView} />;
      case View.DASHBOARD:
        return <Dashboard user={user} setActiveView={setActiveView} platformSettings={platformSettings} banners={platformBanners} />;
      case View.COMMUNITY:
        if (!platformSettings.isCommunityFeedEnabled) {
            return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow"><h2 className="text-2xl font-bold dark:text-gray-100">Community Feed Disabled</h2><p className="dark:text-gray-300">This feature is currently turned off by the administrator.</p></div>;
        }
        return <CommunityPage user={user} />;
      case View.MESSAGES:
        return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow"><h2 className="text-2xl font-bold dark:text-gray-100">Messages</h2><p className="dark:text-gray-300">Select a conversation from the header to start chatting.</p></div>;
      case View.COLLAB_REQUESTS:
        return <CollaborationRequestsPage user={user} onViewProfile={handleViewProfileClick} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiatePayout={handleInitiatePayout} />;
      case View.MY_COLLABORATIONS:
        return <MyCollaborationsPage user={user} onViewProfile={handleViewProfileClick} onStartChat={handleConversationSelected} onInitiateRefund={handleInitiateRefund} platformSettings={platformSettings} />;
      case View.MY_APPLICATIONS:
          return <MyApplicationsPage user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiatePayout={handleInitiatePayout} />;
      case View.CAMPAIGNS:
        if (user.role === 'brand') return <CampaignsPage user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiateRefund={handleInitiateRefund} />;
        if (user.role === 'influencer') return <DiscoverCampaignsPage user={user} />;
        return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow"><h2 className="text-2xl font-bold dark:text-gray-100">Campaigns</h2><p className="dark:text-gray-300">This feature is not available for your account type.</p></div>;
      case View.AD_BOOKINGS:
        return <MyAdBookingsPage user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiateRefund={handleInitiateRefund} />;
      case View.LIVETV:
        if (user.role === 'livetv') return <AdRequestsPage user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiatePayout={handleInitiatePayout} />;
        return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow"><h2 className="text-2xl font-bold dark:text-gray-100">Live TV</h2><p className="dark:text-gray-300">This feature is not available for your account type.</p></div>;
      case View.BANNERADS:
        if (user.role === 'banneragency') return <AdBookingsPage user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiatePayout={handleInitiatePayout} />;
        return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow"><h2 className="text-2xl font-bold dark:text-gray-100">Banner Ads</h2><p className="dark:text-gray-300">This feature is not available for your account type.</p></div>;
      case View.SUPPORT:
        if (user.role === 'staff') return <SupportAdminPage user={user} />;
        return <UserSupportPage user={user} platformSettings={platformSettings} onStartLiveHelp={handleStartLiveHelp} />;
      case View.MEMBERSHIP:
        return <MembershipPage user={user} platformSettings={platformSettings} onActivationSuccess={handleMembershipActivated} />;
      case View.PAYMENT_HISTORY:
        return <PaymentHistoryPage user={user} />;
      default:
        return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow"><h2 className="text-2xl font-bold dark:text-gray-100">Welcome</h2><p className="dark:text-gray-300">Select a view from the sidebar.</p></div>;
    }
  };

  return (
    <div className="h-screen overflow-hidden flex bg-gray-50 dark:bg-gray-950">
      <Sidebar 
        user={user}
        activeView={activeView}
        setActiveView={setActiveView}
        userRole={user.role}
        platformSettings={platformSettings}
      />
      <Sidebar 
        isMobile
        user={user}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        activeView={activeView}
        setActiveView={setActiveView}
        userRole={user.role}
        platformSettings={platformSettings}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <NotificationManager user={user} />
        {user.kycStatus === 'rejected' && (
            <KycRejectedBanner onResubmit={() => setActiveView(View.KYC)} reason={user.kycDetails?.rejectionReason} />
        )}
        {platformSettings.isNotificationBannerEnabled && platformSettings.notificationBannerText && (
            <NotificationBanner text={platformSettings.notificationBannerText} />
        )}
        {showMembershipBanner && <MembershipInactiveBanner onUpgrade={() => setActiveView(View.MEMBERSHIP)} />}
        {showCreatorVerificationBanner && (
            <CreatorVerificationBanner
                status={user.creatorVerificationStatus!}
                onVerify={() => setActiveView(View.CREATOR_VERIFICATION)}
                reason={user.creatorVerificationDetails?.rejectionReason}
            />
        )}
        <Header 
            user={user} 
            setActiveView={setActiveView}
            platformSettings={platformSettings}
            onConversationSelected={handleConversationSelected}
            onMobileNavToggle={() => setIsMobileNavOpen(true)}
            theme={theme}
            setTheme={setTheme}
            unreadCount={unreadCount}
            onActivityFeedToggle={() => setIsFeedOpen(prev => !prev)}
        />

        {platformBanners.length > 0 && (
            <ClickableImageBanner 
                imageUrl={platformBanners[0].imageUrl}
                targetUrl={platformBanners[0].targetUrl}
                title={platformBanners[0].title}
            />
        )}
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
      
      {activeChat && (
        <ChatWindow 
          user={user}
          influencer={activeChat}
          onClose={() => setActiveChat(null)}
        />
      )}
      
      {liveHelpSessionId && (
        <LiveHelpChat 
            user={user}
            sessionId={liveHelpSessionId}
            onClose={() => setLiveHelpSessionId(null)}
        />
      )}

      {collabRequestInfluencer && (
        <CollabRequestModal
          user={user}
          influencer={collabRequestInfluencer}
          onClose={() => setCollabRequestInfluencer(null)}
        />
      )}

      {viewingProfile && (
        <ProfileDetailDrawer
          profile={viewingProfile}
          onClose={() => setViewingProfile(null)}
          onSendMessage={handleSendMessageFromDrawer}
        />
      )}

      {platformSettings.isSocialMediaFabEnabled && (
        <SocialMediaFab links={platformSettings.socialMediaLinks} />
      )}

      <ActivityFeed 
        isOpen={isFeedOpen}
        onClose={() => setIsFeedOpen(false)}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onMarkAllAsRead={handleMarkAllAsRead}
      />
    </div>
  );
};

export default App;