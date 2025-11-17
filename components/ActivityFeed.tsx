import React from 'react';
import { AppNotification } from '../types';
import { CollabIcon, MessagesIcon } from './Icons';

const formatTimeAgo = (timestamp: any) => {
    if (!timestamp?.toDate) return 'Just now';
    const date = timestamp.toDate();
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)}y ago`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)}mo ago`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)}d ago`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)}h ago`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)}m ago`;
    return 'Just now';
};

const NotificationIcon: React.FC<{ type: AppNotification['type'] }> = ({ type }) => {
    const className = "w-6 h-6 text-white";
    switch (type) {
        case 'new_collab_request':
        case 'collab_update':
        case 'work_submitted':
        case 'collab_completed':
            return <div className="p-2 bg-indigo-500 rounded-full"><CollabIcon className={className} /></div>;
        case 'new_campaign_applicant':
        case 'application_update':
            return <div className="p-2 bg-teal-500 rounded-full"><CollabIcon className={className} /></div>;
        case 'new_message':
             return <div className="p-2 bg-blue-500 rounded-full"><MessagesIcon className={className} /></div>;
        default:
            return <div className="p-2 bg-gray-500 rounded-full"><CollabIcon className={className} /></div>;
    }
}

interface ActivityFeedProps {
  notifications: AppNotification[];
  isOpen: boolean;
  onClose: () => void;
  onNotificationClick: (notification: AppNotification) => void;
  onMarkAllAsRead: () => void;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ notifications, isOpen, onClose, onNotificationClick, onMarkAllAsRead }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <>
        <div 
            className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity" 
            onClick={onClose}
            aria-hidden="true"
        ></div>
        <div className="fixed top-20 right-6 w-96 max-h-[calc(100vh-10rem)] bg-white dark:bg-gray-800 rounded-lg shadow-2xl z-50 flex flex-col animate-fade-in-down">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Activity Feed</h3>
                <button onClick={onMarkAllAsRead} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Mark all as read</button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 p-8">No new activity.</p>
                ) : (
                    <ul>
                        {notifications.map(notif => (
                            <li key={notif.id} className={`${!notif.isRead ? 'bg-indigo-50 dark:bg-gray-700/50' : ''}`}>
                                <button onClick={() => onNotificationClick(notif)} className="w-full text-left p-4 flex items-start gap-4 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <NotificationIcon type={notif.type} />
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{notif.title}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">{notif.body}</p>
                                        <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(notif.timestamp)}</p>
                                    </div>
                                    {!notif.isRead && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></div>}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    </>
  );
};

export default ActivityFeed;