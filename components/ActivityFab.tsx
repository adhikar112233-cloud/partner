import React from 'react';
import { NotificationIcon } from './Icons';

interface ActivityFabProps {
    unreadCount: number;
    onClick: () => void;
}

const ActivityFab: React.FC<ActivityFabProps> = ({ unreadCount, onClick }) => {
  return (
    <div className="fixed bottom-6 right-6 z-40">
        <button
            onClick={onClick}
            className="relative w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center transform hover:scale-105 transition-transform"
            aria-label="Open activity feed"
        >
            <NotificationIcon className="w-8 h-8" />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold ring-2 ring-white dark:ring-gray-950">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    </div>
  );
};

export default ActivityFab;