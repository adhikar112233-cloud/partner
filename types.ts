











import { Timestamp } from 'firebase/firestore';

export type UserRole = 'brand' | 'influencer' | 'livetv' | 'banneragency' | 'staff';

export type MembershipPlan = 'free' | 'pro_10' | 'pro_20' | 'pro_unlimited' | 'basic' | 'pro' | 'premium';

export interface Agreements {
    brand: string;
    influencer: string;
    livetv: string;
    banneragency: string;
}

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

export interface BankDetails {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    isVerified: boolean;
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
    gstRegisteredName?: string;
    isGstVerified?: boolean;
    isBusinessPanVerified?: boolean;
    
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
    
    // Financial Penalty
    pendingPenalty?: number;

    // Stats for Leaderboard
    totalEarnings?: number;
    completedCollabCount?: number;

    // Community Follow System
    followers?: string[]; // Array of User IDs
    following?: string[]; // Array of User IDs
    
    // Saved Payment Details
    savedBankDetails?: BankDetails;
    savedUpiId?: string;
    isUpiVerified?: boolean;
    
    // New Creator Verification
    creatorVerificationStatus?: CreatorVerificationStatus;
    creatorVerificationDetails?: CreatorVerificationDetails;
    isVerified?: boolean; // Verified Badge
    isBoosted?: boolean; // Boost Status
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
    isVerified?: boolean; // Verified Badge
}

export interface DiscountSetting {
    isEnabled: boolean;
    percentage: number;
}

export interface SocialMediaLink {
    platform: string;
    url: string;
}

export interface TrainingVideo {
    id: string;
    title: string;
    url: string;
}

export interface CompanyInfo {
    name: string;
    address: string;
    email: string;
    phone: string;
    gstIn?: string;
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
    loanAndRechargeUrl?: string;
    shoppingUrl?: string; // New field for Shopping redirection
    socialMediaLinks: SocialMediaLink[];
    isSocialMediaFabEnabled: boolean;
    isStaffRegistrationEnabled: boolean;
    isLiveHelpEnabled: boolean;
    isProfileBoostingEnabled: boolean;
    isCampaignBoostingEnabled: boolean;
    isBannerAdsEnabled?: boolean; // New flag for Banner Ads visibility
    
    // Training Videos
    trainingVideos?: {
        brand: TrainingVideo[];
        influencer: TrainingVideo[];
        livetv: TrainingVideo[];
        banneragency: TrainingVideo[];
    };

    // KYC Settings
    isKycIdProofRequired: boolean;
    isKycSelfieRequired: boolean;
    isInstantKycEnabled: boolean; // Controls Aadhaar/PAN/DL API availability
    
    isForgotPasswordOtpEnabled: boolean;
    isOtpLoginEnabled: boolean;
    isGoogleLoginEnabled: boolean;
    
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
    isPlatformCommissionEnabled: boolean; // Affects Creators
    platformCommissionRate: number;
    isPaymentProcessingChargeEnabled: boolean; // Deprecated: replaced by isBrandPlatformFeeEnabled
    paymentProcessingChargeRate: number;
    isGstEnabled: boolean; // Deprecated: replaced by specific flags
    gstRate: number;
    cancellationPenaltyAmount: number; // Penalty for creators cancelling collabs

    // Granular Financial Controls
    isBrandGstEnabled: boolean;
    isBrandPlatformFeeEnabled: boolean;
    isCreatorGstEnabled: boolean;
    
    // Payouts
    isPayoutInstantVerificationEnabled: boolean; // Controls Bank/UPI API availability
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
        brandBannerBoost: DiscountSetting;
    };

    // Admin Configurable Company Details
    companyInfo?: CompanyInfo;
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
    MY_CHANNEL = 'my_channel',
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
    CREATOR_VERIFICATION = 'creator_verification',
    LEADERBOARD = 'leaderboard',
    SHOPPING = 'shopping',
    TRAINING = 'training'
}

