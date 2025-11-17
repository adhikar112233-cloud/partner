

import React, { useState, useMemo, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { User, UserRole, PlatformSettings } from '../types';

interface MarketingPanelProps {
    allUsers: User[];
    platformSettings: PlatformSettings;
    onUpdate: () => void;
}

const ConfirmationModal: React.FC<{
    count: number;
    target: string;
    onConfirm: () => void;
    onCancel: () => void;
    isSending: boolean;
    type: 'Email' | 'Notification';
}> = ({ count, target, onConfirm, onCancel, isSending, type }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Confirm Bulk {type}</h3>
            <p className="my-4 text-gray-600 dark:text-gray-300">
                Are you sure you want to send this {type.toLowerCase()} to <strong>{count} {target}(s)</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4 mt-6">
                <button 
                    onClick={onCancel} 
                    disabled={isSending}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                >
                    Cancel
                </button>
                <button 
                    onClick={onConfirm} 
                    disabled={isSending} 
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                    {isSending ? 'Sending...' : 'Confirm & Send'}
                </button>
            </div>
        </div>
    </div>
);

const MarketingPanel: React.FC<MarketingPanelProps> = ({ allUsers }) => {
    const [mainTab, setMainTab] = useState<'push' | 'email'>('push');
    
    // Push Notification State
    const [pushTitle, setPushTitle] = useState('');
    const [pushBody, setPushBody] = useState('');
    const [pushUrl, setPushUrl] = useState('');
    const [pushTargetRole, setPushTargetRole] = useState<UserRole | 'all'>('all');

    // Email State
    const [activeEmailTab, setActiveEmailTab] = useState<UserRole>('influencer');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    
    // General State
    const [isSending, setIsSending] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [showConfirmation, setShowConfirmation] = useState<false | 'email' | 'push'>(false);

    const userCounts = useMemo(() => {
        return allUsers.reduce((acc, user) => {
            if (user.role) {
                acc[user.role] = (acc[user.role] || 0) + 1;
            }
            return acc;
        }, {} as Record<UserRole, number>);
    }, [allUsers]);

    const pushAudienceCount = useMemo(() => {
        if (pushTargetRole === 'all') {
            // 'all' means all non-staff users
            return Object.entries(userCounts).reduce((acc, [role, count]) => {
                if (role !== 'staff') {
                    // FIX: Explicitly convert `count` to a number to prevent a type error with the '+' operator.
                    return acc + Number(count);
                }
                return acc;
            }, 0);
        }
        return userCounts[pushTargetRole] || 0;
    }, [userCounts, pushTargetRole]);

    const executeSend = async () => {
        if (showConfirmation === 'email') {
            await executeSendEmail();
        } else if (showConfirmation === 'push') {
            await executeSendPush();
        }
    };

    const executeSendEmail = async () => {
        if (!emailSubject || !emailBody) {
            setFeedback({ type: 'error', message: 'Subject and Body are required.' });
            return;
        }
        setIsSending(true);
        setShowConfirmation(false);
        try {
            await apiService.sendBulkEmail(activeEmailTab, emailSubject, emailBody);
            setFeedback({ type: 'success', message: `Email for ${activeEmailTab}s has been queued.` });
            setEmailSubject('');
            setEmailBody('');
        } catch (error) {
            setFeedback({ type: 'error', message: 'Failed to queue email.' });
        } finally {
            setIsSending(false);
        }
    };

    const executeSendPush = async () => {
        if (!pushTitle || !pushBody) {
            setFeedback({ type: 'error', message: 'Title and Body are required for notifications.' });
            return;
        }
        setIsSending(true);
        setShowConfirmation(false);
        try {
            await apiService.sendPushNotification(pushTitle, pushBody, pushTargetRole, pushUrl || undefined);
            const targetText = pushTargetRole === 'all' ? 'user(s)' : `${pushTargetRole}(s)`;
            setFeedback({ type: 'success', message: `Push notification has been queued to ${pushAudienceCount} ${targetText}.` });
            setPushTitle('');
            setPushBody('');
            setPushUrl('');
        } catch (error) {
            setFeedback({ type: 'error', message: 'Failed to queue push notification.' });
        } finally {
            setIsSending(false);
        }
    };

    const emailTabs: { role: UserRole; name: string }[] = [
        { role: 'influencer', name: 'Influencers' },
        { role: 'brand', name: 'Brands' },
        { role: 'livetv', name: 'Live TV' },
        { role: 'banneragency', name: 'Banner Agencies' },
    ];
    
    const currentAudienceCount = userCounts[activeEmailTab] || 0;

    return (
        <div className="p-6 bg-gray-50 h-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Marketing Tools</h2>
            
            <div className="flex border-b border-gray-200 mb-6">
                <button onClick={() => setMainTab('push')} className={`px-4 py-2 font-medium text-sm ${mainTab === 'push' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}>Push Notifications</button>
                <button onClick={() => setMainTab('email')} className={`px-4 py-2 font-medium text-sm ${mainTab === 'email' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}>Bulk Email</button>
            </div>

            {feedback && (
                <div className={`p-3 rounded-lg mb-4 text-white text-sm ${feedback.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {feedback.message}
                </div>
            )}

            {mainTab === 'push' && (
                <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Send a Push Notification</h3>
                    <div className="space-y-4">
                        <input type="text" placeholder="Notification Title" value={pushTitle} onChange={e => setPushTitle(e.target.value)} className="w-full p-2 border rounded-md" required />
                        <textarea placeholder="Notification Body" value={pushBody} onChange={e => setPushBody(e.target.value)} rows={5} className="w-full p-2 border rounded-md" required />
                        <input type="url" placeholder="Target URL (Optional, e.g., https://...)" value={pushUrl} onChange={e => setPushUrl(e.target.value)} className="w-full p-2 border rounded-md" />
                        
                        <div>
                            <label htmlFor="push-target" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Send To</label>
                            <select
                                id="push-target"
                                value={pushTargetRole}
                                onChange={e => setPushTargetRole(e.target.value as UserRole | 'all')}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            >
                                <option value="all">All Users</option>
                                <option value="influencer">Influencers</option>
                                <option value="brand">Brands</option>
                                <option value="livetv">Live TV</option>
                                <option value="banneragency">Banner Agencies</option>
                            </select>
                        </div>

                        <div className="flex justify-end">
                            <button onClick={() => setShowConfirmation('push')} disabled={isSending || !pushTitle || !pushBody || pushAudienceCount === 0} className="px-6 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                Send to {pushAudienceCount} {pushTargetRole === 'all' ? 'User(s)' : `${pushTargetRole}(s)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mainTab === 'email' && (
                <div className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="flex border-b border-gray-200">
                        {emailTabs.map(tab => (
                            <button key={tab.role} onClick={() => setActiveEmailTab(tab.role)} className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${activeEmailTab === tab.role ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                {tab.name} ({userCounts[tab.role] || 0})
                            </button>
                        ))}
                    </div>
                    <div className="space-y-4 pt-4">
                        <input type="text" placeholder="Email Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full p-2 border rounded-md" required />
                        <textarea placeholder={`Email body for all ${activeEmailTab}s...`} value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={12} className="w-full p-2 border rounded-md" required />
                        <div className="flex justify-end">
                            <button onClick={() => setShowConfirmation('email')} disabled={isSending || !emailSubject || !emailBody || currentAudienceCount === 0} className="px-6 py-3 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                                Send to {currentAudienceCount} {activeEmailTab}(s)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showConfirmation === 'email' && (
                <ConfirmationModal type="Email" count={currentAudienceCount} target={activeEmailTab} onConfirm={executeSend} onCancel={() => setShowConfirmation(false)} isSending={isSending} />
            )}
            {showConfirmation === 'push' && (
                <ConfirmationModal type="Notification" count={pushAudienceCount} target={pushTargetRole === 'all' ? 'User' : pushTargetRole} onConfirm={executeSend} onCancel={() => setShowConfirmation(false)} isSending={isSending} />
            )}
        </div>
    );
};

export default MarketingPanel;
