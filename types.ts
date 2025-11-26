
import { Timestamp } from 'firebase/firestore';

export type UserRole = 'brand' | 'influencer' | 'livetv' | 'banneragency' | 'staff';

export type MembershipPlan = 'free' | 'pro_10' | 'pro_20' | 'pro_unlimited' | 'basic' | 'pro' | 'premium';

export interface Membership {
    plan: MembershipPlan;
    isActive: boolean;
    startsAt: Timestamp | Date;
    expiresAt: Timestamp | Date | null;
    usage: {
        directCollaborations: number;
        campaigns: number;
        liveTvBookings: number;
        bannerAdBookings: number;
    };
}

export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface KycDetails {
    dob?: string;
    gender?: string;
    idType?: string;
    idNumber?: string;
    address?: string;
    villageTown?: string;
    roadNameArea?: string;
    pincode?: string;
    city?: string;
    district?: string;
    state?: string;
    idProofUrl?: string;
    panCardUrl?: string; // Added for Manual KYC
    selfieUrl?: string;
    rejectionReason?: string;
    isPanVerified?: boolean;
    panNameMatch?: boolean;
    isAadhaarVerified?: boolean;
    isLivenessVerified?: boolean;
    isDlVerified?: boolean;
    verifiedName?: string;
    verifiedBy?: string;
}

export type CreatorVerificationStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface CreatorVerificationDetails {
    // Common
    rejectionReason?: string;
    
    // Influencer
    socialMediaLinks?: string;
    acknowledgementUrl?: string; // Optional creator proof
    
    // Business (Agency & Live TV)
    registrationDocType?: 'msme' | 'gst' | 'trade_license';
    registrationDocUrl?: string;
    officePhotoUrl?: string;
    businessPanUrl?: string;
    
    // Live TV Specific
    channelStampUrl?: string;
}

export type StaffPermission = 'super_admin' | 'user_management' | 'financial' | 'collaborations' | 'kyc' | 'community' | 'support' | 'marketing' | 'live_help' | 'analytics';

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    avatar: string;
    mobileNumber?: string;
    piNumber?: string;
    companyName?: string;
    location?: string;
    isBlocked?: boolean;
    kycStatus: KycStatus;
    kycDetails?: KycDetails;
    membership?: Membership;
    msmeRegistrationNumber?: string;
    staffPermissions?: StaffPermission[];
    referralCode?: string;
    referredBy?: string;
    coins?: number;
    fcmToken?: string | null;
    
    // New Creator Verification
    creatorVerificationStatus?: CreatorVerificationStatus;
    creatorVerificationDetails?: CreatorVerificationDetails;
}

export interface Influencer {
    id: string;
    name: string;
    handle: string;
    bio: string;
    followers: number;
    niche: string;
    engagementRate: number;
    location?: string;
    avatar: string;
    socialMediaLinks?: string;
    isBoosted?: boolean;
    membershipActive?: boolean;
}

export interface DiscountSetting {
    isEnabled: boolean;
    percentage: number;
}

export interface SocialMediaLink {
    platform: string;
    url: string;
}

export interface PlatformSettings {
    isCommunityFeedEnabled: boolean;
    isCreatorMembershipEnabled: boolean;
    isProMembershipEnabled: boolean;
    isMaintenanceModeEnabled: boolean;
    isWelcomeMessageEnabled: boolean;
    isNotificationBannerEnabled: boolean;
    notificationBannerText?: string;
    youtubeTutorialUrl?: string;
    socialMediaLinks: SocialMediaLink[];
    isSocialMediaFabEnabled: boolean;
    isStaffRegistrationEnabled: boolean;
    isLiveHelpEnabled: boolean;
    isProfileBoostingEnabled: boolean;
    isCampaignBoostingEnabled: boolean;
    isKycIdProofRequired: boolean;
    isKycSelfieRequired: boolean;
    isForgotPasswordOtpEnabled: boolean;
    isOtpLoginEnabled: boolean;
    
