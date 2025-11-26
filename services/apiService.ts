
// ... (Previous imports remain unchanged)
import { db, storage, BACKEND_URL } from './firebase';
import { 
    collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, 
    query, where, orderBy, limit, startAfter, serverTimestamp, 
    Timestamp, onSnapshot, writeBatch, arrayUnion, arrayRemove, increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
    PlatformSettings, User, Influencer, Post, Comment, 
    CollaborationRequest, Campaign, CampaignApplication, 
    AdSlotRequest, BannerAd, BannerAdBookingRequest, 
    Transaction, PayoutRequest, RefundRequest, DailyPayoutRequest,
    SupportTicket, TicketReply, LiveTvChannel, Partner,
    LiveHelpSession, QuickReply, AppNotification, CreatorVerificationDetails, UserRole, AnyCollaboration, Dispute
} from '../types';

// Helper to safely get time for sorting
const getTime = (ts: any): number => {
    if (!ts) return 0;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (typeof ts === 'number') return ts;
    return 0;
};

// Default settings if not found in DB
const DEFAULT_SETTINGS: PlatformSettings = {
    // ... (No changes to default settings)
    isCommunityFeedEnabled: true,
    isCreatorMembershipEnabled: true,
    isProMembershipEnabled: true,
    isMaintenanceModeEnabled: false,
    isWelcomeMessageEnabled: true,
    isNotificationBannerEnabled: false,
    isSocialMediaFabEnabled: true,
    isStaffRegistrationEnabled: false,
    isLiveHelpEnabled: true,
    isProfileBoostingEnabled: true,
    isCampaignBoostingEnabled: true,
    isKycIdProofRequired: true,
    isKycSelfieRequired: true,
    isDigilockerKycEnabled: false,
    isForgotPasswordOtpEnabled: false,
    isOtpLoginEnabled: true,
    activePaymentGateway: 'cashfree',
    paymentGatewayApiId: '',
    paymentGatewayApiSecret: '',
    paymentGatewayWebhookSecret: '',
    payoutClientId: '',
    payoutClientSecret: '',
    cashfreeKycClientId: '',
    cashfreeKycClientSecret: '',
    paymentGatewaySourceCode: '',
    otpApiId: '',
    socialMediaLinks: [],
    boostPrices: { profile: 999, campaign: 1999, banner: 1499 },
    membershipPrices: { pro_10: 4999, pro_20: 8999, pro_unlimited: 19999, basic: 999, pro: 4999, premium: 9999 },
    isPlatformCommissionEnabled: true,
    platformCommissionRate: 10,
    isPaymentProcessingChargeEnabled: true,
    paymentProcessingChargeRate: 2,
    isGstEnabled: true,
    gstRate: 18,
    payoutSettings: { requireSelfieForPayout: true, requireLiveVideoForDailyPayout: true },
    discountSettings: {
        creatorProfileBoost: { isEnabled: false, percentage: 0 },
        brandMembership: { isEnabled: false, percentage: 0 },
        creatorMembership: { isEnabled: false, percentage: 0 },
        brandCampaignBoost: { isEnabled: false, percentage: 0 }
    }
};

