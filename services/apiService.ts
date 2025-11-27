
import { 
    collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, 
    orderBy, limit, addDoc, serverTimestamp, onSnapshot, increment, 
    arrayUnion, arrayRemove, startAfter, Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, BACKEND_URL } from './firebase';
import { 
    User, PlatformSettings, Influencer, LiveTvChannel, 
    CollaborationRequest, Campaign, CampaignApplication, 
    AdSlotRequest, BannerAdBookingRequest, BannerAd, 
    SupportTicket, TicketReply, LiveHelpSession, 
    Post, Comment, Partner, Leaderboard, Boost,
    PayoutRequest, RefundRequest, DailyPayoutRequest,
    Transaction, Dispute, KycDetails, CreatorVerificationDetails,
    UserRole, AppNotification, QuickReply, MembershipPlan, StaffPermission
} from '../types';

// Helper to upload file
const uploadFile = async (path: string, file: File): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
};

export const apiService = {
    initializeFirestoreData: async () => {
        // Placeholder for any initialization logic if needed
    },

    // ... Users & Auth related ...
    getAllUsers: async (): Promise<User[]> => {
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },
    getUserByEmail: async (email: string): Promise<User | null> => {
        const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const docData = snapshot.docs[0].data();
        return { id: snapshot.docs[0].id, ...docData } as User;
    },
    getUserByMobile: async (mobile: string): Promise<User | null> => {
        const q = query(collection(db, 'users'), where('mobileNumber', '==', mobile), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const docData = snapshot.docs[0].data();
        return { id: snapshot.docs[0].id, ...docData } as User;
    },
    getUsersByIds: async (userIds: string[]): Promise<User[]> => {
        if (userIds.length === 0) return [];
        const users: User[] = [];
        for (const id of userIds) {
            const docSnap = await getDoc(doc(db, 'users', id));
            if (docSnap.exists()) {
                users.push({ id: docSnap.id, ...docSnap.data() } as User);
            }
        }
        return users;
    },
    updateUser: async (userId: string, data: Partial<User>) => {
        await updateDoc(doc(db, 'users', userId), data);
    },
    updateUserProfile: async (userId: string, data: Partial<User>) => {
        await updateDoc(doc(db, 'users', userId), data);
    },
    uploadProfilePicture: async (userId: string, file: File): Promise<string> => {
        return uploadFile(`profile_pictures/${userId}_${Date.now()}`, file);
    },
    saveFcmToken: async (userId: string, token: string | null) => {
        await updateDoc(doc(db, 'users', userId), { fcmToken: token });
    },
    adminChangePassword: async (userId: string, newPassword: string) => {
        const response = await fetch(`${BACKEND_URL}/admin-change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, newPassword })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update password');
        }
        return await response.json();
    },

    // ... Platform Settings ...
    getPlatformSettings: async (): Promise<PlatformSettings> => {
        const docRef = doc(db, 'settings', 'platform');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as PlatformSettings;
        }
        throw new Error("Platform settings not found");
    },
    updatePlatformSettings: async (settings: PlatformSettings) => {
        await setDoc(doc(db, 'settings', 'platform'), settings, { merge: true });
    },

    // ... Banners ...
    getActivePlatformBanners: async (): Promise<PlatformBanner[]> => {
        const q = query(collection(db, 'platform_banners'), where('isActive', '==', true));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlatformBanner));
    },
    getPlatformBanners: async (): Promise<PlatformBanner[]> => {
        const snapshot = await getDocs(collection(db, 'platform_banners'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlatformBanner));
    },
    createPlatformBanner: async (banner: any) => {
        await addDoc(collection(db, 'platform_banners'), banner);
    },
    updatePlatformBanner: async (id: string, data: any) => {
        await updateDoc(doc(db, 'platform_banners', id), data);
    },
    deletePlatformBanner: async (id: string) => {
        await updateDoc(doc(db, 'platform_banners', id), { isActive: false });
    },
    uploadPlatformBannerImage: async (file: File): Promise<string> => {
        return uploadFile(`banners/${Date.now()}_${file.name}`, file);
    },

    // ... Influencers ...
    getInfluencersPaginated: async (settings: PlatformSettings, options: { limit: number, startAfterDoc?: any }) => {
        let q = query(collection(db, 'influencers'), limit(options.limit));
        if (options.startAfterDoc) {
            q = query(collection(db, 'influencers'), startAfter(options.startAfterDoc), limit(options.limit));
        }
        const snapshot = await getDocs(q);
        const influencers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Influencer));
        return { influencers, lastVisible: snapshot.docs[snapshot.docs.length - 1] };
    },
    getInfluencerProfile: async (userId: string): Promise<any> => {
        const docSnap = await getDoc(doc(db, 'influencers', userId));
        return docSnap.exists() ? docSnap.data() : null;
    },
    updateInfluencerProfile: async (userId: string, data: any) => {
        await updateDoc(doc(db, 'influencers', userId), data);
    },

    // ... Live TV ...
    getLiveTvChannels: async (settings: PlatformSettings): Promise<LiveTvChannel[]> => {
        const snapshot = await getDocs(collection(db, 'livetv_channels'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveTvChannel));
    },

    // ... Messaging ...
    getConversations: async (userId: string): Promise<any[]> => {
        const snapshot = await getDocs(collection(db, `users/${userId}/conversations`));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    getMessagesListener: (userId1: string, userId2: string, callback: (msgs: any[]) => void, onError: (err: any) => void) => {
        const chatId = [userId1, userId2].sort().join('_');
        const q = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
        return onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data, 
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleTimeString() : new Date().toLocaleTimeString() 
                };
            });
            callback(msgs);
        }, onError);
    },
    sendMessage: async (text: string, senderId: string, recipientId: string, attachments: any[] = []) => {
        const chatId = [senderId, recipientId].sort().join('_');
        await addDoc(collection(db, `chats/${chatId}/messages`), {
            text,
            senderId,
            attachments,
            timestamp: serverTimestamp()
        });
    },
    uploadMessageAttachment: async (messageId: string, file: File): Promise<string> => {
        return uploadFile(`attachments/${messageId}/${file.name}`, file);
    },

    // ... Collaborations ...
    getCollabRequestsForInfluencerListener: (userId: string, callback: (data: CollaborationRequest[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', userId));
        return onSnapshot(q, (snapshot) => {
            const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
            callback(reqs);
        }, onError);
    },
    getCollabRequestsForBrandListener: (userId: string, callback: (data: CollaborationRequest[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', userId));
        return onSnapshot(q, (snapshot) => {
            const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
            callback(reqs);
        }, onError);
    },
    getCollabRequestsForBrand: async (userId: string): Promise<CollaborationRequest[]> => {
        const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    },
    getCollabRequestsForInfluencer: async (userId: string): Promise<CollaborationRequest[]> => {
        const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    },
    getAllCollaborationRequests: async (): Promise<CollaborationRequest[]> => {
        const snapshot = await getDocs(collection(db, 'collaboration_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    },
    sendCollabRequest: async (request: any) => {
        await addDoc(collection(db, 'collaboration_requests'), { ...request, status: 'pending', timestamp: serverTimestamp() });
    },
    updateCollaborationRequest: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, 'collaboration_requests', id), data);
    },

    // ... Campaigns ...
    createCampaign: async (campaign: any) => {
        await addDoc(collection(db, 'campaigns'), { ...campaign, status: 'open', timestamp: serverTimestamp() });
    },
    getCampaignsForBrand: async (brandId: string): Promise<Campaign[]> => {
        const q = query(collection(db, 'campaigns'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
    },
    getAllOpenCampaigns: async (location?: string): Promise<Campaign[]> => {
        let q = query(collection(db, 'campaigns'), where('status', '==', 'open'));
        const snapshot = await getDocs(q);
        let campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        if (location && location !== 'All') {
            campaigns = campaigns.filter(c => !c.location || c.location === 'All' || c.location === location);
        }
        return campaigns;
    },
    applyToCampaign: async (application: any) => {
        await addDoc(collection(db, 'campaign_applications'), { ...application, status: 'pending_brand_review', timestamp: serverTimestamp() });
        await updateDoc(doc(db, 'campaigns', application.campaignId), {
            applicantIds: arrayUnion(application.influencerId)
        });
    },
    getApplicationsForCampaign: async (campaignId: string): Promise<CampaignApplication[]> => {
        const q = query(collection(db, 'campaign_applications'), where('campaignId', '==', campaignId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignApplication));
    },
    getCampaignApplicationsForInfluencer: async (userId: string): Promise<CampaignApplication[]> => {
        const q = query(collection(db, 'campaign_applications'), where('influencerId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignApplication));
    },
    getAllCampaignApplications: async (): Promise<CampaignApplication[]> => {
        const snapshot = await getDocs(collection(db, 'campaign_applications'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignApplication));
    },
    updateCampaignApplication: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, 'campaign_applications', id), data);
    },

    // ... Ad Slots ...
    sendAdSlotRequest: async (request: any) => {
        await addDoc(collection(db, 'ad_slot_requests'), { ...request, status: 'pending_approval', timestamp: serverTimestamp() });
    },
    getAdSlotRequestsForBrand: async (brandId: string): Promise<AdSlotRequest[]> => {
        const q = query(collection(db, 'ad_slot_requests'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdSlotRequest));
    },
    getAdSlotRequestsForLiveTv: async (liveTvId: string): Promise<AdSlotRequest[]> => {
        const q = query(collection(db, 'ad_slot_requests'), where('liveTvId', '==', liveTvId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdSlotRequest));
    },
    getAllAdSlotRequests: async (): Promise<AdSlotRequest[]> => {
        const snapshot = await getDocs(collection(db, 'ad_slot_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdSlotRequest));
    },
    updateAdSlotRequest: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, 'ad_slot_requests', id), data);
    },

    // ... Banner Ads ...
    createBannerAd: async (ad: any) => {
        await addDoc(collection(db, 'banner_ads'), { ...ad, timestamp: serverTimestamp() });
    },
    uploadBannerAdPhoto: async (userId: string, file: File): Promise<string> => {
        return uploadFile(`banner_ads/${userId}_${Date.now()}`, file);
    },
    getBannerAds: async (location: string, settings: PlatformSettings): Promise<BannerAd[]> => {
        let q = collection(db, 'banner_ads');
        const snapshot = await getDocs(q);
        let ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAd));
        if (location) {
            ads = ads.filter(ad => ad.location.toLowerCase().includes(location.toLowerCase()));
        }
        return ads;
    },
    getBannerAdsForAgency: async (agencyId: string): Promise<BannerAd[]> => {
        const q = query(collection(db, 'banner_ads'), where('agencyId', '==', agencyId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAd));
    },
    sendBannerAdBookingRequest: async (request: any) => {
        await addDoc(collection(db, 'banner_ad_booking_requests'), { ...request, status: 'pending_approval', timestamp: serverTimestamp() });
    },
    getBannerAdBookingRequestsForBrand: async (brandId: string): Promise<BannerAdBookingRequest[]> => {
        const q = query(collection(db, 'banner_ad_booking_requests'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAdBookingRequest));
    },
    getBannerAdBookingRequestsForAgency: async (agencyId: string): Promise<BannerAdBookingRequest[]> => {
        const q = query(collection(db, 'banner_ad_booking_requests'), where('agencyId', '==', agencyId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAdBookingRequest));
    },
    getAllBannerAdBookingRequests: async (): Promise<BannerAdBookingRequest[]> => {
        const snapshot = await getDocs(collection(db, 'banner_ad_booking_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAdBookingRequest));
    },
    updateBannerAdBookingRequest: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, 'banner_ad_booking_requests', id), data);
    },

    // ... Daily Payouts ...
    getActiveAdCollabsForAgency: async (userId: string, role: string): Promise<(AdSlotRequest | BannerAdBookingRequest)[]> => {
        if (role === 'livetv') {
            const q = query(collection(db, 'ad_slot_requests'), where('liveTvId', '==', userId), where('status', 'in', ['in_progress']));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdSlotRequest));
        } else {
            const q = query(collection(db, 'banner_ad_booking_requests'), where('agencyId', '==', userId), where('status', 'in', ['in_progress']));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAdBookingRequest));
        }
    },
    uploadDailyPayoutVideo: async (userId: string, file: Blob): Promise<string> => {
        const storageRef = ref(storage, `daily_payout_proofs/${userId}_${Date.now()}.webm`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    },
    submitDailyPayoutRequest: async (data: any) => {
        await addDoc(collection(db, 'daily_payout_requests'), { ...data, status: 'pending', timestamp: serverTimestamp() });
    },
    getAllDailyPayouts: async (): Promise<DailyPayoutRequest[]> => {
        const snapshot = await getDocs(collection(db, 'daily_payout_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyPayoutRequest));
    },
    updateDailyPayoutRequest: async (id: string, data: any) => {
        await updateDoc(doc(db, 'daily_payout_requests', id), data);
    },
    updateDailyPayoutRequestStatus: async (id: string, collaborationId: string, collabType: 'ad_slot' | 'banner_booking', status: string, amount?: number, reason?: string) => {
        await updateDoc(doc(db, 'daily_payout_requests', id), { status, approvedAmount: amount, rejectionReason: reason });
        
        if (status === 'approved') {
            const collectionName = collabType === 'ad_slot' ? 'ad_slot_requests' : 'banner_ad_booking_requests';
            await updateDoc(doc(db, collectionName, collaborationId), {
                dailyPayoutsReceived: increment(amount || 0)
            });
        }
    },

    // ... Payouts & Refunds ...
    submitPayoutRequest: async (data: any) => {
        await addDoc(collection(db, 'payout_requests'), { ...data, status: 'pending', timestamp: serverTimestamp() });
    },
    createRefundRequest: async (data: any) => {
        await addDoc(collection(db, 'refund_requests'), { ...data, status: 'pending', timestamp: serverTimestamp() });
    },
    uploadPayoutSelfie: async (userId: string, file: File): Promise<string> => {
        return uploadFile(`payout_selfies/${userId}_${Date.now()}`, file);
    },
    getAllPayouts: async (): Promise<PayoutRequest[]> => {
        const snapshot = await getDocs(collection(db, 'payout_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest));
    },
    getAllRefunds: async (): Promise<RefundRequest[]> => {
        const snapshot = await getDocs(collection(db, 'refund_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RefundRequest));
    },
    getPayoutHistoryForUser: async (userId: string): Promise<PayoutRequest[]> => {
        const q = query(collection(db, 'payout_requests'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest));
    },
    updatePayoutStatus: async (id: string, status: string, collaborationId: string, collabType: string, reason?: string) => {
        await updateDoc(doc(db, 'payout_requests', id), { status, rejectionReason: reason });
        if (status === 'completed') {
            let collectionName = 'collaboration_requests';
            if (collabType === 'campaign') collectionName = 'campaign_applications';
            else if (collabType === 'ad_slot') collectionName = 'ad_slot_requests';
            else if (collabType === 'banner_booking') collectionName = 'banner_ad_booking_requests';
            
            await updateDoc(doc(db, collectionName, collaborationId), { paymentStatus: 'payout_complete' });
        }
    },
    updateRefundRequest: async (id: string, data: any) => {
        await updateDoc(doc(db, 'refund_requests', id), data);
    },
    processPayout: async (requestId: string, requestType: 'Payout' | 'Daily Payout') => {
        const endpoint = `${BACKEND_URL}/process-payout`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, requestType })
        });
        if (!response.ok) {
            throw new Error('Failed to process payout automatically.');
        }
        return await response.json();
    },

    // ... Transactions ...
    getAllTransactions: async (): Promise<Transaction[]> => {
        const snapshot = await getDocs(collection(db, 'transactions'));
        return snapshot.docs.map(doc => ({ ...doc.data() } as Transaction));
    },
    getTransactionsForUser: async (userId: string): Promise<Transaction[]> => {
        const q = query(collection(db, 'transactions'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data() } as Transaction));
    },

    // ... Support ...
    getAllTickets: async (): Promise<SupportTicket[]> => {
        const snapshot = await getDocs(collection(db, 'support_tickets'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
    },
    getTicketsForUser: async (userId: string): Promise<SupportTicket[]> => {
        const q = query(collection(db, 'support_tickets'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
    },
    createSupportTicket: async (ticketData: any, initialMessage: any) => {
        const ticketRef = await addDoc(collection(db, 'support_tickets'), { ...ticketData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await addDoc(collection(db, `support_tickets/${ticketRef.id}/replies`), { ...initialMessage, timestamp: serverTimestamp() });
    },
    getTicketReplies: async (ticketId: string): Promise<TicketReply[]> => {
        const q = query(collection(db, `support_tickets/${ticketId}/replies`), orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TicketReply));
    },
    addTicketReply: async (reply: any) => {
        await addDoc(collection(db, `support_tickets/${reply.ticketId}/replies`), { ...reply, timestamp: serverTimestamp() });
        await updateDoc(doc(db, 'support_tickets', reply.ticketId), { updatedAt: serverTimestamp(), status: 'in_progress' });
    },
    updateTicketStatus: async (ticketId: string, status: string) => {
        await updateDoc(doc(db, 'support_tickets', ticketId), { status });
    },
    uploadTicketAttachment: async (ticketId: string, file: File): Promise<string> => {
        return uploadFile(`support_attachments/${ticketId}/${file.name}`, file);
    },

    // ... Live Help ...
    getAllLiveHelpSessionsListener: (callback: (sessions: LiveHelpSession[]) => void) => {
        const q = query(collection(db, 'live_help_sessions'), orderBy('updatedAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveHelpSession)));
        });
    },
    getSessionsForUser: async (userId: string): Promise<LiveHelpSession[]> => {
        const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveHelpSession));
    },
    getOrCreateLiveHelpSession: async (userId: string, userName: string, userAvatar: string, staffId: string): Promise<string> => {
        const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), where('status', 'in', ['open', 'unassigned']));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }
        const ref = await addDoc(collection(db, 'live_help_sessions'), {
            userId, userName, userAvatar,
            status: 'unassigned',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            messages: []
        });
        return ref.id;
    },
    sendLiveHelpMessage: async (sessionId: string, senderId: string, senderName: string, text: string) => {
        await addDoc(collection(db, `live_help_sessions/${sessionId}/messages`), {
            senderId, senderName, text, timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, 'live_help_sessions', sessionId), { updatedAt: serverTimestamp() });
    },
    reopenLiveHelpSession: async (sessionId: string) => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), { status: 'unassigned', updatedAt: serverTimestamp() });
    },
    closeLiveHelpSession: async (sessionId: string) => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), { status: 'closed', updatedAt: serverTimestamp() });
    },
    assignStaffToSession: async (sessionId: string, staffUser: User) => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), { 
            status: 'open', 
            assignedStaffId: staffUser.id, 
            assignedStaffName: staffUser.name, 
            assignedStaffAvatar: staffUser.avatar 
        });
    },
    getQuickRepliesListener: (callback: (replies: QuickReply[]) => void) => {
        return onSnapshot(collection(db, 'quick_replies'), (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, text: doc.data().text } as QuickReply)));
        });
    },
    addQuickReply: async (text: string) => {
        await addDoc(collection(db, 'quick_replies'), { text });
    },
    updateQuickReply: async (id: string, text: string) => {
        await updateDoc(doc(db, 'quick_replies', id), { text });
    },
    deleteQuickReply: async (id: string) => {
        await updateDoc(doc(db, 'quick_replies', id), { deleted: true });
    },

    // ... Community ...
    getPosts: async (userId?: string): Promise<Post[]> => {
        const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
        
        if (userId) {
            posts = posts.filter(p => p.visibility === 'public' || p.userId === userId);
        } else {
            posts = posts.filter(p => p.visibility === 'public');
        }
        return posts;
    },
    createPost: async (post: any): Promise<Post> => {
        const ref = await addDoc(collection(db, 'posts'), post);
        return { id: ref.id, ...post };
    },
    uploadPostImage: async (postId: string, file: File): Promise<string> => {
        return uploadFile(`posts/${postId}/${file.name}`, file);
    },
    updatePost: async (postId: string, data: Partial<Post>) => {
        await updateDoc(doc(db, 'posts', postId), data);
    },
    deletePost: async (postId: string) => {
        await updateDoc(doc(db, 'posts', postId), { isBlocked: true });
    },
    toggleLikePost: async (postId: string, userId: string) => {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
            const likes = postSnap.data().likes || [];
            if (likes.includes(userId)) {
                await updateDoc(postRef, { likes: arrayRemove(userId) });
            } else {
                await updateDoc(postRef, { likes: arrayUnion(userId) });
            }
        }
    },
    addCommentToPost: async (postId: string, comment: any) => {
        await addDoc(collection(db, `posts/${postId}/comments`), { ...comment, timestamp: serverTimestamp() });
        await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
    },
    getCommentsForPost: async (postId: string): Promise<Comment[]> => {
        const q = query(collection(db, `posts/${postId}/comments`), orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
    },
    followUser: async (followerId: string, targetId: string) => {
        await updateDoc(doc(db, 'users', followerId), { following: arrayUnion(targetId) });
        await updateDoc(doc(db, 'users', targetId), { followers: arrayUnion(followerId) });
    },
    unfollowUser: async (followerId: string, targetId: string) => {
        await updateDoc(doc(db, 'users', followerId), { following: arrayRemove(targetId) });
        await updateDoc(doc(db, 'users', targetId), { followers: arrayRemove(followerId) });
    },

    // ... KYC & Verification ...
    getKycSubmissions: async (): Promise<User[]> => {
        const q = query(collection(db, 'users'), where('kycStatus', '==', 'pending'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },
    updateKycStatus: async (userId: string, status: string, reason?: string) => {
        const updateData: any = { kycStatus: status };
        if (reason) updateData['kycDetails.rejectionReason'] = reason;
        await updateDoc(doc(db, 'users', userId), updateData);
    },
    getPendingCreatorVerifications: async (): Promise<User[]> => {
        const q = query(collection(db, 'users'), where('creatorVerificationStatus', '==', 'pending'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },
    updateCreatorVerificationStatus: async (userId: string, status: string, reason?: string) => {
        const updateData: any = { creatorVerificationStatus: status };
        if (reason) updateData['creatorVerificationDetails.rejectionReason'] = reason;
        if (status === 'approved') updateData['isVerified'] = true;
        await updateDoc(doc(db, 'users', userId), updateData);
    },
    submitKyc: async (userId: string, data: KycDetails, idProof: File | null, addressProof: File | null, pan: File | null) => {
        const updates: any = { kycStatus: 'pending', kycDetails: { ...data } };
        if (idProof) updates.kycDetails.idProofUrl = await uploadFile(`kyc/${userId}/id_proof`, idProof);
        if (pan) updates.kycDetails.panCardUrl = await uploadFile(`kyc/${userId}/pan`, pan);
        await updateDoc(doc(db, 'users', userId), updates);
    },
    submitCreatorVerification: async (userId: string, data: CreatorVerificationDetails, files: any) => {
        const updates: any = { creatorVerificationStatus: 'pending', creatorVerificationDetails: { ...data } };
        if (files.registration) updates.creatorVerificationDetails.registrationDocUrl = await uploadFile(`verification/${userId}/registration`, files.registration);
        if (files.office) updates.creatorVerificationDetails.officePhotoUrl = await uploadFile(`verification/${userId}/office`, files.office);
        if (files.pan) updates.creatorVerificationDetails.businessPanUrl = await uploadFile(`verification/${userId}/business_pan`, files.pan);
        if (files.stamp) updates.creatorVerificationDetails.channelStampUrl = await uploadFile(`verification/${userId}/stamp`, files.stamp);
        if (files.acknowledgement) updates.creatorVerificationDetails.acknowledgementUrl = await uploadFile(`verification/${userId}/acknowledgement`, files.acknowledgement);
        
        await updateDoc(doc(db, 'users', userId), updates);
    },
    verifyLiveness: async (userId: string, image: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-liveness`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        return await response.json();
    },
    verifyAadhaarOtp: async (aadhaar: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-aadhaar-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aadhaar })
        });
        return await response.json();
    },
    verifyAadhaarSubmit: async (userId: string, otp: string, ref_id: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-aadhaar-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, otp, ref_id })
        });
        return await response.json();
    },
    verifyPan: async (userId: string, pan: string, name: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-pan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, pan, name })
        });
        return await response.json();
    },
    verifyDrivingLicense: async (userId: string, dlNumber: string, dob: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-dl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, dlNumber, dob })
        });
        return await response.json();
    },
    verifyBankAccount: async (userId: string, account: string, ifsc: string, name: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-bank`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, account, ifsc, name })
        });
        return await response.json();
    },
    verifyUpi: async (userId: string, vpa: string, name: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-upi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, vpa, name })
        });
        return await response.json();
    },

    // ... Misc ...
    getBoostsForUser: async (userId: string): Promise<Boost[]> => {
        const q = query(collection(db, 'boosts'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Boost));
    },
    createDispute: async (data: any) => {
        await addDoc(collection(db, 'disputes'), { ...data, timestamp: serverTimestamp(), status: 'open' });
    },
    getDisputes: async (): Promise<Dispute[]> => {
        const snapshot = await getDocs(collection(db, 'disputes'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispute));
    },
    getNotificationsForUserListener: (userId: string, callback: (notifs: AppNotification[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, `users/${userId}/notifications`), orderBy('timestamp', 'desc'), limit(50));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
        }, onError);
    },
    markNotificationAsRead: async (notifId: string) => {
        console.warn("markNotificationAsRead requires userId in path or collection group update.");
    },
    markAllNotificationsAsRead: async (userId: string) => {
        console.warn("markAllNotificationsAsRead requires batch update implementation");
    },
    generateReferralCode: async (userId: string) => {
        const code = "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
        return code;
    },
    applyReferralCode: async (userId: string, code: string) => {
        console.log(`Applying referral code ${code} for user ${userId}`);
    },
    getPartners: async (): Promise<Partner[]> => {
        const snapshot = await getDocs(collection(db, 'partners'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
    },
    createPartner: async (data: any) => {
        await addDoc(collection(db, 'partners'), data);
    },
    updatePartner: async (id: string, data: any) => {
        await updateDoc(doc(db, 'partners', id), data);
    },
    deletePartner: async (id: string) => {
        await updateDoc(doc(db, 'partners', id), { deleted: true });
    },
    uploadPartnerLogo: async (file: File): Promise<string> => {
        return uploadFile(`partner_logos/${Date.now()}_${file.name}`, file);
    },
    getLeaderboards: async (): Promise<Leaderboard[]> => {
        const snapshot = await getDocs(collection(db, 'leaderboards'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leaderboard));
    },
    getActiveLeaderboards: async (): Promise<Leaderboard[]> => {
        const q = query(collection(db, 'leaderboards'), where('isActive', '==', true));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leaderboard));
    },
    createLeaderboard: async (data: any) => {
        await addDoc(collection(db, 'leaderboards'), { ...data, createdAt: serverTimestamp() });
    },
    updateLeaderboard: async (id: string, data: any) => {
        await updateDoc(doc(db, 'leaderboards', id), data);
    },
    deleteLeaderboard: async (id: string) => {
        await updateDoc(doc(db, 'leaderboards', id), { deleted: true });
    },
    sendBulkEmail: async (role: UserRole, subject: string, body: string) => {
        console.log(`Sending bulk email to ${role}: ${subject}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    },
    sendPushNotification: async (title: string, body: string, targetRole: UserRole | 'all', url?: string) => {
        console.log(`Sending push notification to ${targetRole}: ${title}`);
        await new Promise(resolve => setTimeout(resolve, 1000)); 
    },
};
