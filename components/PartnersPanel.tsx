
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/apiService';
import { Partner } from '../types';
import { TrashIcon, PencilIcon, ImageIcon } from './Icons';

interface PartnersPanelProps {
    onUpdate: () => void;
}

// Modal for Adding/Editing a Partner
const PartnerModal: React.FC<{
    partner: Partner | null;
    onClose: () => void;
    onSave: () => void;
}> = ({ partner, onClose, onSave }) => {
    const [name, setName] = useState(partner?.name || '');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(partner?.logoUrl || null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            if (logoPreview) {
                URL.revokeObjectURL(logoPreview);
            }
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); // Prevent default form submission
        
        if (!name.trim()) {
            setError('Partner name is required.');
            return;
        }
        if (!partner && !logoFile) {
            setError('A logo image is required for a new partner.');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            let logoUrl = partner?.logoUrl || '';

            if (logoFile) {
                try {
                    logoUrl = await apiService.uploadPartnerLogo(logoFile);
                } catch (uploadError: any) {
                    console.error("Upload failed:", uploadError);
                    throw new Error(uploadError.message || 'Failed to upload logo image.');
                }
            }
            
            if (partner) { // Editing existing partner
                await apiService.updatePartner(partner.id, { name, logoUrl });
            } else { // Creating new partner
                await apiService.createPartner({ name, logoUrl });
            }
            
            onSave();
            onClose();

        } catch (err: any) {
            console.error("Save partner failed:", err);
            setError(err.message || 'Failed to save partner. Please check your connection and try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-100">{partner ? 'Edit Partner' : 'Add New Partner'}</h3>
                <form onSubmit={handleSave}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Partner Name</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" 
                                placeholder="e.g., Flipkart, Zomato"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Logo Image</label>
                            <div className="mt-1 p-4 border-2 border-dashed rounded-md flex flex-col items-center justify-center dark:border-gray-600">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo preview" className="max-h-24 w-auto rounded object-contain" />
                                ) : (
                                    <ImageIcon className="w-12 h-12 text-gray-400" />
                                )}
                                <button 
                                    type="button" 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                                >
                                    {logoPreview ? 'Change Image' : 'Select Image'}
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    accept="image/*" 
                                    className="hidden" 
                                />
                            </div>
                        </div>
                        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded dark:bg-red-900/30 dark:text-red-400">{error}</p>}
                    </div>
                    <div className="flex justify-end space-x-2 mt-6">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={isSaving} 
                            className="px-4 py-2 text-sm rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSaving} 
                            className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const PartnersPanel: React.FC<PartnersPanelProps> = ({ onUpdate }) => {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

    const fetchPartners = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getPartners();
            setPartners(data);
        } catch (err) {
            setError('Failed to load partners.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPartners();
    }, [fetchPartners]);

    const handleOpenAddModal = () => {
        setEditingPartner(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (partner: Partner) => {
        setEditingPartner(partner);
        setIsModalOpen(true);
    };

    const handleDelete = async (partner: Partner) => {
        if (window.confirm(`Are you sure you want to delete the partner "${partner.name}"?`)) {
            try {
                await apiService.deletePartner(partner.id);
                fetchPartners();
                onUpdate();
            } catch (err) {
                setError('Failed to delete partner.');
            }
        }
    };
    
    const handleSave = () => {
        fetchPartners();
        onUpdate();
    };


    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Manage Our Partners</h2>
                <button onClick={handleOpenAddModal} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">
                    Add New Partner
                </button>
            </div>

            {isLoading && <p className="dark:text-gray-300">Loading partners...</p>}
            {error && <p className="text-red-500">{error}</p>}
            
            {!isLoading && !error && (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {partners.map(partner => (
                            <div key={partner.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col items-center">
                                <div className="h-20 w-full flex items-center justify-center mb-4">
                                     <img src={partner.logoUrl} alt={partner.name} className="max-h-full max-w-full object-contain" />
                                </div>
                                <p className="font-semibold text-center flex-grow dark:text-gray-200">{partner.name}</p>
                                <div className="mt-4 flex gap-2 w-full">
                                    <button onClick={() => handleOpenEditModal(partner)} className="flex-1 p-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 flex items-center justify-center gap-1">
                                        <PencilIcon className="w-4 h-4" /> Edit
                                    </button>
                                    <button onClick={() => handleDelete(partner)} className="flex-1 p-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center gap-1">
                                        <TrashIcon className="w-4 h-4" /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                         {partners.length === 0 && (
                            <div className="col-span-full text-center py-10">
                                <p className="text-gray-500 dark:text-gray-400">No partners have been added yet. Add brands like Flipkart, Zomato, etc.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {isModalOpen && (
                <PartnerModal 
                    partner={editingPartner}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default PartnersPanel;