export const apiService = {
    // ... (Previous methods remain unchanged until verifyPan)
    initializeFirestoreData: async () => {
        // Optional: Create initial collections or settings if empty
    },

    // --- Platform Settings ---
    getPlatformSettings: async (): Promise<PlatformSettings> => {
        try {
            const docRef = doc(db, 'settings', 'platform');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { ...DEFAULT_SETTINGS, ...docSnap.data() } as PlatformSettings;
            } else {
                // Initialize if missing
                return DEFAULT_SETTINGS;
            }
        } catch (error) {
            console.warn("Could not fetch settings, using defaults:", error);
            return DEFAULT_SETTINGS;
        }
    },

    updatePlatformSettings: async (settings: PlatformSettings) => {
        const docRef = doc(db, 'settings', 'platform');
        await setDoc(docRef, settings, { merge: true });
    },

    // --- Users & Profiles ---
    getAllUsers: async (): Promise<User[]> => {
        const q = query(collection(db, 'users'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
    },

    getUsersPaginated: async (options: { pageLimit: number, startAfterDoc?: any }) => {
        let q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(options.pageLimit));
        if (options.startAfterDoc) {
            q = query(q, startAfter(options.startAfterDoc));
        }
        const snapshot = await getDocs(q);
        return {
            users: snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User)),
            lastVisible: snapshot.docs[snapshot.docs.length - 1]
        };
    },

    getUserByEmail: async (email: string): Promise<User | null> => {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;
    },

    getUserByMobile: async (mobile: string): Promise<User | null> => {
        const q = query(collection(db, 'users'), where('mobileNumber', '==', mobile));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;
    },

    updateUser: async (userId: string, data: Partial<User>) => {
        await updateDoc(doc(db, 'users', userId), data);
    },

    updateUserProfile: async (userId: string, data: Partial<User>) => {
        await updateDoc(doc(db, 'users', userId), data);
    },

    updateUserMembership: async (userId: string, isActive: boolean) => {
        await updateDoc(doc(db, 'users', userId), {
            'membership.isActive': isActive
        });
    },

    uploadProfilePicture: async (userId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `avatars/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Influencers ---
    getInfluencersPaginated: async (settings: PlatformSettings, options: { limit: number, startAfterDoc?: any }) => {
        let q = query(collection(db, 'influencers'), orderBy('followers', 'desc'), limit(options.limit));
        if (options.startAfterDoc) {
            q = query(q, startAfter(options.startAfterDoc));
        }
        const snapshot = await getDocs(q);
        const influencers = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Influencer));
        return { influencers, lastVisible: snapshot.docs[snapshot.docs.length - 1] };
    },

    getInfluencerProfile: async (id: string): Promise<Influencer | null> => {
        const docRef = doc(db, 'influencers', id);
        const snap = await getDoc(docRef);
        return snap.exists() ? ({ id: snap.id, ...snap.data() } as Influencer) : null;
    },

    updateInfluencerProfile: async (id: string, data: Partial<Influencer>) => {
        await setDoc(doc(db, 'influencers', id), data, { merge: true });
    },

    // --- Live TV ---
    getLiveTvChannels: async (settings: PlatformSettings): Promise<LiveTvChannel[]> => {
        const snapshot = await getDocs(collection(db, 'livetv_channels'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LiveTvChannel));
    },

    // --- Banner Ads ---
    createBannerAd: async (ad: Omit<BannerAd, 'id'>) => {
        await addDoc(collection(db, 'banner_ads'), {
            ...ad,
            timestamp: serverTimestamp()
        });
    },

    getBannerAds: async (locationQuery: string, settings: PlatformSettings): Promise<BannerAd[]> => {
        let q = collection(db, 'banner_ads');
        const snapshot = await getDocs(q);
        let ads = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAd));
        if (locationQuery) {
            const lower = locationQuery.toLowerCase();
            ads = ads.filter(ad => ad.location.toLowerCase().includes(lower));
        }
        return ads;
    },

    getBannerAdsForAgency: async (agencyId: string): Promise<BannerAd[]> => {
        const q = query(collection(db, 'banner_ads'), where('agencyId', '==', agencyId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAd));
    },

    uploadBannerAdPhoto: async (userId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `banner_ads/${userId}_${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    sendBannerAdBookingRequest: async (req: Omit<BannerAdBookingRequest, 'id' | 'status' | 'timestamp'>) => {
        await addDoc(collection(db, 'banner_booking_requests'), {
            ...req,
            status: 'pending_approval',
            timestamp: serverTimestamp()
        });
    },

    getBannerAdBookingRequestsForAgency: async (agencyId: string): Promise<BannerAdBookingRequest[]> => {
        const q = query(collection(db, 'banner_booking_requests'), where('agencyId', '==', agencyId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest));
    },

    getBannerAdBookingRequestsForBrand: async (brandId: string): Promise<BannerAdBookingRequest[]> => {
        const q = query(collection(db, 'banner_booking_requests'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest));
    },

    getAllBannerAdBookingRequests: async (): Promise<BannerAdBookingRequest[]> => {
        const snapshot = await getDocs(collection(db, 'banner_booking_requests'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest));
    },

    updateBannerAdBookingRequest: async (id: string, data: Partial<BannerAdBookingRequest>, updaterId: string) => {
        await updateDoc(doc(db, 'banner_booking_requests', id), data);
    },

    // --- Ad Slot Requests (Live TV) ---
    sendAdSlotRequest: async (req: Omit<AdSlotRequest, 'id' | 'status' | 'timestamp'>) => {
        await addDoc(collection(db, 'ad_slot_requests'), {
            ...req,
            status: 'pending_approval',
            timestamp: serverTimestamp()
        });
    },

    getAdSlotRequestsForLiveTv: async (liveTvId: string): Promise<AdSlotRequest[]> => {
        const q = query(collection(db, 'ad_slot_requests'), where('liveTvId', '==', liveTvId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest));
    },

    getAdSlotRequestsForBrand: async (brandId: string): Promise<AdSlotRequest[]> => {
        const q = query(collection(db, 'ad_slot_requests'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest));
    },

    getAllAdSlotRequests: async (): Promise<AdSlotRequest[]> => {
        const snapshot = await getDocs(collection(db, 'ad_slot_requests'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest));
    },

    updateAdSlotRequest: async (id: string, data: Partial<AdSlotRequest>, updaterId: string) => {
        await updateDoc(doc(db, 'ad_slot_requests', id), data);
    },

    // --- Collaboration Requests (Direct) ---
    sendCollabRequest: async (req: any) => {
        const docRef = await addDoc(collection(db, 'collaboration_requests'), {
            ...req,
            status: 'pending',
            timestamp: serverTimestamp(),
            collabId: `CRI${Date.now()}`
        });
        return docRef.id;
    },

    getCollabRequestsForBrand: async (brandId: string): Promise<CollaborationRequest[]> => {
        const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest));
    },

    getCollabRequestsForBrandListener: (brandId: string, onSuccess: (data: CollaborationRequest[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest));
            onSuccess(data);
        }, onError);
    },

    getCollabRequestsForInfluencer: async (influencerId: string): Promise<CollaborationRequest[]> => {
        const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest));
    },

    getCollabRequestsForInfluencerListener: (influencerId: string, onSuccess: (data: CollaborationRequest[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest));
            onSuccess(data);
        }, onError);
    },

    getAllCollaborationRequests: async (): Promise<CollaborationRequest[]> => {
        const snapshot = await getDocs(collection(db, 'collaboration_requests'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest));
    },

    updateCollaborationRequest: async (id: string, data: Partial<CollaborationRequest>, updaterId: string) => {
        await updateDoc(doc(db, 'collaboration_requests', id), data);
    },

    // --- Campaigns ---
    createCampaign: async (campaign: Omit<Campaign, 'id' | 'status'>) => {
        await addDoc(collection(db, 'campaigns'), {
            ...campaign,
            status: 'open',
            timestamp: serverTimestamp()
        });
    },

    getCampaignsForBrand: async (brandId: string): Promise<Campaign[]> => {
        const q = query(collection(db, 'campaigns'), where('brandId', '==', brandId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
    },

    getAllOpenCampaigns: async (location?: string): Promise<Campaign[]> => {
        let q = query(collection(db, 'campaigns'), where('status', '==', 'open'));
        const snapshot = await getDocs(q);
        let campaigns = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
        if (location && location !== 'All') {
            campaigns = campaigns.filter(c => !c.location || c.location === 'All' || c.location === location);
        }
        return campaigns;
    },

    applyToCampaign: async (app: Omit<CampaignApplication, 'id' | 'status' | 'timestamp'>) => {
        // Add applicant to campaign
        const campaignRef = doc(db, 'campaigns', app.campaignId);
        await updateDoc(campaignRef, {
            applicantIds: arrayUnion(app.influencerId)
        });

        await addDoc(collection(db, 'campaign_applications'), {
            ...app,
            status: 'pending_brand_review',
            timestamp: serverTimestamp(),
            collabId: `CAP${Date.now()}`
        });
    },

    getApplicationsForCampaign: async (campaignId: string): Promise<CampaignApplication[]> => {
        const q = query(collection(db, 'campaign_applications'), where('campaignId', '==', campaignId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CampaignApplication));
    },

    getCampaignApplicationsForInfluencer: async (influencerId: string): Promise<CampaignApplication[]> => {
        const q = query(collection(db, 'campaign_applications'), where('influencerId', '==', influencerId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CampaignApplication));
    },

    getAllCampaignApplications: async (): Promise<CampaignApplication[]> => {
        const snapshot = await getDocs(collection(db, 'campaign_applications'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CampaignApplication));
    },

    updateCampaignApplication: async (id: string, data: Partial<CampaignApplication>, updaterId: string) => {
        await updateDoc(doc(db, 'campaign_applications', id), data);
    },

    // --- Messaging ---
    getConversations: async (userId: string): Promise<any[]> => {
        const q = query(collection(db, 'conversations'), where('participants', 'array-contains', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...data };
        });
    },

    getMessages: async (userId1: string, userId2: string): Promise<any[]> => {
        return [];
    },

    getMessagesListener: (userId1: string, userId2: string, onUpdate: (msgs: any[]) => void, onError: (err: any) => void) => {
        const convoId = [userId1, userId2].sort().join('_');
        const q = query(collection(db, 'chats', convoId, 'messages'), orderBy('timestamp', 'asc'));
        
        return onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            onUpdate(msgs);
        }, onError);
    },

    sendMessage: async (text: string, senderId: string, receiverId: string, attachments: any[] = []) => {
        const convoId = [senderId, receiverId].sort().join('_');
        const messageData = {
            senderId,
            receiverId,
            text,
            attachments,
            timestamp: serverTimestamp()
        };
        await addDoc(collection(db, 'chats', convoId, 'messages'), messageData);
        
        const convoRef = doc(db, 'conversations', convoId);
        await setDoc(convoRef, {
            participants: [senderId, receiverId],
            lastMessage: { text, timestamp: serverTimestamp() },
            updatedAt: serverTimestamp()
        }, { merge: true });
    },

    uploadMessageAttachment: async (messageId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `chat_attachments/${messageId}/${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Posts / Community ---
    getPosts: async (currentUserId?: string): Promise<Post[]> => {
        let q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
        
        if (currentUserId) {
            posts = posts.filter(p => 
                (!p.isBlocked) && 
                (p.visibility === 'public' || p.userId === currentUserId)
            );
        } else {
            posts = posts.filter(p => !p.isBlocked && p.visibility === 'public');
        }
        return posts;
    },

    createPost: async (postData: Omit<Post, 'id'>) => {
        const docRef = await addDoc(collection(db, 'posts'), postData);
        return { id: docRef.id, ...postData };
    },

    deletePost: async (postId: string) => {
        await deleteDoc(doc(db, 'posts', postId));
    },

    updatePost: async (postId: string, data: Partial<Post>) => {
        await updateDoc(doc(db, 'posts', postId), data);
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

    uploadPostImage: async (postId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `posts/${postId}/${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    getCommentsForPost: async (postId: string): Promise<Comment[]> => {
        const q = query(collection(db, 'posts', postId, 'comments'), orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
    },

    addCommentToPost: async (postId: string, commentData: any) => {
        await addDoc(collection(db, 'posts', postId, 'comments'), {
            ...commentData,
            timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, 'posts', postId), {
            commentCount: increment(1)
        });
    },

    // --- KYC ---
    submitKyc: async (userId: string, data: any, idFile: File | null, selfieFile: File | null) => {
        const kycData = { ...data };

        if (idFile) {
            const ref1 = ref(storage, `kyc/${userId}/id_proof`);
            await uploadBytes(ref1, idFile);
            kycData.idProofUrl = await getDownloadURL(ref1);
        }
        if (selfieFile) {
            const ref2 = ref(storage, `kyc/${userId}/selfie`);
            await uploadBytes(ref2, selfieFile);
            kycData.selfieUrl = await getDownloadURL(ref2);
        }

        await updateDoc(doc(db, 'users', userId), {
            kycDetails: kycData,
            kycStatus: 'pending'
        });
    },

    // --- VERIFICATION WRAPPERS ---
    verifyPan: async (userId: string, pan: string, name: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-pan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, pan, name })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Verification failed");
        }
        return data;
    },

    verifyBankAccount: async (userId: string, account: string, ifsc: string, name: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-bank`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, account, ifsc, name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Verification failed");
        return data;
    },

    verifyUpi: async (userId: string, vpa: string, name: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-upi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, vpa, name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Verification failed");
        return data;
    },

    verifyGst: async (userId: string, gstin: string, businessName: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-gst`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, gstin, businessName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Verification failed");
        return data;
    },

    getKycSubmissions: async (): Promise<User[]> => {
        const q = query(collection(db, 'users'), where('kycStatus', '==', 'pending'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
    },

    updateKycStatus: async (userId: string, status: 'approved' | 'rejected', reason?: string) => {
        const updateData: any = { kycStatus: status };
        if (reason) updateData['kycDetails.rejectionReason'] = reason;
        await updateDoc(doc(db, 'users', userId), updateData);
    },

    submitDigilockerKyc: async (userId: string) => {
        // Mock integration
        await updateDoc(doc(db, 'users', userId), {
            kycStatus: 'approved',
            'kycDetails.verifiedBy': 'DigiLocker'
        });
    },

    // --- Transactions & Payouts ---
    getTransactionsForUser: async (userId: string): Promise<Transaction[]> => {
        const q = query(collection(db, 'transactions'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const transactions = snapshot.docs.map(d => ({ transactionId: d.id, ...d.data() } as Transaction));
        return transactions.sort((a, b) => getTime(b.timestamp) - getTime(a.timestamp));
    },

    getAllTransactions: async (): Promise<Transaction[]> => {
        const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ transactionId: d.id, ...d.data() } as Transaction));
    },

    submitPayoutRequest: async (data: any) => {
        const payload = { ...data };
        if (payload.collabId === undefined) payload.collabId = null;

        // 1. Create Payout Request
        await addDoc(collection(db, 'payout_requests'), {
            ...payload,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        
        // 2. Update Collaboration Payment Status
        let collectionName = '';
        switch (data.collaborationType) {
            case 'direct': collectionName = 'collaboration_requests'; break;
            case 'campaign': collectionName = 'campaign_applications'; break;
            case 'ad_slot': collectionName = 'ad_slot_requests'; break;
            case 'banner_booking': collectionName = 'banner_booking_requests'; break;
        }

        if (collectionName && data.collaborationId) {
            await updateDoc(doc(db, collectionName, data.collaborationId), {
                paymentStatus: 'payout_requested'
            });
        }
    },

    getAllPayouts: async (): Promise<PayoutRequest[]> => {
        const q = query(collection(db, 'payout_requests'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PayoutRequest));
    },

    getPayoutHistoryForUser: async (userId: string): Promise<PayoutRequest[]> => {
        const q = query(collection(db, 'payout_requests'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const payouts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PayoutRequest));
        return payouts.sort((a, b) => getTime(b.timestamp) - getTime(a.timestamp));
    },

    updatePayoutStatus: async (payoutId: string, status: string, collabId: string, collabType: string, reason?: string) => {
        await updateDoc(doc(db, 'payout_requests', payoutId), { status });
    },

    uploadPayoutSelfie: async (userId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `payouts/${userId}/${Date.now()}_selfie`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Refunds ---
    createRefundRequest: async (data: any) => {
        const payload = { ...data };
        if (payload.collabId === undefined) payload.collabId = null;

        await addDoc(collection(db, 'refund_requests'), {
            ...payload,
            status: 'pending',
            timestamp: serverTimestamp()
        });

        // Update Collaboration Status
        let collectionName = '';
        switch (data.collabType) {
            case 'direct': collectionName = 'collaboration_requests'; break;
            case 'campaign': collectionName = 'campaign_applications'; break;
            case 'ad_slot': collectionName = 'ad_slot_requests'; break;
            case 'banner_booking': collectionName = 'banner_booking_requests'; break;
        }

        if (collectionName && data.collaborationId) {
            await updateDoc(doc(db, collectionName, data.collaborationId), {
                status: 'refund_pending_admin_review'
            });
        }
    },

    getAllRefunds: async (): Promise<RefundRequest[]> => {
        const snapshot = await getDocs(collection(db, 'refund_requests'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RefundRequest));
    },

    updateRefundRequest: async (id: string, data: any) => {
        await updateDoc(doc(db, 'refund_requests', id), data);
    },

    // --- Daily Payouts ---
    getActiveAdCollabsForAgency: async (agencyId: string, role: UserRole) => {
        const collectionName = role === 'livetv' ? 'ad_slot_requests' : 'banner_booking_requests';
        const idField = role === 'livetv' ? 'liveTvId' : 'agencyId';
        
        const q = query(collection(db, collectionName), where(idField, '==', agencyId), where('status', '==', 'in_progress'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    uploadDailyPayoutVideo: async (userId: string, blob: Blob): Promise<string> => {
        const storageRef = ref(storage, `daily_payouts/${userId}/${Date.now()}.webm`);
        await uploadBytes(storageRef, blob);
        return getDownloadURL(storageRef);
    },

    submitDailyPayoutRequest: async (data: any) => {
        const payload = { ...data };
        if (payload.collabId === undefined) payload.collabId = null;

        await addDoc(collection(db, 'daily_payout_requests'), {
            ...payload,
            status: 'pending',
            timestamp: serverTimestamp()
        });
    },

    getAllDailyPayouts: async (): Promise<DailyPayoutRequest[]> => {
        const snapshot = await getDocs(collection(db, 'daily_payout_requests'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyPayoutRequest));
    },

    updateDailyPayoutRequestStatus: async (id: string, collabId: string, collabType: 'ad_slot' | 'banner_booking', status: string, amount?: number, reason?: string) => {
        await updateDoc(doc(db, 'daily_payout_requests', id), {
            status,
            approvedAmount: amount,
            rejectionReason: reason
        });
    },
    
    updateDailyPayoutRequest: async (id: string, data: any) => {
        await updateDoc(doc(db, 'daily_payout_requests', id), data);
    },

    // --- Disputes ---
    createDispute: async (data: any) => {
        const payload = { ...data };
        if (payload.collabId === undefined) payload.collabId = null;

        await addDoc(collection(db, 'disputes'), {
            ...payload,
            status: 'open',
            timestamp: serverTimestamp()
        });
        // Update collab status to 'disputed'
        const collectionMap: any = {
            'direct': 'collaboration_requests',
            'campaign': 'campaign_applications',
            'ad_slot': 'ad_slot_requests',
            'banner_booking': 'banner_booking_requests'
        };
        const colName = collectionMap[data.collaborationType];
        if (colName) {
            await updateDoc(doc(db, colName, data.collaborationId), { status: 'disputed' });
        }
    },

    getDisputes: async (): Promise<Dispute[]> => {
        const snapshot = await getDocs(collection(db, 'disputes'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dispute));
    },

    // --- Creator Verification ---
    submitCreatorVerification: async (userId: string, data: CreatorVerificationDetails) => {
        await updateDoc(doc(db, 'users', userId), {
            creatorVerificationDetails: data,
            creatorVerificationStatus: 'pending'
        });
    },

    getPendingCreatorVerifications: async (): Promise<User[]> => {
        const q = query(collection(db, 'users'), where('creatorVerificationStatus', '==', 'pending'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
    },

    updateCreatorVerificationStatus: async (userId: string, status: 'approved' | 'rejected', reason?: string) => {
        const updateData: any = { creatorVerificationStatus: status };
        if (reason) updateData['creatorVerificationDetails.rejectionReason'] = reason;
        await updateDoc(doc(db, 'users', userId), updateData);
    },

    // --- Support Tickets ---
    createSupportTicket: async (ticketData: any, firstMessage: any) => {
        const ticketRef = await addDoc(collection(db, 'support_tickets'), {
            ...ticketData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        await addDoc(collection(db, 'support_tickets', ticketRef.id, 'messages'), {
            ...firstMessage,
            timestamp: serverTimestamp()
        });
    },

    getTicketsForUser: async (userId: string): Promise<SupportTicket[]> => {
        const q = query(collection(db, 'support_tickets'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const tickets = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
        return tickets.sort((a, b) => getTime(b.updatedAt) - getTime(a.updatedAt));
    },

    getAllTickets: async (): Promise<SupportTicket[]> => {
        const q = query(collection(db, 'support_tickets'), orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
    },

    getTicketReplies: async (ticketId: string): Promise<TicketReply[]> => {
        const q = query(collection(db, 'support_tickets', ticketId, 'messages'), orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TicketReply));
    },

    addTicketReply: async (replyData: any) => {
        await addDoc(collection(db, 'support_tickets', replyData.ticketId, 'messages'), {
            ...replyData,
            timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, 'support_tickets', replyData.ticketId), {
            updatedAt: serverTimestamp(),
            status: 'in_progress' 
        });
    },

    updateTicketStatus: async (ticketId: string, status: string) => {
        await updateDoc(doc(db, 'support_tickets', ticketId), { status });
    },

    uploadTicketAttachment: async (ticketId: string, file: File): Promise<string> => {
        const storageRef = ref(storage, `tickets/${ticketId}/${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Live Help ---
    getSessionsForUser: async (userId: string): Promise<LiveHelpSession[]> => {
        const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const sessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LiveHelpSession));
        return sessions.sort((a, b) => getTime(b.updatedAt) - getTime(a.updatedAt));
    },

    getAllLiveHelpSessionsListener: (onUpdate: (sessions: LiveHelpSession[]) => void) => {
        const q = query(collection(db, 'live_help_sessions'), orderBy('updatedAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LiveHelpSession));
            onUpdate(sessions);
        });
    },

    getOrCreateLiveHelpSession: async (userId: string, userName: string, userAvatar: string, staffId?: string) => {
        const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), where('status', 'in', ['open', 'unassigned']));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return snapshot.docs[0].id;

        const docRef = await addDoc(collection(db, 'live_help_sessions'), {
            userId,
            userName,
            userAvatar,
            status: 'unassigned',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    },

    sendLiveHelpMessage: async (sessionId: string, senderId: string, senderName: string, text: string) => {
        await addDoc(collection(db, 'live_help_sessions', sessionId, 'messages'), {
            senderId,
            senderName,
            text,
            timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, 'live_help_sessions', sessionId), {
            updatedAt: serverTimestamp()
        });
    },

    assignStaffToSession: async (sessionId: string, staffUser: User) => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), {
            status: 'open',
            assignedStaffId: staffUser.id,
            assignedStaffName: staffUser.name,
            assignedStaffAvatar: staffUser.avatar
        });
    },

    closeLiveHelpSession: async (sessionId: string) => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), {
            status: 'closed'
        });
    },

    reopenLiveHelpSession: async (sessionId: string) => {
        await updateDoc(doc(db, 'live_help_sessions', sessionId), {
            status: 'unassigned', 
            updatedAt: serverTimestamp()
        });
    },

    getQuickRepliesListener: (onUpdate: (replies: QuickReply[]) => void) => {
        return onSnapshot(collection(db, 'quick_replies'), (snapshot) => {
            onUpdate(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as QuickReply)));
        });
    },

    addQuickReply: async (text: string) => {
        await addDoc(collection(db, 'quick_replies'), { text });
    },

    updateQuickReply: async (id: string, text: string) => {
        await updateDoc(doc(db, 'quick_replies', id), { text });
    },

    deleteQuickReply: async (id: string) => {
        await deleteDoc(doc(db, 'quick_replies', id));
    },

    // --- Notifications & Marketing ---
    saveFcmToken: async (userId: string, token: string | null) => {
        await updateDoc(doc(db, 'users', userId), { fcmToken: token });
    },

    getNotificationsForUserListener: (userId: string, onUpdate: (notifs: AppNotification[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, 'notifications'), where('userId', '==', userId));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
            data.sort((a, b) => getTime(b.timestamp) - getTime(a.timestamp));
            onUpdate(data.slice(0, 50));
        }, onError);
    },

    markNotificationAsRead: async (id: string) => {
        await updateDoc(doc(db, 'notifications', id), { isRead: true });
    },

    markAllNotificationsAsRead: async (userId: string) => {
        const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('isRead', '==', false));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach(d => batch.update(d.ref, { isRead: true }));
        await batch.commit();
    },

    sendPushNotification: async (title: string, body: string, targetRole: string, url?: string) => {
        console.log(`Sending push: ${title} to ${targetRole}`);
        let q = query(collection(db, 'users'));
        if (targetRole !== 'all') {
            q = query(collection(db, 'users'), where('role', '==', targetRole));
        }
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        let count = 0;
        
        snapshot.forEach(d => {
            if (count < 500) { 
                const notifRef = doc(collection(db, 'notifications'));
                batch.set(notifRef, {
                    userId: d.id,
                    title,
                    body,
                    type: 'system',
                    isRead: false,
                    timestamp: serverTimestamp(),
                    view: 'dashboard',
                    relatedId: url
                });
                count++;
            }
        });
        await batch.commit();
    },

    sendBulkEmail: async (role: string, subject: string, body: string) => {
        console.log(`Queued email to ${role}: ${subject}`);
        await addDoc(collection(db, 'email_queue'), {
            role,
            subject,
            body,
            status: 'pending',
            timestamp: serverTimestamp()
        });
    },

    // --- Boosts ---
    getBoostsForUser: async (userId: string): Promise<import('../types').Boost[]> => {
        const q = query(collection(db, 'boosts'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as import('../types').Boost));
    },

    // --- Partners ---
    getPartners: async (): Promise<Partner[]> => {
        const snapshot = await getDocs(collection(db, 'partners'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Partner));
    },

    createPartner: async (data: Omit<Partner, 'id'>) => {
        await addDoc(collection(db, 'partners'), data);
    },

    updatePartner: async (id: string, data: Partial<Partner>) => {
        await updateDoc(doc(db, 'partners', id), data);
    },

    deletePartner: async (id: string) => {
        await deleteDoc(doc(db, 'partners', id));
    },

    uploadPartnerLogo: async (file: File): Promise<string> => {
        const storageRef = ref(storage, `partners/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Banners ---
    getActivePlatformBanners: async (): Promise<import('../types').PlatformBanner[]> => {
        const q = query(collection(db, 'platform_banners'), where('isActive', '==', true));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as import('../types').PlatformBanner));
    },

    getPlatformBanners: async (): Promise<import('../types').PlatformBanner[]> => {
        const snapshot = await getDocs(collection(db, 'platform_banners'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as import('../types').PlatformBanner));
    },

    createPlatformBanner: async (data: Omit<import('../types').PlatformBanner, 'id'>) => {
        await addDoc(collection(db, 'platform_banners'), data);
    },

    updatePlatformBanner: async (id: string, data: Partial<import('../types').PlatformBanner>) => {
        await updateDoc(doc(db, 'platform_banners', id), data);
    },

    deletePlatformBanner: async (id: string) => {
        await deleteDoc(doc(db, 'platform_banners', id));
    },

    uploadPlatformBannerImage: async (file: File): Promise<string> => {
        const storageRef = ref(storage, `banners/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    },

    // --- Referrals ---
    generateReferralCode: async (userId: string) => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await updateDoc(doc(db, 'users', userId), { referralCode: code });
        return code;
    },

    applyReferralCode: async (userId: string, code: string) => {
        const q = query(collection(db, 'users'), where('referralCode', '==', code));
        const snapshot = await getDocs(q);
        if (snapshot.empty) throw new Error("Invalid referral code.");
        
        const referrer = snapshot.docs[0];
        if (referrer.id === userId) throw new Error("Cannot refer yourself.");

        const batch = writeBatch(db);
        
        const userRef = doc(db, 'users', userId);
        const referrerRef = doc(db, 'users', referrer.id);

        batch.update(userRef, { 
            referredBy: code,
            coins: increment(20)
        });
        batch.update(referrerRef, {
            coins: increment(50)
        });

        await batch.commit();
    },

    // --- Admin Payout Processing ---
    processPayout: async (payoutId: string, collectionType?: string) => {
        const collectionName = collectionType === 'Daily Payout' ? 'daily_payout_requests' : 'payout_requests';
        
        try {
            const response = await fetch(`${BACKEND_URL}/initiate-payout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payoutId: payoutId,
                    collection: collectionName
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || "Payout initiation failed");
            }
            
            console.log("Payout initiated successfully", data);
            return data;
        } catch (error) {
            console.error("Process Payout Error:", error);
            throw error;
        }
    }
};
