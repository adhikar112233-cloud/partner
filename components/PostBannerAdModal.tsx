
import React, { useState, useMemo, useRef } from 'react';
import { User } from '../types';
import { apiService } from '../services/apiService';

interface PostBannerAdModalProps {
    user: User;
    onClose: () => void;
    onAdPosted: () => void;
}

const indianCities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh'
];

const bannerTypes = [
    'Billboards',
    'Posters',
    'Transit Advertising',
    'Street Furniture Advertising',
    'Wallscapes and Murals',
    'Digital Out Of Home (DOOH)',
    'Mobile Billboards',
    'Event and Stadium Advertising',
];


const PostBannerAdModal: React.FC<PostBannerAdModalProps> = ({ user, onClose, onAdPosted }) => {
    const [location, setLocation] = useState('Mumbai');
    const [address, setAddress] = useState('');
    const [size, setSize] = useState('');
    const [feePerDay, setFeePerDay] = useState(0);
    const [bannerType, setBannerType] = useState(bannerTypes[0]);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPhotoFile(file);
            if (photoPreview) {
                URL.revokeObjectURL(photoPreview);
            }
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!address || !size || feePerDay <= 0) {
            setError("Please fill all required fields (Address, Size, and Fee).");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            let photoUrl = 'https://placehold.co/600x400/cccccc/ffffff?text=No+Image'; // Default placeholder
            if (photoFile) {
                photoUrl = await apiService.uploadBannerAdPhoto(user.id, photoFile);
            }

            await apiService.createBannerAd({
                agencyId: user.id,
                agencyName: user.companyName || user.name,
                agencyAvatar: user.avatar || '',
                location,
                address,
                photoUrl,
                size,
                feePerDay,
                bannerType,
            });
            onAdPosted();
            onClose();
        } catch (err) {
            console.error(err);
            setError("Failed to post ad. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">Post New Banner Ad</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">City</label>
                            <select id="location" value={location} onChange={e => setLocation(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                                {indianCities.sort().map(city => <option key={city} value={city}>{city}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="bannerType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Banner Type</label>
                            <select id="bannerType" value={bannerType} onChange={e => setBannerType(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                                {bannerTypes.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Specific Address / Landmark</label>
                        <input type="text" id="address" value={address} onChange={e => setAddress(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="size" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Banner Size (e.g., 40x20 ft)</label>
                            <input type="text" id="size" value={size} onChange={e => setSize(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                        </div>
                        <div>
                            <label htmlFor="feePerDay" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fee per Day (INR)</label>
                            <input type="number" id="feePerDay" value={feePerDay} onChange={e => setFeePerDay(Number(e.target.value))} required min="0" className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Banner Photo (Optional)</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md dark:border-gray-600">
                            <div className="space-y-1 text-center">
                                {photoPreview ? (
                                    <img src={photoPreview} alt="Banner preview" className="mx-auto h-24 w-auto rounded-md" />
                                ) : (
                                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                                )}
                                <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                        <span>Upload a file</span>
                                        <input id="file-upload" name="file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="sr-only" />
                                    </label>
                                    <p className="pl-1">or drag and drop</p>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-500">PNG or JPG up to 10MB</p>
                            </div>
                        </div>
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <div className="flex justify-end pt-4 space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {isLoading ? 'Posting...' : 'Post Ad'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PostBannerAdModal;
