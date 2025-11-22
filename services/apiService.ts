






// ... (imports remain same)
import { Influencer, Message, User, PlatformSettings, Attachment, CollaborationRequest, CollabRequestStatus, Conversation, ConversationParticipant, Campaign, CampaignApplication, LiveTvChannel, AdSlotRequest, BannerAd, BannerAdBookingRequest, SupportTicket, TicketReply, SupportTicketStatus, Membership, UserRole, PayoutRequest, CampaignApplicationStatus, AdBookingStatus, AnyCollaboration, DailyPayoutRequest, Post, Comment, Dispute, MembershipPlan, Transaction, KycDetails, KycStatus, PlatformBanner, PushNotification, Boost, BoostType, LiveHelpMessage, LiveHelpSession, RefundRequest, View, QuickReply, CreatorVerificationDetails, CreatorVerificationStatus, AppNotification, NotificationType, Partner } from '../types';
import { db, storage, auth, BACKEND_URL, RAZORPAY_KEY_ID } from './firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  documentId,
  arrayUnion,
  increment,
  deleteDoc,
  arrayRemove,
  getCountFromServer,
  onSnapshot,
  limit,
  startAfter,
  runTransaction,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';

const DEFAULT_AVATAR_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDRjMCAwIDAtMSAwLTJoMTJ2Mmg0di00YzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==';

const generateCollabId = (): string => `CRI${String(Math.floor(Math.random() * 10000000000)).padStart(10, '0')}`;
// ... (initial data constants remain same)

// ... (helper functions remain same)

