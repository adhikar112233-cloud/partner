

import { Timestamp } from 'firebase/firestore';

// Fix: Define application-wide types to resolve import errors across multiple components and services.
export type UserRole = 'brand' | 'influencer' | 'livetv' | 'banneragency' | 'staff';

export type StaffPermission = 
  | 'super_admin'
  | 'analytics'
  | 'user_management'
  | 'collaborations'
  | 'kyc'
  | 'financial'
  | 'community'
  | 'support'
  | 'marketing'
  | 'live_help';

export type MembershipPlan = 'free' | 'pro_10' | 'pro_20' | 'pro_unlimited' | 'basic' | 'pro' | 'premium';

export interface MembershipUsage {
  directCollaborations: number;
  campaigns: number;
  liveTvBookings: number;
  bannerAdBookings: number;
}

export interface Membership {
  plan: MembershipPlan;
  isActive: boolean; // True for any paid plan
  startsAt: any; // Firestore Timestamp
  expiresAt: any; // Firestore Timestamp
  usage: MembershipUsage;
}

export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface KycDetails {
    address?: string;
    villageTown?: string;
    roadNameArea?: string;
    pincode?: string;
    district?: string;
    state?: string;
    city?: string;
    idProofUrl?: string;
    selfieUrl?: string;
    rejectionReason?: string;
}

export type CreatorVerificationStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface CreatorVerificationDetails {
  // influencer
  socialMediaLinks?: string;
  idNumber?: string; // pan/aadhar/voter

  // agency
  registrationNo?: string;
  msmeNo?: string;
  businessPan?: string;
  tradeLicenseNo?: string;

  // admin
  rejectionReason?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  piNumber?: string;
  mobileNumber?: string;
  companyName?: string;
  role: UserRole;
  avatar?: string;
  location?: string;
  membership: Membership;
  isBlocked?: boolean;
  kycStatus: KycStatus;
  kycDetails?: KycDetails;
  creatorVerificationStatus?: CreatorVerificationStatus;
  creatorVerificationDetails?: CreatorVerificationDetails;
  msmeRegistrationNumber?: string;
  fcmToken?: string; // For push notifications
  staffPermissions?: StaffPermission[];
  notificationPreferences?: {
    enabled: boolean;
  };
}

export interface Influencer {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  bio: string;
  followers: number;
  niche: string;
  engagementRate: number;
  socialMediaLinks?: string;
  location?: string;
  isBoosted?: boolean;
  membershipActive?: boolean;
}

export interface Attachment {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document';
  name: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  attachments?: Attachment[];
  timestamp: any; // Allow for Firestore Timestamp
  participantIds?: string[];
}

export type CollabRequestStatus = 
  | 'pending'           // Initial request from brand
  | 'rejected'          // Rejected by either party
  | 'influencer_offer'  // Influencer made the first offer
  | 'brand_offer'       // Brand made a counter-offer
  | 'agreement_reached' // An offer was accepted, waiting for payment
  | 'in_progress'       // Payment confirmed, work can be started
  | 'work_submitted'    // Influencer marked work as complete
  | 'completed'         // Brand marked work as complete
  | 'disputed'         // Brand marked work as incomplete
  | 'brand_decision_pending' // Admin ruled for brand, brand must decide to complete or refund
  | 'refund_pending_admin_review'; // Brand has requested a refund, awaiting admin action

export interface CollaborationRequest {
  id: string;
  brandId: string;
  influencerId: string;
  brandName: string; 
  brandAvatar: string;
  influencerName: string;
  influencerAvatar: string;
  title: string;
  message: string;
  budget?: string; // Initial budget proposal from brand
  status: CollabRequestStatus;
  timestamp: any; // Firestore Timestamp
  
  // New fields for negotiation and workflow
  rejectionReason?: string;
  currentOffer?: {
      amount: string;
      offeredBy: 'brand' | 'influencer';
  };
  offerHistory?: Array<{
      amount: string;
      offeredBy: 'brand' | 'influencer';
      timestamp: any;
  }>;
  finalAmount?: string;
  paymentStatus?: 'paid' | 'payout_requested' | 'payout_complete';
  workStatus?: 'started';
  collabId?: string;
}

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
  status: 'open' | 'closed';
  timestamp: any;
  applicantIds?: string[];
  location?: string;
  isBoosted?: boolean;
}

