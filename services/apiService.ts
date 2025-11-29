import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    addDoc, 
    serverTimestamp, 
    onSnapshot, 
    deleteDoc, 
    startAfter,
    writeBatch,
    Timestamp,
    increment,
    arrayUnion,
    arrayRemove,
    DocumentData,
    QueryDocumentSnapshot
} from 'firebase/firestore';
import { 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from 'firebase/storage';
import { db, storage, BACKEND_URL } from './firebase';
import { 
    User, 
    Influencer, 
    PlatformSettings, 
    LiveTvChannel, 
    BannerAd,
    Campaign,
    CollaborationRequest,
    CampaignApplication,
    AdSlotRequest,
    BannerAdBookingRequest,
    Transaction,
    PayoutRequest,
    RefundRequest,
    DailyPayoutRequest,
    SupportTicket,
    TicketReply,
    LiveHelpSession,
    QuickReply,
    Post,
    Comment,
    Dispute,
    AppNotification,
    Partner,
    Leaderboard,
    Agreements,
    UserRole,
    Membership,
    Attachment,
    SupportTicketStatus,
    KycDetails,
    CreatorVerificationDetails,
    PlatformBanner
} from '../types';

export const apiService = {
    // --- Platform Settings ---
    getPlatformSettings: async (): Promise<PlatformSettings> => {
        const docRef = doc(db, 'settings', 'platform');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as PlatformSettings;
        } else {
            // Return defaults if not found
            return {
                isCommunityFeedEnabled: true,
                isCreatorMembershipEnabled: true,
                isProMembershipEnabled: true,
                isMaintenanceModeEnabled: false,
                isWelcomeMessageEnabled: true,
                isNotificationBannerEnabled: false,
                isKycIdProofRequired: true,
                isKycSelfieRequired: true,
                isInstantKycEnabled: false,
                isForgotPasswordOtpEnabled: false,
                isOtpLoginEnabled: true,
                isGoogleLoginEnabled: true,
                socialMediaLinks: [],
                isSocialMediaFabEnabled: true,
                isStaffRegistrationEnabled: false,
                isLiveHelpEnabled: true,
                isProfileBoostingEnabled: true,
                isCampaignBoostingEnabled: true,
                paymentGatewaySourceCode: '',
                otpApiId: '',
                activePaymentGateway: 'cashfree',
                paymentGatewayApiId: '',
                paymentGatewayApiSecret: '',
                boostPrices: { profile: 499, campaign: 999, banner: 1499 },
                membershipPrices: { pro_10: 2999, pro_20: 4999, pro_unlimited: 9999, basic: 499, pro: 1499, premium: 2499 },
                isPlatformCommissionEnabled: true,
                platformCommissionRate: 10,
                isPaymentProcessingChargeEnabled: true,
                paymentProcessingChargeRate: 2,
                isGstEnabled: true,
                gstRate: 18,
                cancellationPenaltyAmount: 500,
                isBrandGstEnabled: true,
                isBrandPlatformFeeEnabled: true,
                isCreatorGstEnabled: true,
                isPayoutInstantVerificationEnabled: true,
                payoutSettings: { requireSelfieForPayout: true, requireLiveVideoForDailyPayout: true },
                discountSettings: {
                    creatorProfileBoost: { isEnabled: false, percentage: 0 },
                    brandMembership: { isEnabled: false, percentage: 0 },
                    creatorMembership: { isEnabled: false, percentage: 0 },
                    brandCampaignBoost: { isEnabled: false, percentage: 0 },
                    brandBannerBoost: { isEnabled: false, percentage: 0 }
                }
            };
        }
    },

    updatePlatformSettings: async (settings: PlatformSettings): Promise<void> => {
        await setDoc(doc(db, 'settings', 'platform'), settings, { merge: true });
    },

    initializeFirestoreData: async () => {
        // Placeholder for initialization logic if needed
    },

    // --- Users & Profiles ---
    getAllUsers: async (): Promise<User[]> => {
        const q = query(collection(db, 'users'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },

    getUserByEmail: async (email: string): Promise<User | null> => {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() } as User;
        }
        return null;
    },

    getUserByMobile: async (mobile: string): Promise<User | null> => {
        const q = query(collection(db, 'users'), where('mobileNumber', '==', mobile));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() } as User;
        }
        return null;
    },

    getUsersByIds: async (userIds: string[]): Promise<User[]> => {
        if (userIds.length === 0) return [];
        // Firestore 'in' query supports up to 10 items. For more, need batching.
        // For simplicity here, taking first 10.
        const chunks = [];
        for (let i = 0; i < userIds.length; i += 10) {
            chunks.push(userIds.slice(i, i + 10));
        }
        
        const users: User[] = [];
        for (const chunk of chunks) {
            const q = query(collection(db, 'users'), where('id', 'in', chunk)); // Assuming 'id' field exists in doc, usually doc.id is implicit but for 'in' query referencing doc ID requires FieldPath.documentId()
            // However, usually we store ID in the doc as well. If not, we'd use documentId().
            // Let's assume 'users' collection documents have 'id' field or use __name__.
            // To be safe with 'in' queries on IDs:
            // Actually, best to fetch individually if we can't rely on 'id' field being there.
            // Or use FieldPath.documentId().
            // Given the complexity, let's just fetch individually for now or assume 'id' field is present as per User type.
            // But wait, the User type implies id is the doc id.
            // Let's just do individual fetches for robustness in this example or map results.
            const chunkSnap = await getDocs(query(collection(db, 'users'), where('__name__', 'in', chunk)));
            chunkSnap.forEach(doc => users.push({ id: doc.id, ...doc.data() } as User));
        }
        return users;
    },

    updateUser: async (userId: string, data: Partial<User>): Promise<void> => {
        await updateDoc(doc(db, 'users', userId), data);
    },

    updateUserProfile: async (userId: string, data: Partial<User>): Promise<void> => {
        await updateDoc(doc(db, 'users', userId), data);
    },

    adminChangePassword: async (userId: string, newPassword: string): Promise<void> => {
        await fetch(`${BACKEND_URL}/admin-change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, newPassword })
        });
    },

    saveFcmToken: async (userId: string, token: string | null): Promise<void> => {
        await updateDoc(doc(db, 'users', userId), { fcmToken: token });
    },

    uploadProfilePicture: async (userId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `avatars/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Influencers ---
    getInfluencerProfile: async (userId: string): Promise<Influencer | null> => {
        const docRef = doc(db, 'influencers', userId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Influencer : null;
    },

    updateInfluencerProfile: async (userId: string, data: Partial<Influencer>): Promise<void> => {
        const docRef = doc(db, 'influencers', userId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            await updateDoc(docRef, data);
        } else {
            // Create if doesn't exist (e.g. upgraded user)
            await setDoc(docRef, { ...data, id: userId });
        }
    },

    getInfluencersPaginated: async (params: { limit: number, startAfterDoc?: QueryDocumentSnapshot<DocumentData> }): Promise<{ influencers: Influencer[], lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => {
        let q = query(collection(db, 'influencers'), orderBy('followers', 'desc'), limit(params.limit));
        if (params.startAfterDoc) {
            q = query(collection(db, 'influencers'), orderBy('followers', 'desc'), startAfter(params.startAfterDoc), limit(params.limit));
        }
        const snapshot = await getDocs(q);
        const influencers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Influencer));
        return {
            influencers,
            lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
        };
    },

    // --- Live TV & Ads ---
    getLiveTvChannels: async (settings?: PlatformSettings): Promise<LiveTvChannel[]> => {
        const q = query(collection(db, 'livetv_channels'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveTvChannel));
    },

    getLiveTvChannel: async (userId: string): Promise<LiveTvChannel | null> => {
        const docRef = doc(db, 'livetv_channels', userId);
        const snapshot = await getDoc(docRef);
        return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as LiveTvChannel : null;
    },

    updateLiveTvChannel: async (userId: string, data: Partial<LiveTvChannel>): Promise<void> => {
        const docRef = doc(db, 'livetv_channels', userId);
        const snap = await getDoc(docRef);
        if(snap.exists()) {
            await updateDoc(docRef, data);
        } else {
            await setDoc(docRef, { ...data, id: userId });
        }
    },
    
    uploadChannelLogo: async (userId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `channel_logos/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    getBannerAds: async (locationFilter?: string, settings?: PlatformSettings): Promise<BannerAd[]> => {
        let q = query(collection(db, 'banner_ads'));
        if (locationFilter) {
            q = query(collection(db, 'banner_ads'), where('location', '==', locationFilter));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAd));
    },

    createBannerAd: async (ad: Omit<BannerAd, 'id'>): Promise<void> => {
        await addDoc(collection(db, 'banner_ads'), { ...ad, timestamp: serverTimestamp() });
    },

    uploadBannerAdPhoto: async (userId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `banner_ads/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Collaborations & Campaigns ---
    createCampaign: async (campaign: Omit<Campaign, 'id' | 'status'>): Promise<void> => {
        await addDoc(collection(db, 'campaigns'), { 
            ...campaign, 
            status: 'open', 
            timestamp: serverTimestamp() 
        });
    },

    getCampaignsForBrand: async (brandId: string): Promise<Campaign[]> => {
        const q = query(collection(db, 'campaigns'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
    },

    getAllOpenCampaigns: async (location?: string): Promise<Campaign[]> => {
        let q = query(collection(db, 'campaigns'), where('status', '==', 'open'));
        if (location) {
            // Note: Firestore equality matches are exact. For complex filtering, client-side or Algolia is better.
            // Here we assume exact match or no location filter
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
    },

    applyToCampaign: async (application: Omit<CampaignApplication, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'campaign_applications'), {
            ...application,
            status: 'pending_brand_review',
            timestamp: serverTimestamp()
        });
        
        // Update campaign applicant list
        const campaignRef = doc(db, 'campaigns', application.campaignId);
        await updateDoc(campaignRef, {
            applicantIds: arrayUnion(application.influencerId)
        });
    },

    getApplicationsForCampaign: async (campaignId: string): Promise<CampaignApplication[]> => {
        const q = query(collection(db, 'campaign_applications'), where('campaignId', '==', campaignId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignApplication));
    },

    getCampaignApplicationsForInfluencer: async (influencerId: string): Promise<CampaignApplication[]> => {
        const q = query(collection(db, 'campaign_applications'), where('influencerId', '==', influencerId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignApplication));
    },

    updateCampaignApplication: async (appId: string, data: Partial<CampaignApplication>, userId?: string): Promise<void> => {
        await updateDoc(doc(db, 'campaign_applications', appId), data);
        if (userId && data.status) {
            // Optional: Notify other party
        }
    },

    // Direct Collabs
    sendCollabRequest: async (request: Omit<CollaborationRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'collaboration_requests'), {
            ...request,
            status: 'pending',
            timestamp: serverTimestamp()
        });
    },

    getCollabRequestsForBrand: async (brandId: string): Promise<CollaborationRequest[]> => {
        const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    },

    getCollabRequestsForBrandListener: (brandId: string, callback: (data: CollaborationRequest[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest)));
        }, onError);
    },

    getCollabRequestsForInfluencer: async (influencerId: string): Promise<CollaborationRequest[]> => {
        const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    },

    getCollabRequestsForInfluencerListener: (influencerId: string, callback: (data: CollaborationRequest[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest)));
        }, onError);
    },

    updateCollaborationRequest: async (reqId: string, data: Partial<CollaborationRequest>, userId?: string): Promise<void> => {
        await updateDoc(doc(db, 'collaboration_requests', reqId), data);
    },

    // Ad Slot Requests
    sendAdSlotRequest: async (request: Omit<AdSlotRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'ad_slot_requests'), {
            ...request,
            status: 'pending_approval',
            timestamp: serverTimestamp()
        });
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

    updateAdSlotRequest: async (reqId: string, data: Partial<AdSlotRequest>, userId?: string): Promise<void> => {
        await updateDoc(doc(db, 'ad_slot_requests', reqId), data);
    },

    // Banner Bookings
    sendBannerAdBookingRequest: async (request: Omit<BannerAdBookingRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'banner_ad_booking_requests'), {
            ...request,
            status: 'pending_approval',
            timestamp: serverTimestamp()
        });
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

    updateBannerAdBookingRequest: async (reqId: string, data: Partial<BannerAdBookingRequest>, userId?: string): Promise<void> => {
        await updateDoc(doc(db, 'banner_ad_booking_requests', reqId), data);
    },

    deleteCollaboration: async (id: string, collectionName: string): Promise<void> => {
        await deleteDoc(doc(db, collectionName, id));
    },

    cancelCollaboration: async (userId: string, collaborationId: string, collectionName: string, reason: string, penaltyAmount: number): Promise<void> => {
        // This should ideally be a cloud function to handle transaction atomically
        await fetch(`${BACKEND_URL}/cancel-collaboration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, collaborationId, collectionName, reason, penaltyAmount })
        });
    },

    // --- Messaging ---
    getConversations: async (userId: string): Promise<any[]> => {
        // This is a simplified fetch. In a real app, you'd maintain a 'conversations' collection.
        // For now, we return empty or implement a more complex query if needed.
        // Placeholder implementation:
        return [];
    },

    getMessagesListener: (userId: string, otherUserId: string, callback: (msgs: any[]) => void, onError: (err: any) => void) => {
        const chatId = [userId, otherUserId].sort().join('_');
        const q = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
        return onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(msgs);
        }, onError);
    },

    sendMessage: async (text: string, senderId: string, receiverId: string, attachments: Attachment[]) => {
        const chatId = [senderId, receiverId].sort().join('_');
        const message = {
            senderId,
            text,
            attachments,
            timestamp: serverTimestamp(),
            read: false
        };
        await addDoc(collection(db, `chats/${chatId}/messages`), message);
        // Should also update last message in conversation doc
    },

    uploadMessageAttachment: async (messageId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `chat_attachments/${messageId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Admin & Financials ---
    getAllTransactions: async (): Promise<Transaction[]> => {
        const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data() } as Transaction));
    },

    getTransactionsForUser: async (userId: string): Promise<Transaction[]> => {
        const q = query(collection(db, 'transactions'), where('userId', '==', userId), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data() } as Transaction));
    },

    getAllPayouts: async (): Promise<PayoutRequest[]> => {
        const q = query(collection(db, 'payout_requests'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest));
    },

    getPayoutHistoryForUser: async (userId: string): Promise<PayoutRequest[]> => {
        const q = query(collection(db, 'payout_requests'), where('userId', '==', userId), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest));
    },

    submitPayoutRequest: async (data: Omit<PayoutRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'payout_requests'), {
            ...data,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        
        // Update collab status
        const collectionName = data.collaborationType === 'direct' ? 'collaboration_requests' :
                               data.collaborationType === 'campaign' ? 'campaign_applications' :
                               data.collaborationType === 'ad_slot' ? 'ad_slot_requests' : 'banner_ad_booking_requests';
                               
        await updateDoc(doc(db, collectionName, data.collaborationId), { paymentStatus: 'payout_requested' });
        
        // Clear penalty if applicable
        if (data.deductedPenalty && data.deductedPenalty > 0) {
             await updateDoc(doc(db, 'users', data.userId), { pendingPenalty: 0 });
        }
    },

    updatePayoutStatus: async (id: string, status: string, collabId: string, collabType: string, rejectionReason?: string): Promise<void> => {
        await updateDoc(doc(db, 'payout_requests', id), { status, rejectionReason });
        
        if (status === 'completed') {
             const collectionName = collabType === 'direct' ? 'collaboration_requests' :
                                   collabType === 'campaign' ? 'campaign_applications' :
                                   collabType === 'ad_slot' ? 'ad_slot_requests' : 'banner_ad_booking_requests';
             await updateDoc(doc(db, collectionName, collabId), { paymentStatus: 'payout_complete' });
        }
    },

    processPayout: async (requestId: string, requestType: 'Payout' | 'Daily Payout'): Promise<void> => {
        await fetch(`${BACKEND_URL}/process-payout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, requestType })
        });
    },

    // Daily Payouts
    getAllDailyPayouts: async (): Promise<DailyPayoutRequest[]> => {
        const q = query(collection(db, 'daily_payout_requests'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyPayoutRequest));
    },

    submitDailyPayoutRequest: async (data: Omit<DailyPayoutRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'daily_payout_requests'), {
            ...data,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        
        // Increment count on collaboration
        const collectionName = data.collaborationType === 'ad_slot' ? 'ad_slot_requests' : 'banner_ad_booking_requests';
        await updateDoc(doc(db, collectionName, data.collaborationId), {
            dailyPayoutsReceived: increment(1)
        });
    },

    updateDailyPayoutRequest: async (id: string, data: Partial<DailyPayoutRequest>): Promise<void> => {
        await updateDoc(doc(db, 'daily_payout_requests', id), data);
    },

    updateDailyPayoutRequestStatus: async (id: string, collabId: string, collabType: 'ad_slot' | 'banner_booking', status: string, approvedAmount?: number, reason?: string): Promise<void> => {
        await updateDoc(doc(db, 'daily_payout_requests', id), { status, approvedAmount, rejectionReason: reason });
    },

    uploadDailyPayoutVideo: async (userId: string, file: Blob): Promise<string> => {
        const storageRef = ref(storage, `daily_payout_videos/${userId}/${Date.now()}.webm`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },
    
    getActiveAdCollabsForAgency: async (userId: string, role: string): Promise<any[]> => {
        if (role === 'livetv') {
            const q = query(collection(db, 'ad_slot_requests'), where('liveTvId', '==', userId), where('status', 'in', ['in_progress', 'work_submitted']));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({id: d.id, ...d.data()}));
        } else {
            const q = query(collection(db, 'banner_ad_booking_requests'), where('agencyId', '==', userId), where('status', 'in', ['in_progress', 'work_submitted']));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({id: d.id, ...d.data()}));
        }
    },

    // Refunds
    getAllRefunds: async (): Promise<RefundRequest[]> => {
        const q = query(collection(db, 'refund_requests'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RefundRequest));
    },

    getRefundsForUser: async (userId: string): Promise<RefundRequest[]> => {
        const q = query(collection(db, 'refund_requests'), where('brandId', '==', userId), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RefundRequest));
    },

    createRefundRequest: async (data: Omit<RefundRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'refund_requests'), {
            ...data,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        
        // Update collab status
        let collectionName = '';
        if (data.collabType === 'direct') collectionName = 'collaboration_requests';
        else if (data.collabType === 'campaign') collectionName = 'campaign_applications';
        else if (data.collabType === 'ad_slot') collectionName = 'ad_slot_requests';
        else if (data.collabType === 'banner_booking') collectionName = 'banner_ad_booking_requests';
        
        await updateDoc(doc(db, collectionName, data.collaborationId), { status: 'refund_pending_admin_review' });
    },

    updateRefundRequest: async (id: string, data: Partial<RefundRequest>): Promise<void> => {
        await updateDoc(doc(db, 'refund_requests', id), data);
    },

    // --- Admin Dashboard Aggregations ---
    getAllCollaborationRequests: async (): Promise<CollaborationRequest[]> => {
        const q = query(collection(db, 'collaboration_requests'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    },
    getAllCampaignApplications: async (): Promise<CampaignApplication[]> => {
        const q = query(collection(db, 'campaign_applications'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignApplication));
    },
    getAllAdSlotRequests: async (): Promise<AdSlotRequest[]> => {
        const q = query(collection(db, 'ad_slot_requests'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdSlotRequest));
    },
    getAllBannerAdBookingRequests: async (): Promise<BannerAdBookingRequest[]> => {
        const q = query(collection(db, 'banner_ad_booking_requests'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAdBookingRequest));
    },

    // --- Disputes ---
    createDispute: async (data: Omit<Dispute, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'disputes'), {
            ...data,
            status: 'open',
            timestamp: serverTimestamp()
        });
    },

    getDisputes: async (): Promise<Dispute[]> => {
        const q = query(collection(db, 'disputes'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispute));
    },

    updateDispute: async (id: string, data: Partial<Dispute>): Promise<void> => {
        await updateDoc(doc(db, 'disputes', id), data);
    },

    // --- Community ---
    getPosts: async (currentUserId: string): Promise<Post[]> => {
        const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
        
        // Filter based on visibility
        return posts.filter(post => {
            if (post.isBlocked) return false; // Hide blocked posts generally (admin panel can see them via separate query)
            if (post.visibility === 'public') return true;
            return post.userId === currentUserId; // Show private posts only to owner
        });
    },

    createPost: async (post: Omit<Post, 'id'>): Promise<Post> => {
        const docRef = await addDoc(collection(db, 'posts'), post);
        return { id: docRef.id, ...post } as Post;
    },

    uploadPostImage: async (postId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `posts/${postId}/${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    updatePost: async (postId: string, data: Partial<Post>): Promise<void> => {
        await updateDoc(doc(db, 'posts', postId), data);
    },

    deletePost: async (postId: string): Promise<void> => {
        await deleteDoc(doc(db, 'posts', postId));
    },

    toggleLikePost: async (postId: string, userId: string): Promise<void> => {
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

    getCommentsForPost: async (postId: string): Promise<Comment[]> => {
        const q = query(collection(db, `posts/${postId}/comments`), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
    },

    addCommentToPost: async (postId: string, comment: Omit<Comment, 'id' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, `posts/${postId}/comments`), {
            ...comment,
            timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
    },

    followUser: async (followerId: string, followingId: string): Promise<void> => {
        await updateDoc(doc(db, 'users', followerId), { following: arrayUnion(followingId) });
        await updateDoc(doc(db, 'users', followingId), { followers: arrayUnion(followerId) });
    },

    unfollowUser: async (followerId: string, followingId: string): Promise<void> => {
        await updateDoc(doc(db, 'users', followerId), { following: arrayRemove(followingId) });
        await updateDoc(doc(db, 'users', followingId), { followers: arrayRemove(followerId) });
    },

    // --- Support & Live Help ---
    getAllTickets: async (): Promise<SupportTicket[]> => {
        const q = query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
    },

    getTicketsForUser: async (userId: string): Promise<SupportTicket[]> => {
        const q = query(collection(db, 'support_tickets'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
    },

    createSupportTicket: async (ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>, initialMessage: Omit<TicketReply, 'id' | 'ticketId' | 'timestamp'>): Promise<void> => {
        const batch = writeBatch(db);
        const ticketRef = doc(collection(db, 'support_tickets'));
        const messageRef = doc(collection(db, 'ticket_replies'));

        batch.set(ticketRef, {
            ...ticket,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        batch.set(messageRef, {
            ...initialMessage,
            ticketId: ticketRef.id,
            timestamp: serverTimestamp()
        });

        await batch.commit();
    },

    updateTicketStatus: async (ticketId: string, status: SupportTicketStatus): Promise<void> => {
        await updateDoc(doc(db, 'support_tickets', ticketId), { status, updatedAt: serverTimestamp() });
    },

    getTicketReplies: async (ticketId: string): Promise<TicketReply[]> => {
        const q = query(collection(db, 'ticket_replies'), where('ticketId', '==', ticketId), orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TicketReply));
    },

    addTicketReply: async (reply: Omit<TicketReply, 'id' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'ticket_replies'), { ...reply, timestamp: serverTimestamp() });
        await updateDoc(doc(db, 'support_tickets', reply.ticketId), { updatedAt: serverTimestamp() });
    },

    uploadTicketAttachment: async (ticketId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `ticket_attachments/${ticketId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // Live Help
    getAllLiveHelpSessionsListener: (callback: (sessions: LiveHelpSession[]) => void) => {
        const q = query(collection(db, 'live_help_sessions'), orderBy('updatedAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveHelpSession)));
        });
    },

    getSessionsForUser: async (userId: string): Promise<LiveHelpSession[]> => {
        const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveHelpSession));
    },

    getOrCreateLiveHelpSession: async (userId: string, userName: string, userAvatar: string, staffId: string): Promise<string> => {
        const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), where('status', 'in', ['open', 'unassigned']));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }

        const docRef = await addDoc(collection(db, 'live_help_sessions'), {
            userId,
            userName,
            userAvatar,
            status: 'unassigned', // Initially unassigned
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    assignStaffToSession: async (sessionId: string, staffUser: User): Promise<void> => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), {
            status: 'open',
            assignedStaffId: staffUser.id,
            assignedStaffName: staffUser.name,
            assignedStaffAvatar: staffUser.avatar,
            updatedAt: serverTimestamp()
        });
    },

    sendLiveHelpMessage: async (sessionId: string, senderId: string, senderName: string, text: string): Promise<void> => {
        await addDoc(collection(db, `live_help_sessions/${sessionId}/messages`), {
            senderId,
            senderName,
            text,
            timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, 'live_help_sessions', sessionId), { updatedAt: serverTimestamp() });
    },

    closeLiveHelpSession: async (sessionId: string): Promise<void> => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), { status: 'closed', updatedAt: serverTimestamp() });
    },

    reopenLiveHelpSession: async (sessionId: string): Promise<void> => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), { status: 'open', updatedAt: serverTimestamp() });
    },

    getQuickRepliesListener: (callback: (replies: QuickReply[]) => void) => {
        const q = query(collection(db, 'quick_replies'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuickReply)));
        });
    },

    addQuickReply: async (text: string): Promise<void> => {
        await addDoc(collection(db, 'quick_replies'), { text });
    },

    updateQuickReply: async (id: string, text: string): Promise<void> => {
        await updateDoc(doc(db, 'quick_replies', id), { text });
    },

    deleteQuickReply: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'quick_replies', id));
    },

    // --- Marketing & Notifications ---
    getNotificationsForUserListener: (userId: string, callback: (notifs: AppNotification[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, `users/${userId}/notifications`), orderBy('timestamp', 'desc'), limit(50));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
        }, onError);
    },

    markNotificationAsRead: async (userId: string, notificationId: string): Promise<void> => {
        await updateDoc(doc(db, `users/${userId}/notifications`, notificationId), { isRead: true });
    },

    markAllNotificationsAsRead: async (userId: string): Promise<void> => {
        const q = query(collection(db, `users/${userId}/notifications`), where('isRead', '==', false));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { isRead: true });
        });
        await batch.commit();
    },

    sendPushNotification: async (title: string, body: string, targetRole: UserRole | 'all', url?: string): Promise<void> => {
        // This functionality requires Cloud Functions. 
        // We will simulate queuing by adding a task to a 'marketing_tasks' collection
        // which a Cloud Function would process.
        await addDoc(collection(db, 'marketing_tasks'), {
            type: 'push',
            title,
            body,
            targetRole,
            url,
            status: 'pending',
            createdAt: serverTimestamp()
        });
    },

    sendBulkEmail: async (targetRole: UserRole, subject: string, body: string): Promise<void> => {
        await addDoc(collection(db, 'marketing_tasks'), {
            type: 'email',
            targetRole,
            subject,
            body,
            status: 'pending',
            createdAt: serverTimestamp()
        });
    },

    // --- Banners ---
    getPlatformBanners: async (): Promise<PlatformBanner[]> => {
        const q = query(collection(db, 'platform_banners'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlatformBanner));
    },

    getActivePlatformBanners: async (): Promise<PlatformBanner[]> => {
        const q = query(collection(db, 'platform_banners'), where('isActive', '==', true));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlatformBanner));
    },

    createPlatformBanner: async (banner: Omit<PlatformBanner, 'id'>): Promise<void> => {
        await addDoc(collection(db, 'platform_banners'), banner);
    },

    updatePlatformBanner: async (id: string, data: Partial<PlatformBanner>): Promise<void> => {
        await updateDoc(doc(db, 'platform_banners', id), data);
    },

    deletePlatformBanner: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'platform_banners', id));
    },

    uploadPlatformBannerImage: async (file: File): Promise<string> => {
        const storageRef = ref(storage, `platform_banners/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Partners ---
    getPartners: async (): Promise<Partner[]> => {
        const q = query(collection(db, 'partners'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
    },

    createPartner: async (partner: Omit<Partner, 'id'>): Promise<void> => {
        await addDoc(collection(db, 'partners'), partner);
    },

    updatePartner: async (id: string, data: Partial<Partner>): Promise<void> => {
        await updateDoc(doc(db, 'partners', id), data);
    },

    deletePartner: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'partners', id));
    },

    uploadPartnerLogo: async (file: File): Promise<string> => {
        const storageRef = ref(storage, `partner_logos/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Leaderboard ---
    getLeaderboards: async (): Promise<Leaderboard[]> => {
        const q = query(collection(db, 'leaderboards'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leaderboard));
    },

    getActiveLeaderboards: async (): Promise<Leaderboard[]> => {
        const q = query(collection(db, 'leaderboards'), where('isActive', '==', true), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leaderboard));
    },

    createLeaderboard: async (data: Omit<Leaderboard, 'id' | 'createdAt'>): Promise<void> => {
        await addDoc(collection(db, 'leaderboards'), { ...data, createdAt: serverTimestamp() });
    },

    updateLeaderboard: async (id: string, data: Partial<Leaderboard>): Promise<void> => {
        await updateDoc(doc(db, 'leaderboards', id), data);
    },

    deleteLeaderboard: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'leaderboards', id));
    },

    // --- KYC & Verification ---
    getKycSubmissions: async (): Promise<User[]> => {
        const q = query(collection(db, 'users'), where('kycStatus', '==', 'pending'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },

    getPendingCreatorVerifications: async (): Promise<User[]> => {
        const q = query(collection(db, 'users'), where('creatorVerificationStatus', '==', 'pending'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },

    submitKyc: async (userId: string, details: KycDetails, idProofFile: File | null, selfieFile: File | null, panFile: File | null): Promise<void> => {
        let idProofUrl = details.idProofUrl;
        let selfieUrl = details.selfieUrl;
        let panCardUrl = details.panCardUrl;

        if (idProofFile) {
            const storageRef = ref(storage, `kyc/${userId}/id_proof_${Date.now()}`);
            await uploadBytes(storageRef, idProofFile);
            idProofUrl = await getDownloadURL(storageRef);
        }
        
        // Handling Data URL selfie or File object
        if (details.selfieUrl && details.selfieUrl.startsWith('data:')) {
             // Convert data URL to Blob/File is handled in component usually, but if passed here:
             // Assuming selfieFile is passed if it was converted. If not, we upload data URL
             const response = await fetch(details.selfieUrl);
             const blob = await response.blob();
             const storageRef = ref(storage, `kyc/${userId}/selfie_${Date.now()}.jpg`);
             await uploadBytes(storageRef, blob);
             selfieUrl = await getDownloadURL(storageRef);
        } else if (selfieFile) {
            const storageRef = ref(storage, `kyc/${userId}/selfie_${Date.now()}`);
            await uploadBytes(storageRef, selfieFile);
            selfieUrl = await getDownloadURL(storageRef);
        }

        if (panFile) {
            const storageRef = ref(storage, `kyc/${userId}/pan_${Date.now()}`);
            await uploadBytes(storageRef, panFile);
            panCardUrl = await getDownloadURL(storageRef);
        }

        await updateDoc(doc(db, 'users', userId), {
            kycStatus: 'pending',
            kycDetails: {
                ...details,
                idProofUrl,
                selfieUrl,
                panCardUrl
            }
        });
    },

    submitCreatorVerification: async (userId: string, details: CreatorVerificationDetails, files: { [key: string]: File | null }): Promise<void> => {
        const updatedDetails = { ...details };
        
        for (const [key, file] of Object.entries(files)) {
            if (file) {
                const storageRef = ref(storage, `verification/${userId}/${key}_${Date.now()}`);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                
                if (key === 'registration') updatedDetails.registrationDocUrl = url;
                if (key === 'office') updatedDetails.officePhotoUrl = url;
                if (key === 'pan') updatedDetails.businessPanUrl = url;
                if (key === 'stamp') updatedDetails.channelStampUrl = url;
                if (key === 'acknowledgement') updatedDetails.acknowledgementUrl = url;
            }
        }

        await updateDoc(doc(db, 'users', userId), {
            creatorVerificationStatus: 'pending',
            creatorVerificationDetails: updatedDetails
        });
    },

    // --- Mock Verification APIs ---
    verifyPan: async (userId: string, pan: string, name: string): Promise<{ success: boolean, registeredName?: string }> => {
        // Simulate API call to backend which calls Cashfree
        const res = await fetch(`${BACKEND_URL}/verify-pan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pan, name })
        });
        return await res.json();
    },

    verifyBankAccount: async (userId: string, account: string, ifsc: string, name: string): Promise<{ success: boolean, registeredName?: string }> => {
        const res = await fetch(`${BACKEND_URL}/verify-bank`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account, ifsc, name })
        });
        return await res.json();
    },

    verifyUpi: async (userId: string, vpa: string, name: string): Promise<{ success: boolean, registeredName?: string }> => {
        const res = await fetch(`${BACKEND_URL}/verify-upi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vpa, name })
        });
        return await res.json();
    },

    verifyLiveness: async (userId: string, image: string): Promise<{ success: boolean }> => {
        const res = await fetch(`${BACKEND_URL}/verify-liveness`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, image }) // In real app, send file or S3 URL
        });
        return await res.json();
    },

    verifyAadhaarOtp: async (aadhaar: string): Promise<{ success: boolean, ref_id: string }> => {
        const res = await fetch(`${BACKEND_URL}/verify-aadhaar-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aadhaar })
        });
        return await res.json();
    },

    verifyAadhaarSubmit: async (userId: string, otp: string, refId: string): Promise<{ success: boolean }> => {
        const res = await fetch(`${BACKEND_URL}/verify-aadhaar-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, otp, refId })
        });
        if ((await res.json()).success) {
             await updateDoc(doc(db, 'users', userId), { kycStatus: 'approved', 'kycDetails.isAadhaarVerified': true });
             return { success: true };
        }
        throw new Error("OTP Verification Failed");
    },

    verifyDrivingLicense: async (userId: string, dlNo: string, dob: string): Promise<{ success: boolean }> => {
        const res = await fetch(`${BACKEND_URL}/verify-dl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dlNo, dob })
        });
        if ((await res.json()).success) {
             await updateDoc(doc(db, 'users', userId), { kycStatus: 'approved', 'kycDetails.isDlVerified': true });
             return { success: true };
        }
        throw new Error("DL Verification Failed");
    },

    uploadPayoutSelfie: async (userId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `payout_verification/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Referral ---
    generateReferralCode: async (userId: string): Promise<string> => {
        // Simple code generation
        const code = `REF${Math.floor(10000 + Math.random() * 90000)}`;
        await updateDoc(doc(db, 'users', userId), { referralCode: code });
        return code;
    },

    applyReferralCode: async (userId: string, code: string): Promise<void> => {
        // Validate code (check if exists in users)
        const q = query(collection(db, 'users'), where('referralCode', '==', code));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error("Invalid referral code.");
        
        // Apply logic (e.g. bonus coins)
        await updateDoc(doc(db, 'users', userId), { 
            referredBy: code,
            coins: increment(20)
        });
        
        // Reward referrer
        const referrerId = snap.docs[0].id;
        await updateDoc(doc(db, 'users', referrerId), {
            coins: increment(50)
        });
    },

    // --- Agreements ---
    getAgreements: async (): Promise<Agreements> => {
        const docRef = doc(db, 'settings', 'agreements');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as Agreements;
        }
        return { brand: '', influencer: '', livetv: '', banneragency: '' };
    },

    updateAgreements: async (data: Agreements): Promise<void> => {
        await setDoc(doc(db, 'settings', 'agreements'), data, { merge: true });
    },

    // --- Penalty ---
    updatePenalty: async (userId: string, amount: number): Promise<void> => {
        await fetch(`${BACKEND_URL}/update-penalty`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, amount })
        });
    },

    // --- Boosts ---
    getBoostsForUser: async (userId: string): Promise<any[]> => {
        const q = query(collection(db, 'boosts'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
    }
};
