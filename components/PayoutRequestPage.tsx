import React, { useState, useMemo } from 'react';
import { User, AnyCollaboration, PayoutRequest, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import CameraCapture from './CameraCapture';

interface PayoutRequestPageProps {
    user: User;
    collaboration: AnyCollaboration;
    platformSettings: PlatformSettings;
    onClose: () => void;
    onSubmitted: () => void;
}

const PayoutRequestPage: React.FC<PayoutRequestPageProps> = ({ user, collaboration, platformSettings, onClose, onSubmitted }) => {
    const [payoutMethod, setPayoutMethod] = useState<'bank' | 'upi'>('bank');
    const [bankDetails, setBankDetails] = useState({
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
    });
    const [upiId, setUpiId] = useState('');
    const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // FIX: Add useMemo to correctly derive the collaboration title from the union type.
    const collaborationTitle = useMemo(() => {
        if ('title' in collaboration) return collaboration.title;
        if ('campaignTitle' in collaboration) return collaboration.campaignTitle;
        if ('campaignName' in collaboration) return collaboration.campaignName;
        return 'Untitled Collaboration';
    }, [collaboration]);

    // --- Calculation Logic ---
    const finalAmountRaw = collaboration?.finalAmount ? parseFloat(String(collaboration.finalAmount).replace(/[^0-9.-]+/g, "")) : 0;
    const finalAmount = isNaN(finalAmountRaw) ? 0 : finalAmountRaw;
    const dailyPayoutsReceived = 'dailyPayoutsReceived' in collaboration ? collaboration.dailyPayoutsReceived || 0 : 0;

    const commission = platformSettings.isPlatformCommissionEnabled ? finalAmount * (platformSettings.platformCommissionRate / 100) : 0;
    const processingCharge = platformSettings.isPaymentProcessingChargeEnabled ? finalAmount * (platformSettings.paymentProcessingChargeRate / 100) : 0;
    const gstOnFees = platformSettings.isGstEnabled ? (commission + processingCharge) * (platformSettings.gstRate / 100) : 0;
    
    const totalDeductions = commission + processingCharge + gstOnFees + dailyPayoutsReceived;
    const finalPayoutAmount = finalAmount - totalDeductions;

    // --- Helper to convert Data URL to File for upload ---
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
    };

    // --- Form Submission ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if ((payoutMethod === 'bank' && (!bankDetails.accountHolderName.trim() || !bankDetails.accountNumber.trim() || !bankDetails.ifscCode.trim() || !bankDetails.bankName.trim())) || (payoutMethod === 'upi' && !upiId.trim())) {
            setError('Please provide your complete payment details.');
            return;
        }
        if (platformSettings.payoutSettings.requireSelfieForPayout && !selfieDataUrl) {
            setError('A live selfie with ID proof is required for verification.');
            return;
        }

        setIsLoading(true);
        try {
            let selfieUrl: string | undefined = undefined;
            if (platformSettings.payoutSettings.requireSelfieForPayout && selfieDataUrl) {
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
                collabId: collaboration.collabId,
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

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                 <h1 className="text-3xl font-bold text-gray-800">Request Payout</h1>
                 <button onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    &larr; Back to Dashboard
                 </button>
            </div>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                    {/* Collab Details */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h2 className="text-xl font-bold text-gray-800">Collaboration Details</h2>
                        <div className="mt-4 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Title:</span> <span className="font-semibold text-right">{collaborationTitle}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">ID:</span> <span className="font-mono text-xs">{collaboration.id}</span></div>
                            {collaboration.collabId && <div className="flex justify-between"><span className="text-gray-500">Collab ID:</span> <span className="font-mono text-xs">{collaboration.collabId}</span></div>}
                        </div>
                    </div>
                    {/* Payout Calculation */}
                     <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h2 className="text-xl font-bold text-gray-800">Final Payout Calculation</h2>
                        <div className="mt-4 space-y-2 text-sm border-t pt-4">
                            <div className="flex justify-between"><span>Final Agreed Price:</span> <span className="font-semibold">₹{finalAmount.toFixed(2)}</span></div>
                            {platformSettings.isPlatformCommissionEnabled && commission > 0 && (
                                <div className="flex justify-between text-red-600"><span>(-) Platform Commission ({platformSettings.platformCommissionRate}%):</span> <span>- ₹{commission.toFixed(2)}</span></div>
                            )}
                            {platformSettings.isPaymentProcessingChargeEnabled && processingCharge > 0 && (
                                <div className="flex justify-between text-red-600"><span>(-) Payment Processing Charge ({platformSettings.paymentProcessingChargeRate}%):</span> <span>- ₹{processingCharge.toFixed(2)}</span></div>
                            )}
                            {platformSettings.isGstEnabled && gstOnFees > 0 && (
                                 <div className="flex justify-between text-red-600"><span>(-) GST on Fees ({platformSettings.gstRate}%):</span> <span>- ₹{gstOnFees.toFixed(2)}</span></div>
                            )}
                            {dailyPayoutsReceived > 0 && <div className="flex justify-between text-red-600"><span>(-) Daily Payouts Received:</span> <span>- ₹{dailyPayoutsReceived.toFixed(2)}</span></div>}
                            <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span>Final Payout Amount:</span> <span>₹{finalPayoutAmount.toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Payment Details */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h2 className="text-xl font-bold text-gray-800">Payment Details</h2>
                         <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                            <select value={payoutMethod} onChange={e => setPayoutMethod(e.target.value as any)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
                                <option value="bank">Bank Account</option>
                                <option value="upi">UPI ID</option>
                            </select>
                         </div>
                         {payoutMethod === 'bank' ? (
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label htmlFor="accountHolderName" className="block text-sm font-medium text-gray-700">Account Holder Name</label>
                                    <input type="text" id="accountHolderName" name="accountHolderName" value={bankDetails.accountHolderName} onChange={handleBankDetailsChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md"/>
                                </div>
                                <div>
                                    <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">Account Number</label>
                                    <input type="text" id="accountNumber" name="accountNumber" value={bankDetails.accountNumber} onChange={handleBankDetailsChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md"/>
                                </div>
                                <div>
                                    <label htmlFor="ifscCode" className="block text-sm font-medium text-gray-700">IFSC Code</label>
                                    <input type="text" id="ifscCode" name="ifscCode" value={bankDetails.ifscCode} onChange={handleBankDetailsChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md"/>
                                </div>
                                <div>
                                    <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">Bank Name & Branch</label>
                                    <input type="text" id="bankName" name="bankName" value={bankDetails.bankName} onChange={handleBankDetailsChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md"/>
                                </div>
                            </div>
                         ) : (
                             <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700">UPI ID</label>
                                <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi" required className="mt-1 w-full p-2 border border-gray-300 rounded-md"/>
                            </div>
                         )}
                    </div>

                    {/* Selfie Verification */}
                    {platformSettings.payoutSettings.requireSelfieForPayout && (
                        <div className="bg-white p-6 rounded-2xl shadow-lg">
                            <h2 className="text-xl font-bold text-gray-800">Identity Verification</h2>
                            <CameraCapture
                                capturedImage={selfieDataUrl}
                                onCapture={setSelfieDataUrl}
                                onRetake={() => setSelfieDataUrl(null)}
                                selfieInstruction="Hold a valid ID (Aadhaar, PAN, Voter ID) next to your face and take a clear selfie."
                            />
                        </div>
                    )}
                    
                    {error && <p className="text-red-600 text-sm text-center p-3 bg-red-50 rounded-md">{error}</p>}
                    
                    <button type="submit" disabled={isLoading} className="w-full py-4 text-lg font-semibold rounded-lg text-white bg-gradient-to-r from-green-500 to-teal-600 shadow-lg hover:shadow-xl disabled:opacity-50">
                        {isLoading ? 'Submitting...' : 'Submit Payout Request'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PayoutRequestPage;