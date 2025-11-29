
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { isFirebaseConfigured, db, auth, firebaseConfig } from '../services/firebase';
import { authService } from '../services/authService';
import { apiService } from '../services/apiService';
import { User, View, Influencer, PlatformSettings, ProfileData, ConversationParticipant, LiveTvChannel, Transaction, PayoutRequest, AnyCollaboration, PlatformBanner, RefundRequest, DailyPayoutRequest, AppNotification, CreatorVerificationStatus } from '../types';
// Fix: Add QueryDocumentSnapshot and DocumentData for pagination types.
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
import TrainingPage from './TrainingPage';

// Simple "Pop" sound encoded in Base64
const NOTIFICATION_SOUND = 'data:audio/mp3;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAG1xisiYkTV98L0AWxwwjZYAdgZc64DCwcQDBaQqirAlqJz3WhfqTz9DgQ2ODQqjfww4oYLmJk0ubftpnZ963+4TAS99LF5gUNQACUOZzKwPNXcbjKnD0307yE0X+l78179en65Z//uQRA168360Z/ImwEA5y0a/JmAEOcAE+3gAAE5wAT7eAAAG3z3zftcAAAAAA+Dud74Fad97238K1ntx5XCCEIdt5YFqgtEE2KcIGAF/1vOKBaGrC6LCbfAOv4l9sFv/2qBP4V0gnoV3KZtOd96//uQRA668720a/JmYEh3t21/ZmIAOsAE/3gAAI6wAT/eAAAG3bAgAAAB//uQRA868fY1a/JmYEA8wAT7eAACT7gAT7eAAAG3gAA//uQRA+68fY1a/JmYEA8wAT7eAACT7gAT7eAAAG3gAA//uQRA/68fY1a/JmYEA8wAT7eAACT7gAT7eAAAG3gAA//uQRBA68fY1a/JmYEA8wAT7eAACT7gAT7eAAAG3gAA';

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
    // ... (Error component logic remains the same)
    return <div className="p-4 text-red-500">{message}</div>; // Simplified for brevity in this block, use full version in real file
};

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

