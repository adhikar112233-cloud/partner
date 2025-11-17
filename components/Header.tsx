import React, { useState, useEffect, useRef } from 'react';
import { LogoIcon, MessagesIcon, SupportIcon, YoutubeIcon, MenuIcon, SunIcon, MoonIcon, NotificationIcon } from './Icons';
import { User, View, PlatformSettings, Influencer, Conversation, ConversationParticipant } from '../types';
import ConversationsPanel from './ConversationsPanel';
import { apiService } from '../services/apiService';

interface HeaderProps {
  user: User;
  setActiveView: (view: View) => void;
  platformSettings: PlatformSettings;
  onConversationSelected: (participant: ConversationParticipant) => void;
  onMobileNavToggle: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  unreadCount: number;
  onActivityFeedToggle: () => void;
}

const DEFAULT_AVATAR_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDRjMCAwIDAtMSAwLTJoMTJ2Mmg0di00YzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==';

const Header: React.FC<HeaderProps> = ({ user, setActiveView, platformSettings, onConversationSelected, onMobileNavToggle, theme, setTheme, unreadCount, onActivityFeedToggle }) => {
  const [isConversationsOpen, setIsConversationsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  const conversationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (conversationsRef.current && !conversationsRef.current.contains(event.target as Node)) {
        setIsConversationsOpen(false);
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


  return (
    <header className="h-16 md:h-20 bg-white border-b border-gray-200 flex items-center px-2 sm:px-4 dark:bg-gray-800 dark:border-gray-700 relative z-20">
      {/* LEFT SECTION */}
      <div className="flex items-center justify-start gap-2 flex-1">
        <button
          onClick={onMobileNavToggle}
          className="p-1 rounded-md text-gray-500 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Open navigation menu"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <button onClick={() => setActiveView(View.PARTNERS)} className="flex items-center md:hidden focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg">
           <LogoIcon className="h-8 w-auto" />
        </button>
      </div>

      {/* RIGHT SECTION: All Icons */}
      <div className="flex justify-end items-center gap-0 md:gap-1">
         {platformSettings.youtubeTutorialUrl && (
            <a
              href={platformSettings.youtubeTutorialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="View Tutorials on YouTube"
              title="Tutorials & Updates"
            >
              <YoutubeIcon className="w-5 h-5" />
            </a>
          )}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Toggle theme"
            title="Toggle theme"
          >
              {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
          </button>
         <button
            onClick={() => setActiveView(View.SUPPORT)}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Live Help"
            title="Live Help"
          >
            <SupportIcon className="w-5 h-5" />
          </button>

        <div className="relative" ref={conversationsRef}>
          <button
            onClick={toggleConversations}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="View conversations"
            title="Conversations"
          >
            <MessagesIcon className="w-5 h-5" />
          </button>
          {isConversationsOpen && (
            <div className="absolute top-full mt-2 z-50 transform -translate-x-1/2 left-1/2">
             <ConversationsPanel
              conversations={conversations}
              isLoading={isLoadingConversations}
              onSelect={handleConversationClick}
            />
            </div>
          )}
        </div>
        
        <button
          onClick={onActivityFeedToggle}
          className="relative p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="View activity feed"
          title="Activity Feed"
        >
          <NotificationIcon className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white dark:ring-gray-800">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

    </header>
  );
};

export default Header;