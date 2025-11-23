
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
  getInfluencersPaginated: async (settings: PlatformSettings, options: { limit: number; startAfterDoc?: QueryDocumentSnapshot<DocumentData> }): Promise<{ influencers: Influencer[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => { 
      try {
        const influencersCol = collection(db, 'influencers');
        let q = query(influencersCol);

        if (!settings.areInfluencerProfilesPublic) {
             // If profiles are not public, we might restrict query here, but logic usually handled in component
        }
        
        // Order by boosted status first, then name
        q = query(q, orderBy('isBoosted', 'desc'), orderBy('name'));

        if (options.startAfterDoc) {
            q = query(q, startAfter(options.startAfterDoc));
        }
        
        q = query(q, limit(options.limit));

        const snapshot = await getDocs(q);
        const influencers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Influencer));
        const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;

        return { influencers, lastVisible };
      } catch (e) {
          console.error("Pagination error", e);
          return { influencers: [], lastVisible: null };
      }
  },
  getAllInfluencers: async (): Promise<Influencer[]> => { const influencersCol = collection(db, 'influencers'); const snapshot = await getDocs(influencersCol); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Influencer)); },
  getLiveTvChannels: async (settings: PlatformSettings): Promise<LiveTvChannel[]> => { 
      const col = collection(db, 'livetv_channels');
      const q = query(col, orderBy('isBoosted', 'desc')); // Show boosted channels first
      const snapshot = await getDocs(q); 
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveTvChannel)); 
  },
  
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
  getUsersPaginated: async (options: { pageLimit: number; startAfterDoc?: QueryDocumentSnapshot<DocumentData> }): Promise<{ users: User[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => { 
      let q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(options.pageLimit));
      if (options.startAfterDoc) {
          q = query(q, startAfter(options.startAfterDoc));
      }
      const snapshot = await getDocs(q);
      return {
          users: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)),
          lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
      };
  },
  getUserByEmail: async (email: string): Promise<User | null> => { 
      const q = query(collection(db, 'users'), where('email', '==', email));
      const snapshot = await getDocs(q);
      if(snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;
  },
  getUserByMobile: async (mobile: string): Promise<User | null> => {
      const q = query(collection(db, 'users'), where('mobileNumber', '==', mobile));
      const snapshot = await getDocs(q);
      if(snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;
  },
  updateUserProfile: async (userId: string, data: Partial<User>): Promise<void> => { const userRef = doc(db, 'users', userId); await updateDoc(userRef, data); },
  updateUser: async (userId: string, data: Partial<User>): Promise<void> => { const userRef = doc(db, 'users', userId); await updateDoc(userRef, data); },
  updateUserMembership: async (userId: string, isActive: boolean): Promise<void> => { 
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { 'membership.isActive': isActive });
      // Also update role specific doc
      const userSnap = await getDoc(userRef);
      if(userSnap.exists() && userSnap.data().role === 'influencer') {
          await updateDoc(doc(db, 'influencers', userId), { membershipActive: isActive });
      }
  },
  getInfluencerProfile: async (influencerId: string): Promise<Influencer | null> => { 
      const docSnap = await getDoc(doc(db, 'influencers', influencerId));
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Influencer : null;
  },
  updateInfluencerProfile: async (influencerId: string, data: Partial<Influencer>): Promise<void> => { const docRef = doc(db, 'influencers', influencerId); await setDoc(docRef, data, { merge: true }); },
  getMessages: async (userId1: string, userId2: string): Promise<Message[]> => {
      const messagesRef = collection(db, 'messages');
      // Firestore requires complex indexing for OR queries with sorting.
      // Simplified approach: Query for messages where sender is u1 AND receiver is u2, AND vice versa.
      const q1 = query(messagesRef, where('senderId', '==', userId1), where('receiverId', '==', userId2));
      const q2 = query(messagesRef, where('senderId', '==', userId2), where('receiverId', '==', userId1));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const allMessages = [...snap1.docs, ...snap2.docs].map(d => ({ id: d.id, ...d.data() } as Message));
      
      return allMessages.sort((a, b) => {
          const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return tA - tB;
      });
  },
  getMessagesListener: (userId1: string, userId2: string, callback: (messages: Message[]) => void, onError: (error: Error) => void): (() => void) => {
      const messagesRef = collection(db, 'messages');
      // Listening to a composite query for chat
      const q = query(messagesRef, 
        where('participantIds', 'array-contains', userId1), 
        orderBy('timestamp', 'asc')
      );
      
      return onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Message))
            .filter(m => m.participantIds?.includes(userId2)); // Client side filter for specific conversation
          callback(msgs);
      }, onError);
  },
  sendMessage: async (text: string, senderId: string, receiverId: string, attachments: Attachment[]): Promise<Message> => {
      const msgData = {
          text,
          senderId,
          receiverId,
          participantIds: [senderId, receiverId],
          timestamp: serverTimestamp(),
          attachments
      };
      const docRef = await addDoc(collection(db, 'messages'), msgData);
      // Update conversation last message
      await setDoc(doc(db, 'conversations', `${senderId}_${receiverId}`), {
          participantIds: [senderId, receiverId],
          lastMessage: { text, timestamp: serverTimestamp() },
          [senderId]: true,
          [receiverId]: true
      }, { merge: true });
      
      return { id: docRef.id, ...msgData } as Message;
  },
  getConversations: async (userId: string): Promise<Conversation[]> => { 
      // This requires a robust conversation tracking system.
      // Simplified: fetch recent messages or a 'conversations' collection
      const q = query(collection(db, 'conversations'), where(userId, '==', true));
      const snapshot = await getDocs(q);
      
      const convos = await Promise.all(snapshot.docs.map(async d => {
          const data = d.data();
          const otherId = data.participantIds.find((id: string) => id !== userId);
          const userDoc = await getDoc(doc(db, 'users', otherId));
          if(!userDoc.exists()) return null;
          const userData = userDoc.data();
          return {
              id: otherId,
              participant: { id: otherId, name: userData.name, avatar: userData.avatar, role: userData.role, handle: userData.companyName || '' },
              lastMessage: data.lastMessage
          } as Conversation;
      }));
      return convos.filter(c => c !== null) as Conversation[];
  },
  sendCollabRequest: async (requestData: Omit<CollaborationRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
      await addDoc(collection(db, 'collaboration_requests'), {
          ...requestData,
          status: 'pending',
          timestamp: serverTimestamp(),
          collabId: generateCollabId()
      });
  },
  getCollabRequestsForBrand: async (brandId: string): Promise<CollaborationRequest[]> => {
      const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest));
  },
  getCollabRequestsForBrandListener: (brandId: string, callback: (requests: CollaborationRequest[]) => void, onError: (error: Error) => void): (() => void) => {
      const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId));
      return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest))), onError);
  },
  getCollabRequestsForInfluencer: async (influencerId: string): Promise<CollaborationRequest[]> => {
      const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest));
  },
  getCollabRequestsForInfluencerListener: (influencerId: string, callback: (requests: CollaborationRequest[]) => void, onError: (error: Error) => void): (() => void) => {
      const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId));
      return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest))), onError);
  },
  updateCollaborationRequest: async (reqId: string, data: Partial<CollaborationRequest>, actorId: string): Promise<void> => {
      await updateDoc(doc(db, 'collaboration_requests', reqId), data);
  },
  createCampaign: async (campaignData: Omit<Campaign, 'id' | 'status' | 'timestamp'>): Promise<void> => {
      await addDoc(collection(db, 'campaigns'), { ...campaignData, status: 'open', timestamp: serverTimestamp(), applicantIds: [] });
  },
  getCampaignsForBrand: async (brandId: string): Promise<Campaign[]> => {
      const q = query(collection(db, 'campaigns'), where('brandId', '==', brandId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
  },
  getAllOpenCampaigns: async (locationFilter?: string): Promise<Campaign[]> => {
      let q = query(collection(db, 'campaigns'), where('status', '==', 'open'));
      // Firestore doesn't support multiple inequality filters easily, filtering location client side if needed or exact match
      if (locationFilter && locationFilter !== 'All') {
          q = query(q, where('location', 'in', ['All', locationFilter]));
      }
      q = query(q, orderBy('isBoosted', 'desc'), orderBy('timestamp', 'desc')); // Show boosted campaigns first
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
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
  applyToCampaign: async (applicationData: Omit<CampaignApplication, 'id' | 'status' | 'timestamp'>): Promise<void> => {
      const batch = writeBatch(db);
      const appRef = doc(collection(db, 'campaign_applications'));
      batch.set(appRef, { ...applicationData, status: 'pending_brand_review', timestamp: serverTimestamp(), collabId: generateCollabId() });
      
      const campaignRef = doc(db, 'campaigns', applicationData.campaignId);
      batch.update(campaignRef, { applicantIds: arrayUnion(applicationData.influencerId) });
      
      await batch.commit();
  },
  updateCampaignApplication: async (appId: string, data: Partial<CampaignApplication>, actorId: string): Promise<void> => {
      await updateDoc(doc(db, 'campaign_applications', appId), data);
  },
  sendAdSlotRequest: async (data: Omit<AdSlotRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
      await addDoc(collection(db, 'ad_slot_requests'), { ...data, status: 'pending_approval', timestamp: serverTimestamp(), collabId: generateCollabId() });
  },
  getAdSlotRequestsForBrand: async (brandId: string): Promise<AdSlotRequest[]> => {
      const q = query(collection(db, 'ad_slot_requests'), where('brandId', '==', brandId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest));
  },
  getAdSlotRequestsForLiveTv: async (liveTvUserId: string): Promise<AdSlotRequest[]> => {
      const q = query(collection(db, 'ad_slot_requests'), where('liveTvId', '==', liveTvUserId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest));
  },
  updateAdSlotRequest: async (reqId: string, data: Partial<AdSlotRequest>, actorId: string): Promise<void> => {
      await updateDoc(doc(db, 'ad_slot_requests', reqId), data);
  },
  createBannerAd: async (data: Omit<BannerAd, 'id' | 'timestamp'>): Promise<void> => {
      await addDoc(collection(db, 'banner_ads'), { ...data, timestamp: serverTimestamp() });
  },
  getBannerAds: async (queryStr: string, settings: PlatformSettings): Promise<BannerAd[]> => {
      const col = collection(db, 'banner_ads');
      let q = query(col, orderBy('isBoosted', 'desc'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const allAds = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAd));
      if (!queryStr) return allAds;
      const lowerQ = queryStr.toLowerCase();
      return allAds.filter(ad => ad.location.toLowerCase().includes(lowerQ) || ad.address.toLowerCase().includes(lowerQ));
  },
  getBannerAdsForAgency: async (agencyId: string): Promise<BannerAd[]> => {
      const q = query(collection(db, 'banner_ads'), where('agencyId', '==', agencyId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAd));
  },
  sendBannerAdBookingRequest: async (data: Omit<BannerAdBookingRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
      await addDoc(collection(db, 'banner_booking_requests'), { ...data, status: 'pending_approval', timestamp: serverTimestamp(), collabId: generateCollabId() });
  },
  getBannerAdBookingRequestsForBrand: async (brandId: string): Promise<BannerAdBookingRequest[]> => {
      const q = query(collection(db, 'banner_booking_requests'), where('brandId', '==', brandId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest));
  },
  getBannerAdBookingRequestsForAgency: async (agencyId: string): Promise<BannerAdBookingRequest[]> => {
      const q = query(collection(db, 'banner_booking_requests'), where('agencyId', '==', agencyId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest));
  },
  updateBannerAdBookingRequest: async (reqId: string, data: Partial<BannerAdBookingRequest>, actorId: string): Promise<void> => {
      await updateDoc(doc(db, 'banner_booking_requests', reqId), data);
  },
  getActiveAdCollabsForAgency: async (agencyId: string, role: UserRole): Promise<AnyCollaboration[]> => {
      if (role === 'livetv') {
          const q = query(collection(db, 'ad_slot_requests'), where('liveTvId', '==', agencyId), where('status', '==', 'in_progress'));
          const snap = await getDocs(q);
          return snap.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest));
      } else if (role === 'banneragency') {
          const q = query(collection(db, 'banner_booking_requests'), where('agencyId', '==', agencyId), where('status', '==', 'in_progress'));
          const snap = await getDocs(q);
          return snap.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest));
      }
      return [];
  },
  getPlatformBanners: async (): Promise<PlatformBanner[]> => {
      const q = query(collection(db, 'platform_banners'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlatformBanner));
  },
  getActivePlatformBanners: async (): Promise<PlatformBanner[]> => {
      const q = query(collection(db, 'platform_banners'), where('isActive', '==', true), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlatformBanner));
  },
  createPlatformBanner: async (data: Omit<PlatformBanner, 'id' | 'createdAt'>): Promise<void> => {
      await addDoc(collection(db, 'platform_banners'), { ...data, createdAt: serverTimestamp() });
  },
  updatePlatformBanner: async (id: string, data: Partial<PlatformBanner>): Promise<void> => {
      await updateDoc(doc(db, 'platform_banners', id), data);
  },
  deletePlatformBanner: async (id: string): Promise<void> => {
      await deleteDoc(doc(db, 'platform_banners', id));
  },
  uploadPlatformBannerImage: (file: File): Promise<string> => {
      const storageRef = ref(storage, `platform_banners/${Date.now()}_${file.name}`);
      return uploadBytes(storageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
  },
  saveFcmToken: async (userId: string, token: string | null): Promise<void> => {
      await updateDoc(doc(db, 'users', userId), { fcmToken: token });
  },
  updateNotificationPreferences: async (userId: string, preferences: { enabled: boolean }): Promise<void> => {
      await updateDoc(doc(db, 'users', userId), { notificationPreferences: preferences });
  },
  sendPushNotification: async (title: string, body: string, targetRole: UserRole | 'all', targetUrl?: string): Promise<void> => {
      // In a real app, this would trigger a Cloud Function to send notifications via FCM Admin SDK.
      // For this simulation, we'll just log it or maybe create a 'notifications' collection document for a background trigger.
      console.log(`[Simulated Push] To: ${targetRole}, Title: ${title}, Body: ${body}`);
      // Create notification documents for relevant users (inefficient for large scale, but works for MVP)
      const usersRef = collection(db, 'users');
      let q = query(usersRef);
      if (targetRole !== 'all') {
          q = query(usersRef, where('role', '==', targetRole));
      }
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(userDoc => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
              userId: userDoc.id,
              title,
              body,
              targetUrl,
              type: 'system',
              view: View.DASHBOARD,
              timestamp: serverTimestamp(),
              isRead: false
          });
      });
      await batch.commit();
  },
  sendBulkEmail: async (targetRole: UserRole, subject: string, body: string): Promise<void> => {
      console.log(`[Simulated Email] To: ${targetRole}, Subject: ${subject}`);
      // Trigger cloud function or external email service
  },
  getBoostsForUser: async (userId: string): Promise<Boost[]> => {
      const boostsRef = collection(db, 'boosts');
      const q = query(boostsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Boost));
  },
  activateBoost: async (userId: string, boostType: BoostType, targetId: string, targetType: 'profile' | 'campaign' | 'banner'): Promise<void> => {
      const days = 7; // Default boost duration
      const now = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(now.getDate() + days);

      await addDoc(collection(db, 'boosts'), {
          userId,
          plan: boostType,
          expiresAt: Timestamp.fromDate(expiresAt),
          createdAt: serverTimestamp(),
          targetId,
          targetType,
      });
      
      // Update target object to reflect boost
      let collectionName = '';
      if (targetType === 'campaign') collectionName = 'campaigns';
      else if (targetType === 'banner') collectionName = 'banner_ads';
      else if (targetType === 'profile') {
          const userRef = await getDoc(doc(db, 'users', userId));
          const role = userRef.data()?.role;
          if (role === 'influencer') collectionName = 'influencers';
          else if (role === 'livetv') collectionName = 'livetv_channels';
      }
      
      if (collectionName) {
          await updateDoc(doc(db, collectionName, targetId), { isBoosted: true });
      }
  },
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
  createSupportTicket: async (ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>, firstReply: Omit<TicketReply, 'id' | 'ticketId' | 'timestamp'>): Promise<void> => {
      const batch = writeBatch(db);
      const ticketRef = doc(collection(db, 'support_tickets'));
      batch.set(ticketRef, { ...ticketData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      
      const replyRef = doc(collection(db, `support_tickets/${ticketRef.id}/replies`));
      batch.set(replyRef, { ...firstReply, ticketId: ticketRef.id, timestamp: serverTimestamp() });
      
      await batch.commit();
  },
  getTicketsForUser: async (userId: string): Promise<SupportTicket[]> => {
      const q = query(collection(db, 'support_tickets'), where('userId', '==', userId), orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
  },
  getAllTickets: async (): Promise<SupportTicket[]> => {
      const q = query(collection(db, 'support_tickets'), orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
  },
  getTicketReplies: async (ticketId: string): Promise<TicketReply[]> => {
      const q = query(collection(db, `support_tickets/${ticketId}/replies`), orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TicketReply));
  },
  addTicketReply: async (replyData: Omit<TicketReply, 'id' | 'timestamp'>): Promise<void> => {
      const batch = writeBatch(db);
      const replyRef = doc(collection(db, `support_tickets/${replyData.ticketId}/replies`));
      batch.set(replyRef, { ...replyData, timestamp: serverTimestamp() });
      
      const ticketRef = doc(db, 'support_tickets', replyData.ticketId);
      batch.update(ticketRef, { updatedAt: serverTimestamp(), status: 'in_progress' }); // Re-open or update status
      
      await batch.commit();
  },
  updateTicketStatus: async (ticketId: string, status: SupportTicketStatus): Promise<void> => {
      await updateDoc(doc(db, 'support_tickets', ticketId), { status, updatedAt: serverTimestamp() });
  },
  getSessionsForUser: async (userId: string): Promise<LiveHelpSession[]> => {
      const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LiveHelpSession));
  },
  getOrCreateLiveHelpSession: async (userId: string, userName: string, userAvatar: string, staffId: string): Promise<string> => {
      // Check for active session
      const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), where('status', 'in', ['open', 'unassigned']));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
          return snapshot.docs[0].id;
      }
      // Create new
      const docRef = await addDoc(collection(db, 'live_help_sessions'), {
          userId, userName, userAvatar,
          assignedStaffId: staffId, // Initially unassigned or auto-assign? Let's say unassigned for pool picking or direct if provided
          status: 'unassigned',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
      });
      return docRef.id;
  },
  reopenLiveHelpSession: async (sessionId: string): Promise<void> => {
      await updateDoc(doc(db, 'live_help_sessions', sessionId), { status: 'open', updatedAt: serverTimestamp() });
  },
  closeLiveHelpSession: async (sessionId: string): Promise<void> => {
      await updateDoc(doc(db, 'live_help_sessions', sessionId), { status: 'closed', updatedAt: serverTimestamp() });
  },
  assignStaffToSession: async (sessionId: string, staffUser: User): Promise<void> => {
      await updateDoc(doc(db, 'live_help_sessions', sessionId), { 
          assignedStaffId: staffUser.id, 
          assignedStaffName: staffUser.name, 
          assignedStaffAvatar: staffUser.avatar,
          status: 'open',
          updatedAt: serverTimestamp()
      });
  },
  sendLiveHelpMessage: async (sessionId: string, senderId: string, senderName: string, text: string): Promise<void> => {
      const batch = writeBatch(db);
      const msgRef = doc(collection(db, `live_help_sessions/${sessionId}/messages`));
      batch.set(msgRef, { senderId, senderName, text, timestamp: serverTimestamp() });
      
      const sessionRef = doc(db, 'live_help_sessions', sessionId);
      batch.update(sessionRef, { updatedAt: serverTimestamp() });
      
      await batch.commit();
  },
  getAllLiveHelpSessionsListener: (callback: (sessions: LiveHelpSession[]) => void): (() => void) => {
      const q = query(collection(db, 'live_help_sessions'), orderBy('updatedAt', 'desc'));
      return onSnapshot(q, (snapshot) => {
          callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LiveHelpSession)));
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
  getQuickRepliesListener: (callback: (replies: QuickReply[]) => void): (() => void) => {
      return onSnapshot(collection(db, 'quick_replies'), (snapshot) => {
          callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as QuickReply)));
      });
  },
  createPost: async (postData: Omit<Post, 'id'>): Promise<Post> => {
      const docRef = await addDoc(collection(db, 'posts'), postData);
      return { id: docRef.id, ...postData } as Post;
  },
  getPosts: async (userId?: string): Promise<Post[]> => {
      let q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const allPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      
      // Filter: Show public posts + private posts only if they belong to the requesting user
      return allPosts.filter(p => p.visibility === 'public' || (userId && p.userId === userId));
  },
  deletePost: async (postId: string): Promise<void> => {
      await deleteDoc(doc(db, 'posts', postId));
  },
  updatePost: async (postId: string, data: Partial<Post>): Promise<void> => {
      await updateDoc(doc(db, 'posts', postId), data);
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
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
  },
  addCommentToPost: async (postId: string, commentData: Omit<Comment, 'id' | 'timestamp'>): Promise<void> => {
      const batch = writeBatch(db);
      const commentRef = doc(collection(db, `posts/${postId}/comments`));
      batch.set(commentRef, { ...commentData, timestamp: serverTimestamp() });
      
      const postRef = doc(db, 'posts', postId);
      batch.update(postRef, { commentCount: increment(1) });
      
      await batch.commit();
  },
  createRefundRequest: async (data: Omit<RefundRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
      await addDoc(collection(db, 'refund_requests'), { ...data, status: 'pending', timestamp: serverTimestamp() });
      // Update source collab
      const collectionMap = {
          'direct': 'collaboration_requests',
          'campaign': 'campaign_applications',
          'ad_slot': 'ad_slot_requests',
          'banner_booking': 'banner_booking_requests'
      };
      const colName = collectionMap[data.collabType];
      if (colName) {
          await updateDoc(doc(db, colName, data.collaborationId), { status: 'refund_pending_admin_review' });
      }
  },
  updateRefundRequest: async (id: string, data: Partial<RefundRequest>): Promise<void> => {
      await updateDoc(doc(db, 'refund_requests', id), data);
  },
  submitDailyPayoutRequest: async (data: Omit<DailyPayoutRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
      await addDoc(collection(db, 'daily_payout_requests'), { ...data, status: 'pending', timestamp: serverTimestamp() });
  },
  updateDailyPayoutRequest: async (id: string, data: Partial<DailyPayoutRequest>): Promise<void> => {
      await updateDoc(doc(db, 'daily_payout_requests', id), data);
  },
  updateDailyPayoutRequestStatus: async (reqId: string, collabId: string, collabType: 'ad_slot' | 'banner_booking', status: 'approved' | 'rejected', amount?: number, reason?: string): Promise<void> => {
      const batch = writeBatch(db);
      const reqRef = doc(db, 'daily_payout_requests', reqId);
      const updateData: any = { status };
      if (reason) updateData.rejectionReason = reason;
      if (amount) updateData.approvedAmount = amount;
      
      batch.update(reqRef, updateData);
      
      if (status === 'approved') {
          const colName = collabType === 'ad_slot' ? 'ad_slot_requests' : 'banner_booking_requests';
          const collabRef = doc(db, colName, collabId);
          batch.update(collabRef, { dailyPayoutsReceived: increment(amount || 0) });
      }
      
      await batch.commit();
  },
  createDispute: async (data: Omit<Dispute, 'id' | 'status' | 'timestamp'>): Promise<void> => {
      await addDoc(collection(db, 'disputes'), { ...data, status: 'open', timestamp: serverTimestamp() });
      
      // Update source collab status to disputed
      const collectionMap = {
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
      const q = query(collection(db, 'disputes'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dispute));
  },
  getAllTransactions: async (): Promise<Transaction[]> => getDocs(collection(db, 'transactions')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))),
  getAllPayouts: async (): Promise<PayoutRequest[]> => getDocs(collection(db, 'payout_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as PayoutRequest))),
  getAllRefunds: async (): Promise<RefundRequest[]> => getDocs(collection(db, 'refund_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as RefundRequest))),
  getAllDailyPayouts: async (): Promise<DailyPayoutRequest[]> => getDocs(collection(db, 'daily_payout_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyPayoutRequest))),
  getAllCollaborationRequests: async (): Promise<CollaborationRequest[]> => getDocs(collection(db, 'collaboration_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest))),
  getAllCampaignApplications: async (): Promise<CampaignApplication[]> => getDocs(collection(db, 'campaign_applications')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignApplication))),
  getAllAdSlotRequests: async (): Promise<AdSlotRequest[]> => getDocs(collection(db, 'ad_slot_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest))),
  getAllBannerAdBookingRequests: async (): Promise<BannerAdBookingRequest[]> => getDocs(collection(db, 'banner_booking_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest))),
  updatePayoutRequest: async (id: string, data: Partial<PayoutRequest>): Promise<void> => {
      await updateDoc(doc(db, 'payout_requests', id), data);
  },
  submitPayoutRequest: async (data: Omit<PayoutRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
      await addDoc(collection(db, 'payout_requests'), {
          ...data,
          status: 'pending',
          timestamp: serverTimestamp()
      });
  },
  updatePayoutStatus: async (reqId: string, status: PayoutRequest['status'], collabId: string, collabType: PayoutRequest['collaborationType'], reason?: string): Promise<void> => {
      const payoutRef = doc(db, 'payout_requests', reqId);
      const updateData: any = { status };
      if(reason) updateData.rejectionReason = reason;
      
      const batch = writeBatch(db);
      batch.update(payoutRef, updateData);

      // If approved/completed, update the related collaboration document to 'payout_complete' if applicable
      if (status === 'approved' || status === 'completed') {
          const collectionMap = {
              'direct': 'collaboration_requests',
              'campaign': 'campaign_applications',
              'ad_slot': 'ad_slot_requests',
              'banner_booking': 'banner_booking_requests'
          };
          const collectionName = collectionMap[collabType];
          if (collectionName) {
              const collabRef = doc(db, collectionName, collabId); 
              batch.update(collabRef, { paymentStatus: 'payout_complete' });
          }
      }
      await batch.commit();
  },
  getTransactionsForUser: async (userId: string): Promise<Transaction[]> => {
    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    // Client-side sort to avoid index requirement
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Transaction))
        .sort((a, b) => {
            const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
            const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
            return tB - tA;
        });
  },
  getPayoutHistoryForUser: async (userId: string): Promise<PayoutRequest[]> => {
    const payoutsRef = collection(db, 'payout_requests');
    const q = query(payoutsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest))
        .sort((a, b) => {
            const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
            const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
            return tB - tA;
        });
  },
  createNotification: async (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>): Promise<void> => {
      await addDoc(collection(db, 'notifications'), { ...notification, timestamp: serverTimestamp(), isRead: false });
  },
  getNotificationsForUserListener: (userId: string, callback: (notifications: AppNotification[]) => void, onError: (error: Error) => void): (() => void) => {
      const q = query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(50));
      return onSnapshot(q, (snapshot) => {
          callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
      }, onError);
  },
  markNotificationAsRead: async (notificationId: string): Promise<void> => {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
  },
  markAllNotificationsAsRead: async (userId: string): Promise<void> => {
      const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('isRead', '==', false));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => batch.update(doc.ref, { isRead: true }));
      await batch.commit();
  },
  getPartners: async (): Promise<Partner[]> => {
      const q = query(collection(db, 'partners'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Partner));
  },
  createPartner: async (data: Omit<Partner, 'id' | 'createdAt'>): Promise<void> => {
      await addDoc(collection(db, 'partners'), { ...data, createdAt: serverTimestamp() });
  },
  updatePartner: async (id: string, data: Partial<Omit<Partner, 'id'| 'createdAt'>>): Promise<void> => {
      await updateDoc(doc(db, 'partners', id), data);
  },
  deletePartner: async (id: string): Promise<void> => {
      await deleteDoc(doc(db, 'partners', id));
  },
  uploadPartnerLogo: (file: File): Promise<string> => {
      const storageRef = ref(storage, `partners/${Date.now()}_${file.name}`);
      return uploadBytes(storageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
  },

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
