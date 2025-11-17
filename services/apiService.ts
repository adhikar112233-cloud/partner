

// Fix: Import `MembershipPlan` and KYC types to correctly type KYC-related functions.
// Fix: Import LiveHelpSession and LiveHelpMessage to support live help chat functionality.
// FIX: Imported missing types `LiveHelpSession` and `NotificationType` to resolve type errors.
import { Influencer, Message, User, PlatformSettings, Attachment, CollaborationRequest, CollabRequestStatus, Conversation, ConversationParticipant, Campaign, CampaignApplication, LiveTvChannel, AdSlotRequest, BannerAd, BannerAdBookingRequest, SupportTicket, TicketReply, SupportTicketStatus, Membership, UserRole, PayoutRequest, CampaignApplicationStatus, AdBookingStatus, AnyCollaboration, DailyPayoutRequest, Post, Comment, Dispute, MembershipPlan, Transaction, KycDetails, KycStatus, PlatformBanner, PushNotification, Boost, BoostType, LiveHelpMessage, LiveHelpSession, RefundRequest, View, QuickReply, CreatorVerificationDetails, CreatorVerificationStatus, AppNotification, NotificationType, Partner } from '../types';
import { db, storage, auth, BACKEND_URL } from './firebase';
// Fix: Corrected Firebase import statements to align with Firebase v9 modular syntax.
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
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';

const DEFAULT_AVATAR_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDRjMCAwIDAtMSAwLTJoMTJ2Mmg0di00YzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==';

const generateCollabId = (): string => `CRI${String(Math.floor(Math.random() * 10000000000)).padStart(10, '0')}`;

const initialInfluencersData: Omit<Influencer, 'id'>[] = [
  // FIX: Added missing engagementRate property to match the Influencer type.
  { name: 'Alex Doe', handle: 'alexdoe', avatar: DEFAULT_AVATAR_URL, bio: 'Lifestyle & Travel enthusiast sharing my journey.', followers: 125000, niche: 'Travel', engagementRate: 4.5, socialMediaLinks: 'https://instagram.com/alexdoe, https://youtube.com/alexdoe', location: 'Mumbai', isBoosted: false, membershipActive: true },
  { name: 'Jane Smith', handle: 'janesmith.fit', avatar: DEFAULT_AVATAR_URL, bio: 'Fitness coach and nutritionist. Helping you be your best self!', followers: 250000, niche: 'Fitness', engagementRate: 5.2, socialMediaLinks: 'https://instagram.com/janesmith.fit, https://tiktok.com/@janesmith', location: 'Delhi', isBoosted: false, membershipActive: true },
  { name: 'Tech Tom', handle: 'techtom', avatar: DEFAULT_AVATAR_URL, bio: 'Unboxing the latest gadgets and reviewing tech.', followers: 500000, niche: 'Technology', engagementRate: 6.1, socialMediaLinks: 'https://youtube.com/techtom, https://x.com/techtom', location: 'Bangalore', isBoosted: false, membershipActive: true },
  { name: 'Foodie Fiona', handle: 'fionas.food', avatar: DEFAULT_AVATAR_URL, bio: 'Exploring the best culinary delights from around the world.', followers: 85000, niche: 'Food', engagementRate: 3.8, socialMediaLinks: 'https://instagram.com/fionas.food', location: 'Mumbai', isBoosted: false, membershipActive: true },
  { name: 'Gamer Greg', handle: 'greggames', avatar: DEFAULT_AVATAR_URL, bio: 'Streaming the latest and greatest in the gaming world.', followers: 750000, niche: 'Gaming', engagementRate: 7.0, location: 'Pune', isBoosted: false, membershipActive: true },
  { name: 'Fashionista Faye', handle: 'fayefashion', avatar: DEFAULT_AVATAR_URL, bio: 'Your daily dose of style inspiration and fashion tips.', followers: 320000, niche: 'Fashion', engagementRate: 4.9, socialMediaLinks: 'https://tiktok.com/@fayefashion, https://instagram.com/fayefashion', location: 'Delhi', isBoosted: false, membershipActive: true },
];

const initialLiveTvChannels: Omit<LiveTvChannel, 'id' | 'ownerId'>[] = [
  { name: 'India Live News', logo: 'https://placehold.co/100x100/e91e63/ffffff?text=ILN', description: '24/7 news coverage from across the nation.', audienceSize: 15000000, niche: 'News' },
  { name: 'CineMax Movies', logo: 'https://placehold.co/100x100/3f51b5/ffffff?text=CM', description: 'Your destination for Bollywood blockbusters and classic films.', audienceSize: 22000000, niche: 'Entertainment' },
  { name: 'Sangeet Beats', logo: 'https://placehold.co/100x100/4caf50/ffffff?text=SB', description: 'The best of Indian music, from pop to classical.', audienceSize: 18000000, niche: 'Music' },
];

const initialBannerAdsData: Omit<BannerAd, 'id' | 'agencyId' | 'agencyName' | 'agencyAvatar' | 'timestamp'>[] = [
    { location: 'Mumbai', address: 'Bandra-Worli Sea Link, Bandra West', photoUrl: 'https://placehold.co/600x400/3f51b5/ffffff?text=Ad+Space+Mumbai', size: '40x20 ft', feePerDay: 5000, bannerType: 'Hoarding' },
    { location: 'Delhi', address: 'Connaught Place, Inner Circle', photoUrl: 'https://placehold.co/600x400/4caf50/ffffff?text=Ad+Space+Delhi', size: '60x30 ft', feePerDay: 7500, bannerType: 'Hoarding' },
    { location: 'Bangalore', address: 'MG Road, near Trinity Circle', photoUrl: 'https://placehold.co/600x400/e91e63/ffffff?text=Digital+Ad+BLR', size: '20x15 ft', feePerDay: 10000, bannerType: 'Digital Billboard' },
];

const isMembershipActive = (membership: Membership): boolean => {
    if (!membership || !membership.isActive || !membership.expiresAt) {
        return false;
    }
    const expiryDate = (membership.expiresAt as Timestamp).toDate();
    return expiryDate > new Date();
};

