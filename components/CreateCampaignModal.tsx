import React, { useState } from 'react';
import { User } from '../types';
import { apiService } from '../services/apiService';

interface CreateCampaignModalProps {
    user: User;
    onClose: () => void;
    onCampaignCreated: () => void;
}

const indianCities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh'
];

const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ user, onClose, onCampaignCreated }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Lifestyle');
    const [collaborationType, setCollaborationType] = useState<'paid' | 'barter'>('paid');
    const [influencerCount, setInfluencerCount] = useState(1);
    const [paymentOffer, setPaymentOffer] = useState('');
    const [location, setLocation] = useState('All');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const categories = ['Lifestyle', 'Travel', 'Fitness', 'Technology', 'Food', 'Gaming', 'Fashion', 'Beauty', 'Education', 'Finance'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (influencerCount < 1) {
            setError('Number of influencers must be at least 1.');
            return;
        }

        setIsLoading(true);
        try {
            await apiService.createCampaign({
                brandId: user.id,
                brandName: user.companyName || user.name,
                brandAvatar: user.avatar || `https://i.pravatar.cc/150?u=${user.id}`,
                title,
                description,
                category,
                collaborationType,
                influencerCount: Number(influencerCount),
                paymentOffer,
                location,
            });
            onCampaignCreated();
        } catch (err: any) {
            if (err.message.includes("collaboration limit")) {
                setError(err.message);
            } else {
                setError('Failed to create campaign. Please try again.');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">Create New Campaign</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Campaign Title</label>
                        <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Describe your campaign requirements</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={4} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"></textarea>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Location</label>
                            <select id="location" value={location} onChange={e => setLocation(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                                <option value="All">All Locations</option>
                                {indianCities.sort().map(city => <option key={city} value={city}>{city}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                            <select id="category" value={category} onChange={e => setCategory(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="collaborationType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                            <select id="collaborationType" value={collaborationType} onChange={e => setCollaborationType(e.target.value as 'paid' | 'barter')} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                                <option value="paid">Paid</option>
                                <option value="barter">Barter (Product Exchange)</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="influencerCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Number of influencers needed</label>
                            <input type="number" id="influencerCount" value={influencerCount} onChange={e => setInfluencerCount(Number(e.target.value))} required min="1" className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="paymentOffer" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment offer per user (optional)</label>
                        <input type="text" id="paymentOffer" value={paymentOffer} onChange={e => setPaymentOffer(e.target.value)} placeholder="e.g., $500" className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    </div>
                    
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    
                    <div className="flex justify-end pt-4 space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {isLoading ? 'Creating...' : 'Create Campaign'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateCampaignModal;