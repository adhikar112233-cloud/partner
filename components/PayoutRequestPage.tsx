
import React, { useState, useMemo, useEffect } from 'react';
import { User, AnyCollaboration, PayoutRequest, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import CameraCapture from './CameraCapture';
import { CheckBadgeIcon, PencilIcon } from './Icons';

interface PayoutRequestPageProps {
    user: User;
    collaboration: AnyCollaboration;
    platformSettings: PlatformSettings;
    onClose: () => void;
    onSubmitted: () => void;
}

const PayoutRequestPage: React.FC<PayoutRequestPageProps> = ({ user, collaboration, platformSettings, onClose, onSubmitted }) => {
    const [payoutMethod, setPayoutMethod] = useState<'bank' | 'upi'>('bank');
    
    // Bank State
    const [bankDetails, setBankDetails] = useState({
        accountHolderName: user.savedBankDetails?.accountHolderName || '',
        accountNumber: user.savedBankDetails?.accountNumber || '',
        ifscCode: user.savedBankDetails?.ifscCode || '',
        bankName: user.savedBankDetails?.bankName || '',
    });
    
    // UPI State
    const [upiId, setUpiId] = useState(user.savedUpiId || '');
    
    // Verification Status
    const [isBankVerified, setIsBankVerified] = useState(!!user.savedBankDetails?.isVerified);
    const [isUpiVerified, setIsUpiVerified] = useState(!!user.isUpiVerified);
    const [isEditing, setIsEditing] = useState(false);

    const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Check Admin Setting
    const isVerificationEnforced = platformSettings.isPayoutInstantVerificationEnabled;

    // Memoize title computation
    const collaborationTitle = useMemo(() => {
        if ('title' in collaboration) return collaboration.title;
        if ('campaignTitle' in collaboration) return collaboration.campaignTitle;
        if ('campaignName' in collaboration) return collaboration.campaignName;
        return 'Untitled Collaboration';
    }, [collaboration]);

    // --- Calculation Logic for Creators ---
    const finalAmountRaw = collaboration?.finalAmount ? parseFloat(String(collaboration.finalAmount).replace(/[^0-9.-]+/g, "")) : 0;
    const finalAmount = isNaN(finalAmountRaw) ? 0 : finalAmountRaw;
    const dailyPayoutsReceived = 'dailyPayoutsReceived' in collaboration ? collaboration.dailyPayoutsReceived || 0 : 0;

    // Use specific flags for Creators
    const commission = platformSettings.isPlatformCommissionEnabled ? finalAmount * (platformSettings.platformCommissionRate / 100) : 0;
    
    // GST applied on Commission amount only
    const gstOnCommission = platformSettings.isCreatorGstEnabled ? commission * (platformSettings.gstRate / 100) : 0;
    
    // Penalty Calculation
    const pendingPenalty = user.pendingPenalty || 0;
    
    const totalDeductions = commission + gstOnCommission + dailyPayoutsReceived + pendingPenalty;
    const finalPayoutAmount = Math.max(0, finalAmount - totalDeductions);

    // --- Helper to convert Data URL to File ---
    const dataURLtoFile = (dataurl: string, filename: string): File => {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) throw new Error("Invalid Data URL");
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, {type:mime});
    }

    const getCollaborationType = (): PayoutRequest['collaborationType'] => {
        if ('campaignId' in collaboration) return 'campaign';
        if ('influencerId' in collaboration) return 'direct';
        if ('liveTvId' in collaboration) return 'ad_slot';
        if ('agencyId' in collaboration) return 'banner_booking';
        throw new Error('Could not determine collaboration type');
    };

    const handleBankDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setBankDetails(prev => ({ ...prev, [name]: value }));
        // If verification is enforced, editing invalidates verification status
        if (isVerificationEnforced) {
            setIsBankVerified(false); 
        }
    };

    const handleUpiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUpiId(e.target.value);
        if (isVerificationEnforced) {
            setIsUpiVerified(false); 
        }
    };

    // --- Verification ---
    const handleVerifyPaymentDetails = async () => {
        setError(null);
        setSuccessMessage(null);
        setIsVerifying(true);

        try {
            if (payoutMethod === 'bank') {
                if (!bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
                    throw new Error("Please fill all bank fields.");
                }
                const res = await apiService.verifyBankAccount(user.id, bankDetails.accountNumber, bankDetails.ifscCode, bankDetails.accountHolderName);
                
                if (res.success) {
                    const updatedBankDetails = { ...bankDetails, isVerified: true };
                    await apiService.updateUserProfile(user.id, { savedBankDetails: updatedBankDetails });
                    setIsBankVerified(true);
                    setIsEditing(false);
                    setSuccessMessage(`Bank Verified! Registered Name: ${res.registeredName}`);
                } else {
                    throw new Error("Bank verification failed. Name mismatch or invalid details.");
                }
            } else {
                if (!upiId) throw new Error("Please enter UPI ID.");
                const res = await apiService.verifyUpi(user.id, upiId, user.name);
                if (res.success) {
                    await apiService.updateUserProfile(user.id, { savedUpiId: upiId, isUpiVerified: true });
                    setIsUpiVerified(true);
                    setIsEditing(false);
                    setSuccessMessage(`UPI Verified! Registered Name: ${res.registeredName}`);
                } else {
                    throw new Error("UPI verification failed.");
                }
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Verification failed.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Verification Check
        if (isVerificationEnforced) {
            if (payoutMethod === 'bank' && !isBankVerified) {
                setError("Please verify your bank account details first.");
                return;
            }
            if (payoutMethod === 'upi' && !isUpiVerified) {
                setError("Please verify your UPI ID first.");
                return;
            }
        } else {
            // Manual Check
            if (payoutMethod === 'bank') {
                if (!bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
                    setError("Please fill all bank fields.");
                    return;
                }
            } else {
                if (!upiId) {
                    setError("Please enter UPI ID.");
                    return;
                }
            }
        }

        if (platformSettings.payoutSettings.requireSelfieForPayout && !selfieDataUrl) {
            setError('A live selfie with ID proof is required for verification.');
            return;
        }

        setIsLoading(true);
        try {
            // If verification is NOT enforced, save details now (as unverified) for convenience
            if (!isVerificationEnforced) {
                if (payoutMethod === 'bank') {
                     await apiService.updateUserProfile(user.id, { savedBankDetails: { ...bankDetails, isVerified: false } });
                } else {
                     await apiService.updateUserProfile(user.id, { savedUpiId: upiId, isUpiVerified: false });
                }
            }

            let selfieUrl: string | undefined = undefined;
            if (selfieDataUrl) {
                const selfieFile = dataURLtoFile(selfieDataUrl, `payout_selfie_${user.id}.jpg`);
                selfieUrl = await apiService.uploadPayoutSelfie(user.id, selfieFile);
            }
            
            const requestData: any = {
                userId: user.id,
                userName: user.name,
                userAvatar: user.avatar || '',
                collaborationId: collaboration.id,
                collaborationType: getCollaborationType(),
                collaborationTitle: collaborationTitle,
                amount: finalPayoutAmount,
                collabId: collaboration.collabId || null,
                isAccountVerified: isVerificationEnforced, // Mark based on setting
                accountVerifiedName: payoutMethod === 'bank' ? bankDetails.accountHolderName : user.name,
                deductedPenalty: pendingPenalty // Store the deducted penalty
            };

            if (selfieUrl) {
                requestData.idProofSelfieUrl = selfieUrl;
            }

            if (payoutMethod === 'bank') {
                requestData.bankDetails = `Account Holder: ${bankDetails.accountHolderName}\nAccount Number: ${bankDetails.accountNumber}\nIFSC: ${bankDetails.ifscCode}\nBank: ${bankDetails.bankName}`;
            } else {
                requestData.upiId = upiId;
            }

            await apiService.submitPayoutRequest(requestData);
            onSubmitted();

        } catch (err) {
            console.error(err);
            setError("Failed to submit payout request. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const isCurrentlyVerified = payoutMethod === 'bank' ? isBankVerified : isUpiVerified;
    
    const canEdit = !isVerificationEnforced || (isEditing || !isCurrentlyVerified);

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                 <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Request Payout</h1>
                 <button onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
                    &larr; Back to Dashboard
                 </button>
            </div>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                    {/* Collab Details */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Collaboration Details</h2>
                        <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Title:</span> <span className="font-semibold text-right">{collaborationTitle}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">ID:</span> <span className="font-mono text-xs">{collaboration.id}</span></div>
                            {collaboration.collabId && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Collab ID:</span> <span className="font-mono text-xs">{collaboration.collabId}</span></div>}
                        </div>
                    </div>
                    {/* Payout Calculation */}
                     <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Final Payout Calculation</h2>
                        <div className="mt-4 space-y-2 text-sm border-t dark:border-gray-700 pt-4 dark:text-gray-300">
                            <div className="flex justify-between"><span>Final Agreed Price:</span> <span className="font-semibold">₹{finalAmount.toFixed(2)}</span></div>
                            {platformSettings.isPlatformCommissionEnabled && commission > 0 && (
                                <div className="flex justify-between text-red-600 dark:text-red-400"><span>(-) Platform Commission ({platformSettings.platformCommissionRate}%):</span> <span>- ₹{commission.toFixed(2)}</span></div>
                            )}
                            {platformSettings.isCreatorGstEnabled && gstOnCommission > 0 && (
                                 <div className="flex justify-between text-red-600 dark:text-red-400"><span>(-) GST on Commission ({platformSettings.gstRate}%):</span> <span>- ₹{gstOnCommission.toFixed(2)}</span></div>
                            )}
                            {dailyPayoutsReceived > 0 && <div className="flex justify-between text-red-600 dark:text-red-400"><span>(-) Daily Payouts Received:</span> <span>- ₹{dailyPayoutsReceived.toFixed(2)}</span></div>}
                            
                            {pendingPenalty > 0 && (
                                <div className="flex justify-between text-red-600 dark:text-red-400 font-bold">
                                    <span>(-) Cancellation Penalty:</span>
                                    <span>- ₹{pendingPenalty.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between font-bold text-lg border-t dark:border-gray-700 pt-2 mt-2 text-gray-900 dark:text-white"><span>Final Payout Amount:</span> <span>₹{finalPayoutAmount.toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Payment Details */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border-2 border-transparent transition-colors duration-300">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Payment Method</h2>
                            {isCurrentlyVerified && !isEditing && isVerificationEnforced && (
                                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                                    <CheckBadgeIcon className="w-5 h-5" />
                                    <span className="text-xs font-bold">VERIFIED</span>
                                </div>
                            )}
                        </div>

                         <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Type</label>
                            <select 
                                value={payoutMethod} 
                                onChange={e => { 
                                    setPayoutMethod(e.target.value as any); 
                                    if(isVerificationEnforced) setIsEditing(false); 
                                }} 
                                disabled={!canEdit && isVerificationEnforced}
                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-60"
                            >
                                <option value="bank">Bank Account</option>
                                <option value="upi">UPI ID</option>
                            </select>
                         </div>

                         {payoutMethod === 'bank' ? (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label htmlFor="accountHolderName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Holder Name</label>
                                    <input type="text" name="accountHolderName" value={bankDetails.accountHolderName} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnforced} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                                </div>
                                <div>
                                    <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Number</label>
                                    <input type="text" name="accountNumber" value={bankDetails.accountNumber} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnforced} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                                </div>
                                <div>
                                    <label htmlFor="ifscCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">IFSC Code</label>
                                    <input type="text" name="ifscCode" value={bankDetails.ifscCode} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnforced} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                                </div>
                                <div>
                                    <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Name & Branch</label>
                                    <input type="text" name="bankName" value={bankDetails.bankName} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnforced} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                                </div>
                            </div>
                         ) : (
                             <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">UPI ID</label>
                                <input type="text" value={upiId} onChange={handleUpiChange} disabled={!canEdit && isVerificationEnforced} placeholder="yourname@upi" required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                            </div>
                         )}

                         <div className="mt-6">
                             {isVerificationEnforced ? (
                                 !isCurrentlyVerified || isEditing ? (
                                     <button 
                                        type="button" 
                                        onClick={handleVerifyPaymentDetails} 
                                        disabled={isVerifying}
                                        className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
                                     >
                                         {isVerifying ? 'Verifying...' : 'Verify & Save Details'}
                                     </button>
                                 ) : (
                                     <button 
                                        type="button" 
                                        onClick={() => setIsEditing(true)} 
                                        className="w-full py-2 border border-indigo-500 text-indigo-600 bg-white rounded-lg font-semibold hover:bg-indigo-50 flex items-center justify-center gap-2"
                                     >
                                         <PencilIcon className="w-4 h-4" /> Edit / Change Account
                                     </button>
                                 )
                             ) : (
                                 <p className="text-xs text-gray-500 text-center">Details will be saved upon submission.</p>
                             )}
                         </div>
                         {successMessage && <p className="mt-2 text-sm text-green-600 text-center bg-green-50 p-2 rounded border border-green-200">{successMessage}</p>}
                    </div>

                    {/* Selfie Verification */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Identity Verification</h2>
                            {!platformSettings.payoutSettings.requireSelfieForPayout && (
                                <span className="text-xs text-gray-500 uppercase font-semibold">Optional</span>
                            )}
                        </div>
                        <CameraCapture
                            capturedImage={selfieDataUrl}
                            onCapture={setSelfieDataUrl}
                            onRetake={() => setSelfieDataUrl(null)}
                            selfieInstruction="Hold a valid ID (Aadhaar, PAN, Voter ID) next to your face and take a clear selfie."
                        />
                    </div>
                    
                    {error && <p className="text-red-600 text-sm text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-md">{error}</p>}
                    
                    <button 
                        type="submit" 
                        disabled={isLoading || (isVerificationEnforced && (!isCurrentlyVerified || isEditing)) || (platformSettings.payoutSettings.requireSelfieForPayout && !selfieDataUrl)} 
                        className="w-full py-4 text-lg font-semibold rounded-lg text-white bg-gradient-to-r from-green-500 to-teal-600 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? 'Submitting...' : 'Submit Payout Request'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PayoutRequestPage;
