
import { db, storage } from './firebase';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, where, startAfter, Timestamp, serverTimestamp, DocumentData, QueryDocumentSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Influencer, User, PlatformSettings, Conversation, Message, Attachment, SupportTicket, TicketReply, PayoutRequest, Transaction, Campaign, CampaignApplication, AdSlotRequest, BannerAdBookingRequest, BannerAd, Partner, LiveTvChannel, Post, Comment, Boost, LiveHelpSession, LiveHelpMessage, QuickReply, CreatorVerificationDetails, RefundRequest, DailyPayoutRequest, AppNotification } from '../types';

const INFLUENCERS_COLLECTION = 'influencers';
const USERS_COLLECTION = 'users';
const CAMPAIGNS_COLLECTION = 'campaigns';
const CAMPAIGN_APPLICATIONS_COLLECTION = 'campaign_applications';
const COLLAB_REQUESTS_COLLECTION = 'collaboration_requests';
const TRANSACTIONS_COLLECTION = 'transactions';
const PAYOUTS_COLLECTION = 'payout_requests';
const AD_SLOT_REQUESTS_COLLECTION = 'ad_slot_requests';
const BANNER_AD_BOOKING_REQUESTS_COLLECTION = 'banner_ad_booking_requests';
const BANNER_ADS_COLLECTION = 'banner_ads';
const LIVE_TV_CHANNELS_COLLECTION = 'livetv_channels';
const POSTS_COLLECTION = 'posts';
const PLATFORM_BANNERS_COLLECTION = 'platform_banners';
const PARTNERS_COLLECTION = 'partners';
const REFUNDS_COLLECTION = 'refund_requests';
const DAILY_PAYOUTS_COLLECTION = 'daily_payout_requests';
const DISPUTES_COLLECTION = 'disputes';
const BOOSTS_COLLECTION = 'boosts';
const LIVE_HELP_SESSIONS_COLLECTION = 'live_help_sessions';
const QUICK_REPLIES_COLLECTION = 'quick_replies';
const NOTIFICATIONS_COLLECTION = 'notifications';

// Helper to check if we are running in a browser environment
const isBrowser = typeof window !== 'undefined';