    // Payment Settings
    activePaymentGateway: string;
    paymentGatewayApiId: string;
    paymentGatewayApiSecret: string;
    paymentGatewayWebhookSecret?: string;
    // Payout Settings
    payoutClientId?: string;
    payoutClientSecret?: string;
    
    // Cashfree KYC Settings
    cashfreeKycClientId?: string;
    cashfreeKycClientSecret?: string;
    
    paymentGatewaySourceCode: string;
    otpApiId: string;
    
    welcomeMessage?: string;
    
    // Pricing
    boostPrices: {
        profile: number;
        campaign: number;
        banner: number;
    };
    membershipPrices: {
        pro_10: number;
        pro_20: number;
        pro_unlimited: number;
        basic: number;
        pro: number;
        premium: number;
    };
    
    // Commission & Taxes
    isPlatformCommissionEnabled: boolean;
    platformCommissionRate: number;
    isPaymentProcessingChargeEnabled: boolean;
    paymentProcessingChargeRate: number;
    isGstEnabled: boolean;
    gstRate: number;
    
    // Payouts
    payoutSettings: {
        requireSelfieForPayout: boolean;
        requireLiveVideoForDailyPayout: boolean;
    };
    
    // Discounts
    discountSettings: {
        creatorProfileBoost: DiscountSetting;
        brandMembership: DiscountSetting;
        creatorMembership: DiscountSetting;
        brandCampaignBoost: DiscountSetting;
    };
}

export enum View {
    DASHBOARD = 'dashboard',
    PROFILE = 'profile',
    INFLUENCERS = 'influencers',
    MESSAGES = 'messages',
    SETTINGS = 'settings',
    LOGIN = 'login',
    SIGNUP = 'signup',
    ADMIN = 'admin',
    COLLAB_REQUESTS = 'collab_requests',
    MY_COLLABORATIONS = 'my_collaborations',
    CAMPAIGNS = 'campaigns',
    MY_APPLICATIONS = 'my_applications',
    DISCOVER_LIVETV = 'discover_livetv',
    LIVETV = 'livetv',
    AD_BOOKINGS = 'ad_bookings',
    DISCOVER_BANNERADS = 'discover_bannerads',
    BANNERADS = 'bannerads',
    SUPPORT = 'support',
    MEMBERSHIP = 'membership',
    PAYMENT_HISTORY = 'payment_history',
    KYC = 'kyc',
    COMMUNITY = 'community',
    PAYOUT_REQUEST = 'payout_request',
    REFUND_REQUEST = 'refund_request',
    BOOST_PROFILE = 'boost_profile',
    PARTNERS = 'partners',
    PAYMENT_SUCCESS = 'payment_success',
    CREATOR_VERIFICATION = 'creator_verification'
}

export interface ProfileData {
    id: string;
    name: string;
    avatar: string;
    role: UserRole;
    handle?: string;
    companyName?: string;
    bio?: string;
}

export interface ConversationParticipant {
    id: string;
    name: string;
    avatar: string;
    role?: UserRole;
    companyName?: string;
    handle?: string;
}

export interface Conversation {
    id: string;
    participant: ConversationParticipant;
    lastMessage: {
        text: string;
        timestamp: any;
    };
}

export interface Message {
    id: string;
    senderId: string;
    text: string;
    timestamp: any;
    attachments?: Attachment[];
}

export interface Attachment {
    url: string;
    type: 'image' | 'video' | 'audio' | 'document';
    name: string;
}

export interface LiveTvChannel {
    id: string;
    name: string;
    logo: string;
    description: string;
    audienceSize: number;
    niche: string;
    isBoosted?: boolean;
}

export interface BannerAd {
    id: string;
    agencyId: string;
    agencyName: string;
    agencyAvatar: string;
    location: string;
    address: string;
    photoUrl: string;
    size: string;
    feePerDay: number;
    bannerType: string;
    isBoosted?: boolean;
    timestamp?: any;
}

