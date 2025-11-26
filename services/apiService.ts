
import { db, storage, auth, BACKEND_URL } from './firebase';
import { 
    collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, 
    query, where, orderBy, limit, startAfter, 
    serverTimestamp, Timestamp, onSnapshot, arrayUnion, arrayRemove, increment, documentId
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
    User, PlatformSettings, Influencer, Campaign, CampaignApplication, 
    CollaborationRequest, AdSlotRequest, BannerAdBookingRequest, 
    Post, Comment, SupportTicket, TicketReply, LiveHelpSession, 
    LiveHelpMessage, AppNotification, Transaction, PayoutRequest, 
    RefundRequest, DailyPayoutRequest, Partner, BannerAd, LiveTvChannel, 
    Boost, QuickReply, KycDetails,
    UserRole, PlatformBanner, CreatorVerificationDetails
} from '../types';

const USERS_COLLECTION = 'users';
const INFLUENCERS_COLLECTION = 'influencers';
const CAMPAIGNS_COLLECTION = 'campaigns';
const CAMPAIGN_APPS_COLLECTION = 'campaign_applications';
const COLLAB_REQUESTS_COLLECTION = 'collaboration_requests';
const AD_REQUESTS_COLLECTION = 'ad_slot_requests';
const BANNER_ADS_COLLECTION = 'banner_ads';
const BANNER_BOOKINGS_COLLECTION = 'banner_ad_bookings';
const TRANSACTIONS_COLLECTION = 'transactions';
const PAYOUTS_COLLECTION = 'payout_requests';
const REFUNDS_COLLECTION = 'refund_requests';
const DAILY_PAYOUTS_COLLECTION = 'daily_payout_requests';
const POSTS_COLLECTION = 'posts';
const TICKETS_COLLECTION = 'support_tickets';
const SESSIONS_COLLECTION = 'live_help_sessions';
const DISPUTES_COLLECTION = 'disputes';
const PARTNERS_COLLECTION = 'partners';
const BANNERS_COLLECTION = 'platform_banners';

// Helper function for robust file uploads with timeout and error handling
const uploadFileToStorage = async (path: string, file: File): Promise<string> => {
    if (!storage) {
        throw new Error("Firebase Storage is not initialized. Please check your configuration in services/firebase.ts.");
    }
    
    // Sanitize filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const finalPath = `${path}_${Date.now()}_${sanitizedName}`;
    const storageRef = ref(storage, finalPath);

    try {
        // Create the upload task
        const uploadTask = uploadBytes(storageRef, file);
        
        // Create a timeout promise that rejects after 15 seconds
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Upload timed out (15s). Please check your internet connection.")), 15000);
        });

        // Race the upload against the timeout
        const snapshot = await Promise.race([uploadTask, timeoutPromise]);
        
        // Get URL
        const url = await getDownloadURL(snapshot.ref);
        return url;
    } catch (error: any) {
        console.error(`Upload failed for ${path}:`, error);
        
        let friendlyMessage = `Failed to upload image: ${error.message}`;
        
        if (error.code === 'storage/unauthorized') {
             friendlyMessage = "Permission Denied: Upload rejected. Please go to Firebase Console > Storage > Rules and change 'allow read, write: if false;' to 'allow read, write: if true;' (or 'if request.auth != null;').";
        } else if (error.code === 'storage/retry-limit-exceeded') {
             friendlyMessage = "Upload failed. Network retry limit exceeded. Check your connection.";
        } else if (error.code === 'storage/canceled') {
             friendlyMessage = "Upload was canceled.";
        } else if (error.code === 'storage/object-not-found') {
             friendlyMessage = "Storage bucket not found. Ensure 'storageBucket' in services/firebase.ts matches your Firebase Console (likely 'bigyapon2-cfa39.firebasestorage.app').";
        } else if (error.message && error.message.includes("timed out")) {
             friendlyMessage = error.message;
        }
        
        throw new Error(friendlyMessage);
    }
};

