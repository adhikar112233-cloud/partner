import React, { useState, useMemo } from 'react';
import { User, CollaborationRequest, CampaignApplication, AdSlotRequest, BannerAdBookingRequest } from '../types';
import { apiService } from '../services/apiService';

type AnyCollab = CollaborationRequest | CampaignApplication | AdSlotRequest | BannerAdBookingRequest;

interface DisputeModalProps {
    user: User;
    collaboration: AnyCollab;
    onClose: () => void;
    onDisputeSubmitted: () => void;
}

const DisputeModal: React.FC<DisputeModalProps> = ({ user, collaboration, onClose, onDisputeSubmitted }) => {
    const [reason, setReason] = useState('');
    const [mobileNumber, setMobileNumber] = useState(user.mobileNumber || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getCollaborationType = (): 'direct' | 'campaign' | 'ad_slot' | 'banner_booking' => {
        if ('campaignTitle' in collaboration) return 'campaign';
        if ('influencerId' in collaboration) return 'direct';
        if ('liveTvId' in collaboration) return 'ad_slot';
        if ('agencyId' in collaboration) return 'banner_booking';
        throw new Error('Unknown collaboration type');
    };

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
        return 'Untitled Collaboration'; // Fallback to prevent undefined
    }, [collaboration]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (user.role === 'brand') {
            if (!mobileNumber.trim() || !/^\d{10,15}$/.test(mobileNumber.trim())) {
                setError("Please provide a valid contact mobile number (10-15 digits).");
                return;
            }
        }

        if (!reason.trim()) {
            setError("Please explain the issue.");
            return;
        }

        setIsLoading(true);
        try {
             // Update user profile if mobile number has changed
            if (user.role === 'brand' && mobileNumber.trim() !== user.mobileNumber) {
                await apiService.updateUserProfile(user.id, { mobileNumber: mobileNumber.trim() });
            }

            const collabType = getCollaborationType();
            const partner = getPartnerDetails();
            const finalAmountRaw = collaboration?.finalAmount ? parseFloat(String(collaboration.finalAmount).replace(/[^0-9.-]+/g, "")) : 0;
            const finalAmount = isNaN(finalAmountRaw) ? 0 : finalAmountRaw;

            await apiService.createDispute({
                collaborationId: collaboration.id,
                collaborationType: collabType,
                collaborationTitle: collaborationTitle,
                disputedById: user.id,
                disputedByName: user.companyName || user.name,
                disputedByAvatar: user.avatar || '',
                disputedAgainstId: partner.id,
                disputedAgainstName: partner.name,
                disputedAgainstAvatar: partner.avatar,
                reason,
                amount: finalAmount,
                collabId: collaboration.collabId,
            });
            onDisputeSubmitted();
        } catch (err) {
            console.error(err);
            setError("Failed to raise dispute. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const partner = getPartnerDetails();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-lg relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100">&times;</button>
                <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-2">Raise a Dispute</h2>
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">Explain the issue with this collaboration. An admin will review it.</p>
                
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border dark:border-gray-600 mb-4 dark:text-gray-300">
                    <p><span className="font-semibold">Collaboration:</span> {collaborationTitle}</p>
                    <p><span className="font-semibold">Partner:</span> {partner.name}</p>
                    {collaboration.collabId && <p><span className="font-semibold">Collab ID:</span> <span className="font-mono">{collaboration.collabId}</span></p>}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {user.role === 'brand' && (
                        <div>
                            <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contact Mobile Number</label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">We will contact you on this number regarding your dispute.</p>
                            <input
                                type="tel"
                                id="mobileNumber"
                                value={mobileNumber}
                                onChange={(e) => setMobileNumber(e.target.value)}
                                required
                                pattern="^\d{10,15}$"
                                title="Please enter a valid mobile number (10-15 digits)."
                                placeholder="Enter your mobile number"
                                className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            />
                        </div>
                    )}
                    <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">What is the issue?</label>
                        <textarea 
                            id="reason" 
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={5} required 
                            className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <div className="flex justify-end pt-4 space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-6 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                            {isLoading ? 'Submitting...' : 'Submit Dispute'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DisputeModal;
