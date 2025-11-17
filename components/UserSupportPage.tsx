import React, { useState, useEffect, useRef } from 'react';
import { User, SupportTicket, TicketReply, SupportTicketStatus, Attachment, PlatformSettings, LiveHelpSession } from '../types';
import { apiService } from '../services/apiService';
import { Timestamp } from 'firebase/firestore';
import CreateTicketModal from './CreateTicketModal';
import { DocumentIcon, ImageIcon } from './Icons';

const getFileType = (file: File): Attachment['type'] => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
};

const StatusBadge: React.FC<{ status: SupportTicketStatus }> = ({ status }) => {
    const base = "px-3 py-1 text-xs font-medium rounded-full capitalize";
    const colors = {
        open: "bg-blue-100 text-blue-800",
        in_progress: "bg-yellow-100 text-yellow-800",
        closed: "bg-gray-100 text-gray-800",
    };
    return <span className={`${base} ${colors[status]}`}>{status.replace('_', ' ')}</span>;
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    const base = "px-3 py-1 text-xs font-medium rounded-full";
    const colors = {
        Low: "bg-green-100 text-green-800",
        Medium: "bg-yellow-100 text-yellow-800",
        High: "bg-red-100 text-red-800",
    };
    return <span className={`${base} ${colors[priority as keyof typeof colors]}`}>{priority}</span>;
};