const getUsersWithActiveMembership = async (role: UserRole): Promise<string[]> => {
    const usersRef = collection(db, 'users');
    const q = query(
        usersRef,
        where('role', '==', role),
        where('membership.isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    const activeUserIds: string[] = [];
    snapshot.forEach(doc => {
        const user = doc.data() as User;
        if (user.membership?.expiresAt && (user.membership.expiresAt as Timestamp).toDate() > new Date()) {
            activeUserIds.push(doc.id);
        }
    });

    return activeUserIds;
};


const formatMessageTimestamp = (timestamp: Timestamp | null): string => {
    if (!timestamp) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Centralized helper for mapping collaboration types to Firestore collection names.
const getCollectionNameForCollab = (collabType: 'direct' | 'campaign' | 'ad_slot' | 'banner_booking'): string => {
    const collectionMap = {
      direct: 'collaboration_requests',
      campaign: 'campaign_applications',
      ad_slot: 'ad_slot_requests',
      banner_booking: 'banner_booking_requests',
    };
    const collectionName = collectionMap[collabType];
    if (!collectionName) {
        // This should theoretically never be hit due to the strong typing, but it's a good safeguard.
        throw new Error(`Invalid collaboration type provided: "${collabType}"`);
    }
    return collectionName;
};

export const apiService = {
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
    const updateData: { [key: string]: any } = {
      creatorVerificationStatus: status,
    };
    if (status === 'rejected' && reason) {
      updateData['creatorVerificationDetails.rejectionReason'] = reason;
    }
    await updateDoc(userRef, updateData);
  },
  sendNotificationToUser: async (userId: string, title: string, body: string, targetUrl?: string): Promise<void> => {
    // This simulates triggering a backend function to send a notification to a specific user.
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
        const user = userDoc.data() as User;
        // Only queue notification if user has a token and has enabled notifications (or not explicitly disabled)
        if (user.fcmToken && user.notificationPreferences?.enabled !== false) {
            await addDoc(collection(db, 'user_notifications'), {
                userId,
                fcmToken: user.fcmToken, // For the backend function to use
                title,
                body,
                targetUrl: targetUrl || null,
                sentAt: serverTimestamp(),
                status: 'queued',
            });
        }
    }
  },
  uploadProfilePicture: (userId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `profile_pictures/${userId}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        () => {},
        (error) => reject(error),
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
        }
      );
    });
  },
  
  uploadBannerAdPhoto: (agencyId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `banner_ads/${agencyId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        () => {},
        (error) => reject(error),
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
        }
      );
    });
  },
  
  uploadMessageAttachment: (messageId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `message_attachments/${messageId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        () => {},
        (error) => reject(error),
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
        }
      );
    });
  },
  
  uploadTicketAttachment: (ticketId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `support_tickets/${ticketId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        () => {},
        (error) => reject(error),
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
        }
      );
    });
  },

  uploadDailyPayoutVideo: async (userId: string, file: Blob): Promise<string> => {
    const storageRef = ref(storage, `daily_payout_videos/${userId}/${Date.now()}.webm`);
    const uploadTask = uploadBytesResumable(storageRef, file, { contentType: 'video/webm' });
    
    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {}, // progress observer
            (error) => reject(error),
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
            }
        );
    });
  },
  
