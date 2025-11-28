

// ... (imports)
import { 
    collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, 
    orderBy, limit, addDoc, serverTimestamp, onSnapshot, increment, 
    arrayUnion, arrayRemove, startAfter, Timestamp, deleteDoc, writeBatch
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
    UserRole, AppNotification, QuickReply, MembershipPlan, StaffPermission,
    PlatformBanner, Agreements, View
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

    // ... (getAllUsers to adminChangePassword - no changes)
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
        try {
            const response = await fetch(`${BACKEND_URL}/admin-change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, newPassword })
            });
            
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to update password');
                }
                return data;
            } else {
                const text = await response.text();
                console.error("Non-JSON response from backend:", text);
                throw new Error("Backend function not found or failed. Please ensure 'functions' are deployed to Firebase.");
            }
        } catch (error: any) {
            console.error("adminChangePassword error:", error);
            throw error; 
        }
    },
    applyPenalty: async (userId: string, amount: number) => {
        await updateDoc(doc(db, 'users', userId), {
            pendingPenalty: increment(amount)
        });
    },
    updatePenalty: async (userId: string, amount: number) => {
        try {
            const response = await fetch(`${BACKEND_URL}/update-penalty`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, amount })
            });
            if (!response.ok) throw new Error('Backend failed');
            return await response.json();
        } catch (e) {
            console.warn("Backend updatePenalty failed, falling back to client-side", e);
            await updateDoc(doc(db, 'users', userId), {
                pendingPenalty: amount
            });
            return { success: true };
        }
    },
    cancelCollaboration: async (userId: string, collaborationId: string, collectionName: string, reason: string, penaltyAmount: number) => {
        try {
            const response = await fetch(`${BACKEND_URL}/cancel-collaboration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, collaborationId, collectionName, reason, penaltyAmount })
            });
            if (!response.ok) throw new Error('Backend failed');
            return await response.json();
        } catch (error) {
            console.warn("Backend cancelCollaboration failed, falling back to client-side", error);
            
            const batch = writeBatch(db);
            const collabRef = doc(db, collectionName, collaborationId);
            const userRef = doc(db, 'users', userId);

            // 1. Update Collaboration Status
            batch.update(collabRef, { 
                status: 'rejected', 
                rejectionReason: reason || 'Cancelled by creator',
                cancelledBy: userId,
                cancelledAt: serverTimestamp()
            });

            // 2. Apply Penalty
            if (penaltyAmount > 0) {
                batch.update(userRef, {
                    pendingPenalty: increment(Number(penaltyAmount))
                });
            }
            
            // 3. Commit
            await batch.commit();
            return { success: true };
        }
    },

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
    // ... rest of the file remains unchanged
    getAgreements: async (): Promise<Agreements> => {
        const docRef = doc(db, 'settings', 'agreements');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as Agreements;
        }
        return { brand: '', influencer: '', livetv: '', banneragency: '' };
    },
    updateAgreements: async (agreements: Agreements) => {
        await setDoc(doc(db, 'settings', 'agreements'), agreements, { merge: true });
    },
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
    getInfluencersPaginated: async (options: { limit: number, startAfterDoc?: any }) => {
        // We will perform client-side sorting for boosts as complex Firestore queries need index creation
        let q = query(collection(db, 'influencers'), limit(options.limit * 2)); // Fetch more to allow for client-side boosting reorder
        if (options.startAfterDoc) {
            q = query(collection(db, 'influencers'), startAfter(options.startAfterDoc), limit(options.limit * 2));
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
    getLiveTvChannels: async (settings: PlatformSettings): Promise<LiveTvChannel[]> => {
        const snapshot = await getDocs(collection(db, 'livetv_channels'));
        const channels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveTvChannel));
        // Sort boosted channels to top
        return channels.sort((a, b) => (b.isBoosted === true ? 1 : 0) - (a.isBoosted === true ? 1 : 0));
    },
    getConversations: async (userId: string): Promise<any[]> => {
        const q = query(collection(db, `users/${userId}/conversations`), orderBy('lastMessage.timestamp', 'desc'));
        const snapshot = await getDocs(q);
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
        
        const senderDocRef = doc(db, 'users', senderId);
        const recipientDocRef = doc(db, 'users', recipientId);
        
        const [senderSnap, recipientSnap] = await Promise.all([
            getDoc(senderDocRef), 
            getDoc(recipientDocRef)
        ]);

        if (senderSnap.exists() && recipientSnap.exists()) {
            const senderData = senderSnap.data();
            const recipientData = recipientSnap.data();

            const lastMessageData = {
                text: text || (attachments.length > 0 ? '📎 Attachment' : 'Message'),
                timestamp: serverTimestamp()
            };

            const senderConvRef = doc(db, `users/${senderId}/conversations`, recipientId);
            await setDoc(senderConvRef, {
                id: recipientId,
                participant: {
                    id: recipientId,
                    name: recipientData.name,
                    avatar: recipientData.avatar,
                    role: recipientData.role,
                    companyName: recipientData.companyName || ''
                },
                lastMessage: lastMessageData
            }, { merge: true });

            const recipientConvRef = doc(db, `users/${recipientId}/conversations`, senderId);
            await setDoc(recipientConvRef, {
                id: senderId,
                participant: {
                    id: senderId,
                    name: senderData.name,
                    avatar: senderData.avatar,
                    role: senderData.role,
                    companyName: senderData.companyName || ''
                },
                lastMessage: lastMessageData
            }, { merge: true });
        }
        
        const senderName = senderSnap.exists() ? senderSnap.data().name : 'User';
        
        await apiService.createNotification(recipientId, {
            userId: recipientId,
            title: `New Message from ${senderName}`,
            body: text || 'Sent an attachment',
            type: 'new_message',
            view: View.MESSAGES,
            isRead: false,
            relatedId: chatId
        });
    },
    uploadMessageAttachment: async (messageId: string, file: File): Promise<string> => {
        return uploadFile(`attachments/${messageId}/${file.name}`, file);
    },
    createNotification: async (userId: string, notification: Omit<AppNotification, 'id' | 'timestamp'>) => {
        try {
            await addDoc(collection(db, `users/${userId}/notifications`), {
                ...notification,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Failed to create notification:", error);
        }
    },
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
        const ref = await addDoc(collection(db, 'collaboration_requests'), { ...request, status: 'pending', timestamp: serverTimestamp() });
        await apiService.createNotification(request.influencerId, {
            userId: request.influencerId,
            title: "New Collaboration Request",
            body: `${request.brandName} sent you a proposal: ${request.title}`,
            type: 'new_collab_request',
            view: View.COLLAB_REQUESTS,
            relatedId: ref.id,
            isRead: false
        });
    },
    updateCollaborationRequest: async (id: string, data: any, actorId: string) => {
        const docRef = doc(db, 'collaboration_requests', id);
        const snapshot = await getDoc(docRef);
        const currentData = snapshot.data() as CollaborationRequest;
        
        await updateDoc(docRef, data);

        if (!currentData) return;

        const targetId = actorId === currentData.brandId ? currentData.influencerId : currentData.brandId;
        const targetRole = actorId === currentData.brandId ? 'influencer' : 'brand';
        
        let title = "Collaboration Update";
        let body = `Update on ${currentData.title}`;
        
        if (data.status === 'rejected') {
             title = "Request Rejected";
             body = `The collaboration request "${currentData.title}" was rejected.`;
        } else if (data.status === 'agreement_reached') {
             title = "Agreement Reached!";
             body = `Terms have been accepted for "${currentData.title}".`;
        } else if (data.status && data.status.includes('offer')) {
             title = "New Offer Received";
             body = `A new offer of ${data.currentOffer?.amount} has been made for "${currentData.title}".`;
        } else if (data.status === 'completed') {
             title = "Collaboration Completed";
             body = `The collaboration "${currentData.title}" has been marked as complete.`;
        }

        await apiService.createNotification(targetId, {
            userId: targetId,
            title,
            body,
            type: 'collab_update',
            view: targetRole === 'brand' ? View.MY_COLLABORATIONS : View.COLLAB_REQUESTS,
            relatedId: id,
            isRead: false
        });
    },
    deleteCollaboration: async (id: string, collectionName: string) => {
        await deleteDoc(doc(db, collectionName, id));
    },
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
        // Sort boosted campaigns to top
        return campaigns.sort((a, b) => (b.isBoosted === true ? 1 : 0) - (a.isBoosted === true ? 1 : 0));
    },
    applyToCampaign: async (application: any) => {
        const ref = await addDoc(collection(db, 'campaign_applications'), { ...application, status: 'pending_brand_review', timestamp: serverTimestamp() });
        await updateDoc(doc(db, 'campaigns', application.campaignId), {
            applicantIds: arrayUnion(application.influencerId)
        });
        
        await apiService.createNotification(application.brandId, {
            userId: application.brandId,
            title: "New Campaign Application",
            body: `${application.influencerName} applied to "${application.campaignTitle}".`,
            type: 'new_campaign_applicant',
            view: View.CAMPAIGNS,
            relatedId: ref.id,
            isRead: false
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
    updateCampaignApplication: async (id: string, data: any, actorId: string) => {
        const docRef = doc(db, 'campaign_applications', id);
        const snapshot = await getDoc(docRef);
        const currentData = snapshot.data() as CampaignApplication;
        
        await updateDoc(docRef, data);
        
        if (!currentData) return;

        const isActorBrand = actorId === currentData.brandId;
        const targetId = isActorBrand ? currentData.influencerId : currentData.brandId;
        const targetView = isActorBrand ? View.MY_APPLICATIONS : View.CAMPAIGNS;

        let title = "Application Update";
        let body = `Update on application for "${currentData.campaignTitle}"`;

        if (data.status === 'agreement_reached') {
            title = "Application Accepted";
            body = `Congrats! Your application for "${currentData.campaignTitle}" was accepted.`;
        } else if (data.status === 'rejected') {
            title = "Application Rejected";
            body = `Your application for "${currentData.campaignTitle}" was not selected.`;
        }

        await apiService.createNotification(targetId, {
            userId: targetId,
            title,
            body,
            type: 'application_update',
            view: targetView,
            relatedId: id,
            isRead: false
        });
    },
    sendAdSlotRequest: async (request: any) => {
        const ref = await addDoc(collection(db, 'ad_slot_requests'), { ...request, status: 'pending_approval', timestamp: serverTimestamp() });
        
        await apiService.createNotification(request.liveTvId, {
            userId: request.liveTvId,
            title: "New Ad Slot Request",
            body: `${request.brandName} requested an ad slot for "${request.campaignName}".`,
            type: 'new_collab_request',
            view: View.LIVETV,
            relatedId: ref.id,
            isRead: false
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
    getAllAdSlotRequests: async (): Promise<AdSlotRequest[]> => {
        const snapshot = await getDocs(collection(db, 'ad_slot_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdSlotRequest));
    },
    updateAdSlotRequest: async (id: string, data: any, userId: string) => {
        const docRef = doc(db, 'ad_slot_requests', id);
        const snapshot = await getDoc(docRef);
        const currentData = snapshot.data() as AdSlotRequest;
        
        await updateDoc(docRef, data);
        
        if (!currentData) return;

        const isActorBrand = userId === currentData.brandId;
        const targetId = isActorBrand ? currentData.liveTvId : currentData.brandId;
        const targetView = isActorBrand ? View.LIVETV : View.AD_BOOKINGS;

        await apiService.createNotification(targetId, {
            userId: targetId,
            title: "Ad Request Update",
            body: `Status updated for ad campaign "${currentData.campaignName}".`,
            type: 'collab_update',
            view: targetView,
            relatedId: id,
            isRead: false
        });
    },
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
        // Sort boosted ads to top
        return ads.sort((a, b) => (b.isBoosted === true ? 1 : 0) - (a.isBoosted === true ? 1 : 0));
    },
    getBannerAdsForAgency: async (agencyId: string): Promise<BannerAd[]> => {
        const q = query(collection(db, 'banner_ads'), where('agencyId', '==', agencyId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAd));
    },
    sendBannerAdBookingRequest: async (request: any) => {
        const ref = await addDoc(collection(db, 'banner_ad_booking_requests'), { ...request, status: 'pending_approval', timestamp: serverTimestamp() });
        
        await apiService.createNotification(request.agencyId, {
            userId: request.agencyId,
            title: "New Banner Booking",
            body: `${request.brandName} requested to book a banner for "${request.campaignName}".`,
            type: 'new_collab_request',
            view: View.BANNERADS,
            relatedId: ref.id,
            isRead: false
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
    getAllBannerAdBookingRequests: async (): Promise<BannerAdBookingRequest[]> => {
        const snapshot = await getDocs(collection(db, 'banner_ad_booking_requests'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BannerAdBookingRequest));
    },
    updateBannerAdBookingRequest: async (id: string, data: any, userId: string) => {
        const docRef = doc(db, 'banner_ad_booking_requests', id);
        const snapshot = await getDoc(docRef);
        const currentData = snapshot.data() as BannerAdBookingRequest;
        
        await updateDoc(docRef, data);
        
        if (!currentData) return;

        const isActorBrand = userId === currentData.brandId;
        const targetId = isActorBrand ? currentData.agencyId : currentData.brandId;
        const targetView = isActorBrand ? View.BANNERADS : View.AD_BOOKINGS;

        await apiService.createNotification(targetId, {
            userId: targetId,
            title: "Banner Booking Update",
            body: `Status updated for banner campaign "${currentData.campaignName}".`,
            type: 'collab_update',
            view: targetView,
            relatedId: id,
            isRead: false
        });
    },
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
    submitPayoutRequest: async (data: any) => {
        await addDoc(collection(db, 'payout_requests'), { ...data, status: 'pending', timestamp: serverTimestamp() });
        if (data.userId) {
            await updateDoc(doc(db, 'users', data.userId), {
                pendingPenalty: 0
            });
        }
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
    getAllTransactions: async (): Promise<Transaction[]> => {
        const snapshot = await getDocs(collection(db, 'transactions'));
        return snapshot.docs.map(doc => ({ ...doc.data() } as Transaction));
    },
    getTransactionsForUser: async (userId: string): Promise<Transaction[]> => {
        const q = query(collection(db, 'transactions'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data() } as Transaction));
    },
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
    updateDispute: async (id: string, data: any) => {
        await updateDoc(doc(db, 'disputes', id), data);
    },
    getNotificationsForUserListener: (userId: string, callback: (notifs: AppNotification[]) => void, onError: (err: any) => void) => {
        const q = query(collection(db, `users/${userId}/notifications`), orderBy('timestamp', 'desc'), limit(50));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
        }, onError);
    },
    markNotificationAsRead: async (userId: string, notifId: string) => {
        await updateDoc(doc(db, `users/${userId}/notifications`, notifId), { isRead: true });
    },
    markAllNotificationsAsRead: async (userId: string) => {
        const q = query(collection(db, `users/${userId}/notifications`), where('isRead', '==', false));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
            batch.update(doc.ref, { isRead: true });
        });
        await batch.commit();
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
        let q = query(collection(db, 'users'));
        if (targetRole !== 'all') {
            q = query(collection(db, 'users'), where('role', '==', targetRole));
        }
        const snapshot = await getDocs(q);
        
        for (const doc of snapshot.docs) {
            await apiService.createNotification(doc.id, {
                userId: doc.id,
                title,
                body,
                type: 'system',
                view: View.DASHBOARD,
                isRead: false,
                relatedId: url
            });
        }
    },
};
