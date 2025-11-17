import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, SupportTicket, TicketReply, SupportTicketStatus, Attachment } from '../types';
import { apiService } from '../services/apiService';
import { Timestamp } from 'firebase/firestore';
import { DocumentIcon, ImageIcon } from './Icons';

const getFileType = (file: File): Attachment['type'] => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
};

const formatTimeAgo = (timestamp: any) => {
    if (!timestamp?.toDate) return 'Just now';
    const date = timestamp.toDate();
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    const base = "px-2 py-0.5 text-xs font-medium rounded-full";
    const colors = {
        Low: "bg-green-100 text-green-800",
        Medium: "bg-yellow-100 text-yellow-800",
        High: "bg-red-100 text-red-800",
    };
    return <span className={`${base} ${colors[priority as keyof typeof colors]}`}>{priority}</span>;
};

const StatusBadge: React.FC<{ status: SupportTicketStatus }> = ({ status }) => {
    const base = "px-2 py-0.5 text-xs font-medium rounded-full capitalize";
    const colors = {
        open: "bg-blue-100 text-blue-800",
        in_progress: "bg-yellow-100 text-yellow-800",
        closed: "bg-gray-100 text-gray-800",
    };
    return <span className={`${base} ${colors[status]}`}>{status.replace('_', ' ')}</span>;
};

const TicketConversation: React.FC<{ ticket: SupportTicket, admin: User, onUpdate: () => void }> = ({ ticket, admin, onUpdate }) => {
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
        } finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchReplies();
    }, [ticket.id]);

     useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [replies]);

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newReply.trim() && attachments.length === 0) return;
        
        const uploadedAttachments = await Promise.all(attachments.map(async file => {
            const url = await apiService.uploadTicketAttachment(ticket.id, file);
            return { url, type: getFileType(file), name: file.name };
        }));

        await apiService.addTicketReply({
            ticketId: ticket.id,
            senderId: admin.id,
            senderName: admin.name,
            senderAvatar: admin.avatar || '',
            senderRole: admin.role,
            text: newReply,
            attachments: uploadedAttachments,
        });
        setNewReply('');
        setAttachments([]);
        fetchReplies();
        onUpdate();
    };

    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        await apiService.updateTicketStatus(ticket.id, e.target.value as SupportTicketStatus);
        onUpdate();
    };

    return (
        <div className="bg-white shadow-xl rounded-2xl flex flex-col h-full">
            <div className="p-4 border-b flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-gray-800 truncate">{ticket.subject}</h3>
                    <p className="text-sm text-gray-500">From: {ticket.userName}</p>
                </div>
                <select value={ticket.status} onChange={handleStatusChange} className="text-sm border-gray-300 rounded-md">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                </select>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
                 {isLoading ? <p>Loading conversation...</p> : replies.map(reply => (
                    <div key={reply.id} className={`flex gap-3 ${reply.senderId === admin.id ? 'flex-row-reverse' : ''}`}>
                        <img src={reply.senderAvatar} alt={reply.senderName} className="w-8 h-8 rounded-full"/>
                        <div className={`p-3 rounded-lg max-w-md ${reply.senderRole === 'staff' ? 'bg-indigo-500 text-white' : 'bg-white border'}`}>
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
                            <p className="text-xs mt-2 text-right opacity-70">{(reply.timestamp as Timestamp)?.toDate?.()?.toLocaleString() ?? 'Date not available'}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t">
                <form onSubmit={handleSendReply}>
                     <div className="space-y-1 mb-2">
                        {attachments.map((file, i) => (
                            <div key={i} className="text-xs bg-gray-200 p-1 rounded flex justify-between items-center">
                                <span>{file.name}</span>
                                <button type="button" onClick={() => setAttachments(attachments.filter(f => f !== file))} className="font-bold text-red-500 px-1">&times;</button>
                            </div>
                        ))}
                    </div>
                    <div className="relative">
                         <input type="file" multiple ref={fileInputRef} onChange={(e) => {if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)])}} className="hidden" />
                        <textarea value={newReply} onChange={e => setNewReply(e.target.value)} placeholder="Type your reply..." rows={3} className="w-full p-2 border rounded-md resize-none pr-24"/>
                         <div className="absolute right-2 top-2 flex flex-col gap-2">
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full">📎</button>
                            <button type="submit" className="p-2 text-indigo-500 hover:bg-indigo-100 rounded-full">➢</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};


const SupportAdminPage: React.FC<{ user: User }> = ({ user }) => {
    const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [filter, setFilter] = useState<SupportTicketStatus | 'all'>('all');

    const fetchTickets = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getAllTickets();
            setAllTickets(data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);
    
    const filteredTickets = useMemo(() => {
        if (filter === 'all') return allTickets;
        return allTickets.filter(t => t.status === filter);
    }, [allTickets, filter]);
    
    const handleTicketUpdate = () => {
        fetchTickets();
        if(selectedTicket) {
             const updatedTicket = allTickets.find(t => t.id === selectedTicket.id);
             if (updatedTicket) setSelectedTicket(updatedTicket);
        }
    }

    return (
        <div className="h-full flex flex-col">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Support Center</h1>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 h-[calc(100vh-150px)]">
                <div className="md:col-span-1 lg:col-span-1 bg-white shadow-lg rounded-2xl p-4 flex flex-col">
                    <div className="mb-4">
                        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="w-full border-gray-300 rounded-md">
                            <option value="all">All Tickets</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {isLoading ? <p>Loading...</p> : filteredTickets.map(ticket => (
                            <button key={ticket.id} onClick={() => setSelectedTicket(ticket)} className={`w-full text-left p-3 rounded-lg transition-colors ${selectedTicket?.id === ticket.id ? 'bg-indigo-100 border-l-4 border-indigo-500' : 'hover:bg-gray-100'}`}>
                                <div className="flex items-center space-x-3">
                                    <img src={ticket.userAvatar} alt={ticket.userName} className="w-8 h-8 rounded-full flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <p className="font-semibold text-sm text-gray-800 truncate">{ticket.userName}</p>
                                            <p className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatTimeAgo(ticket.updatedAt)}</p>
                                        </div>
                                        <p className="text-sm text-gray-600 truncate">{ticket.subject}</p>
                                    </div>
                                </div>
                                <div className="mt-2 flex justify-between items-center">
                                    <StatusBadge status={ticket.status} />
                                    <PriorityBadge priority={ticket.priority} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                    {selectedTicket ? (
                        <TicketConversation ticket={selectedTicket} admin={user} onUpdate={handleTicketUpdate} />
                    ) : (
                        <div className="flex items-center justify-center h-full bg-gray-50 rounded-2xl">
                            <p className="text-gray-500">Select a ticket to view the conversation.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SupportAdminPage;