import React, { useState } from 'react';
import { User, BannerAd } from '../types';
import { apiService } from '../services/apiService';

interface BannerAdBookingModalProps {
    user: User;
    ad: BannerAd;
    onClose: () => void;
}

const BannerAdBookingModal: React.FC<BannerAdBookingModalProps> = ({ user, ad, onClose }) => {
    const [campaignName, setCampaignName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!campaignName || !startDate || !endDate) {
            setError("Please fill in all required fields.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            await apiService.sendBannerAdBookingRequest({
                brandId: user.id,
                brandName: user.companyName || user.name,
                brandAvatar: user.avatar || '',
                agencyId: ad.agencyId,
                agencyName: ad.agencyName,
                agencyAvatar: ad.agencyAvatar,
                bannerAdId: ad.id,
                bannerAdLocation: ad.location,
                campaignName,
                startDate,
                endDate,
            });
            setSuccess(true);
            setTimeout(onClose, 2000);
        } catch (err: any) {
            if (err.message.includes("collaboration limit")) {
                setError(err.message);
            } else {
                setError("Failed to send booking request. Please try again.");
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-lg relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                 {success ? (
                    <div className="text-center py-8">
                        <h2 className="text-2xl font-bold text-teal-500">Request Sent!</h2>
                        <p className="text-gray-600 dark:text-gray-300 mt-2">Your booking request has been sent to {ad.agencyName}.</p>
                    </div>
                ) : (
                    <>
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Book Banner Ad</h2>
                        <p className="text-gray-500 dark:text-gray-400">{ad.address}, {ad.location}</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="campaignName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Campaign Name</label>
                            <input type="text" id="campaignName" value={campaignName} onChange={e => setCampaignName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                                <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                            </div>
                            <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                                <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                            </div>
                        </div>
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        <div className="flex justify-end pt-4 space-x-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500">Cancel</button>
                            <button type="submit" disabled={isLoading} className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                {isLoading ? 'Sending...' : 'Send Booking Request'}
                            </button>
                        </div>
                    </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default BannerAdBookingModal;