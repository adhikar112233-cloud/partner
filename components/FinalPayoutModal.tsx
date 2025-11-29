
import React, { useState, useMemo } from 'react';
import { User, AdSlotRequest, BannerAdBookingRequest, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { BanknotesIcon, IdentityIcon } from './Icons';

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

    const handleSubmit = async () => {
        setError(null);
        setIsLoading(true);

        try {
            // Check if bank details exist
            if (!user.savedBankDetails?.accountNumber && !user.savedUpiId) {
                throw new Error("Please add Bank Account or UPI details in your profile first.");
            }

            const description = `Final Payout for ${collab.campaignName} (Rem. Amount: ₹${calculations.finalPayout.toFixed(2)})`;
            
            // Determine beneficiary info string
            let bankDetailsStr = '';
            let upiIdStr = '';

            if (user.savedBankDetails?.accountNumber) {
                bankDetailsStr = `Account Holder: ${user.savedBankDetails.accountHolderName}\nAccount Number: ${user.savedBankDetails.accountNumber}\nIFSC: ${user.savedBankDetails.ifscCode}\nBank: ${user.savedBankDetails.bankName}`;
            }
            if (user.savedUpiId) {
                upiIdStr = user.savedUpiId;
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
                isAccountVerified: user.savedBankDetails?.isVerified || !!user.isUpiVerified,
                accountVerifiedName: user.savedBankDetails?.accountHolderName || user.name,
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
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Beneficiary Details</h4>
                            <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3 space-y-1">
                                {user.savedBankDetails?.accountNumber ? (
                                    <>
                                        <p className="flex justify-between"><span className="text-gray-500">Name:</span> <span className="font-medium dark:text-gray-200">{user.savedBankDetails.accountHolderName}</span></p>
                                        <p className="flex justify-between"><span className="text-gray-500">Bank:</span> <span className="font-medium dark:text-gray-200">{user.savedBankDetails.bankName}</span></p>
                                        <p className="flex justify-between"><span className="text-gray-500">IFSC:</span> <span className="font-medium dark:text-gray-200">{user.savedBankDetails.ifscCode}</span></p>
                                    </>
                                ) : (
                                    <p className="text-red-500 italic">No Bank Details Saved</p>
                                )}
                                <p className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                    <span className="text-gray-500">UPI (Optional):</span> 
                                    <span className="font-medium dark:text-gray-200">{user.savedUpiId || 'N/A'}</span>
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-center">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="w-full py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Processing...' : 'APPLY FOR FINAL PAYOUT'}
                        </button>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinalPayoutModal;
