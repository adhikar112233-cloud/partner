import React from 'react';
import { User, View, PlatformSettings, UserRole, StaffPermission } from '../types';
import { LogoIcon, DashboardIcon, TrophyIcon, InfluencersIcon, MessagesIcon, LiveTvIcon, BannerAdsIcon, AdminIcon, SettingsIcon, SupportIcon, CommunityIcon, PaymentIcon, MembershipIcon, LogoutIcon, CollabIcon, RocketIcon, CheckBadgeIcon } from './Icons';
import { authService } from '../services/authService';

interface SidebarProps {
    user: User;
    activeView: View;
    setActiveView: (view: View) => void;
    userRole: UserRole;
    platformSettings: PlatformSettings;
    isOpen?: boolean;
    onClose?: () => void;
    isMobile?: boolean;
}

interface SidebarItem {
    view: View;
    label: string;
    icon: React.FC<{ className?: string }>;
    roles: UserRole[];
    requiredPermission?: StaffPermission;
}

const Sidebar: React.FC<SidebarProps> = ({ user, activeView, setActiveView, userRole, platformSettings, isOpen, onClose, isMobile }) => {
    
    const menuItems: SidebarItem[] = [
        { view: View.DASHBOARD, label: 'Dashboard', icon: DashboardIcon, roles: ['brand', 'influencer', 'livetv', 'banneragency', 'staff'] },
        { view: View.PROFILE, label: 'My Profile', icon: SettingsIcon, roles: ['brand', 'influencer', 'livetv', 'banneragency'] },
        
        // Brand specific
        { view: View.INFLUENCERS, label: 'Find Influencers', icon: InfluencersIcon, roles: ['brand'] },
        { view: View.CAMPAIGNS, label: 'My Campaigns', icon: RocketIcon, roles: ['brand'] },
        { view: View.DISCOVER_LIVETV, label: 'Book Live TV', icon: LiveTvIcon, roles: ['brand'] },
        { view: View.DISCOVER_BANNERADS, label: 'Book Banner Ads', icon: BannerAdsIcon, roles: ['brand'] },
        { view: View.COLLAB_REQUESTS, label: 'My Collabs', icon: CollabIcon, roles: ['brand'] }, // Mapped to MY_COLLABORATIONS in App.tsx logic
        { view: View.AD_BOOKINGS, label: 'Ad Bookings', icon: BannerAdsIcon, roles: ['brand'] },

        // Influencer specific
        { view: View.COLLAB_REQUESTS, label: 'Collab Requests', icon: CollabIcon, roles: ['influencer'] },
        { view: View.CAMPAIGNS, label: 'Find Campaigns', icon: RocketIcon, roles: ['influencer'] },
        { view: View.MY_APPLICATIONS, label: 'My Applications', icon: CheckBadgeIcon, roles: ['influencer'] },

        // Live TV specific
        { view: View.LIVETV, label: 'Ad Requests', icon: LiveTvIcon, roles: ['livetv'] },

        // Banner Agency specific
        { view: View.BANNERADS, label: 'Booking Requests', icon: BannerAdsIcon, roles: ['banneragency'] },

        // Common Financials
        { view: View.PAYMENT_HISTORY, label: 'Payment History', icon: PaymentIcon, roles: ['brand', 'influencer', 'livetv', 'banneragency'] },
        { view: View.MEMBERSHIP, label: 'Membership', icon: MembershipIcon, roles: ['brand', 'influencer', 'livetv', 'banneragency'] },

        // Community
        { view: View.COMMUNITY, label: 'Community', icon: CommunityIcon, roles: ['brand', 'influencer', 'livetv', 'banneragency', 'staff'] },

        // Support
        { view: View.SUPPORT, label: 'Help & Support', icon: SupportIcon, roles: ['brand', 'influencer', 'livetv', 'banneragency'] },

        // Staff
        { view: View.ADMIN, label: 'Admin Panel', icon: AdminIcon, roles: ['staff'] },
        { view: View.SETTINGS, label: 'Platform Settings', icon: SettingsIcon, roles: ['staff'], requiredPermission: 'super_admin' },
        { view: View.SUPPORT, label: 'Support Center', icon: SupportIcon, roles: ['staff'] },

        // Top 10 - Available for everyone
        { view: View.TOP_INFLUENCERS, label: 'Top 10 of 2025', icon: TrophyIcon, roles: ['brand', 'influencer', 'livetv', 'banneragency', 'staff'] },
    ];

    const filteredItems = menuItems.filter(item => {
        if (!item.roles.includes(userRole)) return false;
        if (item.requiredPermission && user.staffPermissions && !user.staffPermissions.includes(item.requiredPermission)) return false;
        // Adjust logic based on App.tsx view mapping if needed
        return true;
    });

    const handleLogout = async () => {
        await authService.logout();
    };

    const sidebarContent = (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between h-20 px-6 border-b border-gray-200 dark:border-gray-700">
                <LogoIcon className="h-10 w-auto" />
                {isMobile && (
                    <button onClick={onClose} className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto py-4">
                <nav className="px-4 space-y-1">
                    {filteredItems.map((item) => (
                        <button
                            key={item.label}
                            onClick={() => {
                                setActiveView(item.view);
                                if (isMobile && onClose) onClose();
                            }}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                                activeView === item.view
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                            }`}
                        >
                            <item.icon className={`mr-3 h-5 w-5 ${activeView === item.view ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                            {item.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                >
                    <LogoutIcon className="mr-3 h-5 w-5 text-red-500" />
                    Logout
                </button>
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <>
                <div 
                    className={`fixed inset-0 z-40 bg-gray-600 bg-opacity-75 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                    onClick={onClose}
                ></div>
                <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    {sidebarContent}
                </div>
            </>
        );
    }

    return (
        <div className="hidden md:flex md:flex-shrink-0">
            <div className="w-64 flex flex-col">
                {sidebarContent}
            </div>
        </div>
    );
};

export default Sidebar;
