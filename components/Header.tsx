
import React, { useState, useEffect, useRef } from 'react';
import { LogoIcon, MessagesIcon, YoutubeIcon, MenuIcon, SunIcon, MoonIcon, NotificationIcon, DashboardIcon, CommunityIcon, LoanRecharge3DIcon, EllipsisVerticalIcon } from './Icons';
import { User, View, PlatformSettings, ConversationParticipant, Conversation } from '../types';
import ConversationsPanel from './ConversationsPanel';
import { apiService } from '../services/apiService';

interface HeaderProps {
  user: User;
  activeView: View;
  setActiveView: (view: View) => void;
  platformSettings: PlatformSettings;
  onConversationSelected: (participant: ConversationParticipant) => void;
  onMobileNavToggle: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  unreadCount: number;
  onActivityFeedToggle: () => void;
  appMode: 'dashboard' | 'community';
  setAppMode: (mode: 'dashboard' | 'community') => void;
}

const Header: React.FC<HeaderProps> = ({ user, activeView, setActiveView, platformSettings, onConversationSelected, onMobileNavToggle, theme, setTheme, unreadCount, onActivityFeedToggle, appMode, setAppMode }) => {
  const [isConversationsOpen, setIsConversationsOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  const conversationsRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close Conversations Panel if clicked outside
      if (conversationsRef.current && !conversationsRef.current.contains(event.target as Node)) {
        setIsConversationsOpen(false);
      }
      // Close More Menu if clicked outside
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleConversationClick = (participant: ConversationParticipant) => {
    onConversationSelected(participant);
    setIsConversationsOpen(false);
  };

  const toggleConversations = async () => {
    if (!isConversationsOpen) {
      setIsLoadingConversations(true);
      setIsConversationsOpen(true);
      try {
        const convos = await apiService.getConversations(user.id);
        setConversations(convos);
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      } finally {
        setIsLoadingConversations(false);
      }
    } else {
      setIsConversationsOpen(false);
    }
  };

  const handleLoanRechargeClick = () => {
      if (platformSettings.loanAndRechargeUrl) {
          window.open(platformSettings.loanAndRechargeUrl, '_blank');
      } else {
          alert("Coming Soon");
      }
  };

  // Reusable toggle buttons component
  const ToggleButtons = ({ mobile = false }) => (
      <>
          <button
              onClick={() => {
                  setAppMode('dashboard');
                  setActiveView(View.DASHBOARD);
              }}
              className={`${mobile ? 'flex-1 justify-center' : 'px-4'} py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  appMode === 'dashboard'
                      ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
          >
              <DashboardIcon className="w-4 h-4" />
              <span>Dashboard</span>
          </button>
          <button
              onClick={() => {
                  setAppMode('community');
                  setActiveView(View.COMMUNITY);
              }}
              className={`${mobile ? 'flex-1 justify-center' : 'px-4'} py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  appMode === 'community'
                      ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
          >
              <CommunityIcon className="w-4 h-4" />
              <span>Community</span>
          </button>
      </>
  );

  return (
    <header className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 relative z-20 flex flex-col w-full shadow-sm">
      {/* Top Row: Navigation & Actions */}
      <div className="h-16 md:h-20 flex items-center justify-between px-2 sm:px-4 w-full relative">
          
          {/* LEFT: Menu & Logo */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <button
              onClick={onMobileNavToggle}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Open navigation menu"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            
            {/* Logo: Compact on Mobile, Full on Desktop */}
            <div className="flex items-center rounded-lg">
                <div className="block sm:hidden">
                    <LogoIcon iconOnly={true} className="h-8 w-auto" />
                </div>
                <div className="hidden sm:block">
                    <LogoIcon className="h-8 sm:h-10 w-auto" />
                </div>
            </div>
          </div>

          {/* CENTER: Toggle (Desktop Only) - Absolutely positioned to stay centered */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full p-1">
              <ToggleButtons />
          </div>

          {/* RIGHT: Actions (Visible on Top Bar) */}
          <div className="flex justify-end items-center gap-1">
             
             {/* Loan & Recharge (Always Visible) */}
             <button 
                onClick={handleLoanRechargeClick}
                className="p-1 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                title="Loan & Recharge"
             >
                 <LoanRecharge3DIcon className="h-8 w-auto sm:h-10 transform group-hover:scale-105 transition-transform" />
             </button>

             {/* Messages (Always Visible) */}
             <div className="relative" ref={conversationsRef}>
                <button 
                    onClick={toggleConversations} 
                    className={`p-2 rounded-full transition-colors relative ${isConversationsOpen ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                    title="Messages"
                >
                    <MessagesIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                {isConversationsOpen && (
                    <div className="absolute top-full right-0 mt-2 z-50 w-80 sm:right-0">
                        <ConversationsPanel
                            conversations={conversations}
                            isLoading={isLoadingConversations}
                            onSelect={handleConversationClick}
                        />
                    </div>
                )}
             </div>

             {/* Activity Feed (Always Visible) */}
             <button 
                onClick={onActivityFeedToggle} 
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors relative"
                title="Activity Feed"
             >
                <NotificationIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></span>
                )}
             </button>

             {/* Three Dot Menu (Always Visible) - Contains YouTube & Theme */}
             <div className="relative" ref={moreMenuRef}>
                 <button
                    onClick={() => setIsMoreMenuOpen(prev => !prev)}
                    className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                 >
                     <EllipsisVerticalIcon className="w-6 h-6" />
                 </button>
                 
                 {isMoreMenuOpen && (
                     <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-fade-in-down">
                         {/* YouTube */}
                         {platformSettings.youtubeTutorialUrl && (
                            <a 
                                href={platformSettings.youtubeTutorialUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                                onClick={() => setIsMoreMenuOpen(false)}
                            >
                                <YoutubeIcon className="w-5 h-5 mr-3 text-red-600" />
                                Tutorials
                            </a>
                         )}
                         {/* Theme */}
                         <button 
                            onClick={() => { setTheme(theme === 'light' ? 'dark' : 'light'); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                         >
                            {theme === 'light' ? (
                                <>
                                    <MoonIcon className="w-5 h-5 mr-3 text-gray-600" /> Dark Mode
                                </>
                            ) : (
                                <>
                                    <SunIcon className="w-5 h-5 mr-3 text-yellow-500" /> Light Mode
                                </>
                            )}
                         </button>
                     </div>
                 )}
             </div>

          </div>
      </div>

      {/* Bottom Row: Toggle (Mobile Only) */}
      <div className="md:hidden px-3 pb-3 w-full">
         <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-full shadow-inner">
             <ToggleButtons mobile={true} />
         </div>
      </div>

    </header>
  );
};

export default Header;
