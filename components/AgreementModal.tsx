
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { User, Agreements, CompanyInfo } from '../types';
import { DocumentTextIcon, ProfileIcon } from './Icons';

interface AgreementModalProps {
    user: User;
    onClose: () => void;
}

const AgreementModal: React.FC<AgreementModalProps> = ({ user, onClose }) => {
    const [agreementText, setAgreementText] = useState<string>('');
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch both agreement texts and platform settings (for company info)
                const [agreements, settings] = await Promise.all([
                    apiService.getAgreements(),
                    apiService.getPlatformSettings()
                ]);

                if (settings.companyInfo) {
                    setCompanyInfo(settings.companyInfo);
                }

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
                const processedText = rawText ? rawText.replace(/{{USER_NAME}}/g, user.name) : "No agreement terms have been set by the administrator yet.";
                setAgreementText(processedText);

            } catch (error) {
                console.error("Failed to load data:", error);
                setAgreementText("Failed to load the agreement. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header Section */}
                <div className="bg-gray-100 dark:bg-gray-900 border-b dark:border-gray-700">
                    <div className="p-4 flex justify-between items-start">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <DocumentTextIcon className="w-6 h-6 text-indigo-600" />
                            Agreement Terms
                        </h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl leading-none">&times;</button>
                    </div>

                    {/* Details Block - Top Left (User) & Top Right (Company) */}
                    <div className="px-6 pb-6 pt-2 flex flex-col md:flex-row justify-between gap-6 text-sm">
                        {/* Left: User Details */}
                        <div className="flex-1 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <h3 className="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase mb-2">User Details</h3>
                            <div className="flex items-start gap-3">
                                <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full">
                                    <ProfileIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white text-lg">{user.name}</p>
                                    <p className="text-gray-600 dark:text-gray-300">{user.mobileNumber || user.email}</p>
                                    <div className="flex gap-2 mt-1">
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs capitalize font-medium">{user.role}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${user.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            {user.isBlocked ? 'Blocked' : 'Active'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Company Details (Admin Configured) */}
                        {companyInfo && (
                            <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/50 shadow-sm text-right md:text-right text-left">
                                <h3 className="font-bold text-indigo-500 dark:text-indigo-300 text-xs uppercase mb-2">Company Details</h3>
                                <p className="font-bold text-gray-900 dark:text-white text-lg">{companyInfo.name || "BIGYAPON"}</p>
                                <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line">{companyInfo.address}</p>
                                <p className="text-gray-600 dark:text-gray-300 mt-1">{companyInfo.email}</p>
                                <p className="text-gray-600 dark:text-gray-300">{companyInfo.phone}</p>
                                {companyInfo.gstIn && <p className="text-xs text-gray-500 mt-1">GSTIN: {companyInfo.gstIn}</p>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Agreement Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white dark:bg-gray-800">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-500 dark:text-gray-400">Loading terms...</p>
                        </div>
                    ) : (
                        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-serif">
                            {agreementText}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
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