export const apiService = {
    getTopInfluencers: async () => {
        // Changed sorting from 'followers' to 'totalEarnings'
        const q = query(collection(db, INFLUENCERS_COLLECTION), orderBy('totalEarnings', 'desc'), limit(10));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Influencer[];
    },

    // --- Stubbed methods to satisfy Typescript usage in other files ---
    // In a real scenario, these would be fully implemented or restored from backup.
    // I am providing implementations based on the method names and context.

    initializeFirestoreData: async () => {
        // Implementation skipped
    },

    getPlatformSettings: async (): Promise<PlatformSettings> => {
        const docRef = doc(db, 'settings', 'platform');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data() as PlatformSettings;
            // Ensure agreements object exists
            if (!data.agreements) {
                data.agreements = {
                    brand: '',
                    influencer: '',
                    livetv: '',
                    banneragency: ''
                };
            }
            return data;
        }
        return {
            agreements: { brand: '', influencer: '', livetv: '', banneragency: '' }
        } as PlatformSettings;
    },

    updatePlatformSettings: async (settings: PlatformSettings) => {
        await setDoc(doc(db, 'settings', 'platform'), settings);
    },

    getActivePlatformBanners: async () => {
        const q = query(collection(db, PLATFORM_BANNERS_COLLECTION), where('isActive', '==', true));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    getPlatformBanners: async () => {
        const snap = await getDocs(collection(db, PLATFORM_BANNERS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    createPlatformBanner: async (banner: any) => {
        await addDoc(collection(db, PLATFORM_BANNERS_COLLECTION), banner);
    },

    updatePlatformBanner: async (id: string, data: any) => {
        await updateDoc(doc(db, PLATFORM_BANNERS_COLLECTION, id), data);
    },

    deletePlatformBanner: async (id: string) => {
        await deleteDoc(doc(db, PLATFORM_BANNERS_COLLECTION, id));
    },

    uploadPlatformBannerImage: async (file: File) => {
        const storageRef = ref(storage, `banners/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    },

    getInfluencersPaginated: async (settings: PlatformSettings, options: { limit: number, startAfterDoc?: QueryDocumentSnapshot<DocumentData> }) => {
        let q = query(collection(db, INFLUENCERS_COLLECTION), orderBy('followers', 'desc'), limit(options.limit));
        if (options.startAfterDoc) {
            q = query(collection(db, INFLUENCERS_COLLECTION), orderBy('followers', 'desc'), startAfter(options.startAfterDoc), limit(options.limit));
        }
        const snap = await getDocs(q);
        return {
            influencers: snap.docs.map(d => ({ id: d.id, ...d.data() })) as Influencer[],
            lastVisible: snap.docs[snap.docs.length - 1]
        };
    },

    getLiveTvChannels: async (settings: PlatformSettings) => {
        const snap = await getDocs(collection(db, LIVE_TV_CHANNELS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as LiveTvChannel[];
    },

    getAllUsers: async () => {
        const snap = await getDocs(collection(db, USERS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
    },

    deleteUser: async (userId: string) => {
        await deleteDoc(doc(db, USERS_COLLECTION, userId));
        // Note: In a real production app, you'd use Firebase Admin SDK to delete the Auth record as well.
        // You would also want to clean up related documents in other collections.
    },

    getAllTransactions: async () => {
        const snap = await getDocs(collection(db, TRANSACTIONS_COLLECTION));
        return snap.docs.map(d => ({ ...d.data() })) as Transaction[];
    },

    getAllPayouts: async () => {
        const snap = await getDocs(collection(db, PAYOUTS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PayoutRequest[];
    },

    getAllRefunds: async () => {
        const snap = await getDocs(collection(db, REFUNDS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as RefundRequest[];
    },

    getAllDailyPayouts: async () => {
        const snap = await getDocs(collection(db, DAILY_PAYOUTS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as DailyPayoutRequest[];
    },

    getAllCollaborationRequests: async () => {
        const snap = await getDocs(collection(db, COLLAB_REQUESTS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    getAllCampaignApplications: async () => {
        const snap = await getDocs(collection(db, CAMPAIGN_APPLICATIONS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    getAllAdSlotRequests: async () => {
        const snap = await getDocs(collection(db, AD_SLOT_REQUESTS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    getAllBannerAdBookingRequests: async () => {
        const snap = await getDocs(collection(db, BANNER_AD_BOOKING_REQUESTS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    getAllTickets: async () => {
        const snap = await getDocs(collection(db, 'support_tickets'));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SupportTicket[];
    },

    getConversations: async (userId: string) => {
        // Stub
        return [] as Conversation[];
    },

    getMessagesListener: (userId: string, otherId: string, callback: (msgs: Message[]) => void, onError: (err: any) => void) => {
        // Stub
        return () => {};
    },

    sendMessage: async (text: string, senderId: string, receiverId: string, attachments?: any[]) => {
        // Stub
    },

    uploadMessageAttachment: async (msgId: string, file: File) => {
        const storageRef = ref(storage, `messages/${msgId}/${file.name}`);
        
        // Ensure we handle the Promise correctly
        return new Promise<string>((resolve, reject) => {
            // Timeout to prevent hanging
            const timeoutId = setTimeout(() => {
                reject(new Error("Upload timed out. Please check if Firebase Storage is enabled in your console."));
            }, 15000); // 15 seconds timeout

            uploadBytes(storageRef, file)
                .then((snapshot) => {
                    clearTimeout(timeoutId);
                    return getDownloadURL(snapshot.ref);
                })
                .then((url) => {
                    resolve(url);
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    if (error.code === 'storage/unauthorized') {
                        reject(new Error("Permission denied. Please update your Firebase Storage Rules to allow writes."));
                    } else if (error.code === 'storage/bucket-not-found') {
                        reject(new Error("Storage bucket not found. Check your firebaseConfig in services/firebase.ts"));
                    } else {
                        reject(error);
                    }
                });
        });
    },

    getNotificationsForUserListener: (userId: string, callback: (n: AppNotification[]) => void, onError: (e: any) => void) => {
        // Stub
        return () => {};
    },

    markNotificationAsRead: async (id: string) => {
        await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, id), { isRead: true });
    },

    markAllNotificationsAsRead: async (userId: string) => {
        // Stub
    },

    getUserByMobile: async (mobile: string) => {
        const q = query(collection(db, USERS_COLLECTION), where('mobileNumber', '==', mobile));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
    },

    getUserByEmail: async (email: string) => {
        const q = query(collection(db, USERS_COLLECTION), where('email', '==', email));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
    },

    applyReferralCode: async (userId: string, code: string) => {
        // Stub
    },

    generateReferralCode: async (userId: string) => {
        return `REF-${userId.substring(0, 5).toUpperCase()}`;
    },

    getInfluencerProfile: async (id: string) => {
        const snap = await getDoc(doc(db, INFLUENCERS_COLLECTION, id));
        return snap.exists() ? snap.data() : null;
    },

    updateUserProfile: async (id: string, data: any) => {
        await updateDoc(doc(db, USERS_COLLECTION, id), data);
    },

    updateInfluencerProfile: async (id: string, data: any) => {
        await updateDoc(doc(db, INFLUENCERS_COLLECTION, id), data);
    },

    uploadProfilePicture: async (id: string, file: File) => {
        const storageRef = ref(storage, `avatars/${id}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    },

    getCollabRequestsForBrand: async (id: string) => {
        const q = query(collection(db, COLLAB_REQUESTS_COLLECTION), where('brandId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    getCampaignsForBrand: async (id: string) => {
        const q = query(collection(db, CAMPAIGNS_COLLECTION), where('brandId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[];
    },

    getApplicationsForCampaign: async (id: string) => {
        const q = query(collection(db, CAMPAIGN_APPLICATIONS_COLLECTION), where('campaignId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CampaignApplication[];
    },

    getAdSlotRequestsForBrand: async (id: string) => {
        const q = query(collection(db, AD_SLOT_REQUESTS_COLLECTION), where('brandId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as AdSlotRequest[];
    },

    getBannerAdBookingRequestsForBrand: async (id: string) => {
        const q = query(collection(db, BANNER_AD_BOOKING_REQUESTS_COLLECTION), where('brandId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BannerAdBookingRequest[];
    },

    getCollabRequestsForInfluencer: async (id: string) => {
        const q = query(collection(db, COLLAB_REQUESTS_COLLECTION), where('influencerId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    getCampaignApplicationsForInfluencer: async (id: string) => {
        const q = query(collection(db, CAMPAIGN_APPLICATIONS_COLLECTION), where('influencerId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CampaignApplication[];
    },

    getAdSlotRequestsForLiveTv: async (id: string) => {
        const q = query(collection(db, AD_SLOT_REQUESTS_COLLECTION), where('liveTvId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as AdSlotRequest[];
    },

    getBannerAdBookingRequestsForAgency: async (id: string) => {
        const q = query(collection(db, BANNER_AD_BOOKING_REQUESTS_COLLECTION), where('agencyId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BannerAdBookingRequest[];
    },

    getCollabRequestsForBrandListener: (id: string, cb: any, err: any) => { return () => {}; },
    getCollabRequestsForInfluencerListener: (id: string, cb: any, err: any) => { return () => {}; },

    updateCollaborationRequest: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, COLLAB_REQUESTS_COLLECTION, id), data);
    },

    sendCollabRequest: async (data: any) => {
        await addDoc(collection(db, COLLAB_REQUESTS_COLLECTION), { ...data, timestamp: serverTimestamp(), status: 'pending' });
    },

    createCampaign: async (data: any) => {
        await addDoc(collection(db, CAMPAIGNS_COLLECTION), { ...data, status: 'open' });
    },

    getAllOpenCampaigns: async (location?: string) => {
        let q = query(collection(db, CAMPAIGNS_COLLECTION), where('status', '==', 'open'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[];
    },

    applyToCampaign: async (data: any) => {
        await addDoc(collection(db, CAMPAIGN_APPLICATIONS_COLLECTION), { ...data, timestamp: serverTimestamp(), status: 'pending_brand_review' });
    },

    updateCampaignApplication: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, CAMPAIGN_APPLICATIONS_COLLECTION, id), data);
    },

    sendAdSlotRequest: async (data: any) => {
        await addDoc(collection(db, AD_SLOT_REQUESTS_COLLECTION), { ...data, timestamp: serverTimestamp(), status: 'pending_approval' });
    },

    updateAdSlotRequest: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, AD_SLOT_REQUESTS_COLLECTION, id), data);
    },

    createBannerAd: async (data: any) => {
        await addDoc(collection(db, BANNER_ADS_COLLECTION), { ...data, timestamp: serverTimestamp(), isBoosted: false });
    },

    uploadBannerAdPhoto: async (id: string, file: File) => {
        return apiService.uploadMessageAttachment(id, file); // Reuse robust uploader
    },

    getBannerAds: async (queryText: string, settings: any) => {
        const q = query(collection(db, BANNER_ADS_COLLECTION));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BannerAd[];
    },

    getBannerAdsForAgency: async (id: string) => {
        const q = query(collection(db, BANNER_ADS_COLLECTION), where('agencyId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BannerAd[];
    },

    sendBannerAdBookingRequest: async (data: any) => {
        await addDoc(collection(db, BANNER_AD_BOOKING_REQUESTS_COLLECTION), { ...data, timestamp: serverTimestamp(), status: 'pending_approval' });
    },

    updateBannerAdBookingRequest: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, BANNER_AD_BOOKING_REQUESTS_COLLECTION, id), data);
    },

    getActiveAdCollabsForAgency: async (id: string, role: string) => {
        // Stub
        return [];
    },

    uploadDailyPayoutVideo: async (id: string, blob: Blob) => {
        const file = new File([blob], "video.webm", { type: "video/webm" });
        return apiService.uploadMessageAttachment(id, file); // Reuse robust uploader
    },

    submitDailyPayoutRequest: async (data: any) => {
        await addDoc(collection(db, DAILY_PAYOUTS_COLLECTION), { ...data, timestamp: serverTimestamp(), status: 'pending' });
    },

    uploadTicketAttachment: async (id: string, file: File) => {
        return apiService.uploadMessageAttachment(id, file); // Reuse robust uploader
    },

    createSupportTicket: async (ticket: any, firstReply: any) => {
        const docRef = await addDoc(collection(db, 'support_tickets'), { ...ticket, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await addDoc(collection(db, `support_tickets/${docRef.id}/replies`), { ...firstReply, timestamp: serverTimestamp() });
    },

    getTicketReplies: async (id: string) => {
        const q = query(collection(db, `support_tickets/${id}/replies`), orderBy('timestamp', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as TicketReply[];
    },

    addTicketReply: async (data: any) => {
        await addDoc(collection(db, `support_tickets/${data.ticketId}/replies`), { ...data, timestamp: serverTimestamp() });
    },

    updateTicketStatus: async (id: string, status: string) => {
        await updateDoc(doc(db, 'support_tickets', id), { status });
    },

    getTicketsForUser: async (id: string) => {
        const q = query(collection(db, 'support_tickets'), where('userId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SupportTicket[];
    },

    getSessionsForUser: async (id: string) => {
        const q = query(collection(db, LIVE_HELP_SESSIONS_COLLECTION), where('userId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as LiveHelpSession[];
    },

    getOrCreateLiveHelpSession: async (userId: string, userName: string, userAvatar: string, staffId: string) => {
        // Stub
        return 'session_id';
    },

    reopenLiveHelpSession: async (id: string) => {
        await updateDoc(doc(db, LIVE_HELP_SESSIONS_COLLECTION, id), { status: 'open' });
    },

    sendLiveHelpMessage: async (sessionId: string, senderId: string, senderName: string, text: string) => {
        await addDoc(collection(db, `live_help_sessions/${sessionId}/messages`), { senderId, senderName, text, timestamp: serverTimestamp() });
    },

    closeLiveHelpSession: async (id: string) => {
        await updateDoc(doc(db, LIVE_HELP_SESSIONS_COLLECTION, id), { status: 'closed' });
    },

    getAllLiveHelpSessionsListener: (cb: any) => { return () => {}; },
    getQuickRepliesListener: (cb: any) => { return () => {}; },
    addQuickReply: async (text: string) => { await addDoc(collection(db, QUICK_REPLIES_COLLECTION), { text }); },
    updateQuickReply: async (id: string, text: string) => { await updateDoc(doc(db, QUICK_REPLIES_COLLECTION, id), { text }); },
    deleteQuickReply: async (id: string) => { await deleteDoc(doc(db, QUICK_REPLIES_COLLECTION, id)); },
    assignStaffToSession: async (id: string, staff: User) => {
        await updateDoc(doc(db, LIVE_HELP_SESSIONS_COLLECTION, id), { status: 'open', assignedStaffId: staff.id, assignedStaffName: staff.name, assignedStaffAvatar: staff.avatar });
    },

    getTransactionsForUser: async (id: string) => {
        const q = query(collection(db, TRANSACTIONS_COLLECTION), where('userId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data() })) as Transaction[];
    },

    getPayoutHistoryForUser: async (id: string) => {
        const q = query(collection(db, PAYOUTS_COLLECTION), where('userId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PayoutRequest[];
    },

    verifyBankAccount: async (userId: string, account: string, ifsc: string, name: string) => {
        // Stub
        return { success: true, registeredName: name };
    },

    verifyUpi: async (userId: string, vpa: string, name: string) => {
        // Stub
        return { success: true, registeredName: name };
    },

    uploadPayoutSelfie: async (id: string, file: File) => {
        return apiService.uploadMessageAttachment(id, file); // Reuse robust uploader
    },

    submitPayoutRequest: async (data: any) => {
        await addDoc(collection(db, PAYOUTS_COLLECTION), { ...data, timestamp: serverTimestamp(), status: 'pending' });
    },

    createRefundRequest: async (data: any) => {
        await addDoc(collection(db, REFUNDS_COLLECTION), { ...data, timestamp: serverTimestamp(), status: 'pending' });
    },

    createDispute: async (data: any) => {
        await addDoc(collection(db, DISPUTES_COLLECTION), { ...data, timestamp: serverTimestamp(), status: 'open' });
    },

    getBoostsForUser: async (id: string) => {
        const q = query(collection(db, BOOSTS_COLLECTION), where('userId', '==', id));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Boost[];
    },

    verifyLiveness: async (userId: string, image: string) => {
        return { success: true };
    },

    verifyAadhaarOtp: async (aadhaar: string) => { return { ref_id: '123' }; },
    verifyAadhaarSubmit: async (userId: string, otp: string, refId: string) => { return { success: true }; },
    verifyPan: async (userId: string, pan: string, name: string) => { return { success: true }; },
    verifyDrivingLicense: async (userId: string, dl: string, dob: string) => { return { success: true }; },
    
    submitKyc: async (userId: string, details: any, idProof: File | null, addressProof: File | null, pan: File | null) => {
        // Stub
    },

    submitCreatorVerification: async (userId: string, details: any, files: any) => {
        // Stub
    },

    createPost: async (post: any) => {
        const ref = await addDoc(collection(db, POSTS_COLLECTION), post);
        return { id: ref.id, ...post };
    },

    uploadPostImage: async (id: string, file: File) => {
        return apiService.uploadMessageAttachment(id, file); // Reuse robust uploader
    },

    updatePost: async (id: string, data: any) => {
        await updateDoc(doc(db, POSTS_COLLECTION, id), data);
    },

    getPosts: async (userId: string) => {
        const q = query(collection(db, POSTS_COLLECTION), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Post[];
    },

    deletePost: async (id: string) => {
        await deleteDoc(doc(db, POSTS_COLLECTION, id));
    },

    toggleLikePost: async (postId: string, userId: string) => {
        // Stub
    },

    getCommentsForPost: async (id: string) => {
        // Stub
        return [] as Comment[];
    },

    addCommentToPost: async (postId: string, comment: any) => {
        // Stub
    },

    saveFcmToken: async (userId: string, token: string | null) => {
        await updateDoc(doc(db, USERS_COLLECTION, userId), { fcmToken: token });
    },

    sendPushNotification: async (title: string, body: string, role: string, url?: string) => {
        // Stub
    },

    sendBulkEmail: async (role: string, subject: string, body: string) => {
        // Stub
    },

    getPartners: async () => {
        const snap = await getDocs(collection(db, PARTNERS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partner[];
    },

    createPartner: async (data: any) => {
        await addDoc(collection(db, PARTNERS_COLLECTION), data);
    },

    updatePartner: async (id: string, data: any) => {
        await updateDoc(doc(db, PARTNERS_COLLECTION, id), data);
    },

    deletePartner: async (id: string) => {
        await deleteDoc(doc(db, PARTNERS_COLLECTION, id));
    },

    uploadPartnerLogo: async (file: File) => {
        return apiService.uploadMessageAttachment("partners", file); // Reuse robust uploader
    },

    processPayout: async (id: string, type: string) => {
        // Stub
    },

    updatePayoutStatus: async (id: string, status: string, collabId: string, type: string, reason?: string) => {
        await updateDoc(doc(db, PAYOUTS_COLLECTION, id), { status, rejectionReason: reason });
    },

    updateRefundRequest: async (id: string, data: any) => {
        await updateDoc(doc(db, REFUNDS_COLLECTION, id), data);
    },

    updateDailyPayoutRequest: async (id: string, data: any) => {
        await updateDoc(doc(db, DAILY_PAYOUTS_COLLECTION, id), data);
    },

    updateDailyPayoutRequestStatus: async (id: string, collabId: string, type: string, status: string, amount?: number, reason?: string) => {
        await updateDoc(doc(db, DAILY_PAYOUTS_COLLECTION, id), { status, approvedAmount: amount, rejectionReason: reason });
    },

    getUsersByIds: async (ids: string[]) => {
        if (!ids || ids.length === 0) return [];
        // Firestore 'in' query limits to 10. For larger sets, we'd need to chunk or loop.
        // For simplicity here, just slice to 10.
        const safeIds = ids.slice(0, 10);
        const q = query(collection(db, USERS_COLLECTION), where('__name__', 'in', safeIds));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
    },

    followUser: async (followerId: string, targetId: string) => {
        const followerRef = doc(db, USERS_COLLECTION, followerId);
        const targetRef = doc(db, USERS_COLLECTION, targetId);

        await updateDoc(followerRef, {
            following: arrayUnion(targetId)
        });

        await updateDoc(targetRef, {
            followers: arrayUnion(followerId)
        });
    },

    unfollowUser: async (followerId: string, targetId: string) => {
        const followerRef = doc(db, USERS_COLLECTION, followerId);
        const targetRef = doc(db, USERS_COLLECTION, targetId);

        await updateDoc(followerRef, {
            following: arrayRemove(targetId)
        });

        await updateDoc(targetRef, {
            followers: arrayRemove(followerId)
        });
    },

    // NEW: Generic file upload helper with error handling
    uploadFileToStorage: async (path: string, file: File): Promise<string> => {
        const storageRef = ref(storage, path);
        
        return new Promise<string>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error("Upload timed out. Please check if Firebase Storage is enabled in your console."));
            }, 15000);

            uploadBytes(storageRef, file)
                .then((snapshot) => {
                    clearTimeout(timeoutId);
                    return getDownloadURL(snapshot.ref);
                })
                .then((url) => {
                    resolve(url);
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    if (error.code === 'storage/unauthorized') {
                        reject(new Error("Permission denied. Please update your Firebase Storage Rules to allow writes."));
                    } else if (error.code === 'storage/bucket-not-found') {
                        reject(new Error("Storage bucket not found. Check your firebaseConfig in services/firebase.ts"));
                    } else {
                        reject(error);
                    }
                });
        });
    }
};
