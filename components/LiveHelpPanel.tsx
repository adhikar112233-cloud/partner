

// ... (imports)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, LiveHelpSession, LiveHelpMessage, QuickReply } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { apiService } from '../services/apiService';
import { CogIcon, TrashIcon, PencilIcon } from './Icons';

// ... (ManageQuickRepliesModal remains same)
const ManageQuickRepliesModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    quickReplies: QuickReply[];
}> = ({ isOpen, onClose, quickReplies }) => {
    // ... (content same as before)
    const [newReplyText, setNewReplyText] = useState('');
    const [editingReply, setEditingReply] = useState<{ id: string; text: string } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAdd = async () => {
        if (!newReplyText.trim()) return;
        setIsProcessing(true);
        await apiService.addQuickReply(newReplyText);
        setNewReplyText('');
        setIsProcessing(false);
    };

    const handleUpdate = async () => {
        if (!editingReply || !editingReply.text.trim()) return;
        setIsProcessing(true);
        await apiService.updateQuickReply(editingReply.id, editingReply.text);
        setEditingReply(null);
        setIsProcessing(false);
    };
    
    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this quick reply?')) {
            setIsProcessing(true);
            await apiService.deleteQuickReply(id);
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Manage Quick Replies</h3>
                    <button onClick={onClose} disabled={isProcessing} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {quickReplies.map(reply => (
                        <div key={reply.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                            {editingReply?.id === reply.id ? (
                                <input 
                                    type="text"
                                    value={editingReply.text}
                                    onChange={(e) => setEditingReply({ ...editingReply, text: e.target.value })}
                                    className="flex-1 p-1 border rounded-md dark:bg-gray-600 dark:border-gray-500"
                                />
                            ) : (
                                <p className="flex-1 text-sm dark:text-gray-200">{reply.text}</p>
                            )}
                            
                            {editingReply?.id === reply.id ? (
                                <div className="flex gap-2">
                                    <button onClick={handleUpdate} disabled={isProcessing} className="text-green-600 hover:text-green-800">Save</button>
                                    <button onClick={() => setEditingReply(null)} disabled={isProcessing} className="text-gray-600 hover:text-gray-800">Cancel</button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingReply({ id: reply.id, text: reply.text })} disabled={isProcessing} className="text-blue-600 hover:text-blue-800"><PencilIcon className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(reply.id)} disabled={isProcessing} className="text-red-600 hover:text-red-800"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t dark:border-gray-600 flex items-center gap-2">
                    <input 
                        type="text"
                        placeholder="Add a new quick reply..."
                        value={newReplyText}
                        onChange={(e) => setNewReplyText(e.target.value)}
                        className="flex-1 p-2 border rounded-md dark:bg-gray-600 dark:border-gray-500"
                    />
                    <button onClick={handleAdd} disabled={isProcessing || !newReplyText.trim()} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50">
                        Add
                    </button>
                </div>
            </div>
        </div>
    );
};


const ConversationView: React.FC<{ 
    session: LiveHelpSession; 
    adminUser: User; 
    quickReplies: QuickReply[];
    onManageReplies: () => void;
}> = ({ session, adminUser, quickReplies, onManageReplies }) => {
    const [messages, setMessages] = useState<LiveHelpMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const messagesRef = collection(db, `live_help_sessions/${session.id}/messages`);
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, snapshot => {
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LiveHelpMessage)));
        });
        return unsubscribe;
    }, [session.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || session.status === 'closed') return;
        await apiService.sendLiveHelpMessage(session.id, adminUser.id, adminUser.name, newMessage);
        setNewMessage('');
    };

    const handleSendPrefilled = async (message: string) => {
        if (!message.trim() || session.status === 'closed') return;
        await apiService.sendLiveHelpMessage(session.id, adminUser.id, adminUser.name, message);
    };

    const handleCloseSessionClick = () => {
        setShowCloseConfirm(true);
    };

    const confirmCloseSession = async () => {
        await apiService.closeLiveHelpSession(session.id);
        setShowCloseConfirm(false);
    };

    const handleAcceptChat = async () => {
        await apiService.assignStaffToSession(session.id, adminUser);
    }

    return (
        <div className="flex flex-col h-full bg-white relative">
            <div className="p-4 border-b flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <img src={session.userAvatar} alt={session.userName} className="w-10 h-10 rounded-full" />
                    <div>
                        <p className="font-semibold">{session.userName}</p>
                        <p className="text-xs text-gray-500">
                            Status: {session.status}
                            {session.status === 'open' && session.assignedStaffName && ` (with ${session.assignedStaffName})`}
                        </p>
                    </div>
                </div>
                {session.status !== 'closed' && (
                    <button 
                        onClick={handleCloseSessionClick} 
                        className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                    >
                        Close Chat
                    </button>
                )}
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
                {session.status === 'unassigned' && (
                    <div className="text-center p-4 bg-yellow-50 border-yellow-200 border rounded-md">
                        <p className="text-sm font-semibold text-yellow-800">This is a new, unassigned chat request.</p>
                        <button onClick={handleAcceptChat} className="mt-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600">
                            Accept Chat
                        </button>
                    </div>
                )}
                {messages.map(msg => {
                     // Correct logic: if the sender is the current admin OR the assigned staff, it's a staff message.
                     // This handles cases where the chat might have been re-assigned.
                     const isStaffMessage = msg.senderId === adminUser.id || (session.assignedStaffId && msg.senderId === session.assignedStaffId);
                     
                     return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isStaffMessage ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-md px-4 py-3 rounded-2xl ${isStaffMessage ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                <p className="text-sm font-bold">{msg.senderName}</p>
                                <p className="text-sm mt-1">{msg.text}</p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t">
                {session.status !== 'closed' && (
                    <div className="mb-3">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-xs text-gray-500 font-medium">Quick Replies:</p>
                            <button onClick={onManageReplies} title="Manage Quick Replies" className="text-gray-400 hover:text-indigo-600">
                                <CogIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {quickReplies.map((reply) => (
                                <button
                                    key={reply.id}
                                    onClick={() => handleSendPrefilled(reply.text)}
                                    className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-full hover:bg-indigo-100 transition-colors"
                                    title="Send this message"
                                >
                                    {reply.text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="relative">
                    <input
                        type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={session.status === 'closed' ? 'This session is closed' : "Type your reply..."}
                        disabled={session.status !== 'open'}
                        className="w-full p-3 pl-4 pr-12 text-sm text-gray-700 bg-gray-100 rounded-full border-transparent focus:ring-2 focus:ring-indigo-500 focus:bg-white disabled:bg-gray-200"
                    />
                    <button type="submit" disabled={session.status !== 'open'} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-500 rounded-full hover:bg-indigo-100 disabled:opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </form>
            </div>

            {showCloseConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4 dark:text-gray-100">Confirm Close Chat</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to end this live help session? The user will not be able to send further messages until they reopen it.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button 
                                onClick={() => setShowCloseConfirm(false)} 
                                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmCloseSession} 
                                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            >
                                Close Session
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

type Tab = 'new' | 'my' | 'all' | 'closed';

interface LiveHelpPanelProps {
    adminUser: User;
}

const toJsDate = (ts: any): Date | undefined => {
    if (!ts) return undefined;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    if (ts.seconds !== undefined && ts.nanoseconds !== undefined) return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
    return undefined;
};

const LiveHelpPanel: React.FC<LiveHelpPanelProps> = ({ adminUser }) => {
    // ... (rest of the component remains same)
    const [allSessions, setAllSessions] = useState<LiveHelpSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<LiveHelpSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('new');
    const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
    const [isManageRepliesModalOpen, setIsManageRepliesModalOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = apiService.getAllLiveHelpSessionsListener((sessions) => {
            setAllSessions(sessions);
            setIsLoading(false);

            if (selectedSession) {
                const updated = sessions.find(s => s.id === selectedSession.id);
                setSelectedSession(updated || null);
            }
        });
        return () => unsubscribe();
    }, [selectedSession]);

    useEffect(() => {
        const unsubscribe = apiService.getQuickRepliesListener(setQuickReplies);
        return () => unsubscribe();
    }, []);
    
    const { newSessions, mySessions, allActiveSessions, closedSessions } = useMemo(() => {
        return {
            newSessions: allSessions.filter(s => s.status === 'unassigned'),
            mySessions: allSessions.filter(s => s.status === 'open' && s.assignedStaffId === adminUser.id),
            allActiveSessions: allSessions.filter(s => s.status === 'open'),
            closedSessions: allSessions.filter(s => s.status === 'closed')
        }
    }, [allSessions, adminUser.id]);
    
    const tabData: Record<Tab, { label: string; data: LiveHelpSession[] }> = {
        new: { label: 'New Requests', data: newSessions },
        my: { label: 'My Chats', data: mySessions },
        all: { label: 'All Active', data: allActiveSessions },
        closed: { label: 'Closed', data: closedSessions },
    };

    const currentList = tabData[activeTab].data;

    return (
        <div className="flex h-full">
            <div className="w-1/3 border-r bg-gray-50 flex flex-col">
                <div className="p-2 border-b">
                    <div className="flex space-x-1">
                        {Object.keys(tabData).map(key => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key as Tab)}
                                className={`flex-1 text-xs font-semibold p-2 rounded-md transition-colors ${activeTab === key ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-200'}`}
                            >
                                {tabData[key as Tab].label} ({tabData[key as Tab].data.length})
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? <p className="p-4 text-sm text-gray-500">Loading...</p> : 
                    currentList.length === 0 ? <p className="p-4 text-sm text-gray-500">No chats in this category.</p> :
                    <ul>
                        {currentList.map(session => (
                            <li key={session.id}>
                                <button
                                    onClick={() => setSelectedSession(session)}
                                    className={`w-full text-left p-3 flex items-center gap-3 border-l-4 ${selectedSession?.id === session.id ? 'bg-white border-indigo-500' : 'border-transparent hover:bg-gray-100'}`}
                                >
                                    <img src={session.userAvatar} alt={session.userName} className="w-10 h-10 rounded-full" />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-semibold truncate">{session.userName}</p>
                                        <p className="text-xs text-gray-500">
                                            {toJsDate(session.updatedAt)?.toLocaleTimeString()}
                                        </p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                    }
                </div>
            </div>
            <div className="w-2/3">
                {selectedSession ? (
                    <ConversationView 
                        session={selectedSession} 
                        adminUser={adminUser} 
                        quickReplies={quickReplies}
                        onManageReplies={() => setIsManageRepliesModalOpen(true)}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center bg-gray-100">
                        <p className="text-gray-500">Select a conversation to start chatting.</p>
                    </div>
                )}
            </div>
             <ManageQuickRepliesModal
                isOpen={isManageRepliesModalOpen}
                onClose={() => setIsManageRepliesModalOpen(false)}
                quickReplies={quickReplies}
            />
        </div>
    );
};

export default LiveHelpPanel;