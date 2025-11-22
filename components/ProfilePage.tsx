









import React, { useState, useEffect, useRef } from 'react';
import { User, MembershipPlan, PlatformSettings, View } from '../types';
import { apiService } from '../services/apiService';
import DailyPayoutRequestModal from './DailyPayoutRequestModal';
import { Timestamp } from 'firebase/firestore';
import { GiftIcon, CoinIcon } from './Icons';

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

const toJsDate = (ts: any): Date | undefined => {
    if (!ts) return undefined;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    if (ts.seconds !== undefined && ts.nanoseconds !== undefined) return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
    return undefined;
};

// Referral Section Component
const ReferralSection: React.FC<{ user: User; onUpdateUser: (updates: Partial<User>) => void }> = ({ user, onUpdateUser }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [redeemCode, setRedeemCode] = useState('');
    const [redeemStatus, setRedeemStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [redeemMessage, setRedeemMessage] = useState('');

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const code = await apiService.generateReferralCode(user.id);
            onUpdateUser({ referralCode: code });
        } catch (error: any) {
            console.error("Failed to generate code:", error);
            alert("Failed to generate referral code. Please check your connection and try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRedeem = async () => {
        if (!redeemCode.trim()) return;
        setRedeemStatus('processing');
        setRedeemMessage('');
        try {
            await apiService.applyReferralCode(user.id, redeemCode.trim());
            setRedeemStatus('success');
            setRedeemMessage('Code redeemed! +20 Coins added to your wallet.');
            // Optimistic update, actual data refresh usually happens via parent or refresh logic
            onUpdateUser({ 
                referredBy: redeemCode.trim(), 
                coins: (user.coins || 0) + 20 
            });
        } catch (error: any) {
            console.error("Redeem failed:", error);
            setRedeemStatus('error');
            setRedeemMessage(error.message || 'Invalid code or already redeemed.');
        }
    };

    const shareLink = user.referralCode ? `${window.location.origin}/?ref=${user.referralCode}` : '';

    const copyLink = () => {
        if (shareLink) {
            navigator.clipboard.writeText(shareLink);
            alert("Referral link copied to clipboard!");
        }
    };

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6 shadow-inner border border-indigo-100 dark:border-gray-600">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-full shadow-sm">
                        <GiftIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Rewards & Referrals</h3>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm border border-yellow-200">
                    <CoinIcon className="w-5 h-5 text-yellow-500" />
                    <span className="font-bold text-gray-800 dark:text-gray-100">{user.coins || 0} Coins</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Share Section */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300">Share & Earn</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Share your unique code. You get 50 coins, they get 20!</p>
                    
                    {user.referralCode ? (
                        <div className="space-y-3">
                            <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-dashed border-indigo-300 flex justify-between items-center">
                                <span className="font-mono font-bold text-lg text-indigo-600 tracking-wider">{user.referralCode}</span>
                                <span className="text-xs text-green-600 font-medium bg-green-100 px-2 py-1 rounded">Active</span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Share this link:</p>
                                <div className="flex gap-2">
                                    <input 
                                        id="referralLink" 
                                        readOnly 
                                        value={shareLink} 
                                        className="flex-1 text-xs p-2 border rounded bg-gray-50 dark:bg-gray-800 dark:text-gray-300" 
                                    />
                                    <button onClick={copyLink} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">Copy</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={handleGenerate} 
                            disabled={isGenerating}
                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {isGenerating ? 'Generating...' : 'Generate Referral Code'}
                        </button>
                    )}
                </div>

                {/* Redeem Section */}
                <div className="space-y-4 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-600 pt-6 md:pt-0 md:pl-8">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300">Have a Code?</h4>
                    
                    {user.referredBy ? (
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                            <p className="text-green-800 dark:text-green-300 text-sm">
                                <span className="font-bold">Referral Applied!</span><br/>
                                You were referred by code: <span className="font-mono">{user.referredBy}</span>
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <input 
                                type="text" 
                                placeholder="Enter Referral Code" 
                                value={redeemCode}
                                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                            />
                            <button 
                                onClick={handleRedeem}
                                disabled={!redeemCode || redeemStatus === 'processing'}
                                className="w-full py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
                            >
                                {redeemStatus === 'processing' ? 'Applying...' : 'Redeem Code'}
                            </button>
                            {redeemMessage && (
                                <p className={`text-xs ${redeemStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {redeemMessage}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

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

  const handleUserUpdate = (updates: Partial<User>) => {
      onProfileUpdate({ ...user, ...updates });
  };

  const InfoRow: React.FC<{ label: string; value: React.ReactNode; isEditable?: boolean; name?: string; type?: string; multiline?: boolean; children?: React.ReactNode; isEditing?: boolean; }> = ({ label, value, isEditable = false, name = '', type = 'text', multiline = false, children, isEditing }) => (
    <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-4 sm:px-6">
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:col-span-2 sm:mt-0">
        {isEditing && isEditable ? (
            children ? children : (
                multiline ? 
                <textarea name={name} value={String(value)} onChange={handleInputChange} rows={3} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" /> :
                <input type={type} name={name} value={String(value)} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            )
        ) : (
          value
        )}
      </dd>
    </div>
  );

  const isMembershipActive = user.membership?.isActive && user.membership.expiresAt && toJsDate(user.membership.expiresAt)! > new Date();
  
  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sm:p-10 text-white relative">
         <button onClick={onGoToDashboard} className="absolute top-4 left-4 text-white opacity-80 hover:opacity-100">
            &larr; Dashboard
         </button>
        <div className="flex flex-col sm:flex-row items-center">
          <div className="relative group">
            <img 
              src={imagePreview || user.avatar} 
              alt={user.name} 
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white object-cover shadow-md"
            />
            {isEditing && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <span className="text-xs font-semibold">Change</span>
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                </div>
            )}
          </div>
          
          <div className="mt-4 sm:mt-0 sm:ml-6 text-center sm:text-left">
            <h1 className="text-3xl font-bold">{user.name}</h1>
            <p className="text-indigo-100 font-medium">{user.email}</p>
            <p className="text-indigo-200 text-sm mt-1 capitalize">{user.role}</p>
            {user.role === 'influencer' && (
               <button onClick={() => setActiveView(View.BOOST_PROFILE)} className="mt-2 text-xs bg-purple-500 hover:bg-purple-400 px-3 py-1 rounded-full font-semibold transition-colors shadow-sm">
                   Boost Profile 🚀
               </button>
            )}
          </div>
          
          <div className="mt-6 sm:mt-0 sm:ml-auto flex flex-col gap-2">
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="bg-white text-indigo-600 px-6 py-2 rounded-full font-semibold shadow-md hover:bg-gray-100 transition-all">
                Edit Profile
              </button>
            ) : (
              <div className="flex space-x-2">
                <button onClick={handleSave} disabled={isLoading} className="bg-green-500 text-white px-4 py-2 rounded-full font-semibold shadow-md hover:bg-green-600 disabled:opacity-50">
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button onClick={handleCancel} disabled={isLoading} className="bg-white text-gray-600 px-4 py-2 rounded-full font-semibold shadow-md hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-4" role="alert"><p>{error}</p></div>}
      {mobileError && <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 m-4" role="alert"><p>{mobileError}</p></div>}
      {success && <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 m-4" role="alert"><p>{success}</p></div>}

      {/* Referral Section */}
      <div className="px-4 py-5 sm:px-6">
          <ReferralSection user={user} onUpdateUser={handleUserUpdate} />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
        <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
          <InfoRow label="Full Name" value={user.name} name="name" isEditable={true} isEditing={isEditing} />
          <InfoRow label="Profile ID" value={<span className="font-mono text-gray-600 dark:text-gray-400">{user.piNumber}</span>} />
          <InfoRow label="Email Address" value={user.email} />
          <InfoRow label="Mobile Number" value={user.mobileNumber || 'Not provided'} name="mobileNumber" isEditable={true} isEditing={isEditing} />
          <InfoRow label="Company / Channel Name" value={user.companyName || 'N/A'} name="companyName" isEditable={true} isEditing={isEditing} />
          <InfoRow label="Location" value={user.location || 'Not specified'} name="location" isEditable={true} isEditing={isEditing}>
             <select name="location" value={formData.location} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                <option value="">Select Location</option>
                {indianCities.sort().map(city => <option key={city} value={city}>{city}</option>)}
             </select>
          </InfoRow>
          
          {user.role === 'influencer' && (
             <InfoRow label="Social Media Links" value={formData.socialMediaLinks || 'No links added'} name="socialMediaLinks" isEditable={true} multiline={true} isEditing={isEditing} />
          )}

          <InfoRow label="MSME Registration" value={user.msmeRegistrationNumber || 'N/A'} name="msmeRegistrationNumber" isEditable={true} isEditing={isEditing} />

          <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Status</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:col-span-2 sm:mt-0 flex items-center space-x-2">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${!user.isBlocked ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isBlocked ? 'Blocked' : 'Active'}
                </span>
            </dd>
          </div>
          
          <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-4 sm:px-6 bg-gray-50 dark:bg-gray-700/50">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Membership Plan</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:col-span-2 sm:mt-0 flex items-center justify-between">
                <div>
                    <span className="font-semibold capitalize">{user.membership?.plan.replace(/_/g, ' ')}</span>
                    {isMembershipActive && <span className="ml-2 text-green-600 text-xs">(Active)</span>}
                    {!isMembershipActive && <span className="ml-2 text-red-500 text-xs">(Inactive)</span>}
                    {user.membership?.expiresAt && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Expires: {toJsDate(user.membership.expiresAt)?.toLocaleDateString()}</p>
                    )}
                </div>
                <button onClick={onGoToMembership} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium">
                    {isMembershipActive ? 'Manage Plan' : 'Upgrade'}
                </button>
            </dd>
          </div>

          <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">KYC Verification</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:col-span-2 sm:mt-0 flex items-center justify-between">
               <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.kycStatus === 'approved' ? 'bg-green-100 text-green-800' : 
                    user.kycStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
                }`}>
                    {user.kycStatus === 'not_submitted' ? 'Not Submitted' : user.kycStatus.replace('_', ' ')}
                </span>
                {user.kycStatus !== 'approved' && user.kycStatus !== 'pending' && (
                    <button onClick={() => setActiveView(View.KYC)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 text-sm font-medium">Verify Now</button>
                )}
            </dd>
          </div>
          
          {(user.role === 'influencer' || user.role === 'livetv' || user.role === 'banneragency') && (
             <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-4 sm:px-6 bg-gray-50 dark:bg-gray-700/50">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Creator Verification</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:col-span-2 sm:mt-0 flex items-center justify-between">
                   <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.creatorVerificationStatus === 'approved' ? 'bg-green-100 text-green-800' : 
                        user.creatorVerificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-gray-100 text-gray-800'
                    }`}>
                        {user.creatorVerificationStatus === 'not_submitted' ? 'Not Verified' : user.creatorVerificationStatus?.replace('_', ' ')}
                    </span>
                    {user.creatorVerificationStatus !== 'approved' && user.creatorVerificationStatus !== 'pending' && (
                        <button onClick={() => setActiveView(View.CREATOR_VERIFICATION)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 text-sm font-medium">Get Verified Badge</button>
                    )}
                </dd>
              </div>
          )}

          {(user.role === 'livetv' || user.role === 'banneragency') && (
             <div className="py-3 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 px-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Daily Payouts</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:col-span-2 sm:mt-0 flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Request payouts for active campaigns</span>
                    <button onClick={() => setShowDailyPayoutModal(true)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 text-sm font-medium">Request Now</button>
                </dd>
             </div>
          )}
        </dl>
      </div>
      {showDailyPayoutModal && <DailyPayoutRequestModal user={user} onClose={() => setShowDailyPayoutModal(false)} platformSettings={platformSettings} />}
    </div>
  );
};

export default ProfilePage;