export const apiService = {
    // --- Verification Services ---
    verifyAadhaarOtp: async (aadhaar: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-aadhaar-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aadhaar })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to send OTP");
        return data;
    },

    verifyAadhaarSubmit: async (userId: string, otp: string, ref_id: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-aadhaar-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, otp, ref_id })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Verification failed");
        return data;
    },

    verifyLiveness: async (userId: string, imageBase64: string) => {
        // Clean base64 string if needed (remove data URI prefix)
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        const response = await fetch(`${BACKEND_URL}/verify-liveness`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, imageBase64: cleanBase64 })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Liveness check failed");
        return data;
    },

    verifyPan: async (userId: string, pan: string, name: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-pan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, pan, name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Verification failed");
        return data;
    },

    verifyDrivingLicense: async (userId: string, dlNumber: string, dob: string) => {
        const response = await fetch(`${BACKEND_URL}/verify-dl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, dlNumber, dob })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Verification failed");
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

    // --- Creator/Business Verification ---
    submitCreatorVerification: async (userId: string, details: CreatorVerificationDetails, files: { [key: string]: File | null }) => {
        const uploadPromises = Object.entries(files).map(async ([key, file]) => {
            if (file) {
                const url = await uploadFileToStorage(`creator_verification/${userId}/${key}`, file);
                return { key, url };
            }
            return null;
        });

        const uploadedFiles = await Promise.all(uploadPromises);
        
        const finalDetails = { ...details };
        uploadedFiles.forEach(f => {
            if(f) {
                // Map file keys to state keys
                if(f.key === 'registration') finalDetails.registrationDocUrl = f.url;
                if(f.key === 'office') finalDetails.officePhotoUrl = f.url;
                if(f.key === 'pan') finalDetails.businessPanUrl = f.url;
                if(f.key === 'stamp') finalDetails.channelStampUrl = f.url;
                if(f.key === 'acknowledgement') finalDetails.acknowledgementUrl = f.url;
            }
        });

        await updateDoc(doc(db, USERS_COLLECTION, userId), {
            creatorVerificationStatus: 'pending',
            creatorVerificationDetails: finalDetails
        });
    },

    getPendingCreatorVerifications: async () => {
        const q = query(collection(db, USERS_COLLECTION), where('creatorVerificationStatus', '==', 'pending'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
    },

    updateCreatorVerificationStatus: async (userId: string, status: 'approved' | 'rejected', reason?: string) => {
        await updateDoc(doc(db, USERS_COLLECTION, userId), {
            creatorVerificationStatus: status,
            'creatorVerificationDetails.rejectionReason': reason || null
        });
    },

    // --- Platform & Config ---
    getPlatformSettings: async (): Promise<PlatformSettings> => {
        const docRef = doc(db, 'settings', 'platform');
        const docSnap = await getDoc(docRef);
        const defaults: any = {
            isCommunityFeedEnabled: true,
            isCreatorMembershipEnabled: true,
            isProMembershipEnabled: true,
            isMaintenanceModeEnabled: false,
            isWelcomeMessageEnabled: true,
            isNotificationBannerEnabled: false,
            socialMediaLinks: [],
            boostPrices: { profile: 500, campaign: 1000, banner: 800 },
            membershipPrices: { pro_10: 2000, pro_20: 3500, pro_unlimited: 5000, basic: 500, pro: 1500, premium: 3000 },
            discountSettings: { creatorProfileBoost: { isEnabled: false, percentage: 0 }, brandMembership: { isEnabled: false, percentage: 0 }, creatorMembership: { isEnabled: false, percentage: 0 }, brandCampaignBoost: { isEnabled: false, percentage: 0 } },
            isPayoutInstantVerificationEnabled: true,
            isInstantKycEnabled: true, // Default enabled
            isGoogleLoginEnabled: true,
            payoutSettings: { requireSelfieForPayout: true, requireLiveVideoForDailyPayout: true },
            agreements: {
                brand: "Default Brand Agreement...",
                influencer: "Default Influencer Agreement...",
                livetv: "Default Live TV Agreement...",
                banneragency: "Default Banner Agency Agreement..."
            }
        };
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Ensure agreements object exists even if merging old data
            if (!data.agreements) {
                data.agreements = defaults.agreements;
            }
            return { ...defaults, ...data } as PlatformSettings;
        }
        return defaults as PlatformSettings;
    },
    updatePlatformSettings: async (settings: PlatformSettings) => {
        await setDoc(doc(db, 'settings', 'platform'), settings, { merge: true });
    },
    initializeFirestoreData: async () => { /* Logic to seed data if needed */ },

    // --- Users ---
    getAllUsers: async () => {
        const snap = await getDocs(collection(db, USERS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
    },
    getUsersPaginated: async (options: any) => {
        let q = query(collection(db, USERS_COLLECTION), limit(options.pageLimit || 20));
        if (options.startAfterDoc) q = query(q, startAfter(options.startAfterDoc));
        const snap = await getDocs(q);
        return { users: snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[], lastVisible: snap.docs[snap.docs.length - 1] };
    },
    getUserByMobile: async (mobile: string) => {
        const q = query(collection(db, USERS_COLLECTION), where('mobileNumber', '==', mobile));
        const snap = await getDocs(q);
        return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
    },
    getUserByEmail: async (email: string) => {
        const q = query(collection(db, USERS_COLLECTION), where('email', '==', email));
        const snap = await getDocs(q);
        return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
    },
    updateUser: async (userId: string, data: Partial<User>) => {
        await updateDoc(doc(db, USERS_COLLECTION, userId), data);
    },
    updateUserProfile: async (userId: string, data: any) => {
        await updateDoc(doc(db, USERS_COLLECTION, userId), data);
    },
    updateInfluencerProfile: async (userId: string, data: any) => {
        await updateDoc(doc(db, INFLUENCERS_COLLECTION, userId), data);
    },
    saveFcmToken: async (userId: string, token: string | null) => {
        await updateDoc(doc(db, USERS_COLLECTION, userId), { fcmToken: token });
    },
    
    // --- Follow System ---
    followUser: async (currentUserId: string, targetUserId: string) => {
        const currentUserRef = doc(db, USERS_COLLECTION, currentUserId);
        const targetUserRef = doc(db, USERS_COLLECTION, targetUserId);

        await updateDoc(currentUserRef, {
            following: arrayUnion(targetUserId)
        });

        await updateDoc(targetUserRef, {
            followers: arrayUnion(currentUserId)
        });
    },

    unfollowUser: async (currentUserId: string, targetUserId: string) => {
        const currentUserRef = doc(db, USERS_COLLECTION, currentUserId);
        const targetUserRef = doc(db, USERS_COLLECTION, targetUserId);

        await updateDoc(currentUserRef, {
            following: arrayRemove(targetUserId)
        });

        await updateDoc(targetUserRef, {
            followers: arrayRemove(currentUserId)
        });
    },

    getUsersByIds: async (userIds: string[]) => {
        if (!userIds || userIds.length === 0) return [];
        const promises = userIds.map(id => getDoc(doc(db, USERS_COLLECTION, id)));
        const snapshots = await Promise.all(promises);
        return snapshots
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() } as User));
    },

    // --- Influencers ---
    getInfluencersPaginated: async (settings: PlatformSettings, options: any) => {
        const q = query(collection(db, INFLUENCERS_COLLECTION), limit(options.limit));
        const snap = await getDocs(q);
        return { influencers: snap.docs.map(d => ({ id: d.id, ...d.data() })) as Influencer[], lastVisible: snap.docs[snap.docs.length - 1] };
    },
    getInfluencerProfile: async (id: string) => {
        const docSnap = await getDoc(doc(db, INFLUENCERS_COLLECTION, id));
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Influencer : null;
    },

    // --- Live TV ---
    getLiveTvChannels: async (settings: PlatformSettings) => {
        const snap = await getDocs(collection(db, 'livetv_channels'));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as LiveTvChannel[];
    },

    // --- Banners ---
    getPlatformBanners: async () => {
        const snap = await getDocs(collection(db, BANNERS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PlatformBanner[];
    },
    getActivePlatformBanners: async () => {
        const q = query(collection(db, BANNERS_COLLECTION), where('isActive', '==', true));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PlatformBanner[];
    },
    createPlatformBanner: async (data: any) => {
        await addDoc(collection(db, BANNERS_COLLECTION), data);
    },
    updatePlatformBanner: async (id: string, data: any) => {
        await updateDoc(doc(db, BANNERS_COLLECTION, id), data);
    },
    deletePlatformBanner: async (id: string) => {
        await deleteDoc(doc(db, BANNERS_COLLECTION, id));
    },
    uploadPlatformBannerImage: async (file: File) => {
        return await uploadFileToStorage(`banners`, file);
    },

    // --- Collaboration & Requests ---
    sendCollabRequest: async (data: any) => {
        await addDoc(collection(db, COLLAB_REQUESTS_COLLECTION), { ...data, status: 'pending', timestamp: serverTimestamp() });
    },
    getCollabRequestsForBrand: async (brandId: string) => {
        const q = query(collection(db, COLLAB_REQUESTS_COLLECTION), where('brandId', '==', brandId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CollaborationRequest[];
    },
    getCollabRequestsForBrandListener: (brandId: string, cb: (data: CollaborationRequest[]) => void, errCb: (err: any) => void) => {
        const q = query(collection(db, COLLAB_REQUESTS_COLLECTION), where('brandId', '==', brandId));
        return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest))), errCb);
    },
    getCollabRequestsForInfluencer: async (influencerId: string) => {
        const q = query(collection(db, COLLAB_REQUESTS_COLLECTION), where('influencerId', '==', influencerId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CollaborationRequest[];
    },
    getCollabRequestsForInfluencerListener: (influencerId: string, cb: (data: CollaborationRequest[]) => void, errCb: (err: any) => void) => {
        const q = query(collection(db, COLLAB_REQUESTS_COLLECTION), where('influencerId', '==', influencerId));
        return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest))), errCb);
    },
    updateCollaborationRequest: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, COLLAB_REQUESTS_COLLECTION, id), data);
    },
    getAllCollaborationRequests: async () => {
        const snap = await getDocs(collection(db, COLLAB_REQUESTS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CollaborationRequest[];
    },

    // --- Campaigns ---
    createCampaign: async (data: any) => {
        await addDoc(collection(db, CAMPAIGNS_COLLECTION), { ...data, status: 'open', timestamp: serverTimestamp() });
    },
    getCampaignsForBrand: async (brandId: string) => {
        const q = query(collection(db, CAMPAIGNS_COLLECTION), where('brandId', '==', brandId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[];
    },
    getAllOpenCampaigns: async (location?: string) => {
        let q = query(collection(db, CAMPAIGNS_COLLECTION), where('status', '==', 'open'));
        const snap = await getDocs(q);
        let campaigns = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[];
        if (location && location !== 'All') {
            campaigns = campaigns.filter(c => c.location === 'All' || c.location === location);
        }
        return campaigns;
    },
    applyToCampaign: async (data: any) => {
        await updateDoc(doc(db, CAMPAIGNS_COLLECTION, data.campaignId), {
            applicantIds: arrayUnion(data.influencerId)
        });
        await addDoc(collection(db, CAMPAIGN_APPS_COLLECTION), { ...data, status: 'pending_brand_review', timestamp: serverTimestamp() });
    },
    getApplicationsForCampaign: async (campaignId: string) => {
        const q = query(collection(db, CAMPAIGN_APPS_COLLECTION), where('campaignId', '==', campaignId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CampaignApplication[];
    },
    getCampaignApplicationsForInfluencer: async (influencerId: string) => {
        const q = query(collection(db, CAMPAIGN_APPS_COLLECTION), where('influencerId', '==', influencerId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CampaignApplication[];
    },
    updateCampaignApplication: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, CAMPAIGN_APPS_COLLECTION, id), data);
    },
    getAllCampaignApplications: async () => {
        const snap = await getDocs(collection(db, CAMPAIGN_APPS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CampaignApplication[];
    },

    // --- Ad Slots & Banner Ads ---
    sendAdSlotRequest: async (data: any) => {
        await addDoc(collection(db, AD_REQUESTS_COLLECTION), { ...data, status: 'pending_approval', timestamp: serverTimestamp() });
    },
    getAdSlotRequestsForBrand: async (brandId: string) => {
        const q = query(collection(db, AD_REQUESTS_COLLECTION), where('brandId', '==', brandId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as AdSlotRequest[];
    },
    getAdSlotRequestsForLiveTv: async (liveTvId: string) => {
        const q = query(collection(db, AD_REQUESTS_COLLECTION), where('liveTvId', '==', liveTvId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as AdSlotRequest[];
    },
    updateAdSlotRequest: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, AD_REQUESTS_COLLECTION, id), data);
    },
    getAllAdSlotRequests: async () => {
        const snap = await getDocs(collection(db, AD_REQUESTS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as AdSlotRequest[];
    },
    createBannerAd: async (data: any) => {
        await addDoc(collection(db, BANNER_ADS_COLLECTION), { ...data, timestamp: serverTimestamp() });
    },
    getBannerAds: async (location: string, settings: PlatformSettings) => {
        let q = query(collection(db, BANNER_ADS_COLLECTION));
        const snap = await getDocs(q);
        let ads = snap.docs.map(d => ({ id: d.id, ...d.data() })) as BannerAd[];
        if (location) {
            ads = ads.filter(a => a.location.toLowerCase().includes(location.toLowerCase()));
        }
        return ads;
    },
    getBannerAdsForAgency: async (agencyId: string) => {
        const q = query(collection(db, BANNER_ADS_COLLECTION), where('agencyId', '==', agencyId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BannerAd[];
    },
    uploadBannerAdPhoto: async (userId: string, file: File) => {
        return await uploadFileToStorage(`banner_photos/${userId}`, file);
    },
    sendBannerAdBookingRequest: async (data: any) => {
        await addDoc(collection(db, BANNER_BOOKINGS_COLLECTION), { ...data, status: 'pending_approval', timestamp: serverTimestamp() });
    },
    getBannerAdBookingRequestsForBrand: async (brandId: string) => {
        const q = query(collection(db, BANNER_BOOKINGS_COLLECTION), where('brandId', '==', brandId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BannerAdBookingRequest[];
    },
    getBannerAdBookingRequestsForAgency: async (agencyId: string) => {
        const q = query(collection(db, BANNER_BOOKINGS_COLLECTION), where('agencyId', '==', agencyId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BannerAdBookingRequest[];
    },
    updateBannerAdBookingRequest: async (id: string, data: any, userId: string) => {
        await updateDoc(doc(db, BANNER_BOOKINGS_COLLECTION, id), data);
    },
    getAllBannerAdBookingRequests: async () => {
        const snap = await getDocs(collection(db, BANNER_BOOKINGS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BannerAdBookingRequest[];
    },
    getActiveAdCollabsForAgency: async (agencyId: string, role: UserRole) => {
        if (role === 'livetv') {
            const q = query(collection(db, AD_REQUESTS_COLLECTION), where('liveTvId', '==', agencyId), where('status', 'in', ['in_progress', 'work_submitted']));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            const q = query(collection(db, BANNER_BOOKINGS_COLLECTION), where('agencyId', '==', agencyId), where('status', 'in', ['in_progress', 'work_submitted']));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
    },

    // --- Payouts & Transactions ---
    getAllTransactions: async () => {
        const snap = await getDocs(collection(db, TRANSACTIONS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[];
    },
    getTransactionsForUser: async (userId: string) => {
        const q = query(collection(db, TRANSACTIONS_COLLECTION), where('userId', '==', userId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[];
    },
    getAllPayouts: async () => {
        const snap = await getDocs(collection(db, PAYOUTS_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PayoutRequest[];
    },
    getPayoutHistoryForUser: async (userId: string) => {
        const q = query(collection(db, PAYOUTS_COLLECTION), where('userId', '==', userId));
        const snap = await getDocs(q);
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
    submitPayoutRequest: async (data: any) => {
        await addDoc(collection(db, PAYOUTS_COLLECTION), { ...data, status: 'pending', timestamp: serverTimestamp() });
    },
    submitDailyPayoutRequest: async (data: any) => {
        await addDoc(collection(db, DAILY_PAYOUTS_COLLECTION), { ...data, status: 'pending', timestamp: serverTimestamp() });
    },
    updatePayoutStatus: async (id: string, status: string, collabId: string, collabType: string, rejectionReason?: string) => {
        await updateDoc(doc(db, PAYOUTS_COLLECTION, id), { status, rejectionReason });
        if (status === 'completed') {
            const col = collabType === 'direct' ? COLLAB_REQUESTS_COLLECTION : 
                        collabType === 'campaign' ? CAMPAIGN_APPS_COLLECTION :
                        collabType === 'ad_slot' ? AD_REQUESTS_COLLECTION : BANNER_BOOKINGS_COLLECTION;
            await updateDoc(doc(db, col, collabId), { paymentStatus: 'payout_complete' });
        }
    },
    updateDailyPayoutRequest: async (id: string, data: any) => {
        await updateDoc(doc(db, DAILY_PAYOUTS_COLLECTION, id), data);
    },
    updateDailyPayoutRequestStatus: async (id: string, collabId: string, collabType: 'ad_slot' | 'banner_booking', status: string, amount?: number, rejectionReason?: string) => {
        await updateDoc(doc(db, DAILY_PAYOUTS_COLLECTION, id), { status, approvedAmount: amount, rejectionReason });
        if (status === 'approved' && amount) {
            const col = collabType === 'ad_slot' ? AD_REQUESTS_COLLECTION : BANNER_BOOKINGS_COLLECTION;
            await updateDoc(doc(db, col, collabId), { dailyPayoutsReceived: increment(amount) });
        }
    },
    createRefundRequest: async (data: any) => {
        await addDoc(collection(db, REFUNDS_COLLECTION), { ...data, status: 'pending', timestamp: serverTimestamp() });
        const col = data.collabType === 'direct' ? COLLAB_REQUESTS_COLLECTION : 
                    data.collabType === 'campaign' ? CAMPAIGN_APPS_COLLECTION :
                    data.collabType === 'ad_slot' ? AD_REQUESTS_COLLECTION : BANNER_BOOKINGS_COLLECTION;
        await updateDoc(doc(db, col, data.collaborationId), { status: 'refund_pending_admin_review' });
    },
    updateRefundRequest: async (id: string, data: any) => {
        await updateDoc(doc(db, REFUNDS_COLLECTION, id), data);
    },
    processPayout: async (id: string, type: 'Payout' | 'Refund' | 'Daily Payout') => {
        const response = await fetch(`${BACKEND_URL}/process-payout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId: id, type })
        });
        if (!response.ok) throw new Error("Payout API failed");
    },
    uploadPayoutSelfie: async (userId: string, file: File) => {
        return await uploadFileToStorage(`payout_selfies/${userId}`, file);
    },
    uploadDailyPayoutVideo: async (userId: string, blob: Blob) => {
        const file = new File([blob], "proof.webm", { type: 'video/webm' });
        return await uploadFileToStorage(`daily_payout_videos/${userId}`, file);
    },

    // --- Support ---
    createSupportTicket: async (userPart: any, ticketPart: any) => {
        const docRef = await addDoc(collection(db, TICKETS_COLLECTION), { ...userPart, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await addDoc(collection(db, `support_tickets/${docRef.id}/replies`), { ...ticketPart, timestamp: serverTimestamp() });
    },
    getTicketsForUser: async (userId: string) => {
        const q = query(collection(db, TICKETS_COLLECTION), where('userId', '==', userId), orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SupportTicket[];
    },
    getAllTickets: async () => {
        const q = query(collection(db, TICKETS_COLLECTION), orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SupportTicket[];
    },
    getTicketReplies: async (ticketId: string) => {
        const q = query(collection(db, `support_tickets/${ticketId}/replies`), orderBy('timestamp', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as TicketReply[];
    },
    addTicketReply: async (data: any) => {
        await addDoc(collection(db, `support_tickets/${data.ticketId}/replies`), { ...data, timestamp: serverTimestamp() });
        await updateDoc(doc(db, TICKETS_COLLECTION, data.ticketId), { updatedAt: serverTimestamp(), status: data.senderRole === 'staff' ? 'in_progress' : 'open' });
    },
    updateTicketStatus: async (id: string, status: string) => {
        await updateDoc(doc(db, TICKETS_COLLECTION, id), { status });
    },
    uploadTicketAttachment: async (ticketId: string, file: File) => {
        return await uploadFileToStorage(`tickets/${ticketId}`, file);
    },

    // --- Live Help ---
    getOrCreateLiveHelpSession: async (userId: string, userName: string, userAvatar: string, staffId: string) => {
        const q = query(collection(db, SESSIONS_COLLECTION), where('userId', '==', userId), where('status', '!=', 'closed'));
        const snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0].id;
        
        const docRef = await addDoc(collection(db, SESSIONS_COLLECTION), {
            userId, userName, userAvatar, status: 'unassigned', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        return docRef.id;
    },
    getSessionsForUser: async (userId: string) => {
        const q = query(collection(db, SESSIONS_COLLECTION), where('userId', '==', userId), orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as LiveHelpSession[];
    },
    getAllLiveHelpSessionsListener: (cb: (sessions: LiveHelpSession[]) => void) => {
        const q = query(collection(db, SESSIONS_COLLECTION), orderBy('updatedAt', 'desc'));
        return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveHelpSession))));
    },
    sendLiveHelpMessage: async (sessionId: string, senderId: string, senderName: string, text: string) => {
        await addDoc(collection(db, `live_help_sessions/${sessionId}/messages`), {
            senderId, senderName, text, timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, SESSIONS_COLLECTION, sessionId), { updatedAt: serverTimestamp() });
    },
    closeLiveHelpSession: async (sessionId: string) => {
        await updateDoc(doc(db, SESSIONS_COLLECTION, sessionId), { status: 'closed' });
    },
    reopenLiveHelpSession: async (sessionId: string) => {
        await updateDoc(doc(db, SESSIONS_COLLECTION, sessionId), { status: 'unassigned', updatedAt: serverTimestamp() });
    },
    assignStaffToSession: async (sessionId: string, staffUser: User) => {
        await updateDoc(doc(db, SESSIONS_COLLECTION, sessionId), { 
            status: 'open', 
            assignedStaffId: staffUser.id, 
            assignedStaffName: staffUser.name, 
            assignedStaffAvatar: staffUser.avatar 
        });
    },
    getQuickRepliesListener: (cb: (replies: QuickReply[]) => void) => {
        return onSnapshot(collection(db, 'quick_replies'), (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuickReply))));
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

    // --- Community ---
    getPosts: async (userId?: string) => {
        let q = query(collection(db, POSTS_COLLECTION), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        let posts = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Post[];
        if (userId) {
            posts = posts.filter(p => p.visibility === 'public' || p.userId === userId);
        } else {
            posts = posts.filter(p => p.visibility === 'public');
        }
        return posts.filter(p => !p.isBlocked);
    },
    createPost: async (data: any) => {
        const docRef = await addDoc(collection(db, POSTS_COLLECTION), data);
        return { id: docRef.id, ...data };
    },
    updatePost: async (id: string, data: any) => {
        await updateDoc(doc(db, POSTS_COLLECTION, id), data);
    },
    deletePost: async (id: string) => {
        await deleteDoc(doc(db, POSTS_COLLECTION, id));
    },
    uploadPostImage: async (postId: string, file: File) => {
        return await uploadFileToStorage(`posts/${postId}`, file);
    },
    toggleLikePost: async (postId: string, userId: string) => {
        const postRef = doc(db, POSTS_COLLECTION, postId);
        const snap = await getDoc(postRef);
        if (snap.exists()) {
            const likes = snap.data().likes || [];
            if (likes.includes(userId)) {
                await updateDoc(postRef, { likes: arrayRemove(userId) });
            } else {
                await updateDoc(postRef, { likes: arrayUnion(userId) });
            }
        }
    },
    getCommentsForPost: async (postId: string) => {
        const q = query(collection(db, `posts/${postId}/comments`), orderBy('timestamp', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Comment[];
    },
    addCommentToPost: async (postId: string, data: any) => {
        await addDoc(collection(db, `posts/${postId}/comments`), { ...data, timestamp: serverTimestamp() });
        await updateDoc(doc(db, POSTS_COLLECTION, postId), { commentCount: increment(1) });
    },

    // --- Messages ---
    getMessagesListener: (userId1: string, userId2: string, cb: (msgs: any[]) => void, errCb: (err: any) => void) => {
        const chatId = [userId1, userId2].sort().join('_');
        const q = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
        return onSnapshot(q, (snap) => cb(snap.docs.map(d => {
            const data = d.data();
            return { 
                id: d.id, 
                ...data, 
                timestamp: data.timestamp?.toDate().toLocaleTimeString() 
            };
        })), errCb);
    },
    sendMessage: async (text: string, senderId: string, recipientId: string, attachments: any[]) => {
        const chatId = [senderId, recipientId].sort().join('_');
        await addDoc(collection(db, `chats/${chatId}/messages`), {
            text, senderId, recipientId, attachments, timestamp: serverTimestamp()
        });
        const updateConvo = async (uid: string, partnerId: string) => {
            const partnerDoc = await getDoc(doc(db, USERS_COLLECTION, partnerId));
            if (partnerDoc.exists()) {
                const pData = partnerDoc.data();
                await setDoc(doc(db, `users/${uid}/conversations`, partnerId), {
                    participant: { id: partnerId, name: pData.name, avatar: pData.avatar, role: pData.role, companyName: pData.companyName },
                    lastMessage: { text: text || 'Attachment', timestamp: serverTimestamp() },
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
        };
        await Promise.all([updateConvo(senderId, recipientId), updateConvo(recipientId, senderId)]);
    },
    uploadMessageAttachment: async (messageId: string, file: File) => {
        return await uploadFileToStorage(`chat_attachments/${messageId}`, file);
    },
    getConversations: async (userId: string) => {
        const q = query(collection(db, `users/${userId}/conversations`), orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    // --- Notifications ---
    getNotificationsForUserListener: (userId: string, cb: (data: AppNotification[]) => void, errCb: (err: any) => void) => {
        const q = query(collection(db, `users/${userId}/notifications`), orderBy('timestamp', 'desc'), limit(20));
        return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification))), errCb);
    },
    markNotificationAsRead: async (id: string) => {
        // Requires precise path or structured query, assuming passed context usually
    },
    markAllNotificationsAsRead: async (userId: string) => {
        const q = query(collection(db, `users/${userId}/notifications`), where('isRead', '==', false));
        const snap = await getDocs(q);
        snap.forEach(d => updateDoc(d.ref, { isRead: true }));
    },

    // --- Other ---
    uploadProfilePicture: async (userId: string, file: File) => {
        return await uploadFileToStorage(`avatars/${userId}`, file);
    },
    createDispute: async (data: any) => {
        await addDoc(collection(db, DISPUTES_COLLECTION), { ...data, status: 'open', timestamp: serverTimestamp() });
        const col = data.collaborationType === 'direct' ? COLLAB_REQUESTS_COLLECTION : 
                    data.collaborationType === 'campaign' ? CAMPAIGN_APPS_COLLECTION :
                    data.collaborationType === 'ad_slot' ? AD_REQUESTS_COLLECTION : BANNER_BOOKINGS_COLLECTION;
        await updateDoc(doc(db, col, data.collaborationId), { status: 'disputed' });
    },
    getDisputes: async () => {
        const snap = await getDocs(collection(db, DISPUTES_COLLECTION));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    getBoostsForUser: async (userId: string) => {
        const q = query(collection(db, 'boosts'), where('userId', '==', userId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Boost[];
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
        return await uploadFileToStorage(`partners`, file);
    },
    sendBulkEmail: async (role: string, subject: string, body: string) => {
        // Backend function trigger
    },
    sendPushNotification: async (title: string, body: string, role: string, url?: string) => {
        // Backend function trigger
    },
    generateReferralCode: async (userId: string) => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await updateDoc(doc(db, USERS_COLLECTION, userId), { referralCode: code });
        return code;
    },
    applyReferralCode: async (userId: string, code: string) => {
        await updateDoc(doc(db, USERS_COLLECTION, userId), { referredBy: code, coins: increment(20) });
    },
    submitKyc: async (userId: string, details: any, file1?: File | null, file2?: File | null, panFile?: File | null) => {
        let idProofUrl = details.idProofUrl;
        let selfieUrl = details.selfieUrl;
        let panCardUrl = details.panCardUrl;

        if(file1) {
            idProofUrl = await uploadFileToStorage(`kyc/${userId}/id_proof`, file1);
        }
        
        if (panFile) {
            panCardUrl = await uploadFileToStorage(`kyc/${userId}/pan_card`, panFile);
        }

        await updateDoc(doc(db, USERS_COLLECTION, userId), { 
            kycStatus: 'pending', 
            kycDetails: { ...details, idProofUrl, selfieUrl, panCardUrl } 
        });
    },
    getKycSubmissions: async () => {
        const q = query(collection(db, USERS_COLLECTION), where('kycStatus', '==', 'pending'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
    },
    updateKycStatus: async (userId: string, status: string, reason?: string) => {
        await updateDoc(doc(db, USERS_COLLECTION, userId), { 
            kycStatus: status, 
            'kycDetails.rejectionReason': reason || null 
        });
    },
};