export interface Transaction {
    transactionId: string;
    userId: string;
    amount: number;
    type: 'payment' | 'payout' | 'refund';
    status: 'pending' | 'completed' | 'failed';
    description: string;
    relatedId: string;
    collabId?: string;
    timestamp: any;
    paymentGatewayDetails?: any;
}

export interface PayoutRequest {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'on_hold';
    collaborationId: string;
    collaborationType: 'direct' | 'campaign' | 'ad_slot' | 'banner_booking';
    collaborationTitle: string;
    bankDetails?: string;
    upiId?: string;
    timestamp: any;
    collabId?: string;
    isAccountVerified?: boolean;
    accountVerifiedName?: string;
}

export interface RefundRequest {
    id: string;
    brandId: string;
    brandName: string;
    brandAvatar: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed';
    collaborationId: string;
    collabType: 'direct' | 'campaign' | 'ad_slot' | 'banner_booking';
    collabTitle: string;
    description: string;
    bankDetails: string;
    panNumber: string;
    timestamp: any;
    collabId?: string;
}

export interface DailyPayoutRequest {
    id: string;
    userId: string;
    userName: string;
    userRole: UserRole;
    collaborationId: string;
    collaborationType: 'ad_slot' | 'banner_booking';
    videoUrl?: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedAmount?: number;
    rejectionReason?: string;
    timestamp: any;
}

export type CollabRequestStatus = 'pending' | 'rejected' | 'influencer_offer' | 'brand_offer' | 'agreement_reached' | 'in_progress' | 'work_submitted' | 'completed' | 'disputed' | 'brand_decision_pending' | 'refund_pending_admin_review';

export interface CollaborationRequest {
    id: string;
    brandId: string;
    brandName: string;
    brandAvatar: string;
    influencerId: string;
    influencerName: string;
    influencerAvatar: string;
    title: string;
    message: string;
    budget?: string;
    status: CollabRequestStatus;
    currentOffer?: { amount: string; offeredBy: 'brand' | 'influencer' };
    finalAmount?: string;
    paymentStatus?: 'paid' | 'payout_requested' | 'payout_complete';
    workStatus?: 'started';
    rejectionReason?: string;
    timestamp: any;
    collabId?: string;
}

export type CampaignApplicationStatus = CollabRequestStatus | 'pending_brand_review' | 'brand_counter_offer' | 'influencer_counter_offer';

export interface Campaign {
    id: string;
    brandId: string;
    brandName: string;
    brandAvatar: string;
    title: string;
    description: string;
    category: string;
    collaborationType: 'paid' | 'barter';
    influencerCount: number;
    paymentOffer?: string;
    location?: string;
    status: 'open' | 'closed';
    isBoosted?: boolean;
    applicantIds?: string[];
}

export interface CampaignApplication {
    id: string;
    campaignId: string;
    campaignTitle: string;
    brandId: string;
    brandName: string;
    brandAvatar: string;
    influencerId: string;
    influencerName: string;
    influencerAvatar: string;
    status: CampaignApplicationStatus;
    message: string;
    currentOffer?: { amount: string; offeredBy: 'brand' | 'influencer' };
    finalAmount?: string;
    paymentStatus?: 'paid' | 'payout_requested' | 'payout_complete';
    workStatus?: 'started';
    rejectionReason?: string;
    timestamp: any;
    collabId?: string;
}

export type AdBookingStatus = CollabRequestStatus | 'pending_approval' | 'agency_offer';

export interface AdSlotRequest {
    id: string;
    brandId: string;
    brandName: string;
    brandAvatar: string;
    liveTvId: string;
    liveTvName: string;
    liveTvAvatar: string;
    campaignName: string;
    adType: string;
    startDate: string;
    endDate: string;
    url?: string;
    status: AdBookingStatus;
    currentOffer?: { amount: string; offeredBy: 'brand' | 'agency' };
    finalAmount?: string;
    paymentStatus?: 'paid' | 'payout_requested' | 'payout_complete';
    workStatus?: 'started';
    rejectionReason?: string;
    timestamp: any;
    collabId?: string;
    dailyPayoutsReceived?: number;
}

