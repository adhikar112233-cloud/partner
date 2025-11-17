import React, { useState } from 'react';
import { User, Campaign } from '../types';
import { apiService } from '../services/apiService';

interface ApplyToCampaignModalProps {
    user: User; // The influencer
    campaign: Campaign;
    onClose: () => void;
    onApplied: () => void;
}

const ApplyToCampaignModal: React.FC<ApplyToCampaignModalProps> = ({ user, campaign, onClose, onApplied }) => {
    const [message, setMessage] = useState(`Hi ${campaign.brandName}, I'm interested in your "${campaign.title}" campaign and would love to collaborate!`);
    const [paymentOffer, setPaymentOffer] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        if (campaign.collaborationType === 'paid' && !paymentOffer.trim()) {
            setError('Please specify your payment offer for this paid campaign.');
            setIsLoading(false);
            return;
        }

        try {
            await apiService.applyToCampaign({
                campaignId: campaign.id,
                campaignTitle: campaign.title,
                brandId: campaign.brandId,
                brandName: campaign.brandName,
                brandAvatar: campaign.brandAvatar,
                influencerId: user.id,
                influencerName: user.name,
                influencerAvatar: user.avatar || `https://i.pravatar.cc/150?u=${user.id}`,
                message,
                currentOffer: {
                    amount: `₹${paymentOffer}`,
                    offeredBy: 'influencer',
                },
            });
            setSuccess(true);
            setTimeout(() => {
                onApplied();
            }, 1500);
        } catch (err) {
            console.error(err);
            setError('Failed to submit application. You may have already applied.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-lg relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {success ? (
                    <div className="text-center py-8">
                        <h2 className="text-2xl font-bold text-teal-500">Application Sent!</h2>
                        <p className="text-gray-600 dark:text-gray-300 mt-2">{campaign.brandName} has been notified of your interest.</p>
                    </div>
                ) : (
                    <>
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Apply to Campaign</h2>
                        <p className="text-gray-500 dark:text-gray-400">{campaign.title}</p>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message to Brand</label>
                            <textarea 
                                id="message" 
                                value={message} 
                                onChange={e => setMessage(e.target.value)} 
                                rows={4} 
                                required 
                                className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            ></textarea>
                        </div>
                         <div>
                            <label htmlFor="paymentOffer" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Your Payment Offer {campaign.collaborationType === 'barter' && '(optional)'}
                            </label>
                            <input 
                                id="paymentOffer" 
                                type="number"
                                value={paymentOffer} 
                                onChange={e => setPaymentOffer(e.target.value)} 
                                placeholder={campaign.collaborationType === 'paid' ? "e.g., 15000" : "e.g., 5000 (monetary part of barter)"}
                                required={campaign.collaborationType === 'paid'}
                                className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            />
                        </div>

                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        <div className="flex justify-end pt-4 space-x-3">
                             <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500">Cancel</button>
                             <button type="submit" disabled={isLoading} className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                {isLoading ? 'Submitting...' : 'Submit Application'}
                            </button>
                        </div>
                    </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default ApplyToCampaignModal;