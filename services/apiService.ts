
// ... (imports remain same)
import { Influencer, Message, User, PlatformSettings, Attachment, CollaborationRequest, CollabRequestStatus, Conversation, ConversationParticipant, Campaign, CampaignApplication, LiveTvChannel, AdSlotRequest, BannerAd, BannerAdBookingRequest, SupportTicket, TicketReply, SupportTicketStatus, Membership, UserRole, PayoutRequest, CampaignApplicationStatus, AdBookingStatus, AnyCollaboration, DailyPayoutRequest, Post, Comment, Dispute, MembershipPlan, Transaction, KycDetails, KycStatus, PlatformBanner, PushNotification, Boost, BoostType, LiveHelpMessage, LiveHelpSession, RefundRequest, View, QuickReply, CreatorVerificationDetails, CreatorVerificationStatus, AppNotification, NotificationType, Partner } from '../types';
import { db, storage, auth, BACKEND_URL } from './firebase';
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

export const apiService = {
  // ... (uploadKycFile, submitKyc, submitDigilockerKyc, updateKycStatus, getKycSubmissions)
  uploadKycFile: (userId: string, file: File, type: 'id_proof' | 'selfie'): Promise<string> => {
    if (!storage) return Promise.reject(new Error("Firebase Storage is not initialized"));
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
  
  // ... (Creator Verification)
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

  // ... (upload methods)
  uploadProfilePicture: (userId: string, file: File): Promise<string> => {
    if (!storage) return Promise.reject(new Error("Firebase Storage is not initialized"));
    const storageRef = ref(storage, `profile_pictures/${userId}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadBannerAdPhoto: async (agencyId: string, file: File): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage is not initialized");
    // Sanitize filename to prevent path issues
    const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    // Use simpler uploadBytes for reliability
    const storageRef = ref(storage, `banner_ads/${agencyId}/${Date.now()}_${cleanName}`);
    
    try {
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    } catch (error: any) {
        console.error("Banner Upload Error:", error);
        throw new Error("Failed to upload banner image: " + (error.message || "Unknown error"));
    }
  },
  uploadMessageAttachment: (messageId: string, file: File): Promise<string> => {
    if (!storage) return Promise.reject(new Error("Firebase Storage is not initialized"));
    const storageRef = ref(storage, `message_attachments/${messageId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadTicketAttachment: (ticketId: string, file: File): Promise<string> => {
    if (!storage) return Promise.reject(new Error("Firebase Storage is not initialized"));
    const storageRef = ref(storage, `support_tickets/${ticketId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadDailyPayoutVideo: async (userId: string, file: Blob): Promise<string> => {
    if (!storage) return Promise.reject(new Error("Firebase Storage is not initialized"));
    const storageRef = ref(storage, `daily_payout_videos/${userId}/${Date.now()}.webm`);
    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: 'video/webm' });
    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadPayoutSelfie: (userId: string, file: File): Promise<string> => {
    if (!storage) return Promise.reject(new Error("Firebase Storage is not initialized"));
    const storageRef = ref(storage, `payout_selfies/${userId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', () => {}, (error) => reject(error), () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); });
    });
  },
  uploadPostImage: (postId: string, file: File): Promise<string> => {
      if (!storage) return Promise.reject(new Error("Firebase Storage is not initialized"));
      const storageRef = ref(storage, `posts/${postId}/${file.name}`);
      return new Promise((resolve, reject) => {
        uploadBytes(storageRef, file).then(snapshot => { getDownloadURL(snapshot.ref).then(resolve).catch(reject); }).catch(reject);
      });
  },

  initializeFirestoreData: async (): Promise<void> => { /* ... same as before ... */ },
  
  // ... (User/Influencer/LiveTV Getters)
  getInfluencersPaginated: async (settings: PlatformSettings, options: { limit: number; startAfterDoc?: QueryDocumentSnapshot<DocumentData> }): Promise<{ influencers: Influencer[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => { 
      try {
        const influencersCol = collection(db, 'influencers');
        let q = query(influencersCol);
        
        // Fix: Only order by isBoosted to avoid composite index error (isBoosted DESC, name ASC).
        // Do NOT add orderBy('name') here. Firestore requires a composite index if sorting by multiple fields.
        q = query(q, orderBy('isBoosted', 'desc'));
        
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
      // Ensure only isBoosted sort to prevent composite index issues
      const q = query(col, orderBy('isBoosted', 'desc'));
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
        activePaymentGateway: 'paytm',
        paymentGatewayApiId: '',
        paymentGatewayApiSecret: '',
        paymentGatewaySourceCode: '',
        paytmMid: '',
        paytmMerchantKey: '',
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
            return { ...defaultSettings, ...docSnap.data() } as PlatformSettings;
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
  setPaymentGateway: async (gateway: string): Promise<void> => {
    await fetch(`${BACKEND_URL}/setPaymentGateway`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gateway, secret: "ADMIN_SECRET" })
    });
  },

  // ... (rest of methods)
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
      const q = query(messagesRef, 
        where('participantIds', 'array-contains', userId1), 
        orderBy('timestamp', 'asc')
      );
      return onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Message))
            .filter(m => m.participantIds?.includes(userId2));
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
      await setDoc(doc(db, 'conversations', `${senderId}_${receiverId}`), {
          participantIds: [senderId, receiverId],
          lastMessage: { text, timestamp: serverTimestamp() },
          [senderId]: true,
          [receiverId]: true
      }, { merge: true });
      return { id: docRef.id, ...msgData } as Message;
  },
  getConversations: async (userId: string): Promise<Conversation[]> => { 
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
  
  // ... (Collab requests methods remain same, simplified here)
  sendCollabRequest: async (requestData: any) => { await addDoc(collection(db, 'collaboration_requests'), { ...requestData, status: 'pending', timestamp: serverTimestamp(), collabId: generateCollabId() }); },
  getCollabRequestsForBrand: async (brandId: string) => { const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest)); },
  getCollabRequestsForBrandListener: (brandId: string, cb: any, err: any) => onSnapshot(query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId)), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err),
  getCollabRequestsForInfluencer: async (influencerId: string) => { const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest)); },
  getCollabRequestsForInfluencerListener: (influencerId: string, cb: any, err: any) => onSnapshot(query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId)), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err),
  updateCollaborationRequest: async (reqId: string, data: any, actorId: string) => { await updateDoc(doc(db, 'collaboration_requests', reqId), data); },
  createCampaign: async (campaignData: any) => { await addDoc(collection(db, 'campaigns'), { ...campaignData, status: 'open', timestamp: serverTimestamp(), applicantIds: [] }); },
  getCampaignsForBrand: async (brandId: string) => { const q = query(collection(db, 'campaigns'), where('brandId', '==', brandId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign)); },
  getAllOpenCampaigns: async (locationFilter?: string) => {
      let q = query(collection(db, 'campaigns'), where('status', '==', 'open'));
      if (locationFilter && locationFilter !== 'All') q = query(q, where('location', 'in', ['All', locationFilter]));
      q = query(q, orderBy('isBoosted', 'desc'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
  },
  getApplicationsForCampaign: async (campaignId: string) => { const q = query(collection(db, 'campaign_applications'), where('campaignId', '==', campaignId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CampaignApplication)); },
  getCampaignApplicationsForInfluencer: async (influencerId: string) => { const q = query(collection(db, 'campaign_applications'), where('influencerId', '==', influencerId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CampaignApplication)); },
  applyToCampaign: async (applicationData: any) => {
      const batch = writeBatch(db);
      const appRef = doc(collection(db, 'campaign_applications'));
      batch.set(appRef, { ...applicationData, status: 'pending_brand_review', timestamp: serverTimestamp(), collabId: generateCollabId() });
      const campaignRef = doc(db, 'campaigns', applicationData.campaignId);
      batch.update(campaignRef, { applicantIds: arrayUnion(applicationData.influencerId) });
      await batch.commit();
  },
  updateCampaignApplication: async (appId: string, data: any, actorId: string) => { await updateDoc(doc(db, 'campaign_applications', appId), data); },
  sendAdSlotRequest: async (data: any) => { await addDoc(collection(db, 'ad_slot_requests'), { ...data, status: 'pending_approval', timestamp: serverTimestamp(), collabId: generateCollabId() }); },
  getAdSlotRequestsForBrand: async (brandId: string) => { const q = query(collection(db, 'ad_slot_requests'), where('brandId', '==', brandId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest)); },
  getAdSlotRequestsForLiveTv: async (liveTvUserId: string) => { const q = query(collection(db, 'ad_slot_requests'), where('liveTvId', '==', liveTvUserId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest)); },
  updateAdSlotRequest: async (reqId: string, data: any, actorId: string) => { await updateDoc(doc(db, 'ad_slot_requests', reqId), data); },
  createBannerAd: async (data: any) => { await addDoc(collection(db, 'banner_ads'), { ...data, timestamp: serverTimestamp() }); },
  getBannerAds: async (queryStr: string, settings: PlatformSettings) => {
      const col = collection(db, 'banner_ads');
      // Fix: Only order by isBoosted to avoid composite index error. Timestamp sort moved client-side.
      let q = query(col, orderBy('isBoosted', 'desc'));
      const snapshot = await getDocs(q);
      const allAds = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAd));
      
      // Sort by timestamp client-side as secondary sort
      allAds.sort((a, b) => {
          const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return tB - tA;
      });

      if (!queryStr) return allAds;
      const lowerQ = queryStr.toLowerCase();
      return allAds.filter(ad => ad.location.toLowerCase().includes(lowerQ) || ad.address.toLowerCase().includes(lowerQ));
  },
  getBannerAdsForAgency: async (agencyId: string) => { const q = query(collection(db, 'banner_ads'), where('agencyId', '==', agencyId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAd)); },
  sendBannerAdBookingRequest: async (data: any) => { await addDoc(collection(db, 'banner_booking_requests'), { ...data, status: 'pending_approval', timestamp: serverTimestamp(), collabId: generateCollabId() }); },
  getBannerAdBookingRequestsForBrand: async (brandId: string) => { const q = query(collection(db, 'banner_booking_requests'), where('brandId', '==', brandId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest)); },
  getBannerAdBookingRequestsForAgency: async (agencyId: string) => { const q = query(collection(db, 'banner_booking_requests'), where('agencyId', '==', agencyId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest)); },
  updateBannerAdBookingRequest: async (reqId: string, data: any, actorId: string) => { await updateDoc(doc(db, 'banner_booking_requests', reqId), data); },
  getActiveAdCollabsForAgency: async (agencyId: string, role: UserRole) => {
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
      // Removed orderBy to prevent composite index error
      const q = query(collection(db, 'platform_banners'), where('isActive', '==', true));
      const snapshot = await getDocs(q);
      const banners = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlatformBanner));
      // Sort client-side
      return banners.sort((a, b) => {
          const tA = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
          return tB - tA;
      });
  },
  createPlatformBanner: async (data: any) => { await addDoc(collection(db, 'platform_banners'), { ...data, createdAt: serverTimestamp() }); },
  updatePlatformBanner: async (id: string, data: any) => { await updateDoc(doc(db, 'platform_banners', id), data); },
  deletePlatformBanner: async (id: string) => { await deleteDoc(doc(db, 'platform_banners', id)); },
  uploadPlatformBannerImage: (file: File): Promise<string> => {
      if (!storage) return Promise.reject(new Error("Firebase Storage is not initialized"));
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = ref(storage, `platform_banners/${Date.now()}_${cleanName}`);
      return uploadBytes(storageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
  },
  saveFcmToken: async (userId: string, token: string | null) => { await updateDoc(doc(db, 'users', userId), { fcmToken: token }); },
  updateNotificationPreferences: async (userId: string, preferences: any) => { await updateDoc(doc(db, 'users', userId), { notificationPreferences: preferences }); },
  sendPushNotification: async (title: string, body: string, targetRole: UserRole | 'all', targetUrl?: string) => {
      console.log(`[Simulated Push] To: ${targetRole}, Title: ${title}, Body: ${body}`);
      const usersRef = collection(db, 'users');
      let q = query(usersRef);
      if (targetRole !== 'all') q = query(usersRef, where('role', '==', targetRole));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(userDoc => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
              userId: userDoc.id, title, body, targetUrl, type: 'system', view: View.DASHBOARD, timestamp: serverTimestamp(), isRead: false
          });
      });
      await batch.commit();
  },
  sendBulkEmail: async (targetRole: UserRole, subject: string, body: string) => { console.log(`[Simulated Email] To: ${targetRole}, Subject: ${subject}`); },
  getBoostsForUser: async (userId: string) => { const q = query(collection(db, 'boosts'), where('userId', '==', userId)); const snapshot = await getDocs(q); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Boost)); },
  activateBoost: async (userId: string, boostType: BoostType, targetId: string, targetType: 'profile' | 'campaign' | 'banner') => {
      const days = 7; const now = new Date(); const expiresAt = new Date(); expiresAt.setDate(now.getDate() + days);
      await addDoc(collection(db, 'boosts'), { userId, plan: boostType, expiresAt: Timestamp.fromDate(expiresAt), createdAt: serverTimestamp(), targetId, targetType });
      let collectionName = '';
      if (targetType === 'campaign') collectionName = 'campaigns';
      else if (targetType === 'banner') collectionName = 'banner_ads';
      else if (targetType === 'profile') {
          const userRef = await getDoc(doc(db, 'users', userId));
          const role = userRef.data()?.role;
          if (role === 'influencer') collectionName = 'influencers';
          else if (role === 'livetv') collectionName = 'livetv_channels';
      }
      if (collectionName) await updateDoc(doc(db, collectionName, targetId), { isBoosted: true });
  },
  processPayout: async (payoutRequestId: string) => {
    const user = auth.currentUser; if (!user) throw new Error("Authentication required."); const token = await user.getIdToken();
    const res = await fetch(`${BACKEND_URL}/process-payout`, { method: "POST", headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ payoutRequestId }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Failed to process payout.'); return data;
  },
  createSupportTicket: async (ticketData: any, firstReply: any) => {
      const batch = writeBatch(db); const ticketRef = doc(collection(db, 'support_tickets')); batch.set(ticketRef, { ...ticketData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const replyRef = doc(collection(db, `support_tickets/${ticketRef.id}/replies`)); batch.set(replyRef, { ...firstReply, ticketId: ticketRef.id, timestamp: serverTimestamp() }); await batch.commit();
  },
  getTicketsForUser: async (userId: string) => { const q = query(collection(db, 'support_tickets'), where('userId', '==', userId), orderBy('updatedAt', 'desc')); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket)); },
  getAllTickets: async () => { const q = query(collection(db, 'support_tickets'), orderBy('updatedAt', 'desc')); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket)); },
  getTicketReplies: async (ticketId: string) => { const q = query(collection(db, `support_tickets/${ticketId}/replies`), orderBy('timestamp', 'asc')); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TicketReply)); },
  addTicketReply: async (replyData: any) => { const batch = writeBatch(db); const replyRef = doc(collection(db, `support_tickets/${replyData.ticketId}/replies`)); batch.set(replyRef, { ...replyData, timestamp: serverTimestamp() }); const ticketRef = doc(db, 'support_tickets', replyData.ticketId); batch.update(ticketRef, { updatedAt: serverTimestamp(), status: 'in_progress' }); await batch.commit(); },
  updateTicketStatus: async (ticketId: string, status: SupportTicketStatus) => { await updateDoc(doc(db, 'support_tickets', ticketId), { status, updatedAt: serverTimestamp() }); },
  getSessionsForUser: async (userId: string) => { const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), orderBy('updatedAt', 'desc')); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LiveHelpSession)); },
  getOrCreateLiveHelpSession: async (userId: string, userName: string, userAvatar: string, staffId: string) => {
      const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), where('status', 'in', ['open', 'unassigned'])); const snapshot = await getDocs(q);
      if (!snapshot.empty) return snapshot.docs[0].id;
      const docRef = await addDoc(collection(db, 'live_help_sessions'), { userId, userName, userAvatar, assignedStaffId: staffId, status: 'unassigned', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); return docRef.id;
  },
  reopenLiveHelpSession: async (sessionId: string) => { await updateDoc(doc(db, 'live_help_sessions', sessionId), { status: 'open', updatedAt: serverTimestamp() }); },
  closeLiveHelpSession: async (sessionId: string) => { await updateDoc(doc(db, 'live_help_sessions', sessionId), { status: 'closed', updatedAt: serverTimestamp() }); },
  assignStaffToSession: async (sessionId: string, staffUser: User) => { await updateDoc(doc(db, 'live_help_sessions', sessionId), { assignedStaffId: staffUser.id, assignedStaffName: staffUser.name, assignedStaffAvatar: staffUser.avatar, status: 'open', updatedAt: serverTimestamp() }); },
  sendLiveHelpMessage: async (sessionId: string, senderId: string, senderName: string, text: string) => { const batch = writeBatch(db); const msgRef = doc(collection(db, `live_help_sessions/${sessionId}/messages`)); batch.set(msgRef, { senderId, senderName, text, timestamp: serverTimestamp() }); const sessionRef = doc(db, 'live_help_sessions', sessionId); batch.update(sessionRef, { updatedAt: serverTimestamp() }); await batch.commit(); },
  getAllLiveHelpSessionsListener: (callback: any) => onSnapshot(query(collection(db, 'live_help_sessions'), orderBy('updatedAt', 'desc')), s => callback(s.docs.map(d => ({ id: d.id, ...d.data() })))),
  addQuickReply: async (text: string) => { await addDoc(collection(db, 'quick_replies'), { text }); },
  updateQuickReply: async (id: string, text: string) => { await updateDoc(doc(db, 'quick_replies', id), { text }); },
  deleteQuickReply: async (id: string) => { await deleteDoc(doc(db, 'quick_replies', id)); },
  getQuickRepliesListener: (callback: any) => onSnapshot(collection(db, 'quick_replies'), s => callback(s.docs.map(d => ({ id: d.id, ...d.data() })))),
  createPost: async (postData: any) => { const docRef = await addDoc(collection(db, 'posts'), postData); return { id: docRef.id, ...postData } as Post; },
  getPosts: async (userId?: string) => { const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc')); const snapshot = await getDocs(q); const allPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post)); return allPosts.filter(p => p.visibility === 'public' || (userId && p.userId === userId)); },
  deletePost: async (postId: string) => { await deleteDoc(doc(db, 'posts', postId)); },
  updatePost: async (postId: string, data: any) => { await updateDoc(doc(db, 'posts', postId), data); },
  toggleLikePost: async (postId: string, userId: string) => { const postRef = doc(db, 'posts', postId); const postSnap = await getDoc(postRef); if (postSnap.exists()) { const likes = postSnap.data().likes || []; if (likes.includes(userId)) await updateDoc(postRef, { likes: arrayRemove(userId) }); else await updateDoc(postRef, { likes: arrayUnion(userId) }); } },
  getCommentsForPost: async (postId: string) => { const q = query(collection(db, `posts/${postId}/comments`), orderBy('timestamp', 'asc')); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment)); },
  addCommentToPost: async (postId: string, commentData: any) => { const batch = writeBatch(db); const commentRef = doc(collection(db, `posts/${postId}/comments`)); batch.set(commentRef, { ...commentData, timestamp: serverTimestamp() }); const postRef = doc(db, 'posts', postId); batch.update(postRef, { commentCount: increment(1) }); await batch.commit(); },
  createRefundRequest: async (data: any) => { await addDoc(collection(db, 'refund_requests'), { ...data, status: 'pending', timestamp: serverTimestamp() }); const map: any = { 'direct': 'collaboration_requests', 'campaign': 'campaign_applications', 'ad_slot': 'ad_slot_requests', 'banner_booking': 'banner_booking_requests' }; if(map[data.collabType]) await updateDoc(doc(db, map[data.collabType], data.collaborationId), { status: 'refund_pending_admin_review' }); },
  updateRefundRequest: async (id: string, data: any) => { await updateDoc(doc(db, 'refund_requests', id), data); },
  submitDailyPayoutRequest: async (data: any) => { await addDoc(collection(db, 'daily_payout_requests'), { ...data, status: 'pending', timestamp: serverTimestamp() }); },
  updateDailyPayoutRequest: async (id: string, data: any) => { await updateDoc(doc(db, 'daily_payout_requests', id), data); },
  updateDailyPayoutRequestStatus: async (reqId: string, collabId: string, collabType: 'ad_slot' | 'banner_booking', status: 'approved' | 'rejected', amount?: number, reason?: string) => { const batch = writeBatch(db); const reqRef = doc(db, 'daily_payout_requests', reqId); const updateData: any = { status }; if (reason) updateData.rejectionReason = reason; if (amount) updateData.approvedAmount = amount; batch.update(reqRef, updateData); if (status === 'approved') { const colName = collabType === 'ad_slot' ? 'ad_slot_requests' : 'banner_booking_requests'; const collabRef = doc(db, colName, collabId); batch.update(collabRef, { dailyPayoutsReceived: increment(amount || 0) }); } await batch.commit(); },
  createDispute: async (data: any) => { await addDoc(collection(db, 'disputes'), { ...data, status: 'open', timestamp: serverTimestamp() }); const map: any = { 'direct': 'collaboration_requests', 'campaign': 'campaign_applications', 'ad_slot': 'ad_slot_requests', 'banner_booking': 'banner_booking_requests' }; if(map[data.collaborationType]) await updateDoc(doc(db, map[data.collaborationType], data.collaborationId), { status: 'disputed' }); },
  getDisputes: async () => { const q = query(collection(db, 'disputes'), orderBy('timestamp', 'desc')); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dispute)); },
  getAllTransactions: async () => getDocs(collection(db, 'transactions')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))),
  getAllPayouts: async () => getDocs(collection(db, 'payout_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as PayoutRequest))),
  getAllRefunds: async () => getDocs(collection(db, 'refund_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as RefundRequest))),
  getAllDailyPayouts: async () => getDocs(collection(db, 'daily_payout_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyPayoutRequest))),
  getAllCollaborationRequests: async () => getDocs(collection(db, 'collaboration_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as CollaborationRequest))),
  getAllCampaignApplications: async () => getDocs(collection(db, 'campaign_applications')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignApplication))),
  getAllAdSlotRequests: async () => getDocs(collection(db, 'ad_slot_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as AdSlotRequest))),
  getAllBannerAdBookingRequests: async () => getDocs(collection(db, 'banner_booking_requests')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as BannerAdBookingRequest))),
  updatePayoutRequest: async (id: string, data: any) => { await updateDoc(doc(db, 'payout_requests', id), data); },
  submitPayoutRequest: async (data: any) => { await addDoc(collection(db, 'payout_requests'), { ...data, status: 'pending', timestamp: serverTimestamp() }); },
  updatePayoutStatus: async (reqId: string, status: PayoutRequest['status'], collabId: string, collabType: PayoutRequest['collaborationType'], reason?: string) => { const payoutRef = doc(db, 'payout_requests', reqId); const updateData: any = { status }; if(reason) updateData.rejectionReason = reason; const batch = writeBatch(db); batch.update(payoutRef, updateData); if (status === 'approved' || status === 'completed') { const map: any = { 'direct': 'collaboration_requests', 'campaign': 'campaign_applications', 'ad_slot': 'ad_slot_requests', 'banner_booking': 'banner_booking_requests' }; if(map[collabType]) { const collabRef = doc(db, map[collabType], collabId); batch.update(collabRef, { paymentStatus: 'payout_complete' }); } } await batch.commit(); },
  getTransactionsForUser: async (userId: string) => { const q = query(collection(db, 'transactions'), where('userId', '==', userId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)).sort((a, b) => ((b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))); },
  getPayoutHistoryForUser: async (userId: string) => { const q = query(collection(db, 'payout_requests'), where('userId', '==', userId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PayoutRequest)).sort((a, b) => ((b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))); },
  createNotification: async (notification: any) => { await addDoc(collection(db, 'notifications'), { ...notification, timestamp: serverTimestamp(), isRead: false }); },
  getNotificationsForUserListener: (userId: string, cb: any, err: any) => { const q = query(collection(db, 'notifications'), where('userId', '==', userId), limit(50)); return onSnapshot(q, s => { const n = s.docs.map(d => ({ id: d.id, ...d.data() })); n.sort((a: any, b: any) => ((b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))); cb(n); }, err); },
  markNotificationAsRead: async (id: string) => { await updateDoc(doc(db, 'notifications', id), { isRead: true }); },
  markAllNotificationsAsRead: async (userId: string) => { const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('isRead', '==', false)); const s = await getDocs(q); const batch = writeBatch(db); s.docs.forEach(d => batch.update(d.ref, { isRead: true })); await batch.commit(); },
  getPartners: async () => { const q = query(collection(db, 'partners'), orderBy('createdAt', 'desc')); const snapshot = await getDocs(q); return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Partner)); },
  createPartner: async (data: any) => { await addDoc(collection(db, 'partners'), { ...data, createdAt: serverTimestamp() }); },
  updatePartner: async (id: string, data: any) => { await updateDoc(doc(db, 'partners', id), data); },
  deletePartner: async (id: string) => { await deleteDoc(doc(db, 'partners', id)); },
  uploadPartnerLogo: async (file: File) => {
      if (!storage) throw new Error("Firebase Storage is not initialized");
      if (!file) throw new Error("No file provided"); // Added check
      
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      // Use simpler uploadBytes for reliability
      const storageRef = ref(storage, `partners/${Date.now()}_${cleanName}`);
      
      try {
          const snapshot = await uploadBytes(storageRef, file);
          return await getDownloadURL(snapshot.ref);
      } catch (error: any) {
          console.error("Partner Logo Upload Error:", error);
          // Throw new error with specific message, preserving original message
          throw new Error(`Failed to upload partner logo: ${error.message || "Unknown error"}`);
      }
  },
  
  // Referral
  generateReferralCode: async (userId: string) => { 
      try { const u = auth.currentUser; if(!u) throw new Error("User not logged in"); const t = await u.getIdToken(); const r = await fetch('https://referal-backend-dx82.onrender.com/generateReferral', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` }, body: JSON.stringify({ uid: userId }) }); if(r.ok) { const d = await r.json(); const c = d.referralCode || d.referral_code || d.code; if(c) return c; } throw new Error("API Error"); } catch(e) { const c = "REF" + Math.random().toString(36).substr(2, 6).toUpperCase(); await setDoc(doc(db, 'users', userId), { referralCode: c }, { merge: true }); return c; }
  },
  applyReferralCode: async (userId: string, code: string) => {
      await runTransaction(db, async (t) => {
          const q = query(collection(db, 'users'), where('referralCode', '==', code), limit(1)); const s = await getDocs(q); if(s.empty) throw new Error("Invalid code"); const rDoc = s.docs[0];
          if(rDoc.id === userId) throw new Error("Cannot refer self");
          const uRef = doc(db, 'users', userId); const uDoc = await t.get(uRef); if(uDoc.data()?.referredBy) throw new Error("Already referred");
          t.update(rDoc.ref, { coins: (rDoc.data().coins || 0) + 50 });
          t.update(uRef, { coins: (uDoc.data()?.coins || 0) + 20, referredBy: code, referralAppliedAt: serverTimestamp() });
          // Create Transactions
          const tx1 = doc(collection(db, 'transactions')); t.set(tx1, { userId: rDoc.id, type: 'referral', description: 'Referral Reward', amount: 50, status: 'completed', transactionId: tx1.id, timestamp: serverTimestamp(), isCredit: true, currency: 'COINS' });
          const tx2 = doc(collection(db, 'transactions')); t.set(tx2, { userId, type: 'referral', description: 'Welcome Bonus', amount: 20, status: 'completed', transactionId: tx2.id, timestamp: serverTimestamp(), isCredit: true, currency: 'COINS' });
      });
  }
};