export interface BannerAdBookingRequest {
    id: string;
    brandId: string;
    brandName: string;
    brandAvatar: string;
    agencyId: string;
    agencyName: string;
    agencyAvatar: string;
    bannerAdId: string;
    bannerAdLocation: string;
    campaignName: string;
    startDate: string;
    endDate: string;
    status: AdBookingStatus;
    currentOffer?: { amount: string; offeredBy: 'brand' | 'agency' };
    finalAmount?: string;
    paymentStatus?: 'paid' | 'payout_requested' | 'payout_complete';
    workStatus?: 'started';
    rejectionReason?: string;
    timestamp: any;
    collabId?: string;
    dailyPayoutsReceived?: number;
}

export type AnyCollaboration = CollaborationRequest | CampaignApplication | AdSlotRequest | BannerAdBookingRequest;

export interface PlatformBanner {
    id: string;
    title: string;
    imageUrl: string;
    targetUrl: string;
    isActive: boolean;
}

export interface AppNotification {
    id: string;
    userId: string;
    title: string;
    body: string;
    type: 'new_collab_request' | 'collab_update' | 'new_message' | 'work_submitted' | 'collab_completed' | 'new_campaign_applicant' | 'application_update' | 'system';
    isRead: boolean;
    timestamp: any;
    view: View;
    relatedId?: string;
}

export interface Post {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    userRole: UserRole;
    text: string;
    imageUrl?: string;
    likes: string[];
    commentCount: number;
    timestamp: any;
    isBlocked?: boolean;
    visibility?: 'public' | 'private';
}

export interface Comment {
    id: string;
    postId: string;
    userId: string;
    userName: string;
    userAvatar: string;
    text: string;
    timestamp: any;
}

export interface Partner {
    id: string;
    name: string;
    logoUrl: string;
}

export type SupportTicketPriority = 'Low' | 'Medium' | 'High';
export type SupportTicketStatus = 'open' | 'in_progress' | 'closed';

export interface SupportTicket {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    subject: string;
    priority: SupportTicketPriority;
    status: SupportTicketStatus;
    createdAt: any;
    updatedAt: any;
}

export interface TicketReply {
    id: string;
    ticketId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    senderRole: string;
    text: string;
    attachments: Attachment[];
    timestamp: any;
}

export interface LiveHelpSession {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    status: 'unassigned' | 'open' | 'closed';
    assignedStaffId?: string;
    assignedStaffName?: string;
    assignedStaffAvatar?: string;
    createdAt: any;
    updatedAt: any;
}

export interface LiveHelpMessage {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: any;
}

export interface QuickReply {
    id: string;
    text: string;
}

export interface Dispute {
    id: string;
    collaborationId: string;
    collaborationType: string;
    collaborationTitle: string;
    disputedById: string;
    disputedByName: string;
    disputedByAvatar: string;
    disputedAgainstId: string;
    disputedAgainstName: string;
    disputedAgainstAvatar: string;
    reason: string;
    amount: number;
    status: 'open' | 'resolved';
    timestamp: any;
    collabId?: string;
}

export type BoostType = 'profile' | 'campaign' | 'banner';

export interface Boost {
    id: string;
    userId: string;
    targetId: string;
    targetType: BoostType;
    plan: string; // e.g. '7days'
    createdAt: any;
    expiresAt: any;
}

export interface CollaborationStatusItem {
    id: string;
    title: string;
    partnerName: string;
    partnerAvatar: string;
    status: string;
    timestamp: any;
    type: string;
    view: View;
}

export interface CombinedCollabItem {
    id: string;
    type: string;
    title: string;
    customerName: string;
    customerAvatar: string;
    customerPiNumber?: string;
    providerName: string;
    providerAvatar: string;
    providerPiNumber?: string;
    date?: Date;
    status: string;
    paymentStatus: string;
    payoutStatus: string;
    originalData: any;
}