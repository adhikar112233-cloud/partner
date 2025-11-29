
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
    CampaignApplication, 
    CollaborationRequest, 
    AdSlotRequest, 
    BannerAdBookingRequest, 
    Transaction, 
    PayoutRequest, 
    RefundRequest, 
    DailyPayoutRequest, 
    Post, 
    Comment, 
    SupportTicket, 
    TicketReply, 
    LiveHelpSession, 
    LiveHelpMessage, 
    Message, 
    AppNotification, 
    QuickReply, 
    Dispute, 
    Partner, 
    Leaderboard, 
    Agreements, 
    KycDetails, 
    CreatorVerificationDetails,
    Boost,
    PlatformBanner,
    Attachment,
    UserRole,
    SupportTicketStatus
} from '../types';

export const apiService = {
    // --- Platform Settings ---
    getPlatformSettings: async (): Promise<PlatformSettings> => {
        const docRef = doc(db, 'settings', 'platform');
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return snapshot.data() as PlatformSettings;
        }
        // Return defaults if not found
        return {
            isCommunityFeedEnabled: true,
            isCreatorMembershipEnabled: true,
            isProMembershipEnabled: true,
            isMaintenanceModeEnabled: false,
            isWelcomeMessageEnabled: true,
            isNotificationBannerEnabled: false,
            socialMediaLinks: [],
            isSocialMediaFabEnabled: true,
            isStaffRegistrationEnabled: false,
            isLiveHelpEnabled: true,
            isProfileBoostingEnabled: true,
            isCampaignBoostingEnabled: true,
            isKycIdProofRequired: true,
            isKycSelfieRequired: true,
            isInstantKycEnabled: false,
            isForgotPasswordOtpEnabled: false,
            isOtpLoginEnabled: true,
            isGoogleLoginEnabled: true,
            activePaymentGateway: 'cashfree',
            paymentGatewayApiId: '',
            paymentGatewayApiSecret: '',
            paymentGatewaySourceCode: '',
            otpApiId: '',
            boostPrices: { profile: 500, campaign: 1000, banner: 800 },
            membershipPrices: { pro_10: 1000, pro_20: 1800, pro_unlimited: 5000, basic: 500, pro: 1200, premium: 2000 },
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
            payoutSettings: { requireSelfieForPayout: true, requireLiveVideoForDailyPayout: false },
            discountSettings: {
                creatorProfileBoost: { isEnabled: false, percentage: 0 },
                brandMembership: { isEnabled: false, percentage: 0 },
                creatorMembership: { isEnabled: false, percentage: 0 },
                brandCampaignBoost: { isEnabled: false, percentage: 0 },
                brandBannerBoost: { isEnabled: false, percentage: 0 }
            }
        };
    },

    updatePlatformSettings: async (settings: PlatformSettings): Promise<void> => {
        await setDoc(doc(db, 'settings', 'platform'), settings, { merge: true });
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

    uploadPlatformBannerImage: async (file: File): Promise<string> => {
        const storageRef = ref(storage, `banners/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
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

    // --- Users & Profiles ---
    getAllUsers: async (): Promise<User[]> => {
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },

    getUsersByIds: async (userIds: string[]): Promise<User[]> => {
        if (userIds.length === 0) return [];
        // Firestore 'in' query supports up to 10 items. For more, need multiple queries.
        // For simplicity here, assuming < 10 or implementing client-side filter if needed for large sets.
        // Better: chunk requests.
        const chunks = [];
        for (let i = 0; i < userIds.length; i += 10) {
            chunks.push(userIds.slice(i, i + 10));
        }
        
        const results: User[] = [];
        for (const chunk of chunks) {
            const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() } as User));
        }
        return results;
    },

    getUserByMobile: async (mobile: string): Promise<User | null> => {
        const q = query(collection(db, 'users'), where('mobileNumber', '==', mobile));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;
        }
        return null;
    },

    getUserByEmail: async (email: string): Promise<User | null> => {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;
        }
        return null;
    },

    updateUserProfile: async (userId: string, data: Partial<User>): Promise<void> => {
        await updateDoc(doc(db, 'users', userId), data);
    },

    updateUser: async (userId: string, data: Partial<User>): Promise<void> => {
        await updateDoc(doc(db, 'users', userId), data);
    },

    uploadProfilePicture: async (userId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `profiles/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    getInfluencerProfile: async (userId: string): Promise<Influencer | null> => {
        const docRef = doc(db, 'influencers', userId);
        const snapshot = await getDoc(docRef);
        return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Influencer : null;
    },

    updateInfluencerProfile: async (userId: string, data: Partial<Influencer>): Promise<void> => {
        const influencerRef = doc(db, 'influencers', userId);
        const snapshot = await getDoc(influencerRef);
        if (snapshot.exists()) {
            await updateDoc(influencerRef, data);
        } else {
            await setDoc(influencerRef, data);
        }
    },

    getInfluencersPaginated: async ({ limit: limitVal, startAfterDoc }: { limit: number, startAfterDoc?: QueryDocumentSnapshot<DocumentData> }): Promise<{ influencers: Influencer[], lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => {
        let q = query(collection(db, 'influencers'), limit(limitVal));
        if (startAfterDoc) {
            q = query(collection(db, 'influencers'), startAfter(startAfterDoc), limit(limitVal));
        }
        
        const snapshot = await getDocs(q);
        const influencers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Influencer));
        const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
        
        return { influencers, lastVisible };
    },

    followUser: async (currentUserId: string, targetUserId: string): Promise<void> => {
        const batch = writeBatch(db);
        const currentUserRef = doc(db, 'users', currentUserId);
        const targetUserRef = doc(db, 'users', targetUserId);

        batch.update(currentUserRef, { following: arrayUnion(targetUserId) });
        batch.update(targetUserRef, { followers: arrayUnion(currentUserId) });

        await batch.commit();
    },

    unfollowUser: async (currentUserId: string, targetUserId: string): Promise<void> => {
        const batch = writeBatch(db);
        const currentUserRef = doc(db, 'users', currentUserId);
        const targetUserRef = doc(db, 'users', targetUserId);

        batch.update(currentUserRef, { following: arrayRemove(targetUserId) });
        batch.update(targetUserRef, { followers: arrayRemove(currentUserId) });

        await batch.commit();
    },

    saveFcmToken: async (userId: string, token: string | null): Promise<void> => {
        await updateDoc(doc(db, 'users', userId), { fcmToken: token });
    },

    applyReferralCode: async (userId: string, code: string): Promise<void> => {
        // Simple mock logic for referral
        // Ideally verify code exists in a 'referrals' collection or user profile
        const q = query(collection(db, 'users'), where('referralCode', '==', code));
        const snapshot = await getDocs(q);
        if (snapshot.empty) throw new Error("Invalid referral code");
        
        const referrer = snapshot.docs[0];
        if (referrer.id === userId) throw new Error("Cannot use your own code");

        const batch = writeBatch(db);
        batch.update(doc(db, 'users', userId), { referredBy: code, coins: increment(20) });
        batch.update(doc(db, 'users', referrer.id), { coins: increment(50) });
        await batch.commit();
    },

    generateReferralCode: async (userId: string): Promise<string> => {
        const code = `REF${userId.substring(0, 4).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
        await updateDoc(doc(db, 'users', userId), { referralCode: code });
        return code;
    },

    updatePenalty: async (userId: string, amount: number): Promise<void> => {
        // Secure call via backend function preferred, but direct update for admin logic here
        await updateDoc(doc(db, 'users', userId), { pendingPenalty: amount });
    },

    getBoostsForUser: async (userId: string): Promise<Boost[]> => {
        const q = query(collection(db, 'boosts'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Boost));
    },

    // --- Admin User Management ---
    adminChangePassword: async (userId: string, newPassword: string): Promise<void> => {
        // This should call a Cloud Function as Client SDK cannot change other user's password
        const response = await fetch(`${BACKEND_URL}/admin-change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, newPassword })
        });
        if (!response.ok) throw new Error("Failed to update password");
    },

    // --- Live TV & Ads ---
    getLiveTvChannels: async (settings?: PlatformSettings): Promise<LiveTvChannel[]> => {
        const q = query(collection(db, 'livetv_channels'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveTvChannel));
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

    getAllOpenCampaigns: async (location?: string): Promise<Campaign[]> => {
        let q = query(collection(db, 'campaigns'), where('status', '==', 'open'));
        const snapshot = await getDocs(q);
        let campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        if (location && location !== 'All') {
            campaigns = campaigns.filter(c => !c.location || c.location === 'All' || c.location === location);
        }
        return campaigns;
    },

    getCampaignsForBrand: async (brandId: string): Promise<Campaign[]> => {
        const q = query(collection(db, 'campaigns'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
    },

    applyToCampaign: async (application: Omit<CampaignApplication, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        // Check if already applied
        const q = query(
            collection(db, 'campaign_applications'), 
            where('campaignId', '==', application.campaignId),
            where('influencerId', '==', application.influencerId)
        );
        const existing = await getDocs(q);
        if (!existing.empty) throw new Error("Already applied to this campaign");

        const batch = writeBatch(db);
        const appRef = doc(collection(db, 'campaign_applications'));
        batch.set(appRef, {
            ...application,
            status: 'pending_brand_review',
            timestamp: serverTimestamp()
        });
        
        // Update campaign applicant list
        const campaignRef = doc(db, 'campaigns', application.campaignId);
        batch.update(campaignRef, { applicantIds: arrayUnion(application.influencerId) });

        await batch.commit();
        
        // Notify Brand
        await addDoc(collection(db, `users/${application.brandId}/notifications`), {
            title: "New Campaign Application",
            body: `${application.influencerName} applied to "${application.campaignTitle}"`,
            type: "new_campaign_applicant",
            view: "campaigns",
            relatedId: application.campaignId,
            isRead: false,
            timestamp: serverTimestamp()
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

    updateCampaignApplication: async (id: string, data: Partial<CampaignApplication>, userId?: string): Promise<void> => {
        await updateDoc(doc(db, 'campaign_applications', id), data);
    },

    sendCollabRequest: async (request: Omit<CollaborationRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        const docRef = await addDoc(collection(db, 'collaboration_requests'), {
            ...request,
            status: 'pending',
            timestamp: serverTimestamp(),
            collabId: `DIR${Date.now().toString().slice(-6)}`
        });
        
        // Notify Influencer
        await addDoc(collection(db, `users/${request.influencerId}/notifications`), {
            title: "New Collaboration Request",
            body: `${request.brandName} wants to collaborate: "${request.title}"`,
            type: "new_collab_request",
            view: "collab_requests",
            relatedId: docRef.id,
            isRead: false,
            timestamp: serverTimestamp()
        });
    },

    getCollabRequestsForBrand: async (brandId: string): Promise<CollaborationRequest[]> => {
        const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    },

    getCollabRequestsForBrandListener: (brandId: string, onUpdate: (data: CollaborationRequest[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId));
        return onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
            onUpdate(requests);
        }, onError);
    },

    getCollabRequestsForInfluencer: async (influencerId: string): Promise<CollaborationRequest[]> => {
        const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    },

    getCollabRequestsForInfluencerListener: (influencerId: string, onUpdate: (data: CollaborationRequest[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId));
        return onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
            onUpdate(requests);
        }, onError);
    },

    updateCollaborationRequest: async (id: string, data: Partial<CollaborationRequest>, userId: string): Promise<void> => {
        await updateDoc(doc(db, 'collaboration_requests', id), data);
    },

    // --- Ad Requests ---
    sendAdSlotRequest: async (request: Omit<AdSlotRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'ad_slot_requests'), {
            ...request,
            status: 'pending_approval',
            timestamp: serverTimestamp(),
            collabId: `LTV${Date.now().toString().slice(-6)}`
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

    updateAdSlotRequest: async (id: string, data: Partial<AdSlotRequest>, userId: string): Promise<void> => {
        await updateDoc(doc(db, 'ad_slot_requests', id), data);
    },

    sendBannerAdBookingRequest: async (request: Omit<BannerAdBookingRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'banner_ad_booking_requests'), {
            ...request,
            status: 'pending_approval',
            timestamp: serverTimestamp(),
            collabId: `BNR${Date.now().toString().slice(-6)}`
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

    updateBannerAdBookingRequest: async (id: string, data: Partial<BannerAdBookingRequest>, userId: string): Promise<void> => {
        await updateDoc(doc(db, 'banner_ad_booking_requests', id), data);
    },

    deleteCollaboration: async (id: string, collectionName: string): Promise<void> => {
        await deleteDoc(doc(db, collectionName, id));
    },

    cancelCollaboration: async (userId: string, collaborationId: string, collectionName: string, reason: string, penaltyAmount: number): Promise<void> => {
        // This is a complex operation involving penalty logic, better handled by backend function
        const response = await fetch(`${BACKEND_URL}/cancel-collaboration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, collaborationId, collectionName, reason, penaltyAmount })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Failed to cancel collaboration");
        }
    },

    // --- Admin Data Getters ---
    getAllCollaborationRequests: async (): Promise<CollaborationRequest[]> => {
        const snapshot = await getDocs(collection(db, 'collaboration_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    },
    getAllCampaignApplications: async (): Promise<CampaignApplication[]> => {
        const snapshot = await getDocs(collection(db, 'campaign_applications'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignApplication));
    },
    getAllAdSlotRequests: async (): Promise<AdSlotRequest[]> => {
        const snapshot = await getDocs(collection(db, 'ad_slot_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdSlotRequest));
    },
    getAllBannerAdBookingRequests: async (): Promise<BannerAdBookingRequest[]> => {
        const snapshot = await getDocs(collection(db, 'banner_ad_booking_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAdBookingRequest));
    },
    
    // --- Chat & Messages ---
    getConversations: async (userId: string): Promise<any[]> => {
        // Basic implementation: fetch distinct users from messages
        // Real implementation would usually have a 'conversations' collection
        // Returning empty for now as simple client-side chat would need optimized schema
        return []; 
    },

    getMessagesListener: (user1Id: string, user2Id: string, onUpdate: (msgs: Message[]) => void, onError: (err: any) => void) => {
        const chatId = [user1Id, user2Id].sort().join('_');
        const q = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
        return onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : 'Just now'
                } as Message;
            });
            onUpdate(msgs);
        }, onError);
    },

    sendMessage: async (text: string, senderId: string, receiverId: string, attachments: Attachment[] = []): Promise<void> => {
        const chatId = [senderId, receiverId].sort().join('_');
        await addDoc(collection(db, `chats/${chatId}/messages`), {
            text,
            senderId,
            receiverId,
            attachments,
            timestamp: serverTimestamp()
        });
        
        // Send notification to receiver
        await addDoc(collection(db, `users/${receiverId}/notifications`), {
            title: "New Message",
            body: `You have a new message.`,
            type: "new_message",
            view: "messages",
            relatedId: chatId,
            isRead: false,
            timestamp: serverTimestamp()
        });
    },

    uploadMessageAttachment: async (messageId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `chat_attachments/${messageId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Notifications ---
    getNotificationsForUserListener: (userId: string, onUpdate: (n: AppNotification[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, `users/${userId}/notifications`), orderBy('timestamp', 'desc'), limit(20));
        return onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
            onUpdate(notifs);
        }, onError);
    },

    markNotificationAsRead: async (userId: string, notificationId: string): Promise<void> => {
        await updateDoc(doc(db, `users/${userId}/notifications`, notificationId), { isRead: true });
    },

    markAllNotificationsAsRead: async (userId: string): Promise<void> => {
        const q = query(collection(db, `users/${userId}/notifications`), where('isRead', '==', false));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach(doc => batch.update(doc.ref, { isRead: true }));
        await batch.commit();
    },

    // --- Community & Posts ---
    createPost: async (post: Omit<Post, 'id'>): Promise<Post> => {
        const docRef = await addDoc(collection(db, 'posts'), post);
        return { id: docRef.id, ...post } as Post;
    },

    getPosts: async (userId?: string): Promise<Post[]> => {
        const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
        
        // Filter blocked/private posts on client side for now (Firestore security rules should handle this in prod)
        return posts.filter(p => !p.isBlocked && (p.visibility === 'public' || p.userId === userId));
    },

    uploadPostImage: async (postId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `posts/${postId}/${Date.now()}_${file.name}`);
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
        const q = query(collection(db, `posts/${postId}/comments`), orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
    },

    addCommentToPost: async (postId: string, comment: Omit<Comment, 'id' | 'timestamp'>): Promise<void> => {
        const batch = writeBatch(db);
        const commentRef = doc(collection(db, `posts/${postId}/comments`));
        batch.set(commentRef, { ...comment, timestamp: serverTimestamp() });
        batch.update(doc(db, 'posts', postId), { commentCount: increment(1) });
        await batch.commit();
    },

    // --- Financials ---
    getAllTransactions: async (): Promise<Transaction[]> => {
        // Removed orderBy to avoid index error with no where clause (should be fine, but consistent practice)
        // If sorting needed, do client side for simple cases or add index
        const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Transaction));
    },

    getTransactionsForUser: async (userId: string): Promise<Transaction[]> => {
        // Removed orderBy to avoid index requirement on (userId, timestamp)
        const q = query(collection(db, 'transactions'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Transaction));
        
        // Client-side sorting
        return transactions.sort((a, b) => {
            const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
            const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
            return tB - tA;
        });
    },

    getAllPayouts: async (): Promise<PayoutRequest[]> => {
        const snapshot = await getDocs(collection(db, 'payout_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest));
    },

    getPayoutHistoryForUser: async (userId: string): Promise<PayoutRequest[]> => {
        const q = query(collection(db, 'payout_requests'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest));
    },

    getAllRefunds: async (): Promise<RefundRequest[]> => {
        const snapshot = await getDocs(collection(db, 'refund_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RefundRequest));
    },

    getRefundsForUser: async (userId: string): Promise<RefundRequest[]> => {
        const q = query(collection(db, 'refund_requests'), where('brandId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RefundRequest));
    },

    createRefundRequest: async (request: Omit<RefundRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
        await addDoc(collection(db, 'refund_requests'), {
            ...request,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        
        // Update collaboration status
        let collectionName = '';
        if (request.collabType === 'direct') collectionName = 'collaboration_requests';
        else if (request.collabType === 'campaign') collectionName = 'campaign_applications';
        else if (request.collabType === 'ad_slot') collectionName = 'ad_slot_requests';
        else if (request.collabType === 'banner_booking') collectionName = 'banner_ad_booking_requests';
        
        if (collectionName) {
            await updateDoc(doc(db, collectionName, request.collaborationId), { 
                status: 'refund_pending_admin_review' 
            });
        }
    },

    updateRefundRequest: async (id: string, data: Partial<RefundRequest>): Promise<void> => {
        await updateDoc(doc(db, 'refund_requests', id), data);
    },

    submitPayoutRequest: async (request: any): Promise<void> => {
        await addDoc(collection(db, 'payout_requests'), {
            ...request,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        
        // Update collab status
        let collectionName = '';
        if (request.collaborationType === 'direct') collectionName = 'collaboration_requests';
        else if (request.collaborationType === 'campaign') collectionName = 'campaign_applications';
        else if (request.collaborationType === 'ad_slot') collectionName = 'ad_slot_requests';
        else if (request.collaborationType === 'banner_booking') collectionName = 'banner_ad_booking_requests';

        if (collectionName && request.collaborationId) {
            await updateDoc(doc(db, collectionName, request.collaborationId), {
                paymentStatus: 'payout_requested'
            });
        }
    },

    updatePayoutStatus: async (id: string, status: string, collabId: string, collabType: string, reason?: string): Promise<void> => {
        const updateData: any = { status };
        if (reason) updateData.rejectionReason = reason;
        await updateDoc(doc(db, 'payout_requests', id), updateData);
        
        if (status === 'approved' || status === 'completed') {
             // Update collab payment status
             let collectionName = '';
             if (collabType === 'direct') collectionName = 'collaboration_requests';
             else if (collabType === 'campaign') collectionName = 'campaign_applications';
             else if (collabType === 'ad_slot') collectionName = 'ad_slot_requests';
             else if (collabType === 'banner_booking') collectionName = 'banner_ad_booking_requests';
             
             if (collectionName) {
                 await updateDoc(doc(db, collectionName, collabId), { paymentStatus: 'payout_complete' });
             }
        }
    },

    processPayout: async (requestId: string, requestType: string): Promise<void> => {
        // Calls the backend function to trigger payout
        const response = await fetch(`${BACKEND_URL}/process-payout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, requestType })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Payout processing failed");
        }
    },

    getAllDailyPayouts: async (): Promise<DailyPayoutRequest[]> => {
        const snapshot = await getDocs(collection(db, 'daily_payout_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyPayoutRequest));
    },

    submitDailyPayoutRequest: async (request: any): Promise<void> => {
        await addDoc(collection(db, 'daily_payout_requests'), {
            ...request,
            status: 'pending',
            timestamp: serverTimestamp()
        });
    },

    updateDailyPayoutRequest: async (id: string, data: Partial<DailyPayoutRequest>): Promise<void> => {
        await updateDoc(doc(db, 'daily_payout_requests', id), data);
    },

    updateDailyPayoutRequestStatus: async (id: string, collabId: string, collabType: 'ad_slot' | 'banner_booking', status: 'approved' | 'rejected', amount?: number, reason?: string): Promise<void> => {
        const updateData: any = { status };
        if (amount) updateData.approvedAmount = amount;
        if (reason) updateData.rejectionReason = reason;
        
        await updateDoc(doc(db, 'daily_payout_requests', id), updateData);

        if (status === 'approved' && amount) {
            const collectionName = collabType === 'ad_slot' ? 'ad_slot_requests' : 'banner_ad_booking_requests';
            await updateDoc(doc(db, collectionName, collabId), {
                dailyPayoutsReceived: increment(amount)
            });
        }
    },

    uploadDailyPayoutVideo: async (userId: string, blob: Blob): Promise<string> => {
        const storageRef = ref(storage, `daily_payout_proofs/${userId}/${Date.now()}.webm`);
        await uploadBytes(storageRef, blob);
        return getDownloadURL(storageRef);
    },

    getActiveAdCollabsForAgency: async (agencyId: string, role: 'livetv' | 'banneragency'): Promise<(AdSlotRequest | BannerAdBookingRequest)[]> => {
        const now = new Date().toISOString().split('T')[0];
        let q;
        if (role === 'livetv') {
            q = query(
                collection(db, 'ad_slot_requests'), 
                where('liveTvId', '==', agencyId), 
                where('status', 'in', ['in_progress', 'work_submitted'])
            );
        } else {
            q = query(
                collection(db, 'banner_ad_booking_requests'), 
                where('agencyId', '==', agencyId), 
                where('status', 'in', ['in_progress', 'work_submitted'])
            );
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    },

    // --- KYC & Verification ---
    getKycSubmissions: async (): Promise<User[]> => {
        const q = query(collection(db, 'users'), where('kycStatus', '==', 'pending'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },

    submitKyc: async (userId: string, data: KycDetails, idProofFile: File | null, selfieFile: File | null, panFile: File | null): Promise<void> => {
        let idProofUrl = data.idProofUrl;
        let selfieUrl = data.selfieUrl;
        let panCardUrl = data.panCardUrl;

        if (idProofFile) {
            const ref1 = ref(storage, `kyc/${userId}/id_proof`);
            await uploadBytes(ref1, idProofFile);
            idProofUrl = await getDownloadURL(ref1);
        }
        
        // Handling base64 selfie data url properly if passed as file
        if (selfieFile) {
             const ref2 = ref(storage, `kyc/${userId}/selfie`);
             await uploadBytes(ref2, selfieFile);
             selfieUrl = await getDownloadURL(ref2);
        } else if (data.selfieUrl && data.selfieUrl.startsWith('data:')) {
             // Handle base64 string upload
             const ref2 = ref(storage, `kyc/${userId}/selfie`);
             const response = await fetch(data.selfieUrl);
             const blob = await response.blob();
             await uploadBytes(ref2, blob);
             selfieUrl = await getDownloadURL(ref2);
        }

        if (panFile) {
            const ref3 = ref(storage, `kyc/${userId}/pan_card`);
            await uploadBytes(ref3, panFile);
            panCardUrl = await getDownloadURL(ref3);
        }

        await updateDoc(doc(db, 'users', userId), {
            kycStatus: 'pending',
            kycDetails: { ...data, idProofUrl, selfieUrl, panCardUrl }
        });
    },

    verifyLiveness: async (userId: string, imageBase64: string): Promise<{ success: boolean }> => {
        // Backend call to mock Liveness or use external API
        const response = await fetch(`${BACKEND_URL}/verify-liveness`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, image: imageBase64 })
        });
        return response.json();
    },

    verifyAadhaarOtp: async (aadhaar: string): Promise<{ success: boolean; ref_id: string }> => {
        const response = await fetch(`${BACKEND_URL}/verify-aadhaar-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aadhaar })
        });
        return response.json();
    },

    verifyAadhaarSubmit: async (userId: string, otp: string, refId: string): Promise<void> => {
        const response = await fetch(`${BACKEND_URL}/verify-aadhaar-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, otp, ref_id: refId })
        });
        if (!response.ok) throw new Error("Verification failed");
        
        await updateDoc(doc(db, 'users', userId), {
            kycStatus: 'approved',
            'kycDetails.isAadhaarVerified': true
        });
    },

    verifyPan: async (userId: string, pan: string, name: string): Promise<{ success: boolean }> => {
        const response = await fetch(`${BACKEND_URL}/verify-pan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, pan, name })
        });
        const data = await response.json();
        if(data.success) {
             await updateDoc(doc(db, 'users', userId), {
                'kycDetails.panCardUrl': 'VERIFIED_INSTANTLY',
                'kycDetails.isPanVerified': true
            });
        }
        return data;
    },

    verifyDrivingLicense: async (userId: string, dlNo: string, dob: string): Promise<void> => {
        const response = await fetch(`${BACKEND_URL}/verify-dl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, dlNo, dob })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || "DL Verification Failed");
        
        await updateDoc(doc(db, 'users', userId), {
            kycStatus: 'approved',
            'kycDetails.isDlVerified': true
        });
    },

    verifyBankAccount: async (userId: string, account: string, ifsc: string, name: string): Promise<{ success: boolean, registeredName?: string }> => {
        const response = await fetch(`${BACKEND_URL}/verify-bank`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, account, ifsc, name })
        });
        return response.json();
    },

    verifyUpi: async (userId: string, vpa: string, name: string): Promise<{ success: boolean, registeredName?: string }> => {
        const response = await fetch(`${BACKEND_URL}/verify-upi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, vpa, name })
        });
        return response.json();
    },

    uploadPayoutSelfie: async (userId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `payout_proofs/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    getPendingCreatorVerifications: async (): Promise<User[]> => {
        const q = query(collection(db, 'users'), where('creatorVerificationStatus', '==', 'pending'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },

    submitCreatorVerification: async (userId: string, data: CreatorVerificationDetails, files: { [key: string]: File | null }): Promise<void> => {
        const updatedDetails = { ...data };
        
        for (const [key, file] of Object.entries(files)) {
            if (file) {
                const storageRef = ref(storage, `creator_verification/${userId}/${key}_${Date.now()}`);
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

    // --- Support & Live Help ---
    createSupportTicket: async (ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>, initialMessage: Omit<TicketReply, 'id' | 'timestamp' | 'ticketId'>): Promise<void> => {
        const batch = writeBatch(db);
        const ticketRef = doc(collection(db, 'support_tickets'));
        batch.set(ticketRef, {
            ...ticket,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        const messageRef = doc(collection(db, `support_tickets/${ticketRef.id}/replies`));
        batch.set(messageRef, {
            ...initialMessage,
            ticketId: ticketRef.id,
            timestamp: serverTimestamp()
        });
        await batch.commit();
    },

    getAllTickets: async (): Promise<SupportTicket[]> => {
        const q = query(collection(db, 'support_tickets'), orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
    },

    getTicketsForUser: async (userId: string): Promise<SupportTicket[]> => {
        // Removed orderBy to avoid index requirement
        const q = query(collection(db, 'support_tickets'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
        
        // Client-side sorting
        return tickets.sort((a, b) => {
            const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
            const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
            return tB - tA;
        });
    },

    getTicketReplies: async (ticketId: string): Promise<TicketReply[]> => {
        const q = query(collection(db, `support_tickets/${ticketId}/replies`), orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TicketReply));
    },

    addTicketReply: async (reply: Omit<TicketReply, 'id' | 'timestamp'>): Promise<void> => {
        const batch = writeBatch(db);
        const replyRef = doc(collection(db, `support_tickets/${reply.ticketId}/replies`));
        batch.set(replyRef, { ...reply, timestamp: serverTimestamp() });
        batch.update(doc(db, 'support_tickets', reply.ticketId), { 
            updatedAt: serverTimestamp(),
            status: reply.senderRole === 'staff' ? 'in_progress' : 'open' // Re-open if user replies
        });
        await batch.commit();
    },

    updateTicketStatus: async (ticketId: string, status: SupportTicketStatus): Promise<void> => {
        await updateDoc(doc(db, 'support_tickets', ticketId), { status });
    },

    uploadTicketAttachment: async (ticketId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `tickets/${ticketId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    getAllLiveHelpSessionsListener: (onUpdate: (sessions: LiveHelpSession[]) => void) => {
        const q = query(collection(db, 'live_help_sessions'), orderBy('updatedAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveHelpSession));
            onUpdate(sessions);
        });
    },

    getSessionsForUser: async (userId: string): Promise<LiveHelpSession[]> => {
        // Removed orderBy to avoid index requirement
        const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveHelpSession));
        
        // Client-side sorting
        return sessions.sort((a, b) => {
            const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
            const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
            return tB - tA;
        });
    },

    getOrCreateLiveHelpSession: async (userId: string, userName: string, userAvatar: string, staffId: string): Promise<string> => {
        // Check for existing open session
        const q = query(
            collection(db, 'live_help_sessions'), 
            where('userId', '==', userId), 
            where('status', 'in', ['open', 'unassigned'])
        );
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
            assignedStaffAvatar: staffUser.avatar
        });
    },

    sendLiveHelpMessage: async (sessionId: string, senderId: string, senderName: string, text: string): Promise<void> => {
        const batch = writeBatch(db);
        const msgRef = doc(collection(db, `live_help_sessions/${sessionId}/messages`));
        batch.set(msgRef, {
            senderId,
            senderName,
            text,
            timestamp: serverTimestamp()
        });
        batch.update(doc(db, 'live_help_sessions', sessionId), { updatedAt: serverTimestamp() });
        await batch.commit();
    },

    reopenLiveHelpSession: async (sessionId: string): Promise<void> => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), { 
            status: 'unassigned', // Set to unassigned to alert staff
            updatedAt: serverTimestamp()
        });
    },

    closeLiveHelpSession: async (sessionId: string): Promise<void> => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), { status: 'closed' });
    },

    getQuickRepliesListener: (onUpdate: (replies: QuickReply[]) => void) => {
        const q = query(collection(db, 'quick_replies'));
        return onSnapshot(q, (snapshot) => {
            onUpdate(snapshot.docs.map(doc => ({ id: doc.id, text: doc.data().text } as QuickReply)));
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

    // --- Marketing & Communication ---
    sendBulkEmail: async (role: UserRole, subject: string, body: string): Promise<void> => {
        // Mock implementation or call backend
        console.log(`Sending email to ${role}s: ${subject}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    },

    sendPushNotification: async (title: string, body: string, targetRole: UserRole | 'all', url?: string): Promise<void> => {
        // This would typically write to a 'notifications' collection that triggers a Cloud Function
        // or call a backend endpoint.
        const batch = writeBatch(db);
        
        let q;
        if (targetRole === 'all') {
            q = query(collection(db, 'users')); // In real app, might need to paginate/chunk
        } else {
            q = query(collection(db, 'users'), where('role', '==', targetRole));
        }
        
        const snapshot = await getDocs(q);
        
        // Note: Creating individual notifications for all users is expensive. 
        // Better to use FCM topics or a Cloud Function to fan out.
        // Here we just simulate for the first 500 to respect batch limits.
        let count = 0;
        snapshot.forEach(doc => {
            if (count < 500) {
                const notifRef = doc.ref.parent.parent ? collection(doc.ref, 'notifications') : collection(db, `users/${doc.id}/notifications`);
                // Note: subcollection path construction
                const newNotifRef = doc(collection(db, `users/${doc.id}/notifications`));
                batch.set(newNotifRef, {
                    title,
                    body,
                    type: 'system',
                    view: 'dashboard',
                    timestamp: serverTimestamp(),
                    isRead: false
                });
                count++;
            }
        });
        await batch.commit();
    },

    // --- Partners ---
    getPartners: async (): Promise<Partner[]> => {
        const snapshot = await getDocs(collection(db, 'partners'));
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
        const storageRef = ref(storage, `partners/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Leaderboards ---
    getActiveLeaderboards: async (): Promise<Leaderboard[]> => {
        const q = query(collection(db, 'leaderboards'), where('isActive', '==', true));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leaderboard));
    },

    getLeaderboards: async (): Promise<Leaderboard[]> => {
        const snapshot = await getDocs(collection(db, 'leaderboards'));
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

    // --- Agreements ---
    getAgreements: async (): Promise<Agreements> => {
        const docRef = doc(db, 'settings', 'agreements');
        const snap = await getDoc(docRef);
        if (snap.exists()) return snap.data() as Agreements;
        return { brand: '', influencer: '', livetv: '', banneragency: '' };
    },

    updateAgreements: async (data: Agreements): Promise<void> => {
        await setDoc(doc(db, 'settings', 'agreements'), data);
    },

    // --- Disputes ---
    createDispute: async (dispute: Omit<Dispute, 'id' | 'timestamp' | 'status'>): Promise<void> => {
        await addDoc(collection(db, 'disputes'), {
            ...dispute,
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

    // --- Data Seeding (Helper) ---
    initializeFirestoreData: async (): Promise<void> => {
        // Optional: Implement seed logic if collections are empty
        // For production apps, typically handled by admin scripts
    }
};
