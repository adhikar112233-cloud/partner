



import React, { useState, useEffect, useRef } from 'react';
import { View, User, UserRole, PlatformSettings } from '../types';
import { LogoIcon, DashboardIcon, InfluencersIcon, MessagesIcon, LiveTvIcon, BannerAdsIcon, AdminIcon, ProfileIcon, CollabIcon, AudioIcon as CampaignIcon, DocumentIcon as ApplicationsIcon, CommunityIcon, SupportIcon, PaymentIcon, MembershipIcon, SettingsIcon, RocketIcon, LogoutIcon, ChevronDownIcon, GlobeIcon, DocumentIcon, UserGroupIcon, TrophyIcon, MoonIcon, SunIcon, ShoppingBagIcon, AcademicCapIcon } from './Icons';
import { authService } from '../services/authService';
import FollowListModal from './FollowListModal';

interface SidebarProps {
  user: User;
  activeView: View;
  setActiveView: (view: View) => void;
  userRole: UserRole;
  platformSettings: PlatformSettings;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  appMode?: 'dashboard' | 'community';
  communityFeedFilter?: 'global' | 'my_posts' | 'following';
  setCommunityFeedFilter?: (filter: 'global' | 'my_posts' | 'following') => void;
  onToggleFollow?: (targetId: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const MembershipStatusCard: React.FC<{ user: User; onClick: () => void }> = ({ user, onClick }) => {
    const planName = (user.membership?.plan || 'free').replace(/_/g, ' ').replace('normal ', '');
    const isPro = user.membership?.isActive && user.membership.plan !== 'free';
  
    return (
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button 
            onClick={onClick} 
            className="w-full p-4 bg-slate-100 dark:bg-gray-700/50 rounded-lg text-left hover:bg-slate-200 dark:hover:bg-gray-600/60 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Manage your membership plan"
        >
          <div className="flex items-center space-x-3">
            <MembershipIcon className="w-8 h-8 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Current Plan</p>
              <p className="font-bold text-gray-800 dark:text-white capitalize">{planName}</p>
            </div>
          </div>
          <div className={`mt-3 w-full text-center px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
            isPro
              ? 'bg-indigo-500 text-white hover:bg-indigo-600'
              : 'bg-teal-500 text-white hover:bg-teal-600'
          }`}>
            {isPro ? 'Manage Plan' : 'Upgrade Plan'}
          </div>
        </button>
      </div>
    );
  };

const Sidebar: React.FC<SidebarProps> = ({ user, activeView, setActiveView, userRole, platformSettings, isMobile = false, isOpen = false, onClose = () => {}, appMode = 'dashboard', communityFeedFilter, setCommunityFeedFilter, onToggleFollow, theme, setTheme }) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [followModalType, setFollowModalType] = useState<'followers' | 'following' | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
              setIsProfileMenuOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
          document.removeEventListener("mousedown", handleClickOutside);
      };
  }, []);

  const allNavItems = [
    // User's Profile (Handled separately now)
    { view: View.PROFILE, label: 'My Account', icon: ProfileIcon, roles: ['brand', 'influencer', 'banneragency', 'livetv', 'staff'] },
    
    // Dashboard first for all primary roles including LiveTV
    { view: View.DASHBOARD, label: 'Dashboard', icon: DashboardIcon, roles: ['brand', 'influencer', 'banneragency', 'livetv'] },
    
    // LIVETV role specific action
    { view: View.LIVETV, label: 'Collaboration Status', icon: CollabIcon, roles: ['livetv'] },
    
    // Other Roles (moved up)
    { view: View.BANNERADS, label: 'My Banner Ads', icon: BannerAdsIcon, roles: ['banneragency'] },

    // Top 10 Leaderboard (Visible to all)
    { view: View.LEADERBOARD, label: 'Top 10 Board', icon: TrophyIcon, roles: ['brand', 'influencer', 'banneragency', 'livetv'] },

    // Payment History for non-brands
    { view: View.PAYMENT_HISTORY, label: 'Payment History', icon: PaymentIcon, roles: ['livetv', 'banneragency']},
    
    // Brand - Discovery (Moved Up)
    { view: View.INFLUENCERS, label: 'Find Influencers', icon: InfluencersIcon, roles: ['brand'] },
    { view: View.DISCOVER_LIVETV, label: 'Book Live TV Ads', icon: LiveTvIcon, roles: ['brand'] },
    { view: View.DISCOVER_BANNERADS, label: 'Book Banner Ads', icon: BannerAdsIcon, roles: ['brand'] },

    // Community for non-brands
    ...(platformSettings.isCommunityFeedEnabled ? [{ view: View.COMMUNITY, label: 'Community', icon: CommunityIcon, roles: ['livetv', 'banneragency', 'staff'] }] : []),
    
    // Brand - Management (Moved Down)
    { view: View.CAMPAIGNS, label: 'My Campaigns', icon: CampaignIcon, roles: ['brand'] },
    { view: View.MY_COLLABORATIONS, label: 'Direct Collaborations', icon: CollabIcon, roles: ['brand'] },
    { view: View.AD_BOOKINGS, label: 'My Ad Bookings', icon: BannerAdsIcon, roles: ['brand'] },
    
    // Influencer
    { view: View.CAMPAIGNS, label: 'Discover Campaigns', icon: CampaignIcon, roles: ['influencer'] },
    { view: View.MY_APPLICATIONS, label: 'My Applications', icon: ApplicationsIcon, roles: ['influencer'] },
    { view: View.COLLAB_REQUESTS, label: 'Direct Requests', icon: CollabIcon, roles: ['influencer'] },
    { view: View.BOOST_PROFILE, label: 'Boost Profile', icon: RocketIcon, roles: ['influencer', 'livetv', 'banneragency'] },
    
    // Shopping Link (All standard users)
    { view: View.SHOPPING, label: 'Shopping', icon: ShoppingBagIcon, roles: ['brand', 'influencer', 'livetv', 'banneragency'] },

    // Training (All standard users)
    { view: View.TRAINING, label: 'Training Center', icon: AcademicCapIcon, roles: ['brand', 'influencer', 'livetv', 'banneragency'] },

    // Staff
    { view: View.ADMIN, label: 'Admin Panel', icon: AdminIcon, roles: ['staff'] },
    { view: View.SETTINGS, label: 'Settings', icon: SettingsIcon, roles: ['staff'], requiredPermission: 'super_admin' },

    // ITEMS MOVED TO BOTTOM FOR BRAND ROLE
    { view: View.PAYMENT_HISTORY, label: 'Payment History', icon: PaymentIcon, roles: ['brand']},
    ...(platformSettings.isCommunityFeedEnabled ? [{ view: View.COMMUNITY, label: 'Community', icon: CommunityIcon, roles: ['brand'] }] : []),

    // ITEMS MOVED TO BOTTOM FOR INFLUENCER ROLE
    { view: View.PAYMENT_HISTORY, label: 'Payment History', icon: PaymentIcon, roles: ['influencer']},
    ...(platformSettings.isCommunityFeedEnabled ? [{ view: View.COMMUNITY, label: 'Community', icon: CommunityIcon, roles: ['influencer'] }] : []),

    // Help & Support (Moved from Header to Sidebar for ALL roles)
    { view: View.SUPPORT, label: 'Help & Support', icon: SupportIcon, roles: ['brand', 'influencer', 'livetv', 'banneragency', 'staff'] },
  ];

  const hasPermission = (permission: string) => {
      if (user.role !== 'staff') return false;
      return user.staffPermissions?.includes('super_admin') || user.staffPermissions?.includes(permission as any);
  };

  let displayNavItems: any[] = [];

  if (appMode === 'community') {
      displayNavItems = [
          { view: View.PROFILE, label: 'My Account', icon: ProfileIcon },
          { view: View.COMMUNITY, label: 'Global Feed', icon: GlobeIcon, filter: 'global' },
          { view: View.COMMUNITY, label: 'Following', icon: UserGroupIcon, filter: 'following' },
          { view: View.COMMUNITY, label: 'My Posts', icon: DocumentIcon, filter: 'my_posts' },
          { view: View.SUPPORT, label: 'Help & Support', icon: SupportIcon } // Also add Help here
      ];
  } else {
      displayNavItems = allNavItems.filter(item => {
        if (item.view === View.COMMUNITY) return false; // Hide generic community button in dashboard mode if it was there
        if (!item.roles.includes(userRole)) return false;
        if (item.requiredPermission && !hasPermission(item.requiredPermission)) return false;
        return true;
      });
  }

  const handleItemClick = (view: View, filter?: 'global' | 'my_posts' | 'following') => {
    if (view === View.SHOPPING) {
        const url = platformSettings.shoppingUrl;
        if (url) {
            window.open(url, '_blank');
        } else {
            alert("No shopping store link configured yet.");
        }
        if (isMobile) onClose();
        return;
    }

    setActiveView(view);
    if (filter && setCommunityFeedFilter) {
        setCommunityFeedFilter(filter);
    }
    setIsProfileMenuOpen(false);
    if (isMobile) {
      onClose();
    }
  };

  const handleLogoClick = () => {
    setActiveView(View.PARTNERS);
    if (isMobile) {
        onClose();
    }
  };

  const navButtons = displayNavItems.map(item => {
    if (item.view === View.PROFILE) {
        return (
            <div key="profile-menu" className="relative" ref={profileMenuRef}>
                <button
                    onClick={() => setIsProfileMenuOpen(prev => !prev)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                        isProfileMenuOpen || activeView === View.PROFILE || activeView === View.SETTINGS
                            ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                    }`}
                >
                    <div className="flex items-center">
                        <item.icon className="w-6 h-6 mr-3" />
                        <span>{item.label}</span>
                    </div>
                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isProfileMenuOpen && (
                    <div className="mt-2 pl-6 space-y-1 animate-fade-in-down">
                        <button onClick={() => handleItemClick(View.PROFILE)} className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">My Profile</button>
                        {(user.role !== 'staff' || (user.staffPermissions && user.staffPermissions.includes('super_admin'))) &&
                            <button onClick={() => handleItemClick(View.SETTINGS)} className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">Settings</button>
                        }
                        
                        <button onClick={() => authService.logout()} className="w-full flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md">
                            <LogoutIcon className="w-5 h-5 mr-2"/>
                            Logout
                        </button>
                    </div>
                )}
            </div>
        );
    }
      const isActive = activeView === item.view && (!item.filter || item.filter === communityFeedFilter);
      return (
        <button
          key={`${item.view}-${item.label}`}
          onClick={() => handleItemClick(item.view, item.filter)}
          className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
            isActive
              ? 'bg-gradient-to-r from-teal-400 to-indigo-600 text-white shadow-lg'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
          }`}
        >
          <item.icon className="w-6 h-6 mr-3" />
          <span>{item.label}</span>
        </button>
      );
    });
  
  const isCreator = ['influencer', 'livetv', 'banneragency'].includes(user.role);
  // Hide membership card in community mode
  const showMembershipCard = appMode === 'community' ? false : (isCreator ? platformSettings.isCreatorMembershipEnabled : platformSettings.isProMembershipEnabled);

  const renderContent = () => (
      <>
        <div className="h-20 flex items-center px-6">
            <button onClick={handleLogoClick} className="focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg">
                <LogoIcon idSuffix={isMobile ? "sidebar-mobile" : "sidebar-desktop"} />
            </button>
        </div>
        
        {/* Follow Stats for Community Mode */}
        {appMode === 'community' && (
            <div className="px-6 pb-2 mb-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                    <button onClick={() => setFollowModalType('followers')} className="text-center hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg flex-1">
                        <span className="block font-bold text-lg text-gray-800 dark:text-white">{user.followers?.length || 0}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Followers</span>
                    </button>
                    <button onClick={() => setFollowModalType('following')} className="text-center hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg flex-1">
                        <span className="block font-bold text-lg text-gray-800 dark:text-white">{user.following?.length || 0}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Following</span>
                    </button>
                </div>
            </div>
        )}

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            {/* Theme Toggle (Moved from My Account dropdown to Top Level) */}
            <button 
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
                className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white transition-colors duration-200"
            >
                {theme === 'light' ? (
                    <>
                        <MoonIcon className="w-6 h-6 mr-3" /> <span>Dark Mode</span>
                    </>
                ) : (
                    <>
                        <SunIcon className="w-6 h-6 mr-3 text-yellow-500" /> <span>Light Mode</span>
                    </>
                )}
            </button>

            {navButtons}
        </nav>
        {showMembershipCard && <MembershipStatusCard user={user} onClick={() => handleItemClick(View.MEMBERSHIP)} />}
      </>
  );

  return (
    <>
      {isMobile ? (
        <>
          {/* Overlay */}
          <div 
            className={`fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
            aria-hidden="true"
          ></div>
          {/* Sidebar */}
          <aside 
            className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-40 transform transition-transform md:hidden dark:bg-gray-800 dark:border-gray-700 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            {renderContent()}
          </aside>
        </>
      ) : (
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 hidden md:flex flex-col dark:bg-gray-800 dark:border-gray-700">
          {renderContent()}
        </aside>
      )}

      {followModalType && onToggleFollow && (
          <FollowListModal 
              title={followModalType === 'followers' ? 'Followers' : 'Following'}
              userIds={followModalType === 'followers' ? (user.followers || []) : (user.following || [])}
              currentUser={user}
              onClose={() => setFollowModalType(null)}
              onToggleFollow={onToggleFollow}
          />
      )}
    </>
  );
};

export default Sidebar;