export type CampaignApplicationStatus =
  | 'pending_brand_review' // Influencer has applied with an offer
  | 'rejected'             // Rejected by either party
  | 'brand_counter_offer'  // Brand made a counter-offer
  | 'influencer_counter_offer' // Influencer made a counter-offer
  | 'agreement_reached'    // An offer was accepted, waiting for payment
  | 'in_progress'          // Payment confirmed, work can be started
  | 'work_submitted'       // Influencer marked work as complete
  | 'completed'            // Brand marked work as complete
  | 'disputed'            // Brand marked work as incomplete
  | 'brand_decision_pending' // Admin ruled for brand, brand must decide to complete or refund
  | 'refund_pending_admin_review'; // Brand has requested a refund, awaiting admin action

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
  message: string;
  status: CampaignApplicationStatus;
  timestamp: any;

  // New fields for negotiation and workflow
  rejectionReason?: string;
  currentOffer?: {
    amount: string;
    offeredBy: 'brand' | 'influencer';
  };
  offerHistory?: Array<{
    amount: string;
    offeredBy: 'brand' | 'influencer';
    timestamp: any;
  }>;
  finalAmount?: string;
  paymentStatus?: 'paid' | 'payout_requested' | 'payout_complete';
  workStatus?: 'started';
  collabId?: string;
}


export enum View {
  DASHBOARD = 'DASHBOARD',
  COMMUNITY = 'COMMUNITY',
  INFLUENCERS = 'INFLUENCERS',
  MESSAGES = 'MESSAGES',
  LIVETV = 'LIVETV', // For agencies/channels to manage their profile/requests
  BANNERADS = 'BANNERADS', // For agencies to manage their profile/requests
  DISCOVER_LIVETV = 'DISCOVER_LIVETV',
  DISCOVER_BANNERADS = 'DISCOVER_BANNERADS',
  AD_BOOKINGS = 'AD_BOOKINGS', // For brands to manage their TV/Banner requests
  ADMIN = 'ADMIN',
  PROFILE = 'PROFILE',
  COLLAB_REQUESTS = 'COLLAB_REQUESTS',
  MY_COLLABORATIONS = 'MY_COLLABORATIONS', // For brand's direct collabs
  CAMPAIGNS = 'CAMPAIGNS',
  MY_APPLICATIONS = 'MY_APPLICATIONS', // For influencer's campaign applications
  SUPPORT = 'SUPPORT',
  MEMBERSHIP = 'MEMBERSHIP',
  PAYMENT_HISTORY = 'PAYMENT_HISTORY',
  SETTINGS = 'SETTINGS',
  KYC = 'KYC',
  PAYOUT_REQUEST = 'PAYOUT_REQUEST',
  REFUND_REQUEST = 'REFUND_REQUEST',
  BOOST_PROFILE = 'BOOST_PROFILE',
  CREATOR_VERIFICATION = 'CREATOR_VERIFICATION',
  PARTNERS = 'PARTNERS',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
}

export interface SocialMediaLink {
  platform: string;
  url: string;
}

export type BoostType = 'profile' | 'campaign' | 'banner';

export interface Boost {
  id: string;
  userId: string;
  plan: BoostType;
  expiresAt: any; // Firestore Timestamp
  createdAt: any; // Firestore Timestamp
  targetId: string;
  targetType: 'profile' | 'campaign' | 'banner';
}

export interface DiscountSetting {
  isEnabled: boolean;
  percentage: number;
}

export interface PlatformSettings {
  welcomeMessage: string;
  isMessagingEnabled: boolean;
  areInfluencerProfilesPublic: boolean;
  youtubeTutorialUrl: string;
  isNotificationBannerEnabled: boolean;
  notificationBannerText: string;

  payoutSettings: {
    requireLiveVideoForDailyPayout: boolean;
    requireSelfieForPayout: boolean;
  };

