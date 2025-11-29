
import React, { useState, useEffect, useRef } from 'react';
import { User, LiveTvChannel } from '../types';
import { apiService } from '../services/apiService';
import { PencilIcon, SparklesIcon, VerifiedIcon, LiveTvIcon } from './Icons';

interface MyChannelPageProps {
    user: User;
}

const MyChannelPage: React.FC<MyChannelPageProps> = ({ user }) => {
    const [channel, setChannel] = useState<LiveTvChannel | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [niche, setNiche] = useState('');
    const [audienceSize, setAudienceSize] = useState<number>(0);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchChannel = async () => {
            setIsLoading(true);
            try {
                const data = await apiService.getLiveTvChannel(user.id);
                if (data) {
                    setChannel(data);
                    setName(data.name);
                    setDescription(data.description);
                    setNiche(data.niche);
                    setAudienceSize(data.audienceSize);
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load channel details.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchChannel();
    }, [user.id]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                setError("Logo file size is too large. Max 5MB.");
                return;
            }
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
            setError(null);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setIsSaving(true);

        try {
            let logoUrl = channel?.logo || '';
            if (logoFile) {
                logoUrl = await apiService.uploadChannelLogo(user.id, logoFile);
            }

            const updatedData: Partial<LiveTvChannel> = {
                name,
                description,
                niche,
                audienceSize,
                logo: logoUrl
            };

            await apiService.updateLiveTvChannel(user.id, updatedData);
            
            // Update local state
            setChannel(prev => prev ? { ...prev, ...updatedData } : null);
            setIsEditing(false);
            setSuccess("Channel details updated successfully!");
        } catch (err) {
            console.error(err);
            setError("Failed to update channel details.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="text-center p-8 text-gray-500">Loading channel details...</div>;
    if (!channel) return <div className="text-center p-8 text-red-500">Channel not found. Please contact support.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">My Channel</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your Live TV channel presence.</p>
                </div>
                {!isEditing && (
                    <button 
                        onClick={() => setIsEditing(true)} 
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <PencilIcon className="w-4 h-4" /> Edit Details
                    </button>
                )}
            </div>

            {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
            {success && <div className="p-4 bg-green-100 text-green-700 rounded-lg">{success}</div>}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                {/* Header Preview */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-8 text-white relative">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative group">
                            <img 
                                src={logoPreview || channel.logo} 
                                alt={channel.name} 
                                className="w-32 h-32 rounded-xl object-cover border-4 border-white dark:border-gray-700 bg-white"
                            />
                            {isEditing && (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 bg-black bg-opacity-50 rounded-xl flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <span className="text-sm font-bold">Change Logo</span>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileChange} 
                                        accept="image/*" 
                                        className="hidden" 
                                    />
                                </div>
                            )}
                        </div>
                        <div className="text-center sm:text-left">
                            <h2 className="text-2xl font-bold flex items-center justify-center sm:justify-start gap-2">
                                {name || channel.name}
                                {channel.isVerified && <VerifiedIcon className="w-6 h-6 text-blue-400" />}
                            </h2>
                            <p className="text-gray-300 mt-1">{niche || channel.niche}</p>
                            <div className="mt-3 flex gap-2 justify-center sm:justify-start">
                                {channel.isBoosted && (
                                    <span className="px-3 py-1 bg-yellow-500 text-yellow-900 text-xs font-bold rounded-full flex items-center gap-1">
                                        <SparklesIcon className="w-3 h-3" /> Boosted
                                    </span>
                                )}
                                <span className="px-3 py-1 bg-gray-700 text-gray-200 text-xs font-bold rounded-full">
                                    {((audienceSize || channel.audienceSize) / 1_000_000).toFixed(1)}M+ Audience
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Form or View Details */}
                <div className="p-6 sm:p-8">
                    {isEditing ? (
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Name</label>
                                    <input 
                                        type="text" 
                                        value={name} 
                                        onChange={e => setName(e.target.value)} 
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Niche / Category</label>
                                    <select 
                                        value={niche} 
                                        onChange={e => setNiche(e.target.value)} 
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        {['General', 'News', 'Entertainment', 'Sports', 'Music', 'Movies', 'Kids', 'Lifestyle', 'Infotainment'].map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Audience Size</label>
                                    <input 
                                        type="number" 
                                        value={audienceSize} 
                                        onChange={e => setAudienceSize(Number(e.target.value))} 
                                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        min="0"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">This number helps brands understand your reach.</p>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Description</label>
                                <textarea 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)} 
                                    rows={4}
                                    className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                                    placeholder="Describe your channel content and demographics..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                                <button 
                                    type="button" 
                                    onClick={() => { setIsEditing(false); setError(null); }} 
                                    className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6 text-gray-800 dark:text-gray-200">
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Description</h3>
                                <p className="leading-relaxed bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-700">
                                    {description || "No description provided."}
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-700">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Niche</h3>
                                    <p className="text-lg font-medium">{niche}</p>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-700">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Audience</h3>
                                    <p className="text-lg font-medium">{audienceSize.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyChannelPage;
