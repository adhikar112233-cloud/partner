// ... (Previous imports)
import React, { useState, useMemo, useEffect } from 'react';
import { PayoutRequest, RefundRequest, DailyPayoutRequest, UserRole, CombinedCollabItem, User, Transaction, AnyCollaboration } from '../types';
import { apiService } from '../services/apiService';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

interface PayoutQueueItem {
    id: string;
    requestType: 'Payout' | 'Refund' | 'Daily Payout';
    status: 'pending' | 'approved' | 'rejected' | 'on_hold' | 'processing' | 'completed';
    amount: number;
    userName: string;
    userAvatar: string;
    userRole: UserRole;
    userPiNumber?: string;
    collabTitle: string;
    collaborationId: string;
    collabType: 'direct' | 'campaign' | 'ad_slot' | 'banner_booking';
    timestamp: any;
    bankDetails?: string;
    upiId?: string;
    panNumber?: string;
    description?: string;
    collabId?: string;
    originalRequest: PayoutRequest | RefundRequest | DailyPayoutRequest;
}

// ... (Helper Components: StatusBadge, safeToLocaleString, getTime remain the same)
const StatusBadge: React.FC<{ status: PayoutQueueItem['status'] }> = ({ status }) => {
    const colors: Record<string, string> = {
        pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
        approved: "bg-green-100 text-green-800 border-green-200",
        rejected: "bg-red-100 text-red-800 border-red-200",
        on_hold: "bg-blue-100 text-blue-800 border-blue-200",
        processing: "bg-purple-100 text-purple-800 border-purple-200",
        completed: "bg-green-100 text-green-800 border-green-200",
    };
    return (
        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
            {status.replace('_', ' ').toUpperCase()}
        </span>
    );
};

const safeToLocaleString = (ts: any): string => {
    if (!ts) return 'N/A';
    if (ts instanceof Date) return ts.toLocaleDateString();
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleDateString();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toLocaleDateString();
    return 'Invalid Date';
};

const getTime = (ts: any): number => {
    if (!ts) return 0;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    return 0;
};

const fetchChatMessages = async (userId1: string, userId2: string) => {
    if (!userId1 || !userId2) return [];
    const chatId = [userId1, userId2].sort().join('_');
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data, 
            // Convert timestamp safely
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date()
        };
    });
};

const ActionSelectionModal: React.FC<{ 
    item: PayoutQueueItem; 
    onClose: () => void; 
    onSelectAction: (status: PayoutQueueItem['status']) => void; 
}> = ({ item, onClose, onSelectAction }) => {
    const actions: PayoutQueueItem['status'][] = ['approved', 'processing', 'on_hold', 'rejected', 'completed'];
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Select Action</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
                </div>
                <div className="space-y-2">
                    {actions.map(action => (
                        <button
                            key={action}
                            onClick={() => onSelectAction(action)}
                            className={`w-full py-3 px-4 rounded-lg font-medium text-left flex justify-between items-center transition-all transform active:scale-95
                                ${action === 'approved' ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' : ''}
                                ${action === 'completed' ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200' : ''}
                                ${action === 'processing' ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200' : ''}
                                ${action === 'on_hold' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200' : ''}
                                ${action === 'rejected' ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' : ''}
                            `}
                        >
                            <span className="capitalize font-semibold">{action.replace('_', ' ')}</span>
                            <span>➜</span>
                        </button>
                    ))}
                </div>
                <div className="mt-4 text-xs text-center text-gray-400">
                    Item ID: {item.id}
                </div>
            </div>
        </div>
    );
};