  // New settings for admin panel
  isMaintenanceModeEnabled: boolean;
  isCommunityFeedEnabled: boolean;
  isWelcomeMessageEnabled: boolean;
  paymentGatewayApiId: string;
  paymentGatewayApiSecret: string;
  paymentGatewaySourceCode: string;
  otpApiId: string;
  otpApiSecret: string;
  otpApiSourceCode: string;
  isOtpLoginEnabled: boolean;
  isForgotPasswordOtpEnabled: boolean;
  isStaffRegistrationEnabled: boolean;
  isSocialMediaFabEnabled: boolean;
  socialMediaLinks: SocialMediaLink[];
  isDigilockerKycEnabled: boolean;
  digilockerClientId: string;
  digilockerClientSecret: string;
  isKycIdProofRequired: boolean;
  isKycSelfieRequired: boolean;
  isProMembershipEnabled: boolean;
  isCreatorMembershipEnabled: boolean;
  membershipPrices: Record<MembershipPlan, number>;
  gstRate: number;
  isGstEnabled: boolean;
  platformCommissionRate: number;
  isPlatformCommissionEnabled: boolean;
  paymentProcessingChargeRate: number;
  isPaymentProcessingChargeEnabled: boolean;
  isProfileBoostingEnabled: boolean;
  isCampaignBoostingEnabled: boolean;
  boostPrices: Record<BoostType, number>;
  isLiveHelpEnabled: boolean;
  discountSettings: {
    creatorProfileBoost: DiscountSetting;
    brandMembership: DiscountSetting;
    creatorMembership: DiscountSetting;
    brandCampaignBoost: DiscountSetting;
  };
}

export interface ProfileData {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  companyName?: string;
  handle?: string;
  bio?: string;
}

export interface ConversationParticipant {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  handle?: string;
  companyName?: string;
}

export interface Conversation {
  id: string; // The other participant's ID
  participant: ConversationParticipant;
  lastMessage: {
    text: string;
    timestamp: any; // Firestore Timestamp
  };
}

export interface LiveTvChannel {
  id: string;
  name: string;
  logo: string;
  description: string;
  audienceSize: number;
  niche: string;
  ownerId: string;
  isBoosted?: boolean;
}

export type AdBookingStatus = 
  | 'pending_approval' // Initial request from brand
  | 'rejected'
  | 'agency_offer'     // Agency/channel made the first offer
  | 'brand_offer'      // Brand made a counter-offer
  | 'agreement_reached'
  | 'in_progress'
  | 'work_submitted'
  | 'completed'
  | 'disputed'
  | 'brand_decision_pending' // Admin ruled for brand, brand must decide to complete or refund
  | 'refund_pending_admin_review'; // Brand has requested a refund, awaiting admin action

interface AdBookingBase {
  brandId: string;
  brandName: string;
  brandAvatar: string;
  campaignName: string;
  startDate: string; // Keep as string for simplicity, can be parsed
  endDate: string;
  status: AdBookingStatus;
  timestamp: any; // Firestore Timestamp
  
  // Negotiation and workflow fields
  rejectionReason?: string;
  currentOffer?: {
      amount: string;
      offeredBy: 'brand' | 'agency'; // Generic term for TV Channel or Banner Agency
  };
  offerHistory?: Array<{
      amount: string;
      offeredBy: 'brand' | 'agency';
      timestamp: any;
  }>;
  finalAmount?: string;
  paymentStatus?: 'paid' | 'payout_requested' | 'payout_complete';
  workStatus?: 'started';
  dailyPayoutsReceived?: number;
  collabId?: string;
}

export interface AdSlotRequest extends AdBookingBase {
  id: string;
  liveTvId: string;
  liveTvName: string;
  liveTvAvatar: string;
  adType: string;
  url?: string;
}

export interface BannerAd {
  id: string;
  agencyId: string;
  agencyName: string;
  agencyAvatar: string;
  location: string; // City, searchable
  address: string; // Specific address
  photoUrl: string;
  size: string; // e.g., "40x20 ft"
  feePerDay: number;
  bannerType: string; // e.g., "Hoarding", "Digital Billboard"
  timestamp: any;
  isBoosted?: boolean;
}

export interface BannerAdBookingRequest extends AdBookingBase {
  id: string;
  agencyId: string;
  agencyName: string;
  agencyAvatar: string;
  bannerAdId: string;
  bannerAdLocation: string;
}

export type AnyCollaboration = CollaborationRequest | CampaignApplication | AdSlotRequest | BannerAdBookingRequest;

export interface CollaborationStatusItem {
  id: string;
  title: string;
  partnerName: string;
  partnerAvatar: string;
  status: CollabRequestStatus | CampaignApplication['status'] | AdBookingStatus;
  timestamp: any;
  type: 'collab-request-sent' | 'collab-request-received' | 'campaign-application-sent' | 'campaign-application-received' | 'ad-slot-request' | 'banner-booking-request';
  view: View;
}

