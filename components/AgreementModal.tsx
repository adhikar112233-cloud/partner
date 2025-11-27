
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { User, Agreements } from '../types';
import { DocumentTextIcon } from './Icons';

interface AgreementModalProps {
    user: User;
    onClose: () => void;
}

const AgreementModal: React.FC<AgreementModalProps> = ({ user, onClose }) => {
    const [agreementText, setAgreementText] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAgreement = async () => {
            setIsLoading(true);
            try {
                const agreements = await apiService.getAgreements();
                let rawText = '';
                
                // Select agreement based on role
                switch (user.role) {
                    case 'brand': rawText = agreements.brand; break;
                    case 'influencer': rawText = agreements.influencer; break;
                    case 'livetv': rawText = agreements.livetv; break;
                    case 'banneragency': rawText = agreements.banneragency; break;
                    default: rawText = "No specific agreement found for your role.";
                }

                // Replace Placeholder
                // Using regex with global flag to replace all occurrences
                const processedText = rawText ? rawText.replace(/{{USER_NAME}}/g, user.name) : "No agreement terms have been set by the administrator yet.";
                setAgreementText(processedText);

            } catch (error) {
                console.error("Failed to load agreement:", error);
                setAgreementText("Failed to load the agreement. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAgreement();
    }, [user]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <DocumentTextIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Agreement with BIGYAPON</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">Terms for {user.role}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl leading-none">&times;</button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-500 dark:text-gray-400">Loading terms...</p>
                        </div>
                    ) : (
                        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {agreementText}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl flex justify-end">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-md transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AgreementModal;
