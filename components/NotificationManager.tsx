import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../services/firebase';
import { apiService } from '../services/apiService';

// Toast component for foreground notifications
const Toast: React.FC<{ title: string; body: string; onClose: () => void }> = ({ title, body, onClose }) => (
    <div className="fixed top-5 right-5 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-[100] border dark:border-gray-700 animate-fade-in-down">
        <div className="flex items-start">
            <div className="flex-1">
                <p className="font-bold text-gray-800 dark:text-gray-100">{title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{body}</p>
            </div>
            <button onClick={onClose} className="ml-3 text-gray-400 hover:text-gray-600">&times;</button>
        </div>
    </div>
);


const useNotifications = (user: User | null) => {
    const [notification, setNotification] = useState<{ title: string; body: string } | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window) || !messaging) {
            console.warn('Push notifications not supported or Firebase Messaging not initialized.');
            return;
        }

        const setupNotifications = async () => {
            if (!user) return;

            const enabled = true;

            if (enabled && Notification.permission !== 'denied') {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        console.log('Notification permission granted.');
                        // =================================================================================
                        // CRITICAL DEPLOYMENT STEP: REPLACE THIS VAPID KEY
                        // =================================================================================
                        // You must replace 'YOUR_VAPID_KEY_HERE' with your actual VAPID key from Firebase.
                        // Without this, push notifications will NOT work in production.
                        //
                        // To find your key:
                        // 1. Go to your Firebase project console.
                        // 2. Click the gear icon > Project settings.
                        // 3. Go to the "Cloud Messaging" tab.
                        // 4. Under "Web configuration", find or generate a "Web Push certificate".
                        // 5. Copy the "Key pair" string and paste it below.
                        // =================================================================================
                        const currentToken = await getToken(messaging, { vapidKey: 'BM48_VjApQI6lIeEOe0dsMc_K9xQ6EXUA3_B2sOb4N-PexZznVBorNWfgx-EDXNQrX26avyiSzcPlfesVE_bZnI' });
                        if (currentToken) {
                            if (user.fcmToken !== currentToken) {
                                await apiService.saveFcmToken(user.id, currentToken);
                            }
                        } else {
                            console.log('No registration token available. Request permission to generate one.');
                        }
                    } else {
                        console.log('Unable to get permission to notify.');
                        await apiService.saveFcmToken(user.id, null);
                    }
                } catch (err) {
                    console.error('An error occurred while retrieving token. ', err);
                }
            } else {
                if (user.fcmToken) {
                    await apiService.saveFcmToken(user.id, null);
                }
            }
        };

        setupNotifications();

        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('Message received in foreground.', payload);
            setNotification({
                title: payload.notification?.title || 'New Message',
                body: payload.notification?.body || '',
            });
        });

        return () => unsubscribe();

    }, [user]);

    return { notification, setNotification };
};


export const NotificationManager: React.FC<{ user: User | null }> = ({ user }) => {
    const { notification, setNotification } = useNotifications(user);

    useEffect(() => {
        if(notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification, setNotification]);

    if (!notification) return null;

    return <Toast title={notification.title} body={notification.body} onClose={() => setNotification(null)} />;
};