const ConfirmationModal: React.FC<{
    item: PayoutQueueItem;
    targetStatus: PayoutQueueItem['status'];
    isProcessing: boolean;
    onConfirm: (details: { reason?: string; amount?: number }) => void;
    onCancel: () => void;
}> = ({ item, targetStatus, isProcessing, onConfirm, onCancel }) => {
    const [reason, setReason] = useState('');
    const [amount, setAmount] = useState<string>(
        item.requestType === 'Daily Payout' 
        ? String((item.originalRequest as DailyPayoutRequest).approvedAmount || item.amount) 
        : String(item.amount)
    );

    const needsReason = targetStatus === 'rejected' || targetStatus === 'on_hold';
    const needsAmount = item.requestType === 'Daily Payout' && targetStatus === 'approved';

    const handleSubmit = () => {
        onConfirm({
            reason: needsReason ? reason : undefined,
            amount: needsAmount ? Number(amount) : undefined
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[110] p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Confirm {targetStatus.replace('_', ' ')}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
                    You are about to update the status of this <strong>{item.requestType}</strong> for <strong>{item.userName}</strong>.
                </p>

                <div className="space-y-4">
                    {needsAmount && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Approved Amount (₹)</label>
                            <input 
                                type="number" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)}
                                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    )}

                    {needsReason && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason (Required)</label>
                            <textarea 
                                value={reason} 
                                onChange={e => setReason(e.target.value)}
                                rows={3}
                                placeholder="Please explain why..."
                                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    )}

                    {!needsAmount && !needsReason && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-sm">
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-500 dark:text-gray-400">Current Amount:</span>
                                <span className="font-medium dark:text-white">₹{item.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Method:</span>
                                <span className="font-medium dark:text-white">{item.bankDetails ? 'Bank Transfer' : 'UPI'}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button 
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={isProcessing || (needsReason && !reason.trim()) || (needsAmount && !amount)}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-md transition-colors
                            ${targetStatus === 'rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        {isProcessing ? 'Updating...' : 'Confirm Update'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DetailsModal: React.FC<{ item: PayoutQueueItem, collaborations: CombinedCollabItem[], onClose: () => void }> = ({ item, collaborations, onClose }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'collab' | 'chat'>('info');
    const [messages, setMessages] = useState<any[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Find the linked collaboration object
    const linkedCollab = useMemo(() => {
        return collaborations.find(c => c.id === item.collaborationId)?.originalData;
    }, [collaborations, item.collaborationId]);

    useEffect(() => {
        if (activeTab === 'chat' && linkedCollab) {
            setLoadingMessages(true);
            
            let brandId = linkedCollab.brandId;
            let creatorId = '';
            
            if ('influencerId' in linkedCollab) creatorId = linkedCollab.influencerId;
            else if ('liveTvId' in linkedCollab) creatorId = (linkedCollab as any).liveTvId;
            else if ('agencyId' in linkedCollab) creatorId = (linkedCollab as any).agencyId;

            if (brandId && creatorId) {
                fetchChatMessages(brandId, creatorId).then(msgs => {
                    setMessages(msgs);
                    setLoadingMessages(false);
                }).catch(() => setLoadingMessages(false));
            } else {
                setLoadingMessages(false);
            }
        }
    }, [activeTab, linkedCollab]);

    const parseBankDetails = (details: string) => {
        return details.split('\n').map((line, index) => {
            const [label, value] = line.split(': ');
            return (
                <div key={index} className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-right">{value}</span>
                </div>
            );
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Request Details</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">ID: {item.id}</p>
                    </div>
                    <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">&times;</button>
                </div>

                <div className="flex border-b dark:border-gray-700">
                    <button 
                        onClick={() => setActiveTab('info')} 
                        className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        Request Info
                    </button>
                    <button 
                        onClick={() => setActiveTab('collab')} 
                        className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'collab' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        Collaboration Details
                    </button>
                    <button 
                        onClick={() => setActiveTab('chat')} 
                        className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        Chat History
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'info' && (
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Core Info</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><p className="text-gray-500">Request Type</p><p className="font-medium dark:text-white">{item.requestType}</p></div>
                                    <div><p className="text-gray-500">Status</p><StatusBadge status={item.status} /></div>
                                    <div><p className="text-gray-500">Amount</p><p className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">₹{item.amount.toLocaleString()}</p></div>
                                    <div><p className="text-gray-500">Date</p><p className="dark:text-white">{safeToLocaleString(item.timestamp)}</p></div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">User Info</h3>
                                <div className="flex items-center gap-3 mb-3">
                                    <img src={item.userAvatar || 'https://via.placeholder.com/40'} alt={item.userName} className="w-10 h-10 rounded-full" />
                                    <div>
                                        <p className="font-medium dark:text-white">{item.userName}</p>
                                        <p className="text-xs text-gray-500 capitalize">{item.userRole} • ID: <span className="font-mono">{item.userPiNumber || 'N/A'}</span></p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Payment Details</h3>
                                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-sm">
                                    {item.bankDetails ? (
                                        <div className="space-y-1">
                                            {parseBankDetails(item.bankDetails)}
                                        </div>
                                    ) : item.upiId ? (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 dark:text-gray-400">UPI ID</span>
                                            <span className="font-mono font-medium text-gray-900 dark:text-gray-100 text-lg">{item.upiId}</span>
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 italic">No payment details provided.</p>
                                    )}
                                </div>
                                {item.panNumber && (
                                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex justify-between items-center">
                                        <span className="text-blue-700 dark:text-blue-300 font-medium">PAN Number</span>
                                        <span className="font-mono font-bold text-blue-900 dark:text-blue-100">{item.panNumber}</span>
                                    </div>
                                )}
                            </section>

                            {item.description && (
                                <section>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Reason / Description</h3>
                                    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 italic">
                                        "{item.description}"
                                    </div>
                                </section>
                            )}

                            {item.requestType === 'Daily Payout' && 'videoUrl' in item.originalRequest && (
                                <section>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Proof of Work</h3>
                                    <a href={(item.originalRequest as any).videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
                                        📺 Watch Video Proof
                                    </a>
                                </section>
                            )}

                            {'idProofSelfieUrl' in item.originalRequest && item.originalRequest.idProofSelfieUrl && (
                                <section>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Verification Selfie</h3>
                                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                        <img 
                                            src={item.originalRequest.idProofSelfieUrl} 
                                            alt="Verification Selfie" 
                                            className="w-full max-w-sm rounded-lg border dark:border-gray-600 shadow-sm" 
                                        />
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {activeTab === 'collab' && (
                        <div className="space-y-4">
                            {linkedCollab ? (
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg space-y-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                                            {'title' in linkedCollab ? linkedCollab.title : 
                                             'campaignTitle' in linkedCollab ? linkedCollab.campaignTitle : 
                                             'campaignName' in linkedCollab ? linkedCollab.campaignName : 'Untitled'}
                                        </h3>
                                        <p className="text-xs text-gray-500 font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded inline-block">Collab ID: {item.collabId || item.collaborationId}</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 text-sm dark:text-gray-200">
                                        <div>
                                            <p className="text-gray-500 text-xs uppercase">Brand</p>
                                            <p className="font-medium">{linkedCollab.brandName}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs uppercase">Creator</p>
                                            <p className="font-medium">
                                                {'influencerName' in linkedCollab ? linkedCollab.influencerName : 
                                                 'liveTvName' in linkedCollab ? (linkedCollab as any).liveTvName : 
                                                 'agencyName' in linkedCollab ? (linkedCollab as any).agencyName : 'Unknown'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs uppercase">Status</p>
                                            <span className="capitalize">{linkedCollab.status.replace('_', ' ')}</span>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs uppercase">Payment Status</p>
                                            <span className="capitalize">{linkedCollab.paymentStatus || 'N/A'}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-gray-500 text-xs uppercase">Description / Message</p>
                                            <p className="mt-1 italic text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600">
                                                {'message' in linkedCollab ? linkedCollab.message : 'No description available.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-8">Collaboration details not found.</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'chat' && (
                        <div className="h-full flex flex-col">
                            {loadingMessages ? (
                                <p className="text-center text-gray-500 py-8">Loading messages...</p>
                            ) : messages.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No messages found for this collaboration.</p>
                            ) : (
                                <div className="space-y-3">
                                    {messages.map(msg => {
                                        const isBrand = msg.senderId === linkedCollab?.brandId;
                                        return (
                                            <div key={msg.id} className={`flex flex-col ${isBrand ? 'items-start' : 'items-end'}`}>
                                                <div className={`max-w-[80%] px-4 py-2 rounded-xl text-sm ${isBrand ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' : 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'}`}>
                                                    <p className="text-xs font-bold mb-1 opacity-70">{isBrand ? 'Brand' : 'Creator'}</p>
                                                    <p>{msg.text}</p>
                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="mt-2 space-y-1">
                                                            {msg.attachments.map((att: any, i: number) => (
                                                                <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block text-xs underline text-indigo-600 dark:text-indigo-400 truncate">
                                                                    {att.name || 'Attachment'}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-gray-400 mt-1">{msg.timestamp?.toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 text-right rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600">Close</button>
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

interface PayoutsPanelProps {
    payouts: PayoutRequest[];
    refunds: RefundRequest[];
    dailyPayouts: DailyPayoutRequest[];
    collaborations: CombinedCollabItem[];
    allTransactions: Transaction[];
    allUsers: User[];
    onUpdate: () => void;
}

const PayoutsPanel: React.FC<PayoutsPanelProps> = ({ payouts, refunds, dailyPayouts, collaborations, allUsers, onUpdate }) => {
    const [filter, setFilter] = useState<'all' | 'pending' | 'processing'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal State
    const [activeModal, setActiveModal] = useState<'none' | 'details' | 'action_select' | 'confirm'>('none');
    const [selectedItem, setSelectedItem] = useState<PayoutQueueItem | null>(null);
    const [targetStatus, setTargetStatus] = useState<PayoutQueueItem['status'] | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Data Processing
    const combinedItems = useMemo<PayoutQueueItem[]>(() => {
        const userMap = new Map<string, User>(allUsers.map(u => [u.id, u] as [string, User]));
        const collabIdMap = new Map(collaborations.map(c => [c.id, c.originalData.collabId]));

        const p: PayoutQueueItem[] = payouts.map(r => ({
            id: r.id, requestType: 'Payout', status: r.status, amount: r.amount, userName: r.userName,
            userAvatar: r.userAvatar, userRole: 'influencer', userPiNumber: userMap.get(r.userId)?.piNumber,
            collabTitle: r.collaborationTitle, collaborationId: r.collaborationId, collabType: r.collaborationType,
            timestamp: r.timestamp, bankDetails: r.bankDetails, upiId: r.upiId,
            collabId: r.collabId || collabIdMap.get(r.collaborationId), originalRequest: r,
        }));

        const r: PayoutQueueItem[] = refunds.map(r => ({
            id: r.id, requestType: 'Refund', status: r.status, amount: r.amount, userName: r.brandName,
            userAvatar: r.brandAvatar, userRole: 'brand', userPiNumber: userMap.get(r.brandId)?.piNumber,
            collabTitle: r.collabTitle, collaborationId: r.collaborationId, collabType: r.collabType,
            timestamp: r.timestamp, bankDetails: r.bankDetails, panNumber: r.panNumber, description: r.description,
            collabId: r.collabId || collabIdMap.get(r.collaborationId), originalRequest: r,
        }));

        const d: PayoutQueueItem[] = dailyPayouts.map(r => ({
            id: r.id, requestType: 'Daily Payout', status: r.status, amount: r.approvedAmount || 0, userName: r.userName,
            userAvatar: userMap.get(r.userId)?.avatar || '', userRole: r.userRole, userPiNumber: userMap.get(r.userId)?.piNumber,
            collabTitle: `Daily Payout: ${r.collaborationId}`, collaborationId: r.collaborationId, collabType: r.collaborationType,
            timestamp: r.timestamp, originalRequest: r, collabId: r.collabId || collabIdMap.get(r.collaborationId),
        }));

        return [...p, ...r, ...d].sort((a, b) => getTime(b.timestamp) - getTime(a.timestamp));
    }, [payouts, refunds, dailyPayouts, collaborations, allUsers]);

    const filteredItems = useMemo(() => {
        let items = combinedItems;
        if (filter === 'pending') items = items.filter(i => i.status === 'pending');
        if (filter === 'processing') items = items.filter(i => ['processing', 'on_hold'].includes(i.status));
        
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            items = items.filter(i => 
                i.userName.toLowerCase().includes(lower) || 
                i.collabTitle.toLowerCase().includes(lower) ||
                i.amount.toString().includes(lower) ||
                (i.userPiNumber && i.userPiNumber.toLowerCase().includes(lower)) ||
                (i.collabId && i.collabId.toLowerCase().includes(lower))
            );
        }
        return items;
    }, [combinedItems, filter, searchQuery]);

    // Handlers
    const openDetails = (item: PayoutQueueItem) => {
        setSelectedItem(item);
        setActiveModal('details');
    };

    const openActionSelect = (item: PayoutQueueItem) => {
        setSelectedItem(item);
        setActiveModal('action_select');
    };

    const handleActionSelect = (status: PayoutQueueItem['status']) => {
        setTargetStatus(status);
        setActiveModal('confirm');
    };

    const executeUpdate = async (details: { reason?: string, amount?: number }) => {
        if (!selectedItem || !targetStatus) return;
        setIsUpdating(true);
        try {
            // Process backend payout if approved
            if (targetStatus === 'approved' && (selectedItem.requestType === 'Payout' || selectedItem.requestType === 'Daily Payout')) {
                try {
                    // Pass the requestType so apiService knows which collection to use
                    await apiService.processPayout(selectedItem.id, selectedItem.requestType);
                } catch (err: any) {
                    console.warn("Auto-payout failed, proceeding with manual status update", err);
                    alert(`Auto-payout failed: ${err.message}. Updating status manually.`);
                }
            }

            if (selectedItem.requestType === 'Payout') {
                await apiService.updatePayoutStatus(selectedItem.id, targetStatus, selectedItem.collaborationId, selectedItem.collabType, details.reason);
            } else if (selectedItem.requestType === 'Refund') {
                await apiService.updateRefundRequest(selectedItem.id, { status: targetStatus, rejectionReason: details.reason });
            } else if (selectedItem.requestType === 'Daily Payout') {
                if (targetStatus === 'approved' || targetStatus === 'rejected') {
                    await apiService.updateDailyPayoutRequestStatus(selectedItem.id, selectedItem.collaborationId, selectedItem.collabType as any, targetStatus, details.amount, details.reason);
                } else {
                    await apiService.updateDailyPayoutRequest(selectedItem.id, { status: targetStatus });
                }
            }
            onUpdate();
            setActiveModal('none');
            setSelectedItem(null);
            setTargetStatus(null);
        } catch (error) {
            alert(`Action failed: ${error}`);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Payouts & Refunds</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage financial requests from users.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setFilter('pending')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === 'pending' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Pending</button>
                    <button onClick={() => setFilter('processing')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === 'processing' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Processing</button>
                    <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>All</button>
                </div>
            </div>

            {/* Search */}
            <div className="px-6 pb-4">
                <input 
                    type="text" 
                    placeholder="Search requests by User, ID, Collab ID..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-6 pb-6">
                {filteredItems.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <p>No requests found.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 text-xs uppercase text-gray-500 font-semibold">
                                        <th className="p-4">User ID</th>
                                        <th className="p-4">Collab ID</th>
                                        <th className="p-4">Request</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredItems.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-mono">
                                                {item.userPiNumber || 'N/A'}
                                                <div className="text-xs text-gray-400 mt-1">{item.userName}</div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-mono">
                                                {item.collabId || 'N/A'}
                                            </td>
                                            <td className="p-4">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.collabTitle}</p>
                                                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{item.requestType}</span>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-bold text-gray-900 dark:text-white">₹{item.amount.toLocaleString()}</span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-500">
                                                {safeToLocaleString(item.timestamp)}
                                            </td>
                                            <td className="p-4">
                                                <StatusBadge status={item.status} />
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button 
                                                    onClick={() => openDetails(item)} 
                                                    className="text-sm font-medium text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    Details
                                                </button>
                                                <button 
                                                    onClick={() => openActionSelect(item)} 
                                                    className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm transition-all active:scale-95"
                                                >
                                                    Actions
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals Rendered at Root Level */}
            {activeModal === 'details' && selectedItem && (
                <DetailsModal item={selectedItem} collaborations={collaborations} onClose={() => { setActiveModal('none'); setSelectedItem(null); }} />
            )}
            {activeModal === 'action_select' && selectedItem && (
                <ActionSelectionModal 
                    item={selectedItem} 
                    onClose={() => { setActiveModal('none'); setSelectedItem(null); }} 
                    onSelectAction={handleActionSelect}
                />
            )}
            {activeModal === 'confirm' && selectedItem && targetStatus && (
                <ConfirmationModal
                    item={selectedItem}
                    targetStatus={targetStatus}
                    isProcessing={isUpdating}
                    onConfirm={executeUpdate}
                    onCancel={() => { setActiveModal('none'); setSelectedItem(null); setTargetStatus(null); }}
                />
            )}
        </div>
    );
};

export default PayoutsPanel;