// Fix: Add KYC file upload helper function
  uploadKycFile: (userId: string, file: File, type: 'id_proof' | 'selfie'): Promise<string> => {
    const storageRef = ref(storage, `kyc_documents/${userId}/${type}_${Date.now()}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        () => {}, // progress observer
        (error) => reject(error),
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
        }
      );
    });
  },

  uploadPayoutSelfie: (userId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `payout_selfies/${userId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', () => {}, 
        (error) => reject(error), 
        () => { getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject); }
      );
    });
  },

  initializeFirestoreData: async (): Promise<void> => {
    // Seed Influencers
    const influencersRef = collection(db, 'influencers');
    const influencerSnapshot = await getDocs(query(influencersRef));
    if (influencerSnapshot.empty) {
      console.log("No influencers found, seeding database...");
      const batch = writeBatch(db);
      initialInfluencersData.forEach(influencer => {
        const docRef = doc(influencersRef); // Firestore generates ID
        // FIX: Spreading `...influencer` could cause a duplicate property error if the source object
        // also defined properties being set explicitly. Ensured source data has all properties.
        batch.set(docRef, influencer);
      });
      await batch.commit();
      console.log("Influencers seeded successfully.");
    }
    
    // Seed Live TV Channels
    const liveTvRef = collection(db, 'livetv_channels');
    const tvSnapshot = await getDocs(query(liveTvRef));
    if (tvSnapshot.empty) {
        console.log("No Live TV channels found, seeding database...");
        const liveTvUsers = await getDocs(query(collection(db, 'users'), where('role', '==', 'livetv')));
        const defaultOwnerId = liveTvUsers.docs.length > 0 ? liveTvUsers.docs[0].id : "default_owner_id";

        const batch = writeBatch(db);
        initialLiveTvChannels.forEach(channel => {
            const docRef = doc(liveTvRef);
            batch.set(docRef, { ...channel, ownerId: defaultOwnerId });
        });
        await batch.commit();
        console.log("Live TV channels seeded successfully.");
    }

    // Seed Banner Ads
    const bannerAdsRef = collection(db, 'banner_ads');
    const bannerSnapshot = await getDocs(query(bannerAdsRef));
    if (bannerSnapshot.empty) {
        console.log("No banner ads found, seeding database...");
        const agencies = await getDocs(query(collection(db, 'users'), where('role', '==', 'banneragency')));
        const defaultAgency = agencies.docs.length > 0 ? { id: agencies.docs[0].id, ...agencies.docs[0].data() as User } : null;

        if (defaultAgency) {
            const batch = writeBatch(db);
            initialBannerAdsData.forEach(ad => {
                const docRef = doc(bannerAdsRef);
                batch.set(docRef, { 
                    ...ad, 
                    agencyId: defaultAgency.id,
                    agencyName: defaultAgency.companyName || defaultAgency.name,
                    agencyAvatar: defaultAgency.avatar,
                    timestamp: serverTimestamp() 
                });
            });
            await batch.commit();
            console.log("Banner ads seeded successfully.");
        } else {
            console.log("Could not seed banner ads: No banner agency user found.");
        }
    }
  },

  getInfluencersPaginated: async (
    settings: PlatformSettings,
    options: { limit: number; startAfterDoc?: QueryDocumentSnapshot<DocumentData> }
  ): Promise<{ influencers: Influencer[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => {
      if (!settings.areInfluencerProfilesPublic) return { influencers: [], lastVisible: null };
  
      const influencersCol = collection(db, 'influencers');
      
      // FIX: The original query required a composite index that is missing in the project.
      // To prevent the app from crashing, the orderBy('isBoosted', 'desc') clause has been removed.
      // FIX 2: The orderBy('followers', 'desc') also requires an index. It is removed to prevent crashes.
      // Influencers will appear in a default order. To restore sorting, create the required indexes in Firebase.
      let q = query(
          influencersCol, 
          where('membershipActive', '==', true),
          // orderBy('isBoosted', 'desc'), // This line requires a composite index.
          // orderBy('followers', 'desc'), // This line also requires a composite index.
          limit(options.limit)
      );
  
      if (options.startAfterDoc) {
          q = query(
              influencersCol,
              where('membershipActive', '==', true),
              // orderBy('isBoosted', 'desc'), // This line requires a composite index.
              // orderBy('followers', 'desc'), // This line also requires a composite index.
              startAfter(options.startAfterDoc),
              limit(options.limit)
          );
      }
      
      const snapshot = await getDocs(q);
      const influencers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Influencer));
      const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
  
      return { influencers, lastVisible };
  },
  
  getAllInfluencers: async (): Promise<Influencer[]> => {
    const influencersCol = collection(db, 'influencers');
    const snapshot = await getDocs(influencersCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Influencer));
  },
  
  // FIX: Implement missing function and correct logic to query channels by ownerId.
  getLiveTvChannels: async (settings: PlatformSettings): Promise<LiveTvChannel[]> => {
    const channelsCol = collection(db, 'livetv_channels');
    
    const activeTvUserIds = await getUsersWithActiveMembership('livetv');
    if (activeTvUserIds.length === 0) {
        return [];
    }

    const userChunks: string[][] = [];
    for (let i = 0; i < activeTvUserIds.length; i += 30) {
        userChunks.push(activeTvUserIds.slice(i, i + 30));
    }

    const promises = userChunks.map(chunk => {
        const chunkQuery = query(channelsCol, where('ownerId', 'in', chunk));
        return getDocs(chunkQuery);
    });
    
    const snapshots = await Promise.all(promises);
    return snapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveTvChannel)));
  },

  // START of new implementations
  // Settings
  getPlatformSettings: async (): Promise<PlatformSettings> => {
    const docRef = doc(db, 'settings', 'platform');
    
    // FIX: Define a complete default settings object to prevent TypeErrors on missing fields (like boostPrices).
    const defaultSettings: PlatformSettings = {
        welcomeMessage: 'Welcome to Collabzz, the premier platform for brands and influencers.',
        isMessagingEnabled: true,
        areInfluencerProfilesPublic: true,
        youtubeTutorialUrl: 'https://www.youtube.com',
        isNotificationBannerEnabled: false,
        notificationBannerText: '',
        payoutSettings: {
            requireLiveVideoForDailyPayout: true,
            requireSelfieForPayout: true,
        },
        isMaintenanceModeEnabled: false,
        isCommunityFeedEnabled: true,
        isWelcomeMessageEnabled: true,
        paymentGatewayApiId: '',
        paymentGatewayApiSecret: '',
        paymentGatewaySourceCode: '',
        otpApiId: '',
        otpApiSecret: '',
        otpApiSourceCode: '',
        isOtpLoginEnabled: true,
        isForgotPasswordOtpEnabled: true,
        isStaffRegistrationEnabled: true, // Enabled by default to ensure admin access
        isSocialMediaFabEnabled: true,
        socialMediaLinks: [],
        isDigilockerKycEnabled: true,
        digilockerClientId: '',
        digilockerClientSecret: '',
        isKycIdProofRequired: true,
        isKycSelfieRequired: true,
        isProMembershipEnabled: true,
        isCreatorMembershipEnabled: true,
        membershipPrices: {
          free: 0,
          pro_10: 1000,
          pro_20: 1800,
          pro_unlimited: 2500,
          basic: 199,
          pro: 499,
          premium: 999,
        },
        gstRate: 18,
        isGstEnabled: true,
        platformCommissionRate: 10,
        isPlatformCommissionEnabled: true,
        paymentProcessingChargeRate: 2,
        isPaymentProcessingChargeEnabled: true,
        isProfileBoostingEnabled: true,
        isCampaignBoostingEnabled: true,
        boostPrices: {
          profile: 49,
          campaign: 99,
          banner: 199,
        },
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
            const existingDiscountSettings = existingData.discountSettings || {};
            // Deep merge nested settings objects to prevent crashes from partial data.
            const finalSettings = {
                ...defaultSettings,
                ...existingData,
                payoutSettings: {
                    ...defaultSettings.payoutSettings,
                    ...(existingData.payoutSettings || {})
                },
                discountSettings: {
                    creatorProfileBoost: { ...defaultSettings.discountSettings.creatorProfileBoost, ...(existingDiscountSettings.creatorProfileBoost || {}) },
                    brandMembership: { ...defaultSettings.discountSettings.brandMembership, ...(existingDiscountSettings.brandMembership || {}) },
                    creatorMembership: { ...defaultSettings.discountSettings.creatorMembership, ...(existingDiscountSettings.creatorMembership || {}) },
                    brandCampaignBoost: { ...defaultSettings.discountSettings.brandCampaignBoost, ...(existingDiscountSettings.brandCampaignBoost || {}) },
                }
            };
            return finalSettings as PlatformSettings;
        } else {
            // If the document doesn't exist, try to create it with the full default settings
            await setDoc(docRef, defaultSettings);
            return defaultSettings;
        }
    } catch (error) {
        console.warn("Could not read/write platform settings from Firestore due to permission error. Falling back to local default settings.", error);
        // On permission error, just return the local defaults so the app can still run.
        return defaultSettings;
    }
  },

  updatePlatformSettings: async (settings: PlatformSettings): Promise<void> => {
    const docRef = doc(db, 'settings', 'platform');
    await setDoc(docRef, settings, { merge: true });
  },

  // Users
  getAllUsers: async (): Promise<User[]> => {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocs(usersCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  },

  getUsersPaginated: async (options: { pageLimit: number; startAfterDoc?: QueryDocumentSnapshot<DocumentData> }): Promise<{ users: User[]; lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => {
    const usersCol = collection(db, 'users');
    let q = query(usersCol, orderBy('name'), limit(options.pageLimit));
    if (options.startAfterDoc) {
        q = query(usersCol, orderBy('name'), startAfter(options.startAfterDoc), limit(options.pageLimit));
    }
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
    return { users, lastVisible };
  },

  getUserByEmail: async (email: string): Promise<User | null> => {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  },

  getUserByMobile: async (mobile: string): Promise<User | null> => {
    const q = query(collection(db, 'users'), where('mobileNumber', '==', mobile));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  },

  updateUserProfile: async (userId: string, data: Partial<User>): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, data);
  },

  updateUser: async (userId: string, data: Partial<User>): Promise<void> => {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, data);
  },

  updateUserMembership: async (userId: string, isActive: boolean): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    const now = Timestamp.now();
    let expiresAt: Timestamp;

    if (isActive) {
        const oneYearFromNow = new Date(now.toDate());
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        expiresAt = Timestamp.fromDate(oneYearFromNow);
    } else {
        const yesterday = new Date(now.toDate());
        yesterday.setDate(yesterday.getDate() - 1);
        expiresAt = Timestamp.fromDate(yesterday);
    }

    const batch = writeBatch(db);

    batch.update(userRef, {
        'membership.isActive': isActive,
        'membership.expiresAt': expiresAt,
    });

    // Check if the user is an influencer and update the denormalized field for discovery queries
    const userDoc = await getDoc(userRef);
    if (userDoc.exists() && userDoc.data().role === 'influencer') {
        const influencerRef = doc(db, 'influencers', userId);
        const influencerDoc = await getDoc(influencerRef);
        if (influencerDoc.exists()) {
             batch.update(influencerRef, { membershipActive: isActive });
        }
    }
    
    await batch.commit();
  },

  // Influencer Profile
  getInfluencerProfile: async (influencerId: string): Promise<Influencer | null> => {
    const docRef = doc(db, 'influencers', influencerId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Influencer;
    }
    return null;
  },

  updateInfluencerProfile: async (influencerId: string, data: Partial<Influencer>): Promise<void> => {
    const docRef = doc(db, 'influencers', influencerId);
    await setDoc(docRef, data, { merge: true });
  },

  // Messaging
  getMessages: async (userId1: string, userId2: string): Promise<Message[]> => {
    const participantIds = [userId1, userId2].sort();
    const q = query(collection(db, 'messages'), where('participantIds', '==', participantIds));
    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    })); // Keep raw timestamp
    messages.sort((a,b) => ((a.timestamp as Timestamp)?.toMillis() || 0) - ((b.timestamp as Timestamp)?.toMillis() || 0));
    return messages.map(msg => ({ ...msg, timestamp: formatMessageTimestamp(msg.timestamp) }));
  },

  getMessagesListener: (
    userId1: string,
    userId2: string,
    callback: (messages: Message[]) => void,
    onError: (error: Error) => void
  ): (() => void) => { // Returns an unsubscribe function
    const participantIds = [userId1, userId2].sort();
    const q = query(
      collection(db, 'messages'),
      where('participantIds', '==', participantIds)
      // orderBy('timestamp', 'asc') // Removing to prevent index requirement
    );
  
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as (Message & {timestamp: Timestamp})[]; // Keep original timestamp
      
      messages.sort((a,b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0)); // Sort client-side
      
      const formattedMessages = messages.map(msg => ({
          ...msg,
          timestamp: formatMessageTimestamp(msg.timestamp),
      })) as Message[];

      callback(formattedMessages);
    }, onError);
  },

  sendMessage: async (text: string, senderId: string, receiverId: string, attachments: Attachment[]): Promise<Message> => {
    const participantIds = [senderId, receiverId].sort();
    const docRef = await addDoc(collection(db, 'messages'), {
      text,
      senderId,
      receiverId,
      attachments: attachments || [],
      timestamp: serverTimestamp(),
      participantIds,
    });

    return {
      id: docRef.id,
      text,
      senderId,
      receiverId,
      attachments: attachments || [],
      timestamp: formatMessageTimestamp(null),
    };
  },
  
  getConversations: async (userId: string): Promise<Conversation[]> => {
    const messagesRef = collection(db, 'messages');
    const q = query(messagesRef, where('participantIds', 'array-contains', userId));
    const snapshot = await getDocs(q);
    
    const messagesByParticipant: { [key: string]: Message } = {};
    snapshot.docs.forEach(doc => {
        const msg = {id: doc.id, ...doc.data()} as Message;
        const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        if (!messagesByParticipant[otherId] || (msg.timestamp as Timestamp) > (messagesByParticipant[otherId].timestamp as Timestamp)) {
            messagesByParticipant[otherId] = msg;
        }
    });

    const participantIds = Object.keys(messagesByParticipant);
    if (participantIds.length === 0) return [];
    
    const profilePromises = participantIds.map(async (id) => {
        const userDocRef = doc(db, 'users', id);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            return { id: userDoc.id, ...userDoc.data() } as User;
        }
        
        const influencerDocRef = doc(db, 'influencers', id);
        const influencerDoc = await getDoc(influencerDocRef);
        if (influencerDoc.exists()) {
            return { id: influencerDoc.id, ...influencerDoc.data(), role: 'influencer' } as Influencer & { role: 'influencer' };
        }
        return null;
    });

    const profiles = (await Promise.all(profilePromises)).filter(Boolean) as (User | Influencer)[];
    const profileMap = new Map(profiles.map(p => [p.id, p]));
    
    const conversations = Object.entries(messagesByParticipant)
        .map(([otherId, lastMessage]) => {
            const participantProfile = profileMap.get(otherId);
            if (!participantProfile) return null;

            const participant: ConversationParticipant = {
                id: participantProfile.id,
                name: participantProfile.name,
                avatar: participantProfile.avatar || DEFAULT_AVATAR_URL,
                role: 'role' in participantProfile ? participantProfile.role : 'influencer',
                handle: 'handle' in participantProfile ? participantProfile.handle : undefined,
                companyName: 'companyName' in participantProfile ? participantProfile.companyName : undefined,
            };

            return {
                id: otherId,
                participant: participant,
                lastMessage: {
                    text: lastMessage.text,
                    timestamp: lastMessage.timestamp,
                },
            };
        })
        .filter((c): c is Conversation => c !== null);
    
    conversations.sort((a, b) => ((b.lastMessage.timestamp as Timestamp)?.toMillis() || 0) - ((a.lastMessage.timestamp as Timestamp)?.toMillis() || 0));

    return conversations;
  },

  // Collaboration Requests
  sendCollabRequest: async (requestData: Omit<CollaborationRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
    const userDocRef = doc(db, 'users', requestData.brandId);
    const userDoc = await getDoc(userDocRef);
    const user = userDoc.data() as User;

    if (user.membership.plan === 'free' && user.membership.usage.directCollaborations >= 1) {
        throw new Error("You have reached your direct collaboration limit on the free plan. Please upgrade to Pro.");
    }
    
    const docRef = await addDoc(collection(db, 'collaboration_requests'), {
      ...requestData,
      collabId: generateCollabId(),
      status: 'pending',
      timestamp: serverTimestamp(),
    });

    // Increment usage
    await updateDoc(userDocRef, {
        'membership.usage.directCollaborations': increment(1)
    });

    // Add notification
    await apiService.createNotification({
        userId: requestData.influencerId,
        title: "New Collaboration Request",
        body: `${requestData.brandName} wants to collaborate with you on "${requestData.title}"!`,
        type: 'new_collab_request',
        relatedId: docRef.id,
        view: View.COLLAB_REQUESTS,
        actor: { name: requestData.brandName, avatar: requestData.brandAvatar }
    });
  },

  getCollabRequestsForBrand: async (brandId: string): Promise<CollaborationRequest[]> => {
    const q = query(collection(db, 'collaboration_requests'), where('brandId', '==', brandId));
    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    requests.sort((a, b) => ((b.timestamp as Timestamp)?.toMillis() || 0) - ((a.timestamp as Timestamp)?.toMillis() || 0));
    return requests;
  },

  getCollabRequestsForBrandListener: (
    brandId: string,
    callback: (requests: CollaborationRequest[]) => void,
    onError: (error: Error) => void
  ): (() => void) => {
    // FIX: Removed orderBy to prevent Firestore index error. Sorting is now handled client-side.
    const q = query(
      collection(db, 'collaboration_requests'),
      where('brandId', '==', brandId)
    );
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
      // Client-side sorting by timestamp descending.
      requests.sort((a, b) => ((b.timestamp as Timestamp)?.toMillis() || 0) - ((a.timestamp as Timestamp)?.toMillis() || 0));
      callback(requests);
    }, onError);
  },
  
  getCollabRequestsForInfluencer: async (influencerId: string): Promise<CollaborationRequest[]> => {
    const q = query(collection(db, 'collaboration_requests'), where('influencerId', '==', influencerId));
    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
    requests.sort((a, b) => ((b.timestamp as Timestamp)?.toMillis() || 0) - ((a.timestamp as Timestamp)?.toMillis() || 0));
    return requests;
  },

  getCollabRequestsForInfluencerListener: (
    influencerId: string,
    callback: (requests: CollaborationRequest[]) => void,
    onError: (error: Error) => void
  ): (() => void) => {
    // FIX: Removed orderBy to prevent Firestore index error. Sorting is now handled client-side.
    const q = query(
      collection(db, 'collaboration_requests'),
      where('influencerId', '==', influencerId)
    );
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollaborationRequest));
      // Client-side sorting by timestamp descending.
      requests.sort((a, b) => ((b.timestamp as Timestamp)?.toMillis() || 0) - ((a.timestamp as Timestamp)?.toMillis() || 0));
      callback(requests);
    }, onError);
  },

  updateCollaborationRequest: async (reqId: string, data: Partial<CollaborationRequest>, actorId: string): Promise<void> => {
    const docRef = doc(db, 'collaboration_requests', reqId);
    const updateData: any = {...data};

    // If a new offer is being made, move the old one to the history.
    if (data.currentOffer) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const oldRequest = docSnap.data() as CollaborationRequest;
            if (oldRequest.currentOffer) {
                const historyEntry = { ...oldRequest.currentOffer, timestamp: Timestamp.now() };
                updateData.offerHistory = arrayUnion(historyEntry);
            }
        }
    }

    await updateDoc(docRef, updateData);
    
    // --- New Notification Logic ---
    if (data.status) {
        const collabDoc = await getDoc(docRef);
        if (!collabDoc.exists()) return;
        const collab = collabDoc.data() as CollaborationRequest;
        
        const isActorBrand = actorId === collab.brandId;
        const recipientId = isActorBrand ? collab.influencerId : collab.brandId;
        const actorName = isActorBrand ? collab.brandName : collab.influencerName;
        const actorAvatar = isActorBrand ? collab.brandAvatar : collab.influencerAvatar;

        let title = '';
        let body = '';
        let type: NotificationType = 'collab_update';
        let view: View = isActorBrand ? View.COLLAB_REQUESTS : View.MY_COLLABORATIONS;

        switch (data.status) {
            case 'brand_offer': title = 'New Offer Received'; body = `${actorName} sent you a counter-offer for "${collab.title}".`; break;
            case 'influencer_offer': title = 'New Offer Received'; body = `${actorName} sent you an offer for "${collab.title}".`; break;
            case 'agreement_reached': title = `Agreement Reached!`; body = `You and ${actorName} have reached an agreement for "${collab.title}". Payment is now pending.`; break;
            case 'in_progress': if (data.paymentStatus === 'paid') { title = `Payment Confirmed!`; body = `${actorName} has paid for "${collab.title}". You can now start the work.`; type = 'collab_update'; } break;
            case 'work_submitted': title = 'Work Submitted'; body = `${actorName} has submitted their work for "${collab.title}" for your review.`; type = 'work_submitted'; break;
            case 'completed': title = 'Collaboration Completed'; body = `${actorName} marked "${collab.title}" as complete.`; type = 'collab_completed'; break;
            case 'rejected': title = 'Collaboration Update'; body = `${actorName} has rejected the collaboration for "${collab.title}".`; break;
            case 'disputed': title = 'Dispute Raised'; body = `${actorName} raised a dispute for "${collab.title}". An admin will review it.`; type = 'dispute_update'; break;
        }

        if (title && body) {
            apiService.createNotification({
                userId: recipientId,
                title,
                body,
                type,
                relatedId: collab.id,
                view,
                actor: { name: actorName, avatar: actorAvatar }
            });
        }
    }
  },
  
  // Marketing / Banners
  getPlatformBanners: async (): Promise<PlatformBanner[]> => {
    const bannersRef = collection(db, 'platform_banners');
    const q = query(bannersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlatformBanner));
  },
  
  getActivePlatformBanners: async (): Promise<PlatformBanner[]> => {
      const bannersRef = collection(db, 'platform_banners');
      const q = query(bannersRef, where('isActive', '==', true));
      try {
          const snapshot = await getDocs(q);
          const banners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlatformBanner));
          banners.sort((a, b) => ((b.createdAt as Timestamp)?.toMillis() || 0) - ((a.createdAt as Timestamp)?.toMillis() || 0));
          return banners;
      } catch (error) {
          console.warn("Could not fetch active platform banners from Firestore due to permission error. Returning an empty list.", error);
          return [];
      }
  },
  
  createPlatformBanner: async (data: Omit<PlatformBanner, 'id' | 'createdAt'>): Promise<void> => {
    await addDoc(collection(db, 'platform_banners'), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },

  updatePlatformBanner: async (id: string, data: Partial<PlatformBanner>): Promise<void> => {
    await updateDoc(doc(db, 'platform_banners', id), data);
  },

  deletePlatformBanner: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'platform_banners', id));
  },
  
  uploadPlatformBannerImage: (file: File): Promise<string> => {
    const storageRef = ref(storage, `platform_banners/${Date.now()}_${file.name}`);
    return new Promise((resolve, reject) => {
      uploadBytes(storageRef, file).then(snapshot => {
        getDownloadURL(snapshot.ref).then(resolve).catch(reject);
      }).catch(reject);
    });
  },

  // Push Notifications
  saveFcmToken: async (userId: string, token: string | null): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { fcmToken: token });
  },

  updateNotificationPreferences: async (userId: string, preferences: { enabled: boolean }): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { notificationPreferences: preferences });
  },

  sendPushNotification: async (title: string, body: string, targetRole: UserRole | 'all', targetUrl?: string): Promise<void> => {
    // In a real app, this would trigger a backend function.
    // For this simulation, we'll just log it to a Firestore collection.
    await addDoc(collection(db, 'sent_notifications'), {
        title,
        body,
        targetRole,
        targetUrl: targetUrl || null,
        sentAt: serverTimestamp(),
        status: 'queued', // A backend function would pick this up
    });
  },

  sendBulkEmail: async (targetRole: UserRole, subject: string, body: string): Promise<void> => {
    // In a real app, this would trigger a backend function.
    // For this simulation, we'll just log it to a Firestore collection.
    await addDoc(collection(db, 'sent_emails'), {
        targetRole,
        subject,
        body,
        sentAt: serverTimestamp(),
        status: 'queued', // A backend function would pick this up
    });
  },
  
  // Boosts
  getBoostsForUser: async (userId: string): Promise<Boost[]> => {
    const q = query(collection(db, 'boosts'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Boost));
  },
  
  activateBoost: async (userId: string, boostType: BoostType, targetId: string, targetType: 'profile' | 'campaign' | 'banner'): Promise<void> => {
    const days = 7; // Fixed 7 days for all boosts
    
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
    
    // Also update the target document itself
    if (targetType === 'campaign') {
        const targetRef = doc(db, 'campaigns', targetId);
        await updateDoc(targetRef, { isBoosted: true });
        return;
    }

    if (targetType === 'profile') {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            throw new Error(`User ${userId} not found, cannot determine role for boost.`);
        }
        const userRole = userSnap.data().role as UserRole;

        let targetCollection: string | null = null;
        if (userRole === 'influencer') {
            targetCollection = 'influencers';
        } else if (userRole === 'livetv') {
            targetCollection = 'livetv_channels';
        } else {
            console.warn(`Profile boost called for unhandled role: ${userRole}. Boost record created but no profile flagged.`);
            return;
        }
        
        // The targetId for profile boosts is the user's ID.
        const targetRef = doc(db, targetCollection, targetId);
        await updateDoc(targetRef, { isBoosted: true });
    }

    if (targetType === 'banner') {
        const targetRef = doc(db, 'banner_ads', targetId);
        await updateDoc(targetRef, { isBoosted: true });
    }
  },

  processPayout: async (payoutRequestId: string): Promise<any> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Authentication required to process payouts.");
    const token = await user.getIdToken();

    const PROCESS_PAYOUT_URL = `${BACKEND_URL}/process-payout`;

    const res = await fetch(PROCESS_PAYOUT_URL, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ payoutRequestId })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || 'Failed to process payout via backend.');
    }
    return data;
  },

  // Support Tickets
  createSupportTicket: async (ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>, firstReply: Omit<TicketReply, 'id' | 'ticketId' | 'timestamp'>): Promise<void> => {
    const ticketRef = await addDoc(collection(db, 'support_tickets'), {
      ...ticketData,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Add the initial message as the first reply
    await addDoc(collection(db, `support_tickets/${ticketRef.id}/replies`), {
      ...firstReply,
      ticketId: ticketRef.id,
      timestamp: serverTimestamp(),
    });
  },
  
  getTicketsForUser: async (userId: string): Promise<SupportTicket[]> => {
    // FIX: Removed orderBy to prevent index error. Sorting will be done client-side.
    const q = query(collection(db, 'support_tickets'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
    // Sort client-side
    tickets.sort((a, b) => ((b.updatedAt as Timestamp)?.toMillis() || 0) - ((a.updatedAt as Timestamp)?.toMillis() || 0));
    return tickets;
  },
  
  getAllTickets: async (): Promise<SupportTicket[]> => {
    const q = query(collection(db, 'support_tickets'), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
  },

  getTicketReplies: async (ticketId: string): Promise<TicketReply[]> => {
    const q = query(collection(db, `support_tickets/${ticketId}/replies`), orderBy('timestamp', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TicketReply));
  },
  
  addTicketReply: async (replyData: Omit<TicketReply, 'id' | 'timestamp'>): Promise<void> => {
      const ticketRef = doc(db, 'support_tickets', replyData.ticketId);
      const repliesRef = collection(db, `support_tickets/${replyData.ticketId}/replies`);

      const batch = writeBatch(db);

      // Add new reply
      batch.set(doc(repliesRef), { ...replyData, timestamp: serverTimestamp() });
      
      // Update ticket's `updatedAt` field to bring it to the top of lists.
      // Also update unread status depending on who is replying.
      const updatePayload: any = { updatedAt: serverTimestamp() };
      if (replyData.senderRole === 'staff') {
        updatePayload.userHasUnread = true;
      } else {
        updatePayload.staffHasUnread = true;
      }
      batch.update(ticketRef, updatePayload);

      await batch.commit();
  },

  // FIX: Added a large number of missing functions to the apiService object.
  // KYC
  submitKyc: async (userId: string, details: KycDetails, idProofFile: File | null, selfieFile: File | null): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    let idProofUrl = details.idProofUrl;
    let selfieUrl = details.selfieUrl;

    if (idProofFile) {
        idProofUrl = await apiService.uploadKycFile(userId, idProofFile, 'id_proof');
    }
    if (selfieFile) {
        selfieUrl = await apiService.uploadKycFile(userId, selfieFile, 'selfie');
    }
    
    await updateDoc(userRef, {
        kycStatus: 'pending',
        kycDetails: {
            ...details,
            idProofUrl,
            selfieUrl,
        }
    });
  },

  submitDigilockerKyc: async (userId: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        kycStatus: 'approved',
    });
  },

  getKycSubmissions: async (): Promise<User[]> => {
    const q = query(collection(db, 'users'), where('kycStatus', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  },

  updateKycStatus: async (userId: string, status: KycStatus, reason?: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    const updateData: any = { kycStatus: status };
    if (status === 'rejected' && reason) {
        updateData['kycDetails.rejectionReason'] = reason;
    }
    await updateDoc(userRef, updateData);
  },

  // Campaigns
  createCampaign: async (campaignData: Omit<Campaign, 'id' | 'status' | 'timestamp' | 'applicantIds'>): Promise<void> => {
    await addDoc(collection(db, 'campaigns'), {
        ...campaignData,
        status: 'open',
        timestamp: serverTimestamp(),
        applicantIds: [],
    });
  },

  getCampaignsForBrand: async (brandId: string): Promise<Campaign[]> => {
    const q = query(collection(db, 'campaigns'), where('brandId', '==', brandId));
    const snapshot = await getDocs(q);
    const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
    campaigns.sort((a, b) => ((b.timestamp as Timestamp)?.toMillis() || 0) - ((a.timestamp as Timestamp)?.toMillis() || 0));
    return campaigns;
  },

  getApplicationsForCampaign: async (campaignId: string): Promise<CampaignApplication[]> => {
    const q = query(collection(db, 'campaign_applications'), where('campaignId', '==', campaignId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignApplication));
  },

  getAllOpenCampaigns: async (userLocation?: string): Promise<Campaign[]> => {
    const campaignsRef = collection(db, 'campaigns');
    let q = query(campaignsRef, where('status', '==', 'open'));
    
    const snapshot = await getDocs(q);
    let campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));

    if(userLocation) {
        campaigns = campaigns.filter(c => c.location === 'All' || c.location === userLocation);
    }
    
    // Sort boosted campaigns to the top
    campaigns.sort((a, b) => (b.isBoosted ? 1 : 0) - (a.isBoosted ? 1 : 0));
    
    return campaigns;
  },

  applyToCampaign: async (appData: Omit<CampaignApplication, 'id' | 'status' | 'timestamp'>): Promise<void> => {
    const campaignRef = doc(db, 'campaigns', appData.campaignId);
    await updateDoc(campaignRef, { applicantIds: arrayUnion(appData.influencerId) });
    
    await addDoc(collection(db, 'campaign_applications'), {
        ...appData,
        collabId: generateCollabId(),
        status: 'pending_brand_review',
        timestamp: serverTimestamp(),
    });
  },

  getCampaignApplicationsForInfluencer: async (influencerId: string): Promise<CampaignApplication[]> => {
    const q = query(collection(db, 'campaign_applications'), where('influencerId', '==', influencerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignApplication));
  },

  updateCampaignApplication: async (appId: string, data: Partial<CampaignApplication>, actorId: string): Promise<void> => {
    const docRef = doc(db, 'campaign_applications', appId);
    await updateDoc(docRef, data);
  },

  // Ad Slots
  sendAdSlotRequest: async (data: Omit<AdSlotRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
    await addDoc(collection(db, 'ad_slot_requests'), {
        ...data,
        collabId: generateCollabId(),
        status: 'pending_approval',
        timestamp: serverTimestamp(),
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
  
  updateAdSlotRequest: async (reqId: string, data: Partial<AdSlotRequest>, actorId: string): Promise<void> => {
    await updateDoc(doc(db, 'ad_slot_requests', reqId), data);
  },

  // Banner Ads
  createBannerAd: async (data: Omit<BannerAd, 'id' | 'timestamp'>): Promise<void> => {
    await addDoc(collection(db, 'banner_ads'), { ...data, timestamp: serverTimestamp() });
  },

  getBannerAds: async (locationQuery: string, settings: PlatformSettings): Promise<BannerAd[]> => {
    const adsRef = collection(db, 'banner_ads');
    let q = query(adsRef);
    if(locationQuery) {
        q = query(adsRef, where('location', '==', locationQuery));
    }
    const snapshot = await getDocs(q);
    const ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAd));
    ads.sort((a, b) => (b.isBoosted ? 1 : 0) - (a.isBoosted ? 1 : 0));
    return ads;
  },

  getBannerAdsForAgency: async (agencyId: string): Promise<BannerAd[]> => {
    const q = query(collection(db, 'banner_ads'), where('agencyId', '==', agencyId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAd));
  },
  
  sendBannerAdBookingRequest: async (data: Omit<BannerAdBookingRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
    await addDoc(collection(db, 'banner_booking_requests'), {
        ...data,
        collabId: generateCollabId(),
        status: 'pending_approval',
        timestamp: serverTimestamp(),
    });
  },
  
  getBannerAdBookingRequestsForBrand: async (brandId: string): Promise<BannerAdBookingRequest[]> => {
    const q = query(collection(db, 'banner_booking_requests'), where('brandId', '==', brandId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAdBookingRequest));
  },
  
  getBannerAdBookingRequestsForAgency: async (agencyId: string): Promise<BannerAdBookingRequest[]> => {
    const q = query(collection(db, 'banner_booking_requests'), where('agencyId', '==', agencyId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAdBookingRequest));
  },
  
  updateBannerAdBookingRequest: async (reqId: string, data: Partial<BannerAdBookingRequest>, actorId: string): Promise<void> => {
    await updateDoc(doc(db, 'banner_booking_requests', reqId), data);
  },

  getActiveAdCollabsForAgency: async (agencyId: string, role: 'livetv' | 'banneragency'): Promise<AnyCollaboration[]> => {
    const collectionName = role === 'livetv' ? 'ad_slot_requests' : 'banner_booking_requests';
    const idField = role === 'livetv' ? 'liveTvId' : 'agencyId';

    const q = query(collection(db, collectionName), where(idField, '==', agencyId), where('status', 'in', ['in_progress', 'work_submitted']));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnyCollaboration));
  },
  
  // Community
  getPosts: async (userId?: string): Promise<Post[]> => {
    const postsRef = collection(db, 'posts');
    const q = userId ? 
        query(postsRef, where('visibility', 'in', ['public', 'private']), orderBy('timestamp', 'desc')) :
        query(postsRef, where('visibility', '==', 'public'), orderBy('timestamp', 'desc'));

    const snapshot = await getDocs(q);
    let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));

    if (userId) {
        posts = posts.filter(p => p.visibility === 'public' || p.userId === userId);
    }

    return posts;
  },

  createPost: async (postData: Omit<Post, 'id'>): Promise<Post> => {
    const docRef = await addDoc(collection(db, 'posts'), postData);
    return { ...postData, id: docRef.id };
  },

  updatePost: async (postId: string, data: Partial<Post>): Promise<void> => {
    await updateDoc(doc(db, 'posts', postId), data);
  },

  deletePost: async (postId: string): Promise<void> => {
    await deleteDoc(doc(db, 'posts', postId));
  },

  uploadPostImage: async (postId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `post_images/${postId}/${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  },

  toggleLikePost: async (postId: string, userId: string): Promise<void> => {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    if (postDoc.exists()) {
        const post = postDoc.data() as Post;
        const likes = post.likes || [];
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
  
  addCommentToPost: async (postId: string, commentData: Omit<Comment, 'id' | 'timestamp'>): Promise<void> => {
    const postRef = doc(db, 'posts', postId);
    const commentsRef = collection(db, `posts/${postId}/comments`);

    const batch = writeBatch(db);
    batch.set(doc(commentsRef), { ...commentData, timestamp: serverTimestamp() });
    batch.update(postRef, { commentCount: increment(1) });
    await batch.commit();
  },

  // Transactions
  createTransaction: async (txData: Omit<Transaction, 'id' | 'timestamp'>): Promise<void> => {
    await addDoc(collection(db, 'transactions'), {
      ...txData,
      timestamp: serverTimestamp(),
    });
  },

  getTransactionsForUser: async (userId: string): Promise<Transaction[]> => {
    const q = query(collection(db, 'transactions'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
  },
  
  // Payouts
  submitPayoutRequest: async (data: any): Promise<void> => {
    await addDoc(collection(db, 'payout_requests'), {
      ...data,
      status: 'pending',
      timestamp: serverTimestamp(),
    });
  },

  getPayoutHistoryForUser: async (userId: string): Promise<PayoutRequest[]> => {
    const q = query(collection(db, 'payout_requests'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest));
  },

  // Disputes
  createDispute: async (data: Omit<Dispute, 'id' | 'status' | 'timestamp'>): Promise<void> => {
    const disputeData = {
        ...data,
        status: 'open',
        timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, 'disputes'), disputeData);
  },

  getDisputes: async (): Promise<Dispute[]> => {
    const snapshot = await getDocs(query(collection(db, 'disputes'), orderBy('timestamp', 'desc')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispute));
  },
  
  resolveDisputeForCreator: async (disputeId: string, collabId: string, collabType: Dispute['collaborationType']): Promise<void> => {
    const collectionName = getCollectionNameForCollab(collabType);
    const batch = writeBatch(db);
    batch.update(doc(db, 'disputes', disputeId), { status: 'resolved' });
    batch.update(doc(db, collectionName, collabId), { status: 'completed' });
    await batch.commit();
  },

  resolveDisputeForBrand: async (disputeId: string, collabId: string, collabType: Dispute['collaborationType']): Promise<void> => {
    const collectionName = getCollectionNameForCollab(collabType);
    const batch = writeBatch(db);
    batch.update(doc(db, 'disputes', disputeId), { status: 'resolved' });
    batch.update(doc(db, collectionName, collabId), { status: 'brand_decision_pending' });
    await batch.commit();
  },

  // Membership
  activateMembership: async (userId: string, plan: MembershipPlan): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    const now = new Date();
    let expiryDate = new Date(now);
    
    switch (plan) {
        case 'basic': expiryDate.setMonth(now.getMonth() + 1); break;
        case 'pro': expiryDate.setMonth(now.getMonth() + 6); break;
        case 'premium': expiryDate.setFullYear(now.getFullYear() + 1); break;
        case 'pro_10':
        case 'pro_20':
        case 'pro_unlimited':
            expiryDate.setFullYear(now.getFullYear() + 1); break;
    }
    
    const updateData = {
        'membership.plan': plan,
        'membership.isActive': true,
        'membership.startsAt': Timestamp.fromDate(now),
        'membership.expiresAt': Timestamp.fromDate(expiryDate),
        'membership.usage': { directCollaborations: 0, campaigns: 0, liveTvBookings: 0, bannerAdBookings: 0 }
    };

    await updateDoc(userRef, updateData);
  },
  
  // Live Help
  getSessionsForUser: async (userId: string): Promise<LiveHelpSession[]> => {
    const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveHelpSession));
  },

  getAllLiveHelpSessionsListener: (callback: (sessions: LiveHelpSession[]) => void): (() => void) => {
    const q = query(collection(db, 'live_help_sessions'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveHelpSession));
        callback(sessions);
    });
  },

  getOrCreateLiveHelpSession: async (userId: string, userName: string, userAvatar: string, staffId: string): Promise<string> => {
    const q = query(collection(db, 'live_help_sessions'), where('userId', '==', userId), where('status', '!=', 'closed'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return snapshot.docs[0].id;
    }

    const docRef = await addDoc(collection(db, 'live_help_sessions'), {
        userId,
        userName,
        userAvatar,
        status: 'unassigned',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userHasUnread: false,
        staffHasUnread: true,
    });
    return docRef.id;
  },

  reopenLiveHelpSession: async (sessionId: string): Promise<void> => {
    await updateDoc(doc(db, 'live_help_sessions', sessionId), {
        status: 'open',
        updatedAt: serverTimestamp(),
        staffHasUnread: true,
    });
  },

  closeLiveHelpSession: async (sessionId: string): Promise<void> => {
    await updateDoc(doc(db, 'live_help_sessions', sessionId), {
        status: 'closed',
        updatedAt: serverTimestamp(),
    });
  },

  assignStaffToSession: async (sessionId: string, staffUser: User): Promise<void> => {
    await updateDoc(doc(db, 'live_help_sessions', sessionId), {
        status: 'open',
        assignedStaffId: staffUser.id,
        assignedStaffName: staffUser.name,
        assignedStaffAvatar: staffUser.avatar,
        updatedAt: serverTimestamp(),
    });
  },
  
  sendLiveHelpMessage: async (sessionId: string, senderId: string, senderName: string, text: string): Promise<void> => {
    const sessionRef = doc(db, 'live_help_sessions', sessionId);
    const messagesRef = collection(db, `live_help_sessions/${sessionId}/messages`);
    
    await addDoc(messagesRef, {
        sessionId,
        senderId,
        senderName,
        text,
        timestamp: serverTimestamp(),
    });
    
    await updateDoc(sessionRef, { updatedAt: serverTimestamp() });
  },

  getQuickRepliesListener: (callback: (replies: QuickReply[]) => void): (() => void) => {
    const q = query(collection(db, 'quick_replies'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuickReply)));
    });
  },
  
  addQuickReply: async (text: string): Promise<void> => {
    await addDoc(collection(db, 'quick_replies'), { text, createdAt: serverTimestamp() });
  },

  updateQuickReply: async (id: string, text: string): Promise<void> => {
    await updateDoc(doc(db, 'quick_replies', id), { text });
  },

  deleteQuickReply: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'quick_replies', id));
  },
  
  updateTicketStatus: async (ticketId: string, status: SupportTicketStatus): Promise<void> => {
    await updateDoc(doc(db, 'support_tickets', ticketId), { status, updatedAt: serverTimestamp() });
  },

  // Refund
  createRefundRequest: async (data: Omit<RefundRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
    await addDoc(collection(db, 'refund_requests'), {
        ...data,
        status: 'pending',
        timestamp: serverTimestamp(),
    });
  },
  
  updateRefundRequest: async (id: string, data: Partial<RefundRequest>): Promise<void> => {
    await updateDoc(doc(db, 'refund_requests', id), data);
  },
  
  // Daily Payout
  submitDailyPayoutRequest: async (data: Omit<DailyPayoutRequest, 'id' | 'status' | 'timestamp'>): Promise<void> => {
    await addDoc(collection(db, 'daily_payout_requests'), {
        ...data,
        status: 'pending',
        timestamp: serverTimestamp(),
    });
  },
  
  updateDailyPayoutRequest: async (id: string, data: Partial<DailyPayoutRequest>): Promise<void> => {
    await updateDoc(doc(db, 'daily_payout_requests', id), data);
  },

  updateDailyPayoutRequestStatus: async (reqId: string, collabId: string, collabType: 'ad_slot' | 'banner_booking', status: 'approved' | 'rejected', amount?: number, reason?: string): Promise<void> => {
    const batch = writeBatch(db);
    const reqRef = doc(db, 'daily_payout_requests', reqId);
    
    const updateData: any = { status };
    if (reason) updateData.rejectionReason = reason;
    if (status === 'approved' && amount) {
      updateData.approvedAmount = amount;
      const collabRef = doc(db, getCollectionNameForCollab(collabType), collabId);
      batch.update(collabRef, { dailyPayoutsReceived: increment(amount) });
    }
    
    batch.update(reqRef, updateData);
    await batch.commit();
  },

  // Admin Panel bulk gets
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

  updatePayoutStatus: async (reqId: string, status: PayoutRequest['status'], collabId: string, collabType: PayoutRequest['collaborationType'], reason?: string): Promise<void> => {
    const batch = writeBatch(db);
    const reqRef = doc(db, 'payout_requests', reqId);
    
    const updateData: any = { status };
    if (reason) updateData.rejectionReason = reason;
    batch.update(reqRef, updateData);

    if (status === 'approved') {
        const collabRef = doc(db, getCollectionNameForCollab(collabType), collabId);
        batch.update(collabRef, { paymentStatus: 'payout_complete' });
    }
    
    await batch.commit();
  },

  // Notifications
  createNotification: async (notification: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>): Promise<void> => {
    await addDoc(collection(db, 'notifications'), {
        ...notification,
        isRead: false,
        timestamp: serverTimestamp(),
    });
  },

  getNotificationsForUserListener: (
    userId: string,
    callback: (notifications: AppNotification[]) => void,
    onError: (error: Error) => void
  ): (() => void) => {
    // FIX: The original query required a composite index on userId and timestamp, which is missing.
    // To prevent the app from crashing, the orderBy clause is removed from the query.
    // Sorting and limiting are now handled on the client-side after fetching all documents for the user.
    // This may have performance implications for users with many notifications. The correct long-term
    // solution is to create the specified index in the Firebase console.
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
      // orderBy('timestamp', 'desc'), // Requires index
    );
    return onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification & { timestamp: Timestamp | null }));
        // Sort client-side to ensure newest are first, then take the top 50.
        notifications.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        callback(notifications.slice(0, 50));
    }, onError);
  },

  markNotificationAsRead: async (notificationId: string): Promise<void> => {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { isRead: true });
  },

  markAllNotificationsAsRead: async (userId: string): Promise<void> => {
    const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isRead: true });
    });
    await batch.commit();
  },

  // Partners
  getPartners: async (): Promise<Partner[]> => {
    const q = query(collection(db, 'partners'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
  },

  createPartner: async (data: Omit<Partner, 'id' | 'createdAt'>): Promise<void> => {
    await addDoc(collection(db, 'partners'), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },

  updatePartner: async (id: string, data: Partial<Omit<Partner, 'id'| 'createdAt'>>): Promise<void> => {
    await updateDoc(doc(db, 'partners', id), data);
  },

  deletePartner: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'partners', id));
  },

  uploadPartnerLogo: (file: File): Promise<string> => {
    const storageRef = ref(storage, `partner_logos/${Date.now()}_${file.name}`);
    return new Promise((resolve, reject) => {
      uploadBytes(storageRef, file).then(snapshot => {
        getDownloadURL(snapshot.ref).then(resolve).catch(reject);
      }).catch(reject);
    });
  },
};