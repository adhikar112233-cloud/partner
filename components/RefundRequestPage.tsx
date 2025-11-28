
import React, { useState, useMemo, useEffect } from 'react';
import { User, AnyCollaboration, RefundRequest, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { CheckBadgeIcon, PencilIcon } from './Icons';

interface RefundRequestPageProps {
    user: User;
    collaboration: AnyCollaboration;
    onClose: () => void;
    onSubmitted: () => void;
    platformSettings: PlatformSettings;
}

const RefundRequestPage: React.FC<RefundRequestPageProps> = ({ user, collaboration, onClose, onSubmitted, platformSettings }) => {
    const [refundMethod, setRefundMethod] = useState<'bank' | 'upi'>('bank');

    const [bankDetails, setBankDetails] = useState({
        accountHolderName: user.savedBankDetails?.accountHolderName || '',
        accountNumber: user.savedBankDetails?.accountNumber || '',
        ifscCode: user.savedBankDetails?.ifscCode || '',
        bankName: user.savedBankDetails?.bankName || '',
    });
    
    const [upiId, setUpiId] = useState(user.savedUpiId || '');
    const [panNumber, setPanNumber] = useState('');
    const [description, setDescription] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [isBankVerified, setIsBankVerified] = useState(!!user.savedBankDetails?.isVerified);
    const [isUpiVerified, setIsUpiVerified] = useState(!!user.isUpiVerified);
    const [isEditing, setIsEditing] = useState(false);
    
    const isVerificationEnforced = platformSettings.isPayoutInstantVerificationEnabled;

    const getCollaborationType = (): RefundRequest['collabType'] => {
        if ('campaignTitle' in collaboration) return 'campaign';
        if ('influencerId' in collaboration) return 'direct';
        if ('liveTvId' in collaboration) return 'ad_slot';
        if ('agencyId' in collaboration) return 'banner_booking';
        throw new Error('Could not determine collaboration type');
    };

    const collaborationTitle = useMemo(() => {
        if ('title' in collaboration) return collaboration.title;
        if ('campaignTitle' in collaboration) return collaboration.campaignTitle;
        if ('campaignName' in collaboration) return collaboration.campaignName;
        return 'Untitled Collaboration';
    }, [collaboration]);
    
    const finalAmountRaw = collaboration?.finalAmount ? parseFloat(String(collaboration.finalAmount).replace(/[^0-9.-]+/g, "")) : 0;
    const finalAmount = isNaN(finalAmountRaw) ? 0 : finalAmountRaw;

    const handleBankDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setBankDetails(prev => ({ ...prev, [name]: value }));
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

    const handleVerifyPaymentDetails = async () => {
        setError(null);
        setSuccessMessage(null);
        setIsVerifying(true);

        try {
            if (refundMethod === 'bank') {
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
                    throw new Error("Bank verification failed. Please ensure the name matches.");
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

        if (isVerificationEnforced) {
            if (refundMethod === 'bank' && !isBankVerified) {
                setError("Please verify your bank account details first.");
                return;
            }
            if (refundMethod === 'upi' && !isUpiVerified) {
                setError("Please verify your UPI ID first.");
                return;
            }
        } else {
             if (refundMethod === 'bank' && (!bankDetails.accountNumber || !bankDetails.ifscCode)) {
                 setError("Please provide complete bank details.");
                 return;
             }
             if (refundMethod === 'upi' && !upiId) {
                 setError("Please provide UPI ID.");
                 return;
             }
        }

        if (!panNumber.trim() || !description.trim()) {
            setError("PAN and reason are required.");
            return;
        }

        setIsLoading(true);
        try {
            if (!isVerificationEnforced) {
                 if (refundMethod === 'bank') {
                    await apiService.updateUserProfile(user.id, { savedBankDetails: { ...bankDetails, isVerified: false } });
                 } else {
                    await apiService.updateUserProfile(user.id, { savedUpiId: upiId, isUpiVerified: false });
                 }
            }

            let bankDetailsString = '';
            if (refundMethod === 'bank') {
                bankDetailsString = `Account Holder: ${bankDetails.accountHolderName}\nAccount Number: ${bankDetails.accountNumber}\nIFSC: ${bankDetails.ifscCode}\nBank: ${bankDetails.bankName}`;
            }

            // Ensure we handle optional fields correctly for Firestore (null instead of undefined)
            await apiService.createRefundRequest({
                collaborationId: collaboration.id,
                collabType: getCollaborationType(),
                collabTitle: collaborationTitle,
                brandId: user.id,
                brandName: user.companyName || user.name,
                brandAvatar: user.avatar || '',
                amount: finalAmount,
                bankDetails: bankDetailsString || null,
                upiId: refundMethod === 'upi' ? upiId : null,
                panNumber,
                description,
                collabId: collaboration.collabId || null,
            });
            onSubmitted();
        } catch (err) {
            console.error(err);
            setError("Failed to submit refund request. Please contact support.");
        } finally {
            setIsLoading(false);
        }
    };

    const isCurrentlyVerified = refundMethod === 'bank' ? isBankVerified : isUpiVerified;
    const canEdit = !isVerificationEnforced || (isEditing || !isCurrentlyVerified);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Request Refund</h1>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl">&times;</button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border dark:border-gray-600 text-gray-700 dark:text-gray-300">
                            <p><span className="font-semibold">Collaboration:</span> {collaborationTitle}</p>
                            <p><span className="font-semibold">Refund Amount:</span> ₹{finalAmount.toFixed(2)}</p>
                            {collaboration.collabId && <p><span className="font-semibold">Collab ID:</span> <span className="font-mono">{collaboration.collabId}</span></p>}
                        </div>
                        
                        <div className="border-t border-b py-4 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-gray-800 dark:text-white">Refund Method</h3>
                                {isCurrentlyVerified && !isEditing && isVerificationEnforced && (
                                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                                        <CheckBadgeIcon className="w-5 h-5" />
                                        <span className="text-xs font-bold">VERIFIED</span>
                                    </div>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Type</label>
                                <select 
                                    value={refundMethod} 
                                    onChange={e => { 
                                        setRefundMethod(e.target.value as any); 
                                        if(isVerificationEnforced) setIsEditing(false); 
                                    }} 
                                    disabled={!canEdit && isVerificationEnforced}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-60"
                                >
                                    <option value="bank">Bank Account</option>
                                    <option value="upi">UPI ID</option>
                                </select>
                            </div>

                            {refundMethod === 'bank' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Holder Name</label>
                                        <input type="text" name="accountHolderName" value={bankDetails.accountHolderName} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnforced} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Number</label>
                                        <input type="text" name="accountNumber" value={bankDetails.accountNumber} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnforced} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">IFSC Code</label>
                                        <input type="text" name="ifscCode" value={bankDetails.ifscCode} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnforced} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Name & Branch</label>
                                        <input type="text" name="bankName" value={bankDetails.bankName} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnforced} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">UPI ID</label>
                                    <input type="text" value={upiId} onChange={handleUpiChange} disabled={!canEdit && isVerificationEnforced} placeholder="yourname@upi" required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                                </div>
                            )}

                            <div className="mt-4">
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
                                            <PencilIcon className="w-4 h-4" /> Edit Account
                                        </button>
                                    )
                                ) : (
                                    <p className="text-xs text-gray-500 text-center">Details will be saved upon submission.</p>
                                )}
                                {successMessage && <p className="mt-2 text-sm text-green-600 text-center">{successMessage}</p>}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="panNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">PAN Card Number</label>
                            <input
                                type="text"
                                id="panNumber"
                                value={panNumber}
                                onChange={e => setPanNumber(e.target.value.toUpperCase())}
                                required
                                className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason for Refund</label>
                            <textarea 
                                id="description" 
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={4} 
                                placeholder="Briefly describe why you are requesting a refund for this completed dispute." 
                                required 
                                className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>

                        {error && <p className="text-red-600 text-sm text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-md">{error}</p>}
                        
                        <button type="submit" disabled={isLoading || (isVerificationEnforced && (!isCurrentlyVerified || isEditing))} className="w-full py-3 text-lg font-semibold rounded-lg text-white bg-gradient-to-r from-red-500 to-orange-600 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                            {isLoading ? 'Submitting...' : 'Submit Refund Request'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RefundRequestPage;
