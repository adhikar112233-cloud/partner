
import React, { useState, useMemo, useEffect } from 'react';
import { User, AnyCollaboration, PayoutRequest, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import CameraCapture from './CameraCapture';
import { CheckBadgeIcon, PencilIcon, ProfileIcon, BanknotesIcon, CreditCardIcon, IdentityIcon, ShieldCheckIcon } from './Icons';

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
    
    // Additional Verification
    const [panNumber, setPanNumber] = useState('');

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
        // If user modifies verified details, reset verification status
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

        if (!panNumber.trim()) {
            setError("PAN Card Number is required.");
            return;
        }

        if (platformSettings.payoutSettings.requireSelfieForPayout && !selfieDataUrl) {
            setError('A live selfie is required for verification.');
            return;
        }

        setIsLoading(true);
        try {
            // Save details if not strictly enforcing verification (for future use)
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
                isAccountVerified: isVerificationEnforced, 
                accountVerifiedName: payoutMethod === 'bank' ? bankDetails.accountHolderName : user.name,
                deductedPenalty: pendingPenalty,
                panNumber: panNumber
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
    // Fields are disabled if verification is enforced AND verified AND not explicitly editing
    const areFieldsDisabled = isVerificationEnforced && isCurrentlyVerified && !isEditing;

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 bg-white dark:bg-gray-900 min-h-screen">
            <div className="flex items-center justify-between mb-8">
                 <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">Payout Request</h1>
                 <button onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
                    &larr; Back to Dashboard
                 </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* 1. User Details (Prefilled) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><ProfileIcon className="w-5 h-5" /></div>
                        User Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
                            <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Registered Mobile</label>
                            <div className="font-medium text-gray-900 dark:text-white">{user.mobileNumber || 'N/A'}</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">User ID / Member ID</label>
                            <div className="font-medium text-gray-900 dark:text-white font-mono">{user.piNumber || user.id}</div>
                        </div>
                    </div>
                </div>

                {/* 2. Withdrawal Method */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><CreditCardIcon className="w-5 h-5" /></div>
                        Withdrawal Method
                    </h3>
                    <div className="flex gap-4 flex-col sm:flex-row">
                        <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all flex items-center gap-4 ${payoutMethod === 'bank' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'}`}>
                            <input type="radio" name="payoutMethod" value="bank" checked={payoutMethod === 'bank'} onChange={() => { setPayoutMethod('bank'); if(isVerificationEnforced) setIsEditing(false); }} className="h-5 w-5 text-indigo-600 focus:ring-indigo-500" />
                            <div>
                                <span className="block font-bold text-gray-800 dark:text-white">Bank Transfer</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Direct to bank account</span>
                            </div>
                        </label>
                        <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all flex items-center gap-4 ${payoutMethod === 'upi' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'}`}>
                            <input type="radio" name="payoutMethod" value="upi" checked={payoutMethod === 'upi'} onChange={() => { setPayoutMethod('upi'); if(isVerificationEnforced) setIsEditing(false); }} className="h-5 w-5 text-indigo-600 focus:ring-indigo-500" />
                            <div>
                                <span className="block font-bold text-gray-800 dark:text-white">UPI ID</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">GPay, PhonePe, Paytm</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* 3. Payment Details */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative transition-all duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <div className="p-1.5 bg-teal-100 text-teal-600 rounded-lg"><BanknotesIcon className="w-5 h-5" /></div>
                            {payoutMethod === 'bank' ? 'Bank Details' : 'UPI Details'}
                        </h3>
                        {/* Status Badge or Edit Button */}
                        <div className="flex items-center gap-2">
                            {isCurrentlyVerified && !isEditing ? (
                                <>
                                    <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center gap-1 font-bold border border-green-200">
                                        <CheckBadgeIcon className="w-4 h-4" /> Verified
                                    </span>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsEditing(true)}
                                        className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1 ml-2"
                                    >
                                        <PencilIcon className="w-3 h-3" /> Edit
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>

                    {payoutMethod === 'bank' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Holder Name</label>
                                <input type="text" name="accountHolderName" value={bankDetails.accountHolderName} onChange={handleBankDetailsChange} disabled={areFieldsDisabled} placeholder="As per bank records" className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bank Name</label>
                                <input type="text" name="bankName" value={bankDetails.bankName} onChange={handleBankDetailsChange} disabled={areFieldsDisabled} placeholder="e.g. HDFC Bank" className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Number</label>
                                <input type="text" name="accountNumber" value={bankDetails.accountNumber} onChange={handleBankDetailsChange} disabled={areFieldsDisabled} className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IFSC Code</label>
                                <input type="text" name="ifscCode" value={bankDetails.ifscCode} onChange={handleBankDetailsChange} disabled={areFieldsDisabled} className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none uppercase" />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">UPI ID</label>
                            <input type="text" value={upiId} onChange={handleUpiChange} disabled={areFieldsDisabled} placeholder="username@upi" className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                    )}

                    {/* Verification Actions */}
                    {isVerificationEnforced && (!isCurrentlyVerified || isEditing) && (
                        <div className="mt-6 flex justify-end">
                            <button 
                                type="button" 
                                onClick={handleVerifyPaymentDetails} 
                                disabled={isVerifying}
                                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-md transition-all active:scale-95"
                            >
                                {isVerifying ? 'Verifying...' : 'Verify Details'}
                            </button>
                        </div>
                    )}
                    
                    {successMessage && <div className="mt-4 p-3 bg-green-50 text-green-800 text-sm font-medium rounded-lg border border-green-200 flex items-center gap-2"><CheckBadgeIcon className="w-5 h-5"/> {successMessage}</div>}
                </div>

                {/* 4. Amount Details */}
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <div className="p-1.5 bg-yellow-100 text-yellow-600 rounded-lg"><span className="text-lg">₹</span></div>
                        Amount Details
                    </h3>
                    <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex justify-between items-center py-1">
                            <span className="font-medium">Payout Amount (Agreed)</span>
                            <span className="font-bold text-gray-900 dark:text-white">₹{finalAmount.toFixed(2)}</span>
                        </div>
                        
                        {/* Deductions */}
                        <div className="pl-4 space-y-2 border-l-2 border-gray-200 dark:border-gray-600 my-2">
                            {platformSettings.isPlatformCommissionEnabled && commission > 0 && (
                                <div className="flex justify-between text-red-600 dark:text-red-400">
                                    <span>Platform Commission ({platformSettings.platformCommissionRate}%)</span> 
                                    <span>- ₹{commission.toFixed(2)}</span>
                                </div>
                            )}
                            {platformSettings.isCreatorGstEnabled && gstOnCommission > 0 && (
                                 <div className="flex justify-between text-red-600 dark:text-red-400">
                                    <span>GST on Commission ({platformSettings.gstRate}%)</span> 
                                    <span>- ₹{gstOnCommission.toFixed(2)}</span>
                                </div>
                            )}
                            {dailyPayoutsReceived > 0 && (
                                <div className="flex justify-between text-red-600 dark:text-red-400">
                                    <span>Daily Payouts Already Received</span> 
                                    <span>- ₹{dailyPayoutsReceived.toFixed(2)}</span>
                                </div>
                            )}
                            {pendingPenalty > 0 && (
                                <div className="flex justify-between text-red-700 dark:text-red-300 font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                    <span>Cancellation Penalty Deduction</span>
                                    <span>- ₹{pendingPenalty.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-600 pt-3 flex justify-between items-center mt-2">
                            <span className="font-bold text-gray-900 dark:text-white text-lg">Final Amount to Receive</span>
                            <span className="font-extrabold text-green-600 dark:text-green-400 text-2xl">₹{finalPayoutAmount.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* 5. Verification */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <div className="p-1.5 bg-red-100 text-red-600 rounded-lg"><ShieldCheckIcon className="w-5 h-5" /></div>
                        Identity Verification
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Live Selfie */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                                    Live Selfie <span className="text-red-500">*</span>
                                </label>
                                {!platformSettings.payoutSettings.requireSelfieForPayout && <span className="text-xs text-gray-400">(Optional)</span>}
                            </div>
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700/50 p-2">
                                <CameraCapture
                                    capturedImage={selfieDataUrl}
                                    onCapture={setSelfieDataUrl}
                                    onRetake={() => setSelfieDataUrl(null)}
                                    selfieInstruction="Take a clear selfie to verify it's you."
                                />
                            </div>
                        </div>

                        {/* PAN Input */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">
                                PAN Card Number <span className="text-red-500">*</span>
                            </label>
                            <input 
                                type="text" 
                                value={panNumber} 
                                onChange={(e) => setPanNumber(e.target.value.toUpperCase())} 
                                maxLength={10}
                                placeholder="ABCDE1234F"
                                className="w-full p-4 border border-gray-300 rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-lg uppercase tracking-widest text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-2">Mandatory for tax compliance and identity check.</p>
                        </div>
                    </div>
                </div>

                {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-center font-medium">{error}</div>}

                {/* 6. Submit Button */}
                <div className="pt-2 pb-8">
                    <button 
                        type="submit" 
                        disabled={isLoading || (isVerificationEnforced && (!isCurrentlyVerified || isEditing))} 
                        className="w-full py-4 text-lg font-bold rounded-xl text-white bg-gradient-to-r from-green-600 to-teal-600 shadow-xl hover:shadow-2xl hover:translate-y-[-2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all transform active:scale-98"
                    >
                        {isLoading ? 'Submitting Request...' : 'Submit Payout Request'}
                    </button>
                    {isVerificationEnforced && (!isCurrentlyVerified || isEditing) && (
                        <p className="text-center text-xs text-gray-500 mt-3">
                            You must verify your payment details above before submitting.
                        </p>
                    )}
                </div>

            </form>
        </div>
    );
};

export default PayoutRequestPage;