const TicketConversation: React.FC<{ ticket: SupportTicket, user: User, onReply: () => void }> = ({ ticket, user, onReply }) => {
    const [replies, setReplies] = useState<TicketReply[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newReply, setNewReply] = useState("");
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchReplies = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getTicketReplies(ticket.id);
            setReplies(data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReplies();
    }, [ticket.id]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [replies]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newReply.trim() && attachments.length === 0) return;
        
        const uploadPromises = attachments.map(async file => {
            const url = await apiService.uploadTicketAttachment(ticket.id, file);
            return { url, type: getFileType(file), name: file.name };
        });
        const uploadedAttachments = await Promise.all(uploadPromises);

        await apiService.addTicketReply({
            ticketId: ticket.id,
            senderId: user.id,
            senderName: user.name,
            senderAvatar: user.avatar || '',
            senderRole: user.role,
            text: newReply,
            attachments: uploadedAttachments,
        });
        setNewReply('');
        setAttachments([]);
        fetchReplies();
        onReply(); // To refresh the main list's updatedAt
    };

    return (
        <div className="bg-gray-50 p-4 sm:p-6 border-t border-gray-200">
            <div className="max-h-96 overflow-y-auto pr-2 space-y-4">
                {isLoading ? <p>Loading conversation...</p> : replies.map(reply => (
                    <div key={reply.id} className={`flex gap-3 ${reply.senderId === user.id ? 'flex-row-reverse' : ''}`}>
                        <img src={reply.senderAvatar} alt={reply.senderName} className="w-8 h-8 rounded-full"/>
                        <div className={`p-3 rounded-lg max-w-md ${reply.senderId === user.id ? 'bg-indigo-500 text-white' : 'bg-white border'}`}>
                            <p className="text-sm font-bold">{reply.senderName}</p>
                            <p className="text-sm mt-1">{reply.text}</p>
                            {reply.attachments.length > 0 && (
                                <div className="mt-2 space-y-2">
                                    {reply.attachments.map((att, i) => (
                                        <a href={att.url} key={i} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs p-2 bg-black bg-opacity-10 rounded hover:bg-opacity-20">
                                            {att.type === 'image' ? <ImageIcon className="w-4 h-4" /> : <DocumentIcon className="w-4 h-4"/>}
                                            {att.name}
                                        </a>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs mt-2 text-right opacity-70">{(reply.timestamp as Timestamp)?.toDate?.().toLocaleString() ?? 'Date not available'}</p>
                        </div>
                    </div>
                ))}
                 <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendReply} className="mt-4 border-t pt-4">
                 {/* Attachment previews */}
                 <div className="space-y-1 mb-2">
                    {attachments.map((file, i) => (
                        <div key={i} className="text-xs bg-gray-200 p-1 rounded flex justify-between items-center">
                            <span>{file.name}</span>
                            <button type="button" onClick={() => setAttachments(attachments.filter(f => f !== file))} className="font-bold text-red-500 px-1">&times;</button>
                        </div>
                    ))}
                </div>
                <div className="relative">
                    <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <textarea value={newReply} onChange={e => setNewReply(e.target.value)} placeholder="Type your reply..." rows={3} className="w-full p-2 border rounded-md resize-none pr-24"/>
                    <div className="absolute right-2 top-2 flex flex-col gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full">📎</button>
                        <button type="submit" className="p-2 text-indigo-500 hover:bg-indigo-100 rounded-full">➢</button>
                    </div>
                </div>
            </form>
        </div>
    );
};


const UserSupportPage: React.FC<{ user: User, platformSettings: PlatformSettings, onStartLiveHelp: (sessionId: string) => void; }> = ({ user, platformSettings, onStartLiveHelp }) => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [liveHelpSession, setLiveHelpSession] = useState<LiveHelpSession | null>(null);

    const fetchTickets = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getTicketsForUser(user.id);
            setTickets(data);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLiveHelpSession = async () => {
        const sessions = await apiService.getSessionsForUser(user.id);
        if (sessions.length > 0) {
            setLiveHelpSession(sessions[0]); // Get the most recent one
        }
    };

    useEffect(() => {
        fetchTickets();
        fetchLiveHelpSession();
    }, [user.id]);

    const handleNewChat = async () => {
        // FIX: The getOrCreateLiveHelpSession function requires a staffId.
        // This logic finds an available staff member to assign the chat to before creating the session.
        const allUsers = await apiService.getAllUsers();
        const staffUser = allUsers.find(u => u.role === 'staff' && !u.isBlocked);

        if (!staffUser) {
            alert("Live help is currently unavailable. No support agents were found.");
            return;
        }

        const sessionId = await apiService.getOrCreateLiveHelpSession(user.id, user.name, user.avatar || '', staffUser.id);
        onStartLiveHelp(sessionId);
        fetchLiveHelpSession(); // Refresh session state
    };
    
    const handleReopenChat = async () => {
        if(liveHelpSession) {
            await apiService.reopenLiveHelpSession(liveHelpSession.id);
            onStartLiveHelp(liveHelpSession.id);
            fetchLiveHelpSession();
        }
    };

    const renderLiveHelpButton = () => {
        if (!platformSettings.isLiveHelpEnabled) {
             return <button disabled title="Live help is currently unavailable" className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">Start Live Chat</button>
        }

        const baseClass = "px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed";

        if (liveHelpSession) {
            if (liveHelpSession.status === 'open' || liveHelpSession.status === 'unassigned') {
                return <button onClick={() => onStartLiveHelp(liveHelpSession.id)} className={baseClass}>Continue Chat</button>;
            }
            if (liveHelpSession.status === 'closed') {
                return (
                    <div className="flex gap-2">
                        <button onClick={handleReopenChat} className="px-5 py-2.5 text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg">Re-open Last Chat</button>
                        <button onClick={handleNewChat} className={baseClass}>Start New Chat</button>
                    </div>
                );
            }
        }
        
        return <button onClick={handleNewChat} className={baseClass}>Start Live Chat</button>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Help & Support</h1>
                    <p className="text-gray-500 mt-1">Get help with your account, report issues, or track your support tickets.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-5 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-all"
                    >
                        Create New Ticket
                    </button>
                    {renderLiveHelpButton()}
                </div>
            </div>
            
            {isLoading ? <p>Loading tickets...</p> : tickets.length === 0 ? (
                 <div className="text-center py-10 bg-white rounded-lg shadow"><p className="text-gray-500">You have not created any support tickets yet.</p></div>
            ) : (
                <div className="space-y-4">
                    {tickets.map(ticket => (
                        <div key={ticket.id} className="bg-white shadow-lg rounded-2xl overflow-hidden">
                            <div className="p-4 sm:p-6 cursor-pointer" onClick={() => setSelectedTicketId(selectedTicketId === ticket.id ? null : ticket.id)}>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                    <h2 className="text-lg font-bold text-gray-800 truncate">{ticket.subject}</h2>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <PriorityBadge priority={ticket.priority} />
                                        <StatusBadge status={ticket.status} />
                                    </div>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                    Last Updated: {(ticket.updatedAt as Timestamp)?.toDate?.()?.toLocaleString() ?? 'Not yet'}
                                </p>
                            </div>
                            {selectedTicketId === ticket.id && <TicketConversation ticket={ticket} user={user} onReply={fetchTickets} />}
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <CreateTicketModal 
                    user={user} 
                    onClose={() => setIsModalOpen(false)} 
                    onTicketCreated={fetchTickets}
                />
            )}
        </div>
    );
};

export default UserSupportPage;
