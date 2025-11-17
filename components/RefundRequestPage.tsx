import React, { useState, useMemo } from 'react';
import { User, AnyCollaboration, RefundRequest, AdSlotRequest, BannerAdBookingRequest } from '../types';
import { apiService } from '../services/apiService';

interface RefundRequestPageProps {
    user: User;
    collaboration: AnyCollaboration;
    onClose: () => void;
    onSubmitted: () => void;
}

const RefundRequestPage: React.FC<RefundRequestPageProps> = ({ user, collaboration, onClose, onSubmitted }) => {
    const [bankDetails, setBankDetails] = useState('');
    const [panNumber, setPanNumber] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getCollaborationType = (): RefundRequest['collabType'] => {
        if ('campaignTitle' in collaboration) return 'campaign';
        if ('influencerId' in collaboration) return 'direct';
        if ('liveTvId' in collaboration) return 'ad_slot';
        if ('agencyId' in collaboration) return 'banner_booking';
        throw new Error('Could not determine collaboration type');
    };

    // Fix: Add getPartnerDetails function to resolve 'Cannot find name' error.
    const getPartnerDetails = () => {
        if ('influencerId' in collaboration) { // Direct or Campaign
            return { id: collaboration.influencerId, name: collaboration.influencerName, avatar: collaboration.influencerAvatar };
        }
        if ('liveTvId' in collaboration) { // Ad Slot
            return { id: collaboration.liveTvId, name: (collaboration as AdSlotRequest).liveTvName, avatar: (collaboration as AdSlotRequest).liveTvAvatar };
        }
        if ('agencyId' in collaboration) { // Banner Ad
            return { id: collaboration.agencyId, name: (collaboration as BannerAdBookingRequest).agencyName, avatar: (collaboration as BannerAdBookingRequest).agencyAvatar };
        }
        return { id: '', name: 'Unknown Partner', avatar: '' };
    };

    const collaborationTitle = useMemo(() => {
        if ('title' in collaboration) return collaboration.title;
        if ('campaignTitle' in collaboration) return collaboration.campaignTitle;
        if ('campaignName' in collaboration) return collaboration.campaignName;
        return 'Untitled Collaboration';
    }, [collaboration]);
    
    const finalAmountRaw = collaboration?.finalAmount ? parseFloat(String(collaboration.finalAmount).replace(/[^0-9.-]+/g, "")) : 0;
    const finalAmount = isNaN(finalAmountRaw) ? 0 : finalAmountRaw;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!bankDetails.trim() || !panNumber.trim() || !description.trim()) {
            setError("All fields are required to process your refund.");
            return;
        }

        setIsLoading(true);
        try {
            await apiService.createRefundRequest({
                // FIX: Changed property 'collabId' to 'collaborationId' to pass the document ID.
                collaborationId: collaboration.id,
                collabType: getCollaborationType(),
                collabTitle: collaborationTitle,
                brandId: user.id,
                brandName: user.companyName || user.name,
                brandAvatar: user.avatar || '',
                amount: finalAmount,
                bankDetails,
                panNumber,
                description,
                // FIX: Replaced non-existent 'trackingId' with 'collabId' to pass the user-facing ID.
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

    const partner = getPartnerDetails();

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                 <h1 className="text-3xl font-bold text-gray-800">Request Refund</h1>
                 <button onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    &larr; Back to Collaborations
                 </button>
            </div>
            
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg space-y-6">
                 <div className="bg-gray-50 p-4 rounded-lg border">
                    <p><span className="font-semibold">Collaboration:</span> {collaborationTitle}</p>
                    <p><span className="font-semibold">Refund Amount:</span> ₹{finalAmount.toFixed(2)}</p>
                    {collaboration.collabId && <p><span className="font-semibold">Collab ID:</span> <span className="font-mono">{collaboration.collabId}</span></p>}
                </div>
                
                <div>
                    <label htmlFor="bankDetails" className="block text-sm font-medium text-gray-700">Bank Account Details</label>
                    <p className="text-xs text-gray-500 mb-1">Your refund will be processed to this account.</p>
                    <textarea 
                        id="bankDetails" 
                        value={bankDetails}
                        onChange={e => setBankDetails(e.target.value)}
                        rows={4} 
                        placeholder="Account Holder Name&#10;Account Number&#10;IFSC Code&#10;Bank Name & Branch" 
                        required 
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                    />
                </div>

                <div>
                    <label htmlFor="panNumber" className="block text-sm font-medium text-gray-700">PAN Card Number</label>
                    <input
                        type="text"
                        id="panNumber"
                        value={panNumber}
                        onChange={e => setPanNumber(e.target.value.toUpperCase())}
                        required
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                    />
                </div>

                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Reason for Refund</label>
                    <textarea 
                        id="description" 
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={4} 
                        placeholder="Briefly describe why you are requesting a refund for this completed dispute." 
                        required 
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                    />
                </div>

                {error && <p className="text-red-600 text-sm text-center p-3 bg-red-50 rounded-md">{error}</p>}
                
                <button type="submit" disabled={isLoading} className="w-full py-3 text-lg font-semibold rounded-lg text-white bg-gradient-to-r from-red-500 to-orange-600 shadow-lg hover:shadow-xl disabled:opacity-50">
                    {isLoading ? 'Submitting...' : 'Submit Refund Request'}
                </button>
            </form>
        </div>
    );
};

export default RefundRequestPage;
