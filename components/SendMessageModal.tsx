import React, { useState, useRef } from 'react';
import { User, Attachment } from '../types';
import { apiService } from '../services/apiService';
import { ImageIcon, DocumentIcon, AudioIcon, VideoIcon } from './Icons';
// Fix: Import doc, collection, and db from Firebase to create a temporary message ID.
import { collection, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface SendMessageModalProps {
    user: User;
    onClose: () => void;
}

const SendMessageModal: React.FC<SendMessageModalProps> = ({ user, onClose }) => {
    const [recipientEmail, setRecipientEmail] = useState('');
    const [messageText, setMessageText] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileButtonClick = (accept: string) => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = accept;
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments(prev => [...prev, ...Array.from(e.target.files as FileList)]);
        }
    };


    const removeAttachment = (fileToRemove: File) => {
        setAttachments(prev => prev.filter(file => file !== fileToRemove));
    };

    const getFileType = (file: File): Attachment['type'] => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        return 'document';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!recipientEmail.trim()) {
            setError("Recipient email is required.");
            return;
        }
        if (!messageText.trim() && attachments.length === 0) {
            setError("You must include a message or an attachment.");
            return;
        }

        setIsLoading(true);
        try {
            const recipient = await apiService.getUserByEmail(recipientEmail.trim());
            if (!recipient) {
                setError("No user found with that email address.");
                setIsLoading(false);
                return;
            }
            if (recipient.id === user.id) {
                setError("You cannot send a message to yourself.");
                setIsLoading(false);
                return;
            }
            
            // Create a temporary message ID for grouping attachments
            const tempMessageId = doc(collection(db, 'messages')).id;

            const attachmentUploadPromises = attachments.map(async (file) => {
                const url = await apiService.uploadMessageAttachment(tempMessageId, file);
                return {
                    url,
                    type: getFileType(file),
                    name: file.name
                };
            });
            
            const uploadedAttachments = await Promise.all(attachmentUploadPromises);

            await apiService.sendMessage(messageText, user.id, recipient.id, uploadedAttachments);
            setSuccess(`Message sent successfully to ${recipient.name}!`);
            setMessageText('');
            setAttachments([]);
            setRecipientEmail('');
            setTimeout(onClose, 2000);

        } catch (err: any) {
            console.error("Failed to send message:", err);
            setError("An error occurred while sending the message. Please try again.");
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
                
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Send a Message</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="recipient-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Recipient Email</label>
                        <input
                            type="email"
                            id="recipient-email"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            placeholder="recipient@example.com"
                            className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="message-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
                        <textarea
                            id="message-text"
                            rows={5}
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Type your message here..."
                            className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Attachments</label>
                         <div className="mt-2 flex items-center space-x-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
                            <button type="button" onClick={() => handleFileButtonClick('image/*')} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-700"><ImageIcon className="w-5 h-5" /></button>
                            <button type="button" onClick={() => handleFileButtonClick('.pdf,.doc,.docx,.txt')} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-700"><DocumentIcon className="w-5 h-5" /></button>
                            <button type="button" onClick={() => handleFileButtonClick('audio/*')} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-700"><AudioIcon className="w-5 h-5" /></button>
                            <button type="button" onClick={() => handleFileButtonClick('video/*')} className="p-2 text-gray-500 rounded-full hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-700"><VideoIcon className="w-5 h-5" /></button>
                         </div>
                    </div>
                    
                    {attachments.length > 0 && (
                        <div className="space-y-2 max-h-32 overflow-y-auto p-2 border rounded-md dark:border-gray-600">
                            {attachments.map((file, index) => (
                                <div key={index} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                    <span className="truncate text-gray-700 dark:text-gray-300">{file.name}</span>
                                    <button type="button" onClick={() => removeAttachment(file)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500">&times;</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    {success && <p className="text-green-500 text-sm text-center">{success}</p>}
                    
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {isLoading ? 'Sending...' : 'Send Message'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SendMessageModal;