export interface ProfileData {
    id: string;
    name: string;
    avatar: string;
    role: UserRole;
    handle?: string;
    companyName?: string;
    bio?: string;
    isVerified?: boolean; // Verified Badge
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
    isVerified?: boolean; // Verified Badge
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
    isVerified?: boolean; // Verified Badge (inherited from Agency user)
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
    deductedPenalty?: number; // Amount deducted from this payout due to penalties
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
    idProofSelfieUrl?: string; // New field for live selfie
    panNumber?: string;
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
    bankDetails?: string;
    upiId?: string;
    panNumber: string;
    timestamp: any;
    collabId?: string;
    idProofSelfieUrl?: string; // New field for live selfie
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
    collabId?: string;
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
    isVerified?: boolean; // Verified Badge (Brand)
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

export interface EmiItem {
    id: string;
    amount: number;
    dueDate: string; // ISO Date string
    status: 'pending' | 'paid' | 'overdue';
    orderId?: string; // If paid
    paidAt?: any;
    description: string; // e.g., "1st EMI (Day 1-30)"
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
    currentOffer?: { amount: string; offeredBy: 'brand' | 'agency'; dailyRate?: number };
    finalAmount?: string;
    paymentStatus?: 'paid' | 'payout_requested' | 'payout_complete';
    workStatus?: 'started' | 'submitted'; // or boolean? Usage implies strings.
    dailyPayoutsReceived?: number;
    rejectionReason?: string;
    timestamp: any;
    collabId?: string;
    
    // New fields for EMI and Daily Rate
    dailyRate?: number;
    paymentPlan?: 'full' | 'emi' | 'subscription';
    emiSchedule?: EmiItem[];
    nextPaymentDueDate?: string;
    subscriptionId?: string;
    subscriptionLink?: string;
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
    currentOffer?: { amount: string; offeredBy: 'brand' | 'agency'; dailyRate?: number };
    finalAmount?: string;
    paymentStatus?: 'paid' | 'payout_requested' | 'payout_complete';
    workStatus?: 'started' | 'submitted';
    dailyPayoutsReceived?: number;
    rejectionReason?: string;
    timestamp: any;
    collabId?: string;

    // New fields for EMI and Daily Rate
    dailyRate?: number;
    paymentPlan?: 'full' | 'emi' | 'subscription';
    emiSchedule?: EmiItem[];
    nextPaymentDueDate?: string;
    subscriptionId?: string;
    subscriptionLink?: string;
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
    type: 'new_collab_request' | 'collab_update' | 'work_submitted' | 'collab_completed' | 'new_campaign_applicant' | 'application_update' | 'new_message' | 'system';
    view: View;
    relatedId?: string;
    isRead: boolean;
    timestamp: any;
}

export type SupportTicketStatus = 'open' | 'in_progress' | 'closed';
export type SupportTicketPriority = 'Low' | 'Medium' | 'High';

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
    senderRole: UserRole;
    text: string;
    attachments: Attachment[];
    timestamp: any;
}

export interface LiveHelpSession {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    status: 'open' | 'closed' | 'unassigned';
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

export interface Post {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    userRole: UserRole;
    text: string;
    imageUrl?: string | null;
    likes: string[];
    commentCount: number;
    timestamp: any;
    isBlocked: boolean;
    visibility: 'public' | 'private';
    isUserVerified?: boolean; // Verified Badge
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

export interface LeaderboardEntry {
    userId: string;
    userName: string;
    userAvatar: string;
    userRole: UserRole;
    score: number;
    rank: number;
}

export interface Leaderboard {
    id: string;
    title: string;
    year: number;
    type: 'earnings' | 'collabs';
    isActive: boolean;
    entries: LeaderboardEntry[];
    createdAt?: any;
}

export type BoostType = 'profile' | 'campaign' | 'banner';

export interface Boost {
    id: string;
    userId: string;
    targetId: string;
    targetType: BoostType;
    expiresAt: any;
    createdAt: any;
}

export interface Dispute {
    id: string;
    collaborationId: string;
    collaborationType: 'direct' | 'campaign' | 'ad_slot' | 'banner_booking';
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
    resolution?: string;
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
    customerId?: string;
    providerName: string;
    providerAvatar: string;
    providerPiNumber?: string;
    providerId?: string;
    date: Date | undefined;
    status: string;
    paymentStatus: string;
    payoutStatus: string;
    originalData: AnyCollaboration;
    visibleCollabId?: string;
    transactionRef?: string;
    disputeStatus?: string;
}