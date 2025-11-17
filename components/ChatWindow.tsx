import React, { useState, useEffect, useRef } from 'react';
import { Influencer, Message, User, Attachment } from '../types';
import { generateMessageDraft } from '../services/geminiService';
import { SparklesIcon, ImageIcon, DocumentIcon, AudioIcon, VideoIcon } from './Icons';
import { apiService } from '../services/apiService';
// Fix: Corrected Firebase import for 'collection' and 'doc' to align with Firebase v9 modular syntax.
import { collection, doc } from 'firebase/firestore';
import { db } from '../services/firebase';


interface ChatWindowProps {
  user: User;
  influencer: Influencer; // Note: This could be a brand, influencer, etc. The type is just for structure.
  onClose: () => void;
}

const getFileType = (file: File): Attachment['type'] => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
};

const ChatWindow: React.FC<ChatWindowProps> = ({ user, influencer, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const unsubscribe = apiService.getMessagesListener(
            user.id,
            influencer.id,
            (fetchedMessages) => {
                setMessages(fetchedMessages);
            },
            (error) => {
                console.error("Error fetching real-time messages:", error);
            }
        );
    
        // Cleanup listener on component unmount
        return () => unsubscribe();
    }, [user.id, influencer.id]);

    useEffect(scrollToBottom, [messages]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments(prev => [...prev, ...Array.from(e.target.files as FileList)]);
        }
        // Reset file input to allow selecting the same file again
        if(e.target) e.target.value = '';
    };

    const handleFileButtonClick = (accept: string) => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = accept;
            fileInputRef.current.click();
        }
    };

    const removeAttachment = (fileToRemove: File) => {
        setAttachments(prev => prev.filter(file => file !== fileToRemove));
    };

    const handleSendMessage = async (e: React.FormEvent | React.KeyboardEvent | React.MouseEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '' && attachments.length === 0) return;

        // Temporarily disable input while sending
        const originalMessage = newMessage;
        const originalAttachments = [...attachments];
        setNewMessage('');
        setAttachments([]);

        try {
            const tempMessageId = doc(collection(db, 'messages')).id;
            const attachmentUploadPromises = originalAttachments.map(async (file) => {
                const url = await apiService.uploadMessageAttachment(tempMessageId, file);
                return { url, type: getFileType(file), name: file.name };
            });
            
            const uploadedAttachments = await Promise.all(attachmentUploadPromises);

            await apiService.sendMessage(originalMessage, user.id, influencer.id, uploadedAttachments);
            // No need to manually add to state, listener will pick it up
        } catch (error) {
            console.error("Failed to send message:", error);
            // Revert UI on failure
            setNewMessage(originalMessage);
            setAttachments(originalAttachments);
        }
    };

    const handleGenerateMessage = async () => {
        setIsGenerating(true);
        const draft = await generateMessageDraft(influencer.name, influencer.niche);
        setNewMessage(draft);
        setIsGenerating(false);
    };

    const AttachmentPreview: React.FC<{ file: File, onRemove: () => void }> = ({ file, onRemove }) => {
        const type = getFileType(file);
        const icon = {
            image: <ImageIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />,
            document: <DocumentIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />,
            audio: <AudioIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />,
            video: <VideoIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        }[type];
        
        return (
            <div className="flex items-center justify-between text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                <div className="flex items-center space-x-2 truncate">
                    {icon}
                    <span className="truncate text-gray-700 dark:text-gray-300">{file.name}</span>
                </div>
                <button type="button" onClick={onRemove} className="text-red-500 hover:text-red-700 font-bold flex-shrink-0 dark:text-red-400 dark:hover:text-red-500">&times;</button>
            </div>
        )
    };

    return (
        <div className="fixed bottom-4 right-4 sm:right-10 w-[90vw] max-w-md h-[70vh] max-h-[500px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-300">
            <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl dark:bg-gray-700 dark:border-gray-600">
                <div className="flex items-center space-x-3">
                    <img src={influencer.avatar} alt={influencer.name} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                        <h3 className="font-bold text-gray-800 dark:text-gray-100">{influencer.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Online</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </header>

            <main className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map(msg => {
                    const isMe = msg.senderId === user.id;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-sm px-4 py-3 rounded-2xl ${isMe ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100'}`}>
                                {msg.text && <p className="text-sm">{msg.text}</p>}
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                        {msg.attachments.map((att, index) => (
                                             <a href={att.url} target="_blank" rel="noopener noreferrer" key={index} className="flex items-center space-x-2 p-2 bg-black bg-opacity-10 rounded-lg hover:bg-opacity-20">
                                                {att.type === 'image' && <ImageIcon className="w-5 h-5 flex-shrink-0" />}
                                                {att.type === 'document' && <DocumentIcon className="w-5 h-5 flex-shrink-0" />}
                                                {att.type === 'audio' && <AudioIcon className="w-5 h-5 flex-shrink-0" />}
                                                {att.type === 'video' && <VideoIcon className="w-5 h-5 flex-shrink-0" />}
                                                <span className="text-xs truncate">{att.name}</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                                <p className={`text-xs mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>{msg.timestamp}</p>
                            </div>
                        </div>
                    )
                })}
                <div ref={messagesEndRef} />
            </main>

            <footer className="p-4 border-t border-gray-200 dark:border-gray-600">
                {attachments.length > 0 && (
                    <div className="space-y-2 mb-2 max-h-24 overflow-y-auto">
                        {attachments.map((file, index) => <AttachmentPreview key={index} file={file} onRemove={() => removeAttachment(file)} />)}
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="relative">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                        placeholder="Type your message..."
                        rows={1}
                        className="w-full p-3 pl-4 pr-40 text-sm text-gray-700 bg-gray-100 rounded-lg border-transparent focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none dark:bg-gray-700 dark:text-gray-200 dark:focus:bg-gray-600"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                        <button type="button" title="Image" onClick={() => handleFileButtonClick('image/*')} className="p-1.5 text-gray-500 rounded-full hover:bg-gray-200 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-600"><ImageIcon className="w-5 h-5" /></button>
                        <button type="button" title="Document" onClick={() => handleFileButtonClick('.pdf,.doc,.docx,.txt')} className="p-1.5 text-gray-500 rounded-full hover:bg-gray-200 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-gray-600"><DocumentIcon className="w-5 h-5" /></button>
                        
                        <button
                            type="button"
                            onClick={handleGenerateMessage}
                            disabled={isGenerating}
                            className="p-1.5 text-indigo-600 rounded-full hover:bg-indigo-100 disabled:opacity-50 dark:hover:bg-gray-600"
                            title="Generate with AI"
                        >
                            <SparklesIcon className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={handleSendMessage}
                            className="p-2 ml-1 text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors"
                            title="Send Message"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                        </button>
                    </div>
                </form>
            </footer>
        </div>
    );
};

export default ChatWindow;