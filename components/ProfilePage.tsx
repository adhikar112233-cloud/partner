import React, { useState, useEffect, useRef } from 'react';
import { User, MembershipPlan, PlatformSettings, View } from '../types';
import { apiService } from '../services/apiService';
import DailyPayoutRequestModal from './DailyPayoutRequestModal';
import { Timestamp } from 'firebase/firestore';

interface ProfilePageProps {
  user: User;
  onProfileUpdate: (updatedUser: User) => void;
  onGoToMembership: () => void;
  platformSettings: PlatformSettings;
  onGoToDashboard: () => void;
  setActiveView: (view: View) => void;
}

const DEFAULT_AVATAR_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDRjMCAwIDAtMSAwLTJoMTJ2Mmg0di00YzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==';

const isValidIndianMobile = (mobile: string): boolean => {
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(mobile);
};

const indianCities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh'
];

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
    <button
        type="button"
        className={`${
            enabled ? 'bg-indigo-600' : 'bg-gray-200'
        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
    >
        <span
            aria-hidden="true"
            className={`${
                enabled ? 'translate-x-5' : 'translate-x-0'
            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onProfileUpdate, onGoToMembership, platformSettings, onGoToDashboard, setActiveView }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    mobileNumber: user.mobileNumber || '',
    companyName: user.companyName || '',
    socialMediaLinks: '', // Added for influencer profile
    location: user.location || '',
    msmeRegistrationNumber: user.msmeRegistrationNumber || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDailyPayoutModal, setShowDailyPayoutModal] = useState(false);

  useEffect(() => {
    // Fetch influencer-specific profile data if user is an influencer
    const fetchInfluencerData = async () => {
      if (user.role === 'influencer') {
        const influencerProfile = await apiService.getInfluencerProfile(user.id);
        setFormData({
          name: user.name,
          mobileNumber: user.mobileNumber || '',
          companyName: user.companyName || '',
          socialMediaLinks: influencerProfile?.socialMediaLinks || '',
          location: influencerProfile?.location || user.location || '',
          msmeRegistrationNumber: user.msmeRegistrationNumber || '',
        });
      } else {
         setFormData({
          name: user.name,
          mobileNumber: user.mobileNumber || '',
          companyName: user.companyName || '',
          socialMediaLinks: '',
          location: user.location || '',
          msmeRegistrationNumber: user.msmeRegistrationNumber || '',
        });
      }
      setImagePreview(null);
      setImageFile(null);
    }
    fetchInfluencerData();
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === 'mobileNumber') {
        if (value && !isValidIndianMobile(value)) {
            setMobileError("Please enter a valid 10-digit mobile number.");
        } else {
            setMobileError(null);
        }
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setSuccess(null);
    }
  };

  const handleCancel = () => {
    // Re-fetch original data to discard changes
    const fetchOriginalData = async () => {
        const influencerProfile = user.role === 'influencer' ? await apiService.getInfluencerProfile(user.id) : null;
        setFormData({
            name: user.name,
            mobileNumber: user.mobileNumber || '',
            companyName: user.companyName || '',
            socialMediaLinks: influencerProfile?.socialMediaLinks || '',
            location: influencerProfile?.location || user.location || '',
            msmeRegistrationNumber: user.msmeRegistrationNumber || '',
        });
    };
    fetchOriginalData();
    setIsEditing(false);
    setError(null);
    setMobileError(null);
    setSuccess(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let avatarUrl = user.avatar;

      if (imageFile) {
        avatarUrl = await apiService.uploadProfilePicture(user.id, imageFile);
      }

      const userProfileData: Partial<Pick<User, 'name' | 'mobileNumber' | 'companyName' | 'avatar' | 'location' | 'msmeRegistrationNumber'>> = {
        name: formData.name,
        mobileNumber: formData.mobileNumber,
        companyName: formData.companyName,
        avatar: avatarUrl,
        location: formData.location,
        msmeRegistrationNumber: formData.msmeRegistrationNumber,
      };
      
      const userUpdatePromise = apiService.updateUserProfile(user.id, userProfileData);
      
      const influencerUpdatePromise = user.role === 'influencer' 
        ? apiService.updateInfluencerProfile(user.id, { 
            socialMediaLinks: formData.socialMediaLinks, 
            avatar: avatarUrl,
            location: formData.location 
          }) 
        : Promise.resolve();
        
      await Promise.all([userUpdatePromise, influencerUpdatePromise]);

      const updatedUser: User = { 
        ...user, 
        name: formData.name,
        mobileNumber: formData.mobileNumber,
        companyName: formData.companyName,
        avatar: avatarUrl,
        location: formData.location,
        msmeRegistrationNumber: formData.msmeRegistrationNumber,
       };

      onProfileUpdate(updatedUser);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

// Fix: Added 'isEditing' to the props interface to resolve TypeScript error.
  const InfoRow: React.FC<{ label: string; value: React.ReactNode; isEditable?: boolean; name?: string; type?: string; multiline?: boolean; children?: React.ReactNode; isEditing?: boolean; }> = ({ label, value, isEditable = false, name = '', type = 'text', multiline = false, children, isEditing }) => (
    <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-4 sm:px-6">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
        {isEditing && isEditable ? (
          children || (
          multiline ? (
            <textarea
              name={name}
              id={name}
              rows={3}
              value={formData[name as keyof typeof formData]}
              onChange={handleInputChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g., https://instagram.com/user, https://youtube.com/user"
            />
          ) : (
            <input
              type={type}
              name={name}
              id={name}
              value={formData[name as keyof typeof formData]}
              onChange={handleInputChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          ))
        ) : (
          value
        )}
      </dd>
    </div>
  );

  const DailyPayoutSection = () => {
    if (user.role === 'livetv' || user.role === 'banneragency') {
      return (
        <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-xl font-bold leading-6 text-gray-900">Daily Payout</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Request a partial payout for active collaborations.</p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <p className="text-sm text-gray-600 mb-4">
              You can request a daily payout for any collaboration that is currently in progress.
            </p>
            <button
              onClick={() => setShowDailyPayoutModal(true)}
              className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent bg-teal-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
            >
              Request Payout Daily
            </button>
          </div>
        </div>
      )
    }
    return null;
  }

  const MembershipSection = () => {
    const { membership } = user;
    
    const effectiveMembership = membership || {
        plan: 'free' as MembershipPlan,
        isActive: false,
        expiresAt: null,
        usage: { directCollaborations: 0, campaigns: 0, liveTvBookings: 0, bannerAdBookings: 0 }
    };

    const { plan, isActive, expiresAt, usage } = effectiveMembership;
    
    const isCurrentlyActive = effectiveMembership.isActive && expiresAt && (expiresAt as Timestamp).toDate() > new Date();

    const expiryDate = (expiresAt as Timestamp)?.toDate?.()?.toLocaleDateString() ?? 'N/A';

    // FIX: Replaced incorrect 'normal_*' keys with the correct 'basic', 'pro', and 'premium' from the MembershipPlan type.
    const usageLimits: Record<MembershipPlan, number | typeof Infinity> = {
        free: 1,
        pro_10: 10,
        pro_20: 20,
        pro_unlimited: Infinity,
        basic: Infinity,
        pro: Infinity,
        premium: Infinity,
    };
    const limit = usageLimits[plan] ?? 0;
    
    const getLimitText = () => {
        if (isCreator) return 'Unlimited Visibility';
        if (limit === Infinity) return 'Unlimited';
        return `${limit} / type / year`;
    }


    return (
        <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center flex-wrap gap-2">
                <div>
                    <h3 className="text-xl font-bold leading-6 text-gray-900">My Membership</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">Your current subscription and usage details.</p>
                </div>
                <button
                    onClick={onGoToMembership}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 whitespace-nowrap"
                >
                    Upgrade Plan
                </button>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Current Plan</dt>
                        <dd className="mt-1 text-sm text-gray-900 capitalize font-semibold">{plan.replace(/_/g, ' ')}</dd>
                    </div>
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isCurrentlyActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {isCurrentlyActive ? 'Active' : 'Inactive'}
                            </span>
                        </dd>
                    </div>
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Expires On</dt>
                        <dd className="mt-1 text-sm text-gray-900">{expiryDate}</dd>
                    </div>
                     <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Limit</dt>
                        <dd className="mt-1 text-sm text-gray-900 font-semibold">{getLimitText()}</dd>
                    </div>
                    
                    <div className="sm:col-span-2">
                        {user.role === 'brand' && usage && (
                            <>
                                <dt className="text-sm font-medium text-gray-500">Usage this cycle</dt>
                                <dd className="mt-2 text-sm text-gray-900 space-y-1">
                                    <p>Direct Collaborations: {usage.directCollaborations} / {limit === Infinity ? '∞' : limit}</p>
                                    <p>Campaigns Created: {usage.campaigns} / {limit === Infinity ? '∞' : limit}</p>
                                    <p>Live TV Bookings: {usage.liveTvBookings} / {limit === Infinity ? '∞' : limit}</p>
                                    <p>Banner Ad Bookings: {usage.bannerAdBookings} / {limit === Infinity ? '∞' : limit}</p>
                                </dd>
                            </>
                        )}
                        
                        {isCreator && isCurrentlyActive && (
                            <>
                                <dt className="text-sm font-medium text-gray-500">Benefit</dt>
                                <dd className="mt-1 text-sm text-green-700 font-semibold">Your profile is visible to all brands on the platform.</dd>
                            </>
                        )}

                        {!isCurrentlyActive && (
                            <div className="p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                                {isCreator 
                                    ? "Your profile is not visible to brands with an inactive membership. Activate a plan to start receiving collaboration requests."
                                    : "Your free plan has limits. Upgrade to a Pro plan to unlock more features and collaborations."
                                }
                            </div>
                        )}
                    </div>
                </dl>
            </div>
        </div>
    );
  };

  const CreatorVerificationSection = () => {
    const status = user.creatorVerificationStatus || 'not_submitted';
    const statusMap = {
      not_submitted: { text: "Not Verified", color: "bg-gray-100 text-gray-800" },
      pending: { text: "Pending Review", color: "bg-yellow-100 text-yellow-800" },
      approved: { text: "Verified", color: "bg-green-100 text-green-800" },
      rejected: { text: "Rejected", color: "bg-red-100 text-red-800" },
    };

    return (
         <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
            <div className="px-4 py-5 sm:px-6">
                <h3 className="text-xl font-bold leading-6 text-gray-900">Creator Verification</h3>
                 <p className="mt-1 max-w-2xl text-sm text-gray-500">Verify your identity to build trust with brands.</p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Your Status</p>
                        <span className={`mt-1 px-3 py-1 text-sm font-semibold rounded-full ${statusMap[status].color}`}>
                            {statusMap[status].text}
                        </span>
                    </div>
                    <button
                        onClick={() => setActiveView(View.CREATOR_VERIFICATION)}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                        {status === 'not_submitted' || status === 'rejected' ? 'Submit Details' : 'View/Update Details'}
                    </button>
                </div>
                 {status === 'rejected' && user.creatorVerificationDetails?.rejectionReason && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
                        <p className="font-semibold">Reason for rejection:</p>
                        <p>{user.creatorVerificationDetails.rejectionReason}</p>
                    </div>
                )}
            </div>
        </div>
    );
  };

  const isCreator = ['influencer', 'livetv', 'banneragency'].includes(user.role);

  return (
    <>
    <div className="space-y-6 w-full">
      <form onSubmit={handleSave}>
        <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button 
                    onClick={onGoToDashboard} 
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-colors dark:bg-gray-700 dark:text-indigo-300 dark:hover:bg-gray-600"
                >
                    &larr; Back to Dashboard
                </button>
                <div>
                  <h3 className="text-xl font-bold leading-6 text-gray-900">My Profile</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">Your personal details.</p>
                </div>
            </div>
            {!isEditing && (
              <button
                type="button"
                onClick={() => { setIsEditing(true); setSuccess(null); }}
                className="ml-4 flex-shrink-0 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                Edit
              </button>
            )}
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
                <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Avatar</dt>
                    <dd className="mt-1 flex text-sm text-gray-900 sm:col-span-2 sm:mt-0 items-center">
                        <span className="h-16 w-16 overflow-hidden rounded-full bg-gray-100">
                            <img src={imagePreview || user.avatar || DEFAULT_AVATAR_URL} alt="User avatar" className="h-full w-full object-cover" />
                        </span>
                        {isEditing && (
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="ml-5 rounded-md border border-gray-300 bg-white py-2 px-3 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50">
                                Change
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                    </dd>
                </div>
              <InfoRow label="Full Name" value={formData.name} isEditable name="name" isEditing={isEditing} />
              <InfoRow label="Email Address" value={user.email} isEditing={isEditing} />
              <InfoRow label="Profile ID" value={<span className="font-mono">{user.piNumber || 'N/A'}</span>} isEditing={false} />
              <InfoRow label="Mobile Number" value={formData.mobileNumber} isEditable name="mobileNumber" type="tel" isEditing={isEditing}>
                  <div>
                      <input
                          type="tel"
                          name="mobileNumber"
                          id="mobileNumber"
                          value={formData.mobileNumber}
                          onChange={handleInputChange}
                          className={`block w-full rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${mobileError ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {mobileError && <p className="mt-1 text-xs text-red-500">{mobileError}</p>}
                  </div>
              </InfoRow>
              {(user.role === 'brand' || user.role === 'livetv' || user.role === 'banneragency') && <InfoRow label="Company Name" value={formData.companyName} isEditable name="companyName" isEditing={isEditing} />}
              {user.role === 'influencer' && <InfoRow label="Social Media Links" value={formData.socialMediaLinks || 'Not provided'} isEditable name="socialMediaLinks" multiline isEditing={isEditing} />}
              {(user.role === 'livetv' || user.role === 'banneragency') && <InfoRow label="MSME Registration No." value={formData.msmeRegistrationNumber || 'Not provided'} isEditable name="msmeRegistrationNumber" isEditing={isEditing} />}
              
                <InfoRow label="Location" value={formData.location || 'Not Set'} isEditable name="location" isEditing={isEditing}>
                    <select name="location" value={formData.location} onChange={handleInputChange} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                        <option value="">Select City</option>
                        {indianCities.sort().map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                </InfoRow>

            </dl>
          </div>
          {isEditing && (
            <div className="bg-gray-50 px-4 py-4 sm:px-6 text-right flex justify-end gap-2">
              <button type="button" onClick={handleCancel} className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={isLoading || !!mobileError} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                {isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </form>

      {success && <div className="mt-4 p-4 text-sm text-green-700 bg-green-100 rounded-lg">{success}</div>}
      {error && <div className="mt-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}

      <MembershipSection />
      {isCreator && <CreatorVerificationSection />}
      <DailyPayoutSection />
      
      {showDailyPayoutModal && (
        <DailyPayoutRequestModal 
          user={user}
          onClose={() => setShowDailyPayoutModal(false)}
          platformSettings={platformSettings}
        />
      )}
    </div>
    </>
  );
};

export default ProfilePage;
