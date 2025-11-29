
import React, { useState, useMemo } from 'react';
import { User, AdSlotRequest, BannerAdBookingRequest, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { BanknotesIcon, IdentityIcon, PencilIcon } from './Icons';

interface FinalPayoutModalProps {
    user: User;
    collab: AdSlotRequest | BannerAdBookingRequest;
    onClose: () => void;
    platformSettings: PlatformSettings;
    onSubmitted: () => void;
}

const FinalPayoutModal: React.FC<FinalPayoutModalProps> = ({ user, collab, onClose, platformSettings, onSubmitted }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Payment Details Edit State
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [editBankDetails, setEditBankDetails] = useState({
        accountHolderName: user.savedBankDetails?.accountHolderName || '',
        accountNumber: user.savedBankDetails?.accountNumber || '',
        ifscCode: user.savedBankDetails?.ifscCode || '',
        bankName: user.savedBankDetails?.bankName || '',
    });
    const [editUpiId, setEditUpiId] = useState(user.savedUpiId || '');
    
    // Local display state to reflect changes immediately
    const [currentBankDetails, setCurrentBankDetails] = useState(user.savedBankDetails);
    const [currentUpiId, setCurrentUpiId] = useState(user.savedUpiId);

    // Calculations
    const calculations = useMemo(() => {
        const totalAmount = parseFloat(String(collab.finalAmount || '0').replace(/[^0-9.-]+/g, "")) || 0;
        
        const startDate = new Date(collab.startDate);
        const endDate = new Date(collab.endDate);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        // Add 1 to include both start and end date in the count
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
        
        // Prevent division by zero
        const effectiveTotalDays = totalDays > 0 ? totalDays : 1;
        const dailyRate = totalAmount / effectiveTotalDays;

        const daysUsed = collab.dailyPayoutsReceived || 0;
        const amountAlreadyPaid = daysUsed * dailyRate;

        // Calculate remaining based on math, ensure no negative
        const remainingDays = Math.max(0, effectiveTotalDays - daysUsed);
        const remainingAmountRaw = Math.max(0, totalAmount - amountAlreadyPaid);

        // Fees on the REMAINING amount (Final Payout)
        const commissionRate = platformSettings.platformCommissionRate || 10;
        const fee = remainingAmountRaw * (commissionRate / 100);
        
        const gstRate = 18;
        const gst = fee * (gstRate / 100);

        const finalPayout = Math.max(0, remainingAmountRaw - fee - gst);

        return {
            totalAmount,
            totalDays: effectiveTotalDays,
            dailyRate,
            daysUsed,
            amountAlreadyPaid,
            remainingDays,
            remainingAmountRaw,
            fee,
            gst,
            finalPayout
        };
    }, [collab, platformSettings]);

    const handleSavePaymentDetails = async () => {
        setError(null);
        // Basic Validation
        if (!editUpiId && (!editBankDetails.accountNumber || !editBankDetails.ifscCode)) {
            setError("Please provide either Bank Details or UPI ID.");
            return;
        }
        
        setIsLoading(true);
        try {
            const updatedBank = { ...editBankDetails, isVerified: false };
            await apiService.updateUserProfile(user.id, {
                savedBankDetails: updatedBank, 
                savedUpiId: editUpiId,
                isUpiVerified: false
            });
            setCurrentBankDetails(updatedBank);
            setCurrentUpiId(editUpiId);
            setIsEditingDetails(false);
        } catch (e) {
            setError("Failed to save payment details.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        setError(null);
        
        // Check if bank details exist using LOCAL state (to capture updates)
        if (!currentBankDetails?.accountNumber && !currentUpiId) {
            setError("Please add Bank Account or UPI details above first.");
            return;
        }

        setIsLoading(true);

        try {
            const description = `Final Payout for ${collab.campaignName} (Rem. Amount: ₹${calculations.finalPayout.toFixed(2)})`;
            
            // Determine beneficiary info string from LOCAL state
            let bankDetailsStr = '';
            let upiIdStr = '';

            if (currentBankDetails?.accountNumber) {
                bankDetailsStr = `Account Holder: ${currentBankDetails.accountHolderName}\nAccount Number: ${currentBankDetails.accountNumber}\nIFSC: ${currentBankDetails.ifscCode}\nBank: ${currentBankDetails.bankName}`;
            }
            if (currentUpiId) {
                upiIdStr = currentUpiId;
            }

            await apiService.submitPayoutRequest({
                userId: user.id,
                userName: user.name,
                userAvatar: user.avatar || '',
                collaborationId: collab.id,
                collaborationType: 'liveTvId' in collab ? 'ad_slot' : 'banner_booking',
                collaborationTitle: collab.campaignName,
                amount: calculations.finalPayout,
                collabId: collab.collabId || null,
                // Verification status check - using updated local verification status if possible, or fallback to user status (optimistic check)
                isAccountVerified: currentBankDetails?.isVerified || !!user.isUpiVerified, 
                accountVerifiedName: currentBankDetails?.accountHolderName || user.name,
                bankDetails: bankDetailsStr,
                upiId: upiIdStr,
                panNumber: user.creatorVerificationDetails?.isBusinessPanVerified ? 'Verified Business PAN' : 'N/A' // Or fetch if stored elsewhere
            });

            onSubmitted();
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to submit request.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[80] p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg relative flex flex-col max-h-[90vh]">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-10 text-2xl leading-none">&times;</button>
                
                <div className="p-6 overflow-y-auto">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-wide">Final Payout Request</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Settlement for {collab.campaignName}</p>
                    </div>

                    <div className="space-y-6 text-sm">
                        
                        {/* Campaign Summary */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-600 dark:text-gray-300 font-semibold">Campaign ID:</span>
                                <span className="font-mono text-gray-800 dark:text-white">{collab.collabId || collab.id.slice(0, 8)}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-600 dark:text-gray-300">Total Days Booked:</span>
                                <span className="text-gray-800 dark:text-white">{calculations.totalDays} Days</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-300">Daily Rate:</span>
                                <span className="font-mono text-gray-800 dark:text-white">₹{calculations.dailyRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day</span>
                            </div>
                        </div>

                        {/* Daily Payouts Summary */}
                        <div className="border-l-4 border-yellow-400 pl-4 py-1">
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-600 dark:text-gray-400">Days Used (Daily Payout Applied):</span>
                                <span className="font-bold text-gray-800 dark:text-white">{calculations.daysUsed}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Amount Already Paid:</span>
                                <span className="font-bold text-gray-800 dark:text-white">₹{calculations.amountAlreadyPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>

                        {/* Remaining Breakdown */}
                        <div className="border-l-4 border-green-500 pl-4 py-1">
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-600 dark:text-gray-400">Remaining Days:</span>
                                <span className="font-bold text-gray-800 dark:text-white">{calculations.remainingDays}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Remaining Amount:</span>
                                <span className="font-bold text-gray-800 dark:text-white">₹{calculations.remainingAmountRaw.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>

                        {/* Fees & Final Calculation */}
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500 dark:text-gray-400">Platform Final Fee ({platformSettings.platformCommissionRate}%):</span>
                                <span className="text-red-500">- ₹{calculations.fee.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex justify-between text-xs pb-2 border-b border-gray-200 dark:border-gray-600">
                                <span className="text-gray-500 dark:text-gray-400">GST (18% on Fee):</span>
                                <span className="text-red-500">- ₹{calculations.gst.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-gray-800 dark:text-white font-bold text-base">FINAL PAYOUT</span>
                                <span className="text-green-600 dark:text-green-400 font-extrabold text-xl">₹{calculations.finalPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>

                        {/* Beneficiary Details */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase">Beneficiary Details</h4>
                                <button 
                                    onClick={() => setIsEditingDetails(!isEditingDetails)} 
                                    className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1"
                                >
                                    <PencilIcon className="w-3 h-3" />
                                    {isEditingDetails ? 'Cancel Edit' : 'Add/Edit Details'}
                                </button>
                            </div>

                            {isEditingDetails ? (
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 space-y-3 shadow-inner">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <input type="text" placeholder="Account Holder Name" value={editBankDetails.accountHolderName} onChange={e => setEditBankDetails({...editBankDetails, accountHolderName: e.target.value})} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs" />
                                        <input type="text" placeholder="Bank Name" value={editBankDetails.bankName} onChange={e => setEditBankDetails({...editBankDetails, bankName: e.target.value})} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs" />
                                        <input type="text" placeholder="Account Number" value={editBankDetails.accountNumber} onChange={e => setEditBankDetails({...editBankDetails, accountNumber: e.target.value})} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs" />
                                        <input type="text" placeholder="IFSC Code" value={editBankDetails.ifscCode} onChange={e => setEditBankDetails({...editBankDetails, ifscCode: e.target.value.toUpperCase()})} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs uppercase" />
                                    </div>
                                    <div className="border-t pt-2 dark:border-gray-600">
                                        <input type="text" placeholder="UPI ID (Optional)" value={editUpiId} onChange={e => setEditUpiId(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-xs" />
                                    </div>
                                    <button 
                                        onClick={handleSavePaymentDetails} 
                                        disabled={isLoading}
                                        className="w-full py-2 bg-indigo-600 text-white rounded font-medium text-xs hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {isLoading ? 'Saving...' : 'Save Details'}
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3 space-y-1">
                                    {currentBankDetails?.accountNumber ? (
                                        <>
                                            <p className="flex justify-between"><span className="text-gray-500">Name:</span> <span className="font-medium dark:text-gray-200">{currentBankDetails.accountHolderName}</span></p>
                                            <p className="flex justify-between"><span className="text-gray-500">Bank:</span> <span className="font-medium dark:text-gray-200">{currentBankDetails.bankName}</span></p>
                                            <p className="flex justify-between"><span className="text-gray-500">IFSC:</span> <span className="font-medium dark:text-gray-200">{currentBankDetails.ifscCode}</span></p>
                                        </>
                                    ) : (
                                        <p className="text-red-500 italic text-xs">No Bank Details Saved</p>
                                    )}
                                    <p className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                        <span className="text-gray-500">UPI (Optional):</span> 
                                        <span className="font-medium dark:text-gray-200">{currentUpiId || 'N/A'}</span>
                                    </p>
                                </div>
                            )}
                            
                            {(!currentBankDetails?.accountNumber && !currentUpiId && !isEditingDetails) && (
                                <p className="text-xs text-red-500 mt-2">* Please add your payment details above to proceed.</p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-center">
                                {error}
                            </div>
                        )}

                        {!isEditingDetails && (
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="w-full py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Processing...' : 'APPLY FOR FINAL PAYOUT'}
                            </button>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinalPayoutModal;