export const apiService = {
  // ... (other methods like uploadKycFile, submitKyc etc. remain same)
  uploadKycFile: (userId: string, file: File, type: 'id_proof' | 'selfie'): Promise<string> => {
    const storageRef = ref(storage, `kyc_documents/${userId}/${type}_${Date.now()}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        () => {}, 
        (error) => reject(error),
        () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); }
      );
    });
  },
  // ...
  submitKyc: async (userId: string, data: KycDetails, idProofFile: File | null, selfieFile: File | null): Promise<void> => {
      let idProofUrl = data.idProofUrl;
      let selfieUrl = data.selfieUrl;

      if (idProofFile) {
          idProofUrl = await apiService.uploadKycFile(userId, idProofFile, 'id_proof');
      }
      if (selfieFile) {
          selfieUrl = await apiService.uploadKycFile(userId, selfieFile, 'selfie');
      }

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
          kycStatus: 'pending',
          kycDetails: {
              ...data,
              idProofUrl,
              selfieUrl,
          }
      });
  },
  // ... (Digilocker and other KYC methods)
  submitDigilockerKyc: async (userId: string): Promise<void> => {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
          kycStatus: 'approved',
          kycDetails: {
              address: 'Verified via DigiLocker',
              city: 'Verified',
              state: 'Verified',
              pincode: '000000',
          }
      });
  },
  updateKycStatus: async (userId: string, status: KycStatus, reason?: string): Promise<void> => {
      const userRef = doc(db, 'users', userId);
      const updateData: any = { kycStatus: status };
      if (reason) updateData['kycDetails.rejectionReason'] = reason;
      await updateDoc(userRef, updateData);
  },
  getKycSubmissions: async (): Promise<User[]> => {
      const q = query(collection(db, 'users'), where('kycStatus', '==', 'pending'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  },
  // ... (Creator Verification methods)
  submitCreatorVerification: async (userId: string, details: CreatorVerificationDetails): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      creatorVerificationStatus: 'pending',
      creatorVerificationDetails: details,
    });
  },
  getPendingCreatorVerifications: async (): Promise<User[]> => {
    const q = query(collection(db, 'users'), where('creatorVerificationStatus', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  },
  updateCreatorVerificationStatus: async (userId: string, status: CreatorVerificationStatus, reason?: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    const updateData: { [key: string]: any } = { creatorVerificationStatus: status };
    if (status === 'rejected' && reason) {
      updateData['creatorVerificationDetails.rejectionReason'] = reason;
    }
    await updateDoc(userRef, updateData);
  },
  // ... (Upload methods remain same)
  uploadProfilePicture: (userId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `profile_pictures/${userId}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadBannerAdPhoto: (agencyId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `banner_ads/${agencyId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadMessageAttachment: (messageId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `message_attachments/${messageId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadTicketAttachment: (ticketId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `support_tickets/${ticketId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadDailyPayoutVideo: async (userId: string, file: Blob): Promise<string> => {
    const storageRef = ref(storage, `daily_payout_videos/${userId}/${Date.now()}.webm`);
    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: 'video/webm' });
    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadPayoutSelfie: (userId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `payout_selfies/${userId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadPostImage: (postId: string, file: File): Promise<string> => {
      const storageRef = ref(storage, `posts/${postId}/${file.name}`);
      return new Promise((resolve, reject) => {
        uploadBytes(storageRef, file).then(snapshot => { getDownloadURL(snapshot.ref).then(resolve).catch(reject); }).catch(reject);
      });
  },
  // ... (initializeFirestoreData and other getters remain same)
  initializeFirestoreData: async (): Promise<void> => { /* ... same as before ... */ },
  getInfluencersPaginated: async (settings: PlatformSettings, options: { limit: number; startAfterDoc?: QueryDocumentSnapshot<DocumentData> }): Promise<{ influencers: Influencer[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => { /* ... same as before ... */ return { influencers: [], lastVisible: null }; },
  getAllInfluencers: async (): Promise<Influencer[]> => { const influencersCol = collection(db, 'influencers'); const snapshot = await getDocs(influencersCol); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Influencer)); },
  getLiveTvChannels: async (settings: PlatformSettings): Promise<LiveTvChannel[]> => { /* ... same as before ... */ return []; },
  
  // Platform Settings
  getPlatformSettings: async (): Promise<PlatformSettings> => {
    const docRef = doc(db, 'settings', 'platform');
    
    const defaultSettings: PlatformSettings = {
        welcomeMessage: 'Welcome to Collabzz, the premier platform for brands and influencers.',
        isMessagingEnabled: true,
        areInfluencerProfilesPublic: true,
        youtubeTutorialUrl: 'https://www.youtube.com',
        isNotificationBannerEnabled: false,
        notificationBannerText: '',
        payoutSettings: { requireLiveVideoForDailyPayout: true, requireSelfieForPayout: true },
        isMaintenanceModeEnabled: false,
        isCommunityFeedEnabled: true,
        isWelcomeMessageEnabled: true,
        activePaymentGateway: 'razorpay', // Default to Razorpay
        paymentGatewayApiId: '',
        paymentGatewayApiSecret: '',
        paymentGatewaySourceCode: '',
        // Initialize Razorpay Key ID from user-provided value to ensure fallback
        razorpayKeyId: RAZORPAY_KEY_ID, // Use the constant from firebase.ts which handles fallback
        razorpayKeySecret: '', 
        otpApiId: '',
        otpApiSecret: '',
        otpApiSourceCode: '',
        isOtpLoginEnabled: true,
        isForgotPasswordOtpEnabled: true,
        isStaffRegistrationEnabled: true, 
        isSocialMediaFabEnabled: true,
        socialMediaLinks: [],
        isDigilockerKycEnabled: true,
        digilockerClientId: '',
        digilockerClientSecret: '',
        isKycIdProofRequired: true,
        isKycSelfieRequired: true,
        isProMembershipEnabled: true,
        isCreatorMembershipEnabled: true,
        membershipPrices: { free: 0, pro_10: 1000, pro_20: 1800, pro_unlimited: 2500, basic: 199, pro: 499, premium: 999 },
        gstRate: 18,
        isGstEnabled: true,
        platformCommissionRate: 10,
        isPlatformCommissionEnabled: true,
        paymentProcessingChargeRate: 2,
        isPaymentProcessingChargeEnabled: true,
        isProfileBoostingEnabled: true,
        isCampaignBoostingEnabled: true,
        boostPrices: { profile: 49, campaign: 99, banner: 199 },
        isLiveHelpEnabled: true,
        discountSettings: {
            creatorProfileBoost: { isEnabled: false, percentage: 0 },
            brandMembership: { isEnabled: false, percentage: 0 },
            creatorMembership: { isEnabled: false, percentage: 0 },
            brandCampaignBoost: { isEnabled: false, percentage: 0 },
        },
    };
    
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const existingData = docSnap.data();
            // Merge to ensure new fields (like razorpayKeyId) exist if they were missing in DB
            return { ...defaultSettings, ...existingData } as PlatformSettings;
        } else {
            await setDoc(docRef, defaultSettings);
            return defaultSettings;
        }
    } catch (error) {
        console.warn("Could not read/write platform settings from Firestore. Falling back to defaults.", error);
        return defaultSettings;
    }
  },
  updatePlatformSettings: async (settings: PlatformSettings): Promise<void> => {
    const docRef = doc(db, 'settings', 'platform');
    await setDoc(docRef, settings, { merge: true });
  },
  // ... (rest of the file remains unchanged)
  getAllUsers: async (): Promise<User[]> => { const usersCol = collection(db, 'users'); const snapshot = await getDocs(usersCol); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)); },
  getUsersPaginated: async (options: { pageLimit: number; startAfterDoc?: QueryDocumentSnapshot<DocumentData> }): Promise<{ users: User[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => { /*...*/ return {users: [], lastVisible: null} },
  getUserByEmail: async (email: string): Promise<User | null> => { /*...*/ return null },
  getUserByMobile: async (mobile: string): Promise<User | null> => { /*...*/ return null },
  updateUserProfile: async (userId: string, data: Partial<User>): Promise<void> => { const userRef = doc(db, 'users', userId); await updateDoc(userRef, data); },
  updateUser: async (userId: string, data: Partial<User>): Promise<void> => { const userRef = doc(db, 'users', userId); await updateDoc(userRef, data); },
  updateUserMembership: async (userId: string, isActive: boolean): Promise<void> => { /*...*/ },
  getInfluencerProfile: async (influencerId: string): Promise<Influencer | null> => { /*...*/ return null },
  updateInfluencerProfile: async (influencerId: string, data: Partial<Influencer>): Promise<void> => { const docRef = doc(db, 'influencers', influencerId); await setDoc(docRef, data, { merge: true }); },
  getMessages: async (userId1: string, userId2: string): Promise<Message[]> => { /*...*/ return [] },
  getMessagesListener: (userId1: string, userId2: string, callback: (messages: Message[]) => void, onError: (error: Error) => void): (() => void) => { /*...*/ return () => {} },
  sendMessage: async (text: string, senderId: string, receiverId: string, attachments: Attachment[]): Promise<Message> => { /*...*/ return {} as Message },
  getConversations: async (userId: string): Promise<Conversation[]> => { /*...*/ return [] },
  sendCollabRequest: async (requestData: Omit<CollaborationRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => { /*...*/ },
  getCollabRequestsForBrand: async (brandId: string): Promise<CollaborationRequest[]> => { /*...*/ return [] },
  getCollabRequestsForBrandListener: (brandId: string, callback: (requests: CollaborationRequest[]) => void, onError: (error: Error) => void): (() => void) => { /*...*/ return () => {} },
  getCollabRequestsForInfluencer: async (influencerId: string): Promise<CollaborationRequest[]> => { /*...*/ return [] },
  getCollabRequestsForInfluencerListener: (influencerId: string, callback: (requests: CollaborationRequest[]) => void, onError: (error: Error) => void): (() => void) => { /*...*/ return () => {} },
  updateCollaborationRequest: async (reqId: string, data: Partial<CollaborationRequest>, actorId: string): Promise<void> => { /*...*/ },
  createCampaign: async (campaignData: Omit<Campaign, 'id' | 'status' | 'timestamp'>): Promise<void> => { /*...*/ },
  getCampaignsForBrand: async (brandId: string): Promise<Campaign[]> => { /*...*/ return [] },
  getAllOpenCampaigns: async (locationFilter?: string): Promise<Campaign[]> => { /*...*/ return [] },
  getApplicationsForCampaign: async (campaignId: string): Promise<CampaignApplication[]> => { /*...*/ return [] },
  getCampaignApplicationsForInfluencer: async (influencerId: string): Promise<CampaignApplication[]> => { /*...*/ return [] },
  applyToCampaign: async (applicationData: Omit<CampaignApplication, 'id' | 'status' | 'timestamp'>): Promise<void> => { /*...*/ },
  updateCampaignApplication: async (appId: string, data: Partial<CampaignApplication>, actorId: string): Promise<void> => { /*...*/ },
  sendAdSlotRequest: async (data: Omit<AdSlotRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => { /*...*/ },
  getAdSlotRequestsForBrand: async (brandId: string): Promise<AdSlotRequest[]> => { /*...*/ return [] },
  getAdSlotRequestsForLiveTv: async (liveTvUserId: string): Promise<AdSlotRequest[]> => { /*...*/ return [] },
  updateAdSlotRequest: async (reqId: string, data: Partial<AdSlotRequest>, actorId: string): Promise<void> => { /*...*/ },
  createBannerAd: async (data: Omit<BannerAd, 'id' | 'timestamp'>): Promise<void> => { /*...*/ },
  getBannerAds: async (queryStr: string, settings: PlatformSettings): Promise<BannerAd[]> => { /*...*/ return [] },
  getBannerAdsForAgency: async (agencyId: string): Promise<BannerAd[]> => { /*...*/ return [] },
  sendBannerAdBookingRequest: async (data: Omit<BannerAdBookingRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => { /*...*/ },
  getBannerAdBookingRequestsForBrand: async (brandId: string): Promise<BannerAdBookingRequest[]> => { /*...*/ return [] },
  getBannerAdBookingRequestsForAgency: async (agencyId: string): Promise<BannerAdBookingRequest[]> => { /*...*/ return [] },
  updateBannerAdBookingRequest: async (reqId: string, data: Partial<BannerAdBookingRequest>, actorId: string): Promise<void> => { /*...*/ },
  getActiveAdCollabsForAgency: async (agencyId: string, role: UserRole): Promise<AnyCollaboration[]> => { /*...*/ return [] },
  getPlatformBanners: async (): Promise<PlatformBanner[]> => { /*...*/ return [] },
  getActivePlatformBanners: async (): Promise<PlatformBanner[]> => { /*...*/ return [] },
  createPlatformBanner: async (data: Omit<PlatformBanner, 'id' | 'createdAt'>): Promise<void> => { /*...*/ },
  updatePlatformBanner: async (id: string, data: Partial<PlatformBanner>): Promise<void> => { /*...*/ },
  deletePlatformBanner: async (id: string): Promise<void> => { /*...*/ },
  uploadPlatformBannerImage: (file: File): Promise<string> => { /*...*/ return Promise.resolve("") },
  saveFcmToken: async (userId: string, token: string | null): Promise<void> => { /*...*/ },
  updateNotificationPreferences: async (userId: string, preferences: { enabled: boolean }): Promise<void> => { /*...*/ },
  sendPushNotification: async (title: string, body: string, targetRole: UserRole | 'all', targetUrl?: string): Promise<void> => { /*...*/ },
  sendBulkEmail: async (targetRole: UserRole, subject: string, body: string): Promise<void> => { /*...*/ },
  getBoostsForUser: async (userId: string): Promise<Boost[]> => { /*...*/ return [] },
  activateBoost: async (userId: string, boostType: BoostType, targetId: string, targetType: 'profile' | 'campaign' | 'banner'): Promise<void> => { /*...*/ },
  processPayout: async (payoutRequestId: string): Promise<any> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Authentication required.");
    const token = await user.getIdToken();
    const res = await fetch(`${BACKEND_URL}/process-payout`, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ payoutRequestId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to process payout.');
    return data;
  },
  createSupportTicket: async (ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>, firstReply: Omit<TicketReply, 'id' | 'ticketId' | 'timestamp'>): Promise<void> => { /*...*/ },
  getTicketsForUser: async (userId: string): Promise<SupportTicket[]> => { /*...*/ return [] },
  getAllTickets: async (): Promise<SupportTicket[]> => { /*...*/ return [] },
  getTicketReplies: async (ticketId: string): Promise<TicketReply[]> => { /*...*/ return [] },
  addTicketReply: async (replyData: Omit<TicketReply, 'id' | 'timestamp'>): Promise<void> => { /*...*/ },
  updateTicketStatus: async (ticketId: string, status: SupportTicketStatus): Promise<void> => { /*...*/ },
  getSessionsForUser: async (userId: string): Promise<LiveHelpSession[]> => { /*...*/ return [] },
  getOrCreateLiveHelpSession: async (userId: string, userName: string, userAvatar: string, staffId: string): Promise<string> => { /*...*/ return "" },
  reopenLiveHelpSession: async (sessionId: string): Promise<void> => { /*...*/ },
  closeLiveHelpSession: async (sessionId: string): Promise<void> => { /*...*/ },
  assignStaffToSession: async (sessionId: string, staffUser: User): Promise<void> => { /*...*/ },
  sendLiveHelpMessage: async (sessionId: string, senderId: string, senderName: string, text: string): Promise<void> => { /*...*/ },
  getAllLiveHelpSessionsListener: (callback: (sessions: LiveHelpSession[]) => void): (() => void) => { /*...*/ return () => {} },
  addQuickReply: async (text: string): Promise<void> => { /*...*/ },
  updateQuickReply: async (id: string, text: string): Promise<void> => { /*...*/ },
  deleteQuickReply: async (id: string): Promise<void> => { /*...*/ },
  getQuickRepliesListener: (callback: (replies: QuickReply[]) => void): (() => void) => { /*...*/ return () => {} },
  createPost: async (postData: Omit<Post, 'id'>): Promise<Post> => { /*...*/ return {} as Post },
  getPosts: async (userId?: string): Promise<Post[]> => { /*...*/ return [] },
  deletePost: async (postId: string): Promise<void> => { /*...*/ },
  updatePost: async (postId: string, data: Partial<Post>): Promise<void> => { /*...*/ },
  toggleLikePost: async (postId: string, userId: string): Promise<void> => { /*...*/ },
  getCommentsForPost: async (postId: string): Promise<Comment[]> => { /*...*/ return [] },
  addCommentToPost: async (postId: string, commentData: Omit<Comment, 'id' | 'timestamp'>): Promise<void> => { /*...*/ },
  createRefundRequest: async (data: Omit<RefundRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => { /*...*/ },
  updateRefundRequest: async (id: string, data: Partial<RefundRequest>): Promise<void> => { /*...*/ },
  submitDailyPayoutRequest: async (data: Omit<DailyPayoutRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => { /*...*/ },
  updateDailyPayoutRequest: async (id: string, data: Partial<DailyPayoutRequest>): Promise<void> => { /*...*/ },
  updateDailyPayoutRequestStatus: async (reqId: string, collabId: string, collabType: 'ad_slot' | 'banner_booking', status: 'approved' | 'rejected', amount?: number, reason?: string): Promise<void> => { /*...*/ },
  createDispute: async (data: Omit<Dispute, 'id' | 'status' | 'timestamp'>): Promise<void> => { /*...*/ },
  getDisputes: async (): Promise<Dispute[]> => { /*...*/ return [] },
  getAllTransactions: async (): Promise<Transaction[]> => getDocs(collection(db, 'transactions')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))),
  getAllPayouts: async (): Promise<PayoutRequest[]> => getDocs(collection(db, 'payout_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as PayoutRequest))),
  getAllRefunds: async (): Promise<RefundRequest[]> => getDocs(collection(db, 'refund_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as RefundRequest))),
  getAllDailyPayouts: async (): Promise<DailyPayoutRequest[]> => getDocs(collection(db, 'daily_payout_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyPayoutRequest))),
  getAllCollaborationRequests: async (): Promise<CollaborationRequest[]> => getDocs(collection(db, 'collaboration_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest))),
  getAllCampaignApplications: async (): Promise<CampaignApplication[]> => getDocs(collection(db, 'campaign_applications')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignApplication))),
  getAllAdSlotRequests: async (): Promise<AdSlotRequest[]> => getDocs(collection(db, 'ad_slot_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest))),
  getAllBannerAdBookingRequests: async (): Promise<BannerAdBookingRequest[]> => getDocs(collection(db, 'banner_booking_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest))),
  updatePayoutRequest: async (id: string, data: Partial<PayoutRequest>): Promise<void> => { /*...*/ },
  submitPayoutRequest: async (data: Omit<PayoutRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => { /*...*/ },
  updatePayoutStatus: async (reqId: string, status: PayoutRequest['status'], collabId: string, collabType: PayoutRequest['collaborationType'], reason?: string): Promise<void> => { /*...*/ },
  getTransactionsForUser: async (userId: string): Promise<Transaction[]> => { /*...*/ return [] },
  getPayoutHistoryForUser: async (userId: string): Promise<PayoutRequest[]> => { /*...*/ return [] },
  createNotification: async (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>): Promise<void> => { /*...*/ },
  getNotificationsForUserListener: (userId: string, callback: (notifications: AppNotification[]) => void, onError: (error: Error) => void): (() => void) => { /*...*/ return () => {} },
  markNotificationAsRead: async (notificationId: string): Promise<void> => { /*...*/ },
  markAllNotificationsAsRead: async (userId: string): Promise<void> => { /*...*/ },
  getPartners: async (): Promise<Partner[]> => { /*...*/ return [] },
  createPartner: async (data: Omit<Partner, 'id' | 'createdAt'>): Promise<void> => { /*...*/ },
  updatePartner: async (id: string, data: Partial<Omit<Partner, 'id'| 'createdAt'>>): Promise<void> => { /*...*/ },
  deletePartner: async (id: string): Promise<void> => { /*...*/ },
  uploadPartnerLogo: (file: File): Promise<string> => { /*...*/ return Promise.resolve("") },

  // --- Referral System ---
  generateReferralCode: async (userId: string): Promise<string> => {
    // 1. Try External API
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("User not logged in");
        const token = await user.getIdToken();

        // Timeout to prevent long waits
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); 

        const response = await fetch('https://referal-backend-dx82.onrender.com/generateReferral', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ uid: userId }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            // Robust check for different response formats
            const code = data.referralCode || data.referral_code || data.code;
            if (code && typeof code === 'string') return code;
        }
        
        // If response not ok or no code, throw to trigger fallback
        throw new Error(`External service returned ${response.status} or invalid data`);
    } catch (apiError) {
        console.warn("Referral API failed, using fallback generation:", apiError);
        
        // 2. Fallback: Generate local code
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "REF";
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // 3. Save to Firestore
        try {
            const userRef = doc(db, 'users', userId);
            // Use setDoc with merge to be safe
            await setDoc(userRef, { referralCode: code }, { merge: true });
            return code;
        } catch (dbError) {
            console.error("Critical: Failed to save referral code locally:", dbError);
            throw new Error("Failed to generate referral code. Please check your internet connection.");
        }
    }
  },

  applyReferralCode: async (userId: string, code: string): Promise<void> => {
    // Use a transaction to ensure integrity
    await runTransaction(db, async (transaction) => {
        // 1. Validate code: Find user who owns this referral code
        const q = query(collection(db, 'users'), where('referralCode', '==', code), limit(1));
        const referrerSnapshot = await getDocs(q);
        
        if (referrerSnapshot.empty) {
            throw new Error("Invalid referral code.");
        }
        
        const referrerDoc = referrerSnapshot.docs[0];
        const referrerId = referrerDoc.id;
        const referrerData = referrerDoc.data();

        // 2. Validate User (Self)
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User does not exist.");
        const userData = userDoc.data();

        if (userData.referredBy) throw new Error("You have already been referred.");
        if (userId === referrerId) throw new Error("You cannot refer yourself.");

        // 3. Update Referrer (Add 50 coins)
        const newReferrerCoins = (referrerData.coins || 0) + 50;
        transaction.update(referrerDoc.ref, { coins: newReferrerCoins });

        // 4. Update User (Add 20 coins, set referredBy)
        const newUserCoins = (userData.coins || 0) + 20;
        transaction.update(userRef, {
            coins: newUserCoins,
            referredBy: code,
            referralAppliedAt: serverTimestamp()
        });

        // 5. Create Audit Record
        const referralRef = doc(collection(db, 'referrals'));
        transaction.set(referralRef, {
            referrerUid: referrerId,
            referredUid: userId,
            referrerCode: code,
            referredCode: userData.referralCode || 'PENDING', // Might be null if not generated yet
            awarded: true,
            referrerCoins: 50,
            referredCoins: 20,
            createdAt: serverTimestamp()
        });
    });
  }
};