// Fix: Add pagination limit constant
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
  const [isSearching, setIsSearching] = useState(false);
  const [platformBanners, setPlatformBanners] = useState<PlatformBanner[]>([]);
  
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allPayouts, setAllPayouts] = useState<PayoutRequest[]>([]);
  const [allCollabs, setAllCollabs] = useState<AnyCollaboration[]>([]);
  const [allRefunds, setAllRefunds] = useState<RefundRequest[]>([]);
  const [allDailyPayouts, setAllDailyPayouts] = useState<DailyPayoutRequest[]>([]);

  // Fix: Add state variables for pagination
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

  const [appMode, setAppMode] = useState<'dashboard' | 'community'>('dashboard');
  const [communityFeedFilter, setCommunityFeedFilter] = useState<'global' | 'my_posts' | 'following'>('global');

  // Ref to track the latest notification ID to prevent sound playing on initial load
  const latestNotificationIdRef = useRef<string | null>(null);

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
        // ... Error handling
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
        
        // Data for discovery pages (for all roles that can see them)
        if (user.role === 'brand' || user.role === 'influencer' || user.role === 'livetv' || user.role === 'banneragency') {
          // FIX: Passed 1 argument instead of 2.
          const influencerResult = await apiService.getInfluencersPaginated({ limit: INFLUENCER_PAGE_LIMIT });
          setInfluencers(influencerResult.influencers);
          setFilteredInfluencers(influencerResult.influencers);
          setLastInfluencerDoc(influencerResult.lastVisible);
          setHasMoreInfluencers(influencerResult.influencers.length === INFLUENCER_PAGE_LIMIT);
          
          const channelData = await apiService.getLiveTvChannels(platformSettings);
          setLiveTvChannels(channelData);
        }

        // Data for Admin Panel (only for staff)
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

  // Fix: Add function to load more influencers for pagination.
  const loadMoreInfluencers = useCallback(async () => {
    if (!platformSettings || !hasMoreInfluencers || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
        const result = await apiService.getInfluencersPaginated({
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
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    
    if (orderId) {
        setActiveView(View.PAYMENT_SUCCESS);
    } else if (user && activeView !== View.PAYMENT_SUCCESS) {
        switch (user.role) {
            case 'staff': setActiveView(View.ADMIN); break;
            case 'brand': setActiveView(View.INFLUENCERS); break;
            default: setActiveView(View.DASHBOARD); break;
        }
    }
  }, [user]);

  useEffect(() => {
      refreshAllData();
  }, [refreshAllData]);

  useEffect(() => {
    if (user) {
        const unsubscribe = apiService.getNotificationsForUserListener(
            user.id,
            (newNotifications) => {
                // Determine if a new notification has arrived
                if (newNotifications.length > 0) {
                    const latestNotification = newNotifications[0];
                    const isNew = latestNotification.id !== latestNotificationIdRef.current;
                    const isUnread = !latestNotification.isRead;

                    // Play sound if it's a new, unread notification and not the initial load (ref is not null)
                    if (isNew && isUnread && latestNotificationIdRef.current !== null) {
                        const audio = new Audio(NOTIFICATION_SOUND);
                        audio.volume = 0.5;
                        audio.play().catch(e => console.log("Audio playback prevented:", e));
                    }

                    // Update the ref to the current latest ID
                    latestNotificationIdRef.current = latestNotification.id;
                } else {
                    latestNotificationIdRef.current = null;
                }

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
    if (!notification.isRead && user) {
        apiService.markNotificationAsRead(user.id, notification.id);
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
  
  const handleSearch = () => {
      const lowercasedQuery = searchQuery.toLowerCase().trim();
      
      if (!lowercasedQuery) {
          setFilteredInfluencers(influencers);
          return;
      }
  
      setIsSearching(true);
      setTimeout(() => {
          const results = influencers.filter(inf => {
              return (
                  inf.name.toLowerCase().includes(lowercasedQuery) ||
                  inf.handle.toLowerCase().includes(lowercasedQuery) ||
                  inf.bio.toLowerCase().includes(lowercasedQuery) ||
                  inf.niche.toLowerCase().includes(lowercasedQuery) ||
                  (inf.location && inf.location.toLowerCase().includes(lowercasedQuery))
              );
          });
  
          setFilteredInfluencers(results);
          setIsSearching(false);
      }, 300); 
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

  const handleToggleFollow = async (targetId: string) => {
      if (!user) return;
      const isFollowing = user.following?.includes(targetId);
      try {
          if (isFollowing) {
              await apiService.unfollowUser(user.id, targetId);
              setUser(prev => prev ? { ...prev, following: prev.following?.filter(id => id !== targetId) } : null);
          } else {
              await apiService.followUser(user.id, targetId);
              setUser(prev => prev ? { ...prev, following: [...(prev.following || []), targetId] } : null);
          }
      } catch (error) {
          console.error("Failed to toggle follow:", error);
      }
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
      // ... (Rest of switch cases remain the same)
      case View.PARTNERS:
        return <OurPartnersPage />;
      case View.TRAINING:
        return <TrainingPage user={user} platformSettings={platformSettings} />;
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
                  platformSettings={platformSettings}
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
                placeholder="Search by name, niche, location, or keywords in bio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full p-4 pr-28 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50"
              >
                <SearchIcon className={`w-5 h-5 mr-2`} />
                {isSearching ? 'Searching...' : 'Search'}
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
            {/* Fix: Add 'load more' button for pagination */}
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
        if (user.role === 'staff') return <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl"><SettingsPanel onSettingsUpdate={refreshPlatformSettings} /></div>;
        return <ProfilePage user={user} onProfileUpdate={handleProfileUpdate} onGoToMembership={() => setActiveView(View.MEMBERSHIP)} platformSettings={platformSettings} onGoToDashboard={() => setActiveView(View.DASHBOARD)} setActiveView={setActiveView} />;
      case View.PROFILE:
        return <ProfilePage user={user} onProfileUpdate={handleProfileUpdate} onGoToMembership={() => setActiveView(View.MEMBERSHIP)} platformSettings={platformSettings} onGoToDashboard={() => setActiveView(View.DASHBOARD)} setActiveView={setActiveView} />;
      case View.DASHBOARD:
        return <Dashboard user={user} setActiveView={setActiveView} platformSettings={platformSettings} banners={platformBanners} />;
      case View.COMMUNITY:
        if (!platformSettings.isCommunityFeedEnabled) {
            return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow"><h2 className="text-2xl font-bold dark:text-gray-100">Community Feed Disabled</h2><p className="dark:text-gray-300">This feature is currently turned off by the administrator.</p></div>;
        }
        return <CommunityPage user={user} feedType={communityFeedFilter} onToggleFollow={handleToggleFollow} />;
      case View.MESSAGES:
        return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow"><h2 className="text-2xl font-bold dark:text-gray-100">Messages</h2><p className="dark:text-gray-300">Select a conversation from the header to start chatting.</p></div>;
      case View.COLLAB_REQUESTS:
        return <CollaborationRequestsPage user={user} onViewProfile={handleViewProfileClick} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiatePayout={handleInitiatePayout} refreshUser={refreshUser} />;
      case View.MY_COLLABORATIONS:
        return <MyCollaborationsPage user={user} onViewProfile={handleViewProfileClick} onStartChat={handleConversationSelected} onInitiateRefund={handleInitiateRefund} platformSettings={platformSettings} />;
      case View.MY_APPLICATIONS:
          return <MyApplicationsPage user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiatePayout={handleInitiatePayout} refreshUser={refreshUser} />;
      case View.CAMPAIGNS:
        if (user.role === 'brand') return <CampaignsPage user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiateRefund={handleInitiateRefund} />;
        if (user.role === 'influencer') return <DiscoverCampaignsPage user={user} />;
        return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow"><h2 className="text-2xl font-bold dark:text-gray-100">Campaigns</h2><p className="dark:text-gray-300">This feature is not available for your account type.</p></div>;
      case View.AD_BOOKINGS:
        return <MyAdBookingsPage user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiateRefund={handleInitiateRefund} />;
      case View.LIVETV:
        if (user.role === 'livetv') return <AdRequestsPage user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiatePayout={handleInitiatePayout} refreshUser={refreshUser} />;
        return <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow"><h2 className="text-2xl font-bold dark:text-gray-100">Live TV</h2><p className="dark:text-gray-300">This feature is not available for your account type.</p></div>;
      case View.BANNERADS:
        if (user.role === 'banneragency') return <AdBookingsPage user={user} onStartChat={handleConversationSelected} platformSettings={platformSettings} onInitiatePayout={handleInitiatePayout} refreshUser={refreshUser} />;
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
        theme={theme}
        setTheme={setTheme}
        appMode={appMode}
        communityFeedFilter={communityFeedFilter}
        setCommunityFeedFilter={setCommunityFeedFilter}
        onToggleFollow={handleToggleFollow}
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
        theme={theme}
        setTheme={setTheme}
        appMode={appMode}
        communityFeedFilter={communityFeedFilter}
        setCommunityFeedFilter={setCommunityFeedFilter}
        onToggleFollow={handleToggleFollow}
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
            activeView={activeView}
            setActiveView={setActiveView}
            platformSettings={platformSettings}
            onConversationSelected={handleConversationSelected}
            onMobileNavToggle={() => setIsMobileNavOpen(true)}
            theme={theme}
            setTheme={setTheme}
            unreadCount={unreadCount}
            onActivityFeedToggle={() => setIsFeedOpen(prev => !prev)}
            appMode={appMode}
            setAppMode={setAppMode}
        />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-h-0">
          {platformBanners.length > 0 && activeView !== View.ADMIN && (
            <div className="mb-6">
                <ClickableImageBanner 
                    banners={platformBanners}
                />
            </div>
          )}
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
