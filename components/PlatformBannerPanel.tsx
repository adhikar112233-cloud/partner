

import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { generateImageFromPrompt, enhanceImagePrompt } from '../services/geminiService';
import { PlatformBanner } from '../types';
import { SparklesIcon, TrashIcon, ImageIcon } from './Icons';

// Reusing ToggleSwitch from AdminPanel
const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
    <button
        type="button"
        className={`${enabled ? 'bg-indigo-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
    >
        <span
            aria-hidden="true"
            className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);

// Helper function to convert base64 string to a File object for uploading.
const base64ToFile = (base64: string, filename: string): File => {
    const dataUrl = `data:image/png;base64,${base64}`;
    const arr = dataUrl.split(',');
    // The first part of the array is the mime type, the second is the data
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error('Invalid data URL for file conversion');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
};

// Confirmation Modal Component
const ConfirmationModal: React.FC<{
    onConfirm: () => void;
    onCancel: () => void;
    isSaving: boolean;
    bannerDetails: { title: string; targetUrl: string };
}> = ({ onConfirm, onCancel, isSaving, bannerDetails }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Confirm Banner Creation</h3>
            <div className="my-4 text-gray-600 dark:text-gray-300 space-y-2">
                <p>Please confirm you want to create the following banner:</p>
                <ul className="text-sm list-disc list-inside bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                    <li><strong>Title:</strong> {bannerDetails.title}</li>
                    <li className="truncate"><strong>URL:</strong> {bannerDetails.targetUrl}</li>
                </ul>
            </div>
            <div className="flex justify-end gap-4 mt-6">
                <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    disabled={isSaving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Confirm & Save'}
                </button>
            </div>
        </div>
    </div>
);


const PlatformBannerPanel: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
    const [banners, setBanners] = useState<PlatformBanner[]>([]);
    const [isLoadingBanners, setIsLoadingBanners] = useState(true);

    // Form state
    const [title, setTitle] = useState('');
    const [targetUrl, setTargetUrl] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null); // base64 string
    const [manualImageFile, setManualImageFile] = useState<File | null>(null);
    const [manualImagePreview, setManualImagePreview] = useState<string | null>(null);
    const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const fetchBanners = useCallback(async () => {
        setIsLoadingBanners(true);
        try {
            const data = await apiService.getPlatformBanners();
            setBanners(data);
        } catch (err) {
            setError('Failed to load banners.');
        } finally {
            setIsLoadingBanners(false);
        }
    }, []);

    useEffect(() => {
        fetchBanners();
    }, [fetchBanners]);

    const handleGenerateImage = async () => {
        if (!aiPrompt.trim()) {
            setError('Please enter a prompt for the AI.');
            return;
        }
        setError(null);
        setWarning(null);
        setIsGenerating(true);
        setGeneratedImage(null);
        setManualImageFile(null);
        setManualImagePreview(null);
    
        try {
            const result = await generateImageFromPrompt(aiPrompt);
    
            // FIX: Restructured the logic to check for the failure case first (`result.success === false`).
            // This helps TypeScript correctly narrow down the discriminated union type within each block,
            // resolving the error where `reason` and `message` were not found on the `result` type.
            if (result.success === false) {
                // Handle failure case where `reason` and `message` exist
                if (result.reason === 'NO_IMAGE') {
                    setWarning("Couldn't generate an image. Trying to improve your prompt...");
                    try {
                        const enhancedPrompt = await enhanceImagePrompt(aiPrompt);
                        setAiPrompt(enhancedPrompt);
                        setWarning("We've enhanced your prompt for you! Try generating again.");
                    } catch (e) {
                        setError("Failed to enhance the prompt. Please try rephrasing it manually.");
                        setWarning(null);
                    }
                } else {
                    setWarning(result.message);
                }
            } else {
                // Handle success case where `data` exists
                setGeneratedImage(result.data);
            }
        } catch (e) {
            console.error("Failed to generate image:", e);
            setError("An unexpected error occurred during image generation.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleManualFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setManualImageFile(file);
            setGeneratedImage(null);
            if (manualImagePreview) {
                URL.revokeObjectURL(manualImagePreview);
            }
            setManualImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!title.trim() || !targetUrl.trim()) {
            setError('Title and Target URL are required.');
            setShowConfirmModal(false);
            return;
        }
        if (!generatedImage && !manualImageFile) {
            setError('An image is required. Please generate one with AI or upload one manually.');
            setShowConfirmModal(false);
            return;
        }
    
        setIsSaving(true);
        setError(null);
        try {
            let imageToUpload: File;
            if (generatedImage) {
                imageToUpload = base64ToFile(generatedImage, `ai_banner_${Date.now()}.png`);
            } else if (manualImageFile) {
                imageToUpload = manualImageFile;
            } else {
                throw new Error("No image available for upload.");
            }
    
            const imageUrl = await apiService.uploadPlatformBannerImage(imageToUpload);
            
            await apiService.createPlatformBanner({
                title,
                targetUrl,
                imageUrl,
                isActive: true, // Banners are active by default
            });

            // Reset form
            setTitle('');
            setTargetUrl('');
            setAiPrompt('');
            setGeneratedImage(null);
            setManualImageFile(null);
            setManualImagePreview(null);
            
            fetchBanners(); // Refresh the list
            onUpdate(); // Notify parent
            
        } catch (err) {
            console.error(err);
            setError('Failed to save banner.');
        } finally {
            setIsSaving(false);
            setShowConfirmModal(false);
        }
    };
    
    const handleToggleActive = async (banner: PlatformBanner) => {
        try {
            await apiService.updatePlatformBanner(banner.id, { isActive: !banner.isActive });
            fetchBanners();
            onUpdate();
        } catch (err) {
            console.error("Failed to update banner status:", err);
            setError("Failed to update banner status.");
        }
    };

    const handleDelete = async (banner: PlatformBanner) => {
        if (window.confirm(`Are you sure you want to delete the banner "${banner.title}"?`)) {
            try {
                await apiService.deletePlatformBanner(banner.id);
                fetchBanners();
                onUpdate();
            } catch (err) {
                console.error("Failed to delete banner:", err);
                setError("Failed to delete banner.");
            }
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Manage Platform Banners</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Column */}
                <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow-sm space-y-4">
                    <h3 className="font-bold text-lg">Create New Banner</h3>
                    <input type="text" placeholder="Banner Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded-md" />
                    <input type="url" placeholder="Target URL (https://...)" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} className="w-full p-2 border rounded-md" />
                    
                    {/* Creation Mode Toggle */}
                    <div className="flex bg-gray-100 rounded-md p-1">
                        <button onClick={() => setCreationMode('ai')} className={`w-1/2 p-1 rounded-md text-sm font-semibold ${creationMode === 'ai' ? 'bg-white shadow' : ''}`}>AI Generate</button>
                        <button onClick={() => setCreationMode('manual')} className={`w-1/2 p-1 rounded-md text-sm font-semibold ${creationMode === 'manual' ? 'bg-white shadow' : ''}`}>Manual Upload</button>
                    </div>

                    {/* AI Generation */}
                    {creationMode === 'ai' && (
                        <div className="space-y-2">
                             <textarea placeholder="Describe the banner image (e.g., 'A vibrant banner for a fashion sale...')" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={3} className="w-full p-2 border rounded-md" />
                             <button onClick={handleGenerateImage} disabled={isGenerating} className="w-full p-2 bg-indigo-500 text-white rounded-md flex items-center justify-center gap-2 disabled:opacity-50">
                                <SparklesIcon className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
                                {isGenerating ? 'Generating...' : 'Generate Image'}
                             </button>
                             {warning && <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded-md">{warning}</p>}
                        </div>
                    )}
                    
                    {/* Manual Upload */}
                    {creationMode === 'manual' && (
                        <div className="p-4 border-2 border-dashed rounded-md flex items-center justify-center">
                            <label htmlFor="manual-image-upload" className="cursor-pointer text-center">
                                <ImageIcon className="w-8 h-8 mx-auto text-gray-400" />
                                <span className="mt-2 block text-sm font-medium text-indigo-600">Click to upload</span>
                                <input id="manual-image-upload" type="file" accept="image/*" className="hidden" onChange={handleManualFileChange} />
                            </label>
                        </div>
                    )}
                    
                    {/* Image Preview */}
                    <div className="bg-gray-100 rounded-md p-2 flex items-center justify-center min-h-24">
                        {generatedImage ? <img src={`data:image/png;base64,${generatedImage}`} alt="AI Generated Banner" className="max-w-full max-h-32 rounded" /> :
                         manualImagePreview ? <img src={manualImagePreview} alt="Manual Upload Preview" className="max-w-full max-h-32 rounded" /> :
                         <span className="text-sm text-gray-500">Image Preview</span>}
                    </div>

                    {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md">{error}</p>}
                    <button onClick={() => setShowConfirmModal(true)} disabled={isSaving} className="w-full p-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50">Save Banner</button>
                </div>

                {/* List Column */}
                <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow-sm">
                    <h3 className="font-bold text-lg mb-4">Current Banners</h3>
                    <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                        {isLoadingBanners ? <p>Loading...</p> : banners.map(banner => (
                            <div key={banner.id} className="flex items-center gap-4 p-2 border rounded-md">
                                <img src={banner.imageUrl} alt={banner.title} className="w-24 h-12 object-cover rounded" />
                                <div className="flex-1">
                                    <p className="font-semibold">{banner.title}</p>
                                    <a href={banner.targetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 truncate block">{banner.targetUrl}</a>
                                </div>
                                <div className="flex items-center gap-4">
                                    <ToggleSwitch enabled={banner.isActive} onChange={() => handleToggleActive(banner)} />
                                    <button onClick={() => handleDelete(banner)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showConfirmModal && (
                <ConfirmationModal
                    onConfirm={handleSave}
                    onCancel={() => setShowConfirmModal(false)}
                    isSaving={isSaving}
                    bannerDetails={{ title, targetUrl }}
                />
            )}
        </div>
    );
};

export default PlatformBannerPanel;