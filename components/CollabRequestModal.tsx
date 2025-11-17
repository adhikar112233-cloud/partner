import React, { useState } from 'react';
import { User, Influencer, CollaborationRequest } from '../types';
import { apiService } from '../services/apiService';
import { generateCollabProposal } from '../services/geminiService';
import { SparklesIcon } from './Icons';

interface CollabRequestModalProps {
    user: User;
    influencer: Influencer;
    onClose: () => void;
}

const CollabRequestModal: React.FC<CollabRequestModalProps> = ({ user, influencer, onClose }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [budget, setBudget] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleGenerateProposal = async () => {
        if (!title.trim()) {
            setError("Please enter a campaign title/idea first.");
            return;
        }
        setError(null);
        setIsGenerating(true);
        const proposal = await generateCollabProposal(influencer.name, user.companyName || user.name, title);
        setMessage(proposal);
        setIsGenerating(false);
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            setError("Title and message are required.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const requestPayload: any = {
                brandId: user.id,
                influencerId: influencer.id,
                brandName: user.companyName || user.name,
                brandAvatar: user.avatar || `https://i.pravatar.cc/150?u=${user.id}`,
                influencerName: influencer.name,
                influencerAvatar: influencer.avatar,
                title,
                message,
            };
            if (budget) {
                requestPayload.budget = `₹${budget}`;
            }
            await apiService.sendCollabRequest(requestPayload);
            setSuccess(true);
            setTimeout(onClose, 2000);
        } catch (err: any) {
             if (err.message.includes("collaboration limit")) {
              setError(err.message);
            } else {
              setError("Failed to send request. Please try again.");
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {success ? (
                    <div className="text-center py-8">
                        <h2 className="text-2xl font-bold text-teal-500">Request Sent!</h2>
                        <p className="text-gray-600 dark:text-gray-300 mt-2">{influencer.name} has been notified of your collaboration request.</p>
                    </div>
                ) : (
                    <>
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Collaboration Request</h2>
                        <p className="text-gray-500 dark:text-gray-400">to {influencer.name}</p>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Campaign Title / Idea</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                        </div>
                        <div>
                            <div className="flex justify-between items-center">
                                <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                                <button type="button" onClick={handleGenerateProposal} disabled={isGenerating} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50 dark:text-indigo-400 dark:hover:text-indigo-300">
                                    <SparklesIcon className={`w-4 h-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                                    Generate with AI
                                </button>
                            </div>
                            <textarea id="message" value={message} onChange={e => setMessage(e.target.value)} rows={6} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"></textarea>
                        </div>
                         <div>
                            <label htmlFor="budget" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Proposed Budget (Optional)</label>
                            <input type="number" id="budget" value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g., 5000" className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                        </div>

                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        <div className="flex justify-end pt-4 space-x-3">
                             <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500">Cancel</button>
                             <button type="submit" disabled={isLoading} className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                {isLoading ? 'Sending...' : 'Send Request'}
                            </button>
                        </div>
                    </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default CollabRequestModal;