export type SupportTicketStatus = 'open' | 'in_progress' | 'closed';
export type SupportTicketPriority = 'Low' | 'Medium' | 'High';

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
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
    timestamp: any; // Firestore Timestamp
}

export interface PayoutRequest {
  id: string; // doc id
  userId: string; // influencerId, agencyId, etc.
  userName: string;
  userAvatar: string;
  collaborationId: string;
  collaborationType: 'direct' | 'campaign' | 'ad_slot' | 'banner_booking';
  collaborationTitle: string;
  bankDetails?: string;
  upiId?: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'on_hold' | 'processing';
  rejectionReason?: string;
  timestamp: any;
  idProofSelfieUrl?: string;
  collabId?: string;
}

export interface DailyPayoutRequest {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  collaborationId: string;
  collabId?: string;
  collaborationType: 'ad_slot' | 'banner_booking';
  videoUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'on_hold' | 'processing';
  rejectionReason?: string;
  approvedAmount?: number;
  timestamp: any; // Firestore Timestamp
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userRole: UserRole;
  text: string;
  imageUrl?: string;
  likes: string[]; // Array of user IDs who liked it
  commentCount: number;
  timestamp: any; // Firestore Timestamp
  isBlocked?: boolean;
  visibility?: 'public' | 'private'; // Added visibility field
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: any; // Firestore Timestamp
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
  status: 'open' | 'resolved';
  timestamp: any; // Firestore Timestamp
  amount?: number;
  collabId?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'payment';
  description: string;
  relatedId: string;
  collabId?: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  transactionId: string;
  timestamp: any;
}

export interface PlatformBanner {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  isActive: boolean;
  createdAt: any; // Firestore Timestamp
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  targetUrl?: string;
  sentAt: any; // Firestore Timestamp
}

export interface LiveHelpSession {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  assignedStaffAvatar?: string;
  status: 'unassigned' | 'open' | 'closed';
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  userHasUnread: boolean;
  staffHasUnread: boolean;
}

export interface LiveHelpMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any; // Firestore Timestamp
}

export interface RefundRequest {
  id: string; // doc id
  // FIX: Renamed 'collabId' to 'collaborationId' to fix duplicate identifier error and align with other types.
  collaborationId: string;
  collabType: 'direct' | 'campaign' | 'ad_slot' | 'banner_booking';
  collabTitle: string;
  brandId: string;
  brandName: string;
  brandAvatar: string;
  amount: number;
  bankDetails: string;
  panNumber: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'on_hold' | 'processing';
  rejectionReason?: string;
  timestamp: any; // Firestore Timestamp
  collabId?: string;
}

// Fix: Moved CombinedCollabItem from AdminPanel.tsx to types.ts to be shared across components.
export interface CombinedCollabItem {
  id: string;
  type: 'Direct' | 'Campaign' | 'Live TV' | 'Banner Ad';
  title: string;
  customerName: string;
  customerAvatar: string;
  customerPiNumber?: string;
  providerName: string;
  providerAvatar: string;
  providerPiNumber?: string;
  date: Date | undefined;
  status: CollabRequestStatus | CampaignApplicationStatus | AdBookingStatus;
  paymentStatus: 'Paid' | 'Unpaid';
  payoutStatus: 'N/A' | 'Requested' | 'Completed';
  originalData: AnyCollaboration;
}

export interface QuickReply {
  id: string;
  text: string;
  createdAt: any; // Firestore Timestamp
}

export type NotificationType = 
  | 'new_collab_request' 
  | 'collab_update' 
  | 'new_campaign_applicant' 
  | 'application_update' 
  | 'work_submitted' 
  | 'collab_completed' 
  | 'new_message'
  | 'payout_status' 
  | 'dispute_update'
  | 'ad_booking_request'
  | 'ad_booking_update';

export interface AppNotification {
  id: string;
  userId: string; // The user who should receive this notification
  title: string;
  body: string;
  type: NotificationType;
  relatedId: string; // e.g., the collab request ID
  view: View; // The view to navigate to on click
  isRead: boolean;
  timestamp: any; // Firestore Timestamp
  actor?: { // The person who performed the action
    name: string;
    avatar: string;
  };
}

export interface Partner {
  id: string;
  name: string;
  logoUrl: string;
  createdAt: any; // Firestore Timestamp
}
