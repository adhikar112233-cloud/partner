
import React, { useState, useMemo, useEffect } from 'react';
import { User, AnyCollaboration, RefundRequest, AdSlotRequest, BannerAdBookingRequest, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { CheckBadgeIcon, PencilIcon } from './Icons';

interface RefundRequestPageProps {
    user: User;
    collaboration: AnyCollaboration;
    onClose: () => void;
    onSubmitted: () => void;
    platformSettings?: PlatformSettings; // Optional to avoid breaking if not passed, but preferred
}

const RefundRequestPage: React.FC<RefundRequestPageProps> = ({ user, collaboration, onClose, onSubmitted, platformSettings }) => {
    const [bankDetails, setBankDetails] = useState({
        accountHolderName: user.savedBankDetails?.accountHolderName || '',
        accountNumber: user.savedBankDetails?.accountNumber || '',
        ifscCode: user.savedBankDetails?.ifscCode || '',
        bankName: user.savedBankDetails?.bankName || '',
    });
    
    const [panNumber, setPanNumber] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [isVerified, setIsVerified] = useState(!!user.savedBankDetails?.isVerified);
    const [isEditing, setIsEditing] = useState(false);
    const [isVerificationEnabled, setIsVerificationEnabled] = useState(true); 

    useEffect(() => {
        if (platformSettings) {
            setIsVerificationEnabled(platformSettings.isPayoutInstantVerificationEnabled);
        } else {
            // Fallback fetch if prop not provided
            apiService.getPlatformSettings().then(settings => {
                setIsVerificationEnabled(settings.isPayoutInstantVerificationEnabled);
            });
        }
    }, [platformSettings]);

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
        if (isVerificationEnabled) {
            setIsVerified(false); 
        }
    };

    const handleVerifyBank = async () => {
        setError(null);
        setSuccessMessage(null);
        if (!bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
            setError("Please fill all bank fields.");
            return;
        }
        
        setIsVerifying(true);
        try {
            const res = await apiService.verifyBankAccount(user.id, bankDetails.accountNumber, bankDetails.ifscCode, bankDetails.accountHolderName);
            
            if (res.success) {
                const updatedBankDetails = { ...bankDetails, isVerified: true };
                await apiService.updateUserProfile(user.id, { savedBankDetails: updatedBankDetails });
                setIsVerified(true);
                setIsEditing(false);
                setSuccessMessage(`Bank Verified! Registered Name: ${res.registeredName}`);
            } else {
                throw new Error("Bank verification failed.");
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

        if (isVerificationEnabled && !isVerified) {
            setError("Please verify your bank account details first.");
            return;
        }

        if (!bankDetails.accountNumber || !bankDetails.ifscCode) {
             setError("Please provide complete bank details.");
             return;
        }

        if (!panNumber.trim() || !description.trim()) {
            setError("PAN and reason are required.");
            return;
        }

        setIsLoading(true);
        try {
            if (!isVerificationEnabled) {
                 // Save details locally as unverified for convenience
                 await apiService.updateUserProfile(user.id, { savedBankDetails: { ...bankDetails, isVerified: false } });
            }

            const bankDetailsString = `Account Holder: ${bankDetails.accountHolderName}\nAccount Number: ${bankDetails.accountNumber}\nIFSC: ${bankDetails.ifscCode}\nBank: ${bankDetails.bankName}`;

            await apiService.createRefundRequest({
                collaborationId: collaboration.id,
                collabType: getCollaborationType(),
                collabTitle: collaborationTitle,
                brandId: user.id,
                brandName: user.companyName || user.name,
                brandAvatar: user.avatar || '',
                amount: finalAmount,
                bankDetails: bankDetailsString,
                panNumber,
                description,
                collabId: collaboration.collabId,
            });
            onSubmitted();
        } catch (err) {
            console.error(err);
            setError("Failed to submit refund request. Please contact support.");
        } finally {
            setIsLoading(false);
        }
    };

    const canEdit = !isVerificationEnabled || (isEditing || !isVerified);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                 <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Request Refund</h1>
                 <button onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
                    &larr; Back to Collaborations
                 </button>
            </div>
            
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg space-y-6">
                 <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border dark:border-gray-600 text-gray-700 dark:text-gray-300">
                    <p><span className="font-semibold">Collaboration:</span> {collaborationTitle}</p>
                    <p><span className="font-semibold">Refund Amount:</span> ₹{finalAmount.toFixed(2)}</p>
                    {collaboration.collabId && <p><span className="font-semibold">Collab ID:</span> <span className="font-mono">{collaboration.collabId}</span></p>}
                </div>
                
                <div className="border-t border-b py-4 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">Refund Bank Details</h3>
                        {isVerified && !isEditing && isVerificationEnabled && (
                            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                                <CheckBadgeIcon className="w-5 h-5" />
                                <span className="text-xs font-bold">VERIFIED</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Holder Name</label>
                            <input type="text" name="accountHolderName" value={bankDetails.accountHolderName} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnabled} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Number</label>
                            <input type="text" name="accountNumber" value={bankDetails.accountNumber} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnabled} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">IFSC Code</label>
                            <input type="text" name="ifscCode" value={bankDetails.ifscCode} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnabled} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Name & Branch</label>
                            <input type="text" name="bankName" value={bankDetails.bankName} onChange={handleBankDetailsChange} disabled={!canEdit && isVerificationEnabled} required className="mt-1 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"/>
                        </div>
                    </div>

                    <div className="mt-4">
                        {isVerificationEnabled ? (
                            !isVerified || isEditing ? (
                                <button 
                                    type="button" 
                                    onClick={handleVerifyBank} 
                                    disabled={isVerifying}
                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {isVerifying ? 'Verifying...' : 'Verify & Save Bank Details'}
                                </button>
                            ) : (
                                <button 
                                    type="button" 
                                    onClick={() => setIsEditing(true)} 
                                    className="w-full py-2 border border-indigo-500 text-indigo-600 bg-white rounded-lg font-semibold hover:bg-indigo-50 flex items-center justify-center gap-2"
                                >
                                    <PencilIcon className="w-4 h-4" /> Edit Bank Account
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
                
                <button type="submit" disabled={isLoading || (isVerificationEnabled && (!isVerified || isEditing))} className="w-full py-3 text-lg font-semibold rounded-lg text-white bg-gradient-to-r from-red-500 to-orange-600 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoading ? 'Submitting...' : 'Submit Refund Request'}
                </button>
            </form>
        </div>
    );
};

export default RefundRequestPage;
