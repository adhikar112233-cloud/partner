

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PayoutRequest, RefundRequest, DailyPayoutRequest, UserRole, CombinedCollabItem, User } from '../types';
import { apiService } from '../services/apiService';
import { Timestamp } from 'firebase/firestore';
import { SparklesIcon } from './Icons';

interface PayoutQueueItem {
    id: string;
    requestType: 'Payout' | 'Refund' | 'Daily Payout';
    status: 'pending' | 'approved' | 'rejected' | 'on_hold' | 'processing';
    amount: number;
    userName: string;
    userAvatar: string;
    userRole: UserRole;
    userPiNumber?: string;
    brandName?: string;
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

const StatusBadge: React.FC<{ status: PayoutQueueItem['status'] }> = ({ status }) => {
    const base = "px-2 py-0.5 text-xs font-medium rounded-full capitalize";
    const colors: Record<PayoutQueueItem['status'], string> = {
        pending: "bg-yellow-100 text-yellow-800",
        approved: "bg-green-100 text-green-800",
        rejected: "bg-red-100 text-red-800",
        on_hold: "bg-blue-100 text-blue-800",
        processing: "bg-purple-100 text-purple-800",
    };
    return <span className={`${base} ${colors[status]}`}>{status.replace('_', ' ')}</span>;
};

const getTime = (ts: any): number => {
    if (!ts) return 0;
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).getTime();
    return 0;
};

const safeToLocaleString = (ts: any): string => {
    if (!ts) return 'N/A';
    if (ts instanceof Date) return ts.toLocaleString();
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toLocaleString();
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).toLocaleString();
    return 'Invalid Date';
}

const ActionDropdown: React.FC<{ item: PayoutQueueItem, onRequestAction: (item: PayoutQueueItem, status: PayoutQueueItem['status']) => void }> = ({ item, onRequestAction }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const handleActionClick = (status: PayoutQueueItem['status']) => {
        setIsOpen(false);
        onRequestAction(item, status);
    };

    const actions: PayoutQueueItem['status'][] = ['approved', 'on_hold', 'processing', 'rejected'];

    return (
        <div className="relative inline-block">
            <button onClick={() => setIsOpen(!isOpen)} className="px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300">Actions</button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white border rounded-md shadow-lg z-10">
                    {actions.map(action => (
                        <button key={action} onClick={() => handleActionClick(action)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 capitalize">
                            {action.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const RequestDetailsModal: React.FC<{ item: PayoutQueueItem, onClose: () => void }> = ({ item, onClose }) => {
    const DetailRow: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
        <div className={`py-2 grid grid-cols-3 gap-4 ${className}`}>
            <dt className="text-sm font-medium text-gray-500">{label}</dt>
            <dd className="mt-1 text-sm text-gray-900 col-span-2 sm:mt-0">{children}</dd>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">Request Details</h2>
                    <button onClick={onClose} className="text-2xl">&times;</button>
                </div>
                <div className="flex-1 p-6 overflow-y-auto">
                    <h3 className="font-bold text-lg mb-4">Request Information</h3>
                    <dl>
                        <DetailRow label="Request ID">{item.id}</DetailRow>
                        <DetailRow label="Type">{item.requestType}</DetailRow>
                        <DetailRow label="Status"><StatusBadge status={item.status} /></DetailRow>
                        <DetailRow label="Amount">₹{item.amount.toLocaleString('en-IN')}</DetailRow>
                        <DetailRow label="Date">{safeToLocaleString(item.timestamp)}</DetailRow>
                    </dl>
                    
                    <h3 className="font-bold text-lg mt-6 mb-4 border-t pt-4">User Information</h3>
                    <dl>
                        <DetailRow label="Name">{item.userName}</DetailRow>
                        <DetailRow label="Role">{item.userRole}</DetailRow>
                        {item.userPiNumber && <DetailRow label="Profile ID"><span className="font-mono">{item.userPiNumber}</span></DetailRow>}
                    </dl>
                    
                    <h3 className="font-bold text-lg mt-6 mb-4 border-t pt-4">Collaboration</h3>
                    <dl>
                        <DetailRow label="Title">{item.collabTitle}</DetailRow>
                        <DetailRow label="Collab ID">{item.collabId || 'N/A'}</DetailRow>
                        <DetailRow label="Document ID"><span className="font-mono text-xs">{item.collaborationId}</span></DetailRow>
                    </dl>

                    <h3 className="font-bold text-lg mt-6 mb-4 border-t pt-4">Payment Information</h3>
                    <dl>
                        {item.requestType === 'Payout' && (
                            <>
                                <DetailRow label="Method">{item.bankDetails ? 'Bank' : 'UPI'}</DetailRow>
                                {item.bankDetails && <DetailRow label="Bank Details"><pre className="text-xs font-mono whitespace-pre-wrap bg-gray-50 p-2 rounded">{item.bankDetails}</pre></DetailRow>}
                                {item.upiId && <DetailRow label="UPI ID">{item.upiId}</DetailRow>}
                            </>
                        )}
                        {item.requestType === 'Refund' && (
                            <>
                                <DetailRow label="Bank Details"><pre className="text-xs font-mono whitespace-pre-wrap bg-gray-50 p-2 rounded">{item.bankDetails}</pre></DetailRow>
                                <DetailRow label="PAN Number">{item.panNumber}</DetailRow>
                                <DetailRow label="Reason for Refund"><p className="whitespace-pre-wrap">{item.description}</p></DetailRow>
                            </>
                        )}
                        {item.requestType === 'Daily Payout' && (
                             <DetailRow label="Video Proof">
                                { 'videoUrl' in item.originalRequest && item.originalRequest.videoUrl ? (
                                    <a href={item.originalRequest.videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">View Video</a>
                                ) : 'N/A' }
                            </DetailRow>
                        )}
                    </dl>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200">Close</button>
                </div>
            </div>
        </div>
    );
};

interface EditDetailsModalProps {
    item: PayoutQueueItem;
    onClose: () => void;
    onSave: (item: PayoutQueueItem, data: Partial<PayoutRequest | RefundRequest>) => void;
}

const EditDetailsModal: React.FC<EditDetailsModalProps> = ({ item, onClose, onSave }) => {
    const [details, setDetails] = useState({
        amount: item.amount,
        bankDetails: item.bankDetails || '',
        upiId: item.upiId || '',
        panNumber: item.panNumber || '',
        description: item.description || ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setDetails(prev => ({ ...prev, [name]: name === 'amount' ? Number(value) : value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(item, details);
        setIsSaving(false);
    };

    const isPayout = item.requestType === 'Payout';
    const isRefund = item.requestType === 'Refund';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Edit Details for {item.userName}</h3>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Amount (INR)</label>
                        <input name="amount" type="number" value={details.amount} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                    {isPayout && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Bank Details</label>
                                <textarea name="bankDetails" value={details.bankDetails} onChange={handleChange} rows={4} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">UPI ID</label>
                                <input name="upiId" value={details.upiId} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                        </>
                    )}
                    {isRefund && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Bank Details</label>
                                <textarea name="bankDetails" value={details.bankDetails} onChange={handleChange} rows={4} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">PAN Number</label>
                                <input name="panNumber" value={details.panNumber} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Description/Reason</label>
                                <textarea name="description" value={details.description} onChange={handleChange} rows={2} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                        </>
                    )}
                </div>
                <div className="flex justify-end space-x-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-gray-200">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ConfirmationModalProps {
    onConfirm: (details: { reason?: string; amount?: number }) => void;
    onCancel: () => void;
    isSending: boolean;
    confirmationDetails: {
        item: PayoutQueueItem;
        status: PayoutQueueItem['status'];
    }
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ onConfirm, onCancel, isSending, confirmationDetails }) => {
    const { item, status } = confirmationDetails;
    const [reason, setReason] = useState('');
    const [amount, setAmount] = useState<string>('');
    const capitalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');

    const needsReason = status === 'rejected';
    const needsAmount = item.requestType === 'Daily Payout' && status === 'approved';
    
    const isConfirmDisabled = isSending || (needsReason && !reason.trim()) || (needsAmount && (amount === '' || isNaN(Number(amount))));
    
    useEffect(() => {
        if (needsAmount) {
            const originalRequest = item.originalRequest as DailyPayoutRequest;
            setAmount(String(originalRequest.approvedAmount || ''));
        }
    }, [item, needsAmount]);

    const handleConfirmClick = () => {
        onConfirm({
            reason: needsReason ? reason : undefined,
            amount: needsAmount ? Number(amount) : undefined
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Confirm Action</h3>
                <div className="my-4 text-gray-600 dark:text-gray-300 space-y-4">
                   <p>Are you sure you want to change the status to <strong>{capitalizedStatus}</strong> for this {item.requestType}?</p>
                   <ul className="text-sm list-disc list-inside bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                       <li><strong>User:</strong> {item.userName}</li>
                       <li><strong>Amount:</strong> ₹{item.requestType === 'Daily Payout' && status === 'approved' ? (amount || item.amount.toLocaleString()) : item.amount.toLocaleString()}</li>
                   </ul>

                   {needsReason && (
                       <div>
                           <label htmlFor="rejectionReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rejection Reason (Required)</label>
                           <textarea
                               id="rejectionReason"
                               value={reason}
                               onChange={(e) => setReason(e.target.value)}
                               rows={3}
                               className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-gray-200"
                               placeholder="Provide a clear reason for rejection..."
                           />
                       </div>
                   )}

                   {needsAmount && (
                       <div>
                           <label htmlFor="approvedAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Approved Amount (Required)</label>
                           <input
                               type="number"
                               id="approvedAmount"
                               value={amount}
                               onChange={(e) => setAmount(e.target.value)}
                               className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-gray-200"
                               placeholder="Enter approved amount"
                           />
                       </div>
                   )}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button 
                        onClick={onCancel} 
                        disabled={isSending}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleConfirmClick} 
                        disabled={isConfirmDisabled} 
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isSending ? 'Processing...' : `Confirm & ${capitalizedStatus}`}
                    </button>
                </div>
            </div>
        </div>
    );
};


interface PayoutsPanelProps {
    payouts: PayoutRequest[];
    refunds: RefundRequest[];
    dailyPayouts: DailyPayoutRequest[];
    collaborations: CombinedCollabItem[];
    allUsers: User[];
    onUpdate: () => void;
}

const PayoutsPanel: React.FC<PayoutsPanelProps> = ({ payouts, refunds, dailyPayouts, collaborations, allUsers, onUpdate }) => {
    const [filter, setFilter] = useState<'all' | 'pending' | 'processing'>('pending');
    const [editingItem, setEditingItem] = useState<PayoutQueueItem | null>(null);
    const [viewingDetails, setViewingDetails] = useState<PayoutQueueItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmation, setConfirmation] = useState<{ item: PayoutQueueItem; status: PayoutQueueItem['status']; } | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);


    const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);

    const combinedRequests = useMemo<PayoutQueueItem[]>(() => {
        const collabIdMap = new Map(collaborations.map(c => [c.id, c.originalData.collabId]));

        const p: PayoutQueueItem[] = payouts.map(r => {
            const user = userMap.get(r.userId);
            return {
                id: r.id, requestType: 'Payout', status: r.status, amount: r.amount, userName: r.userName,
                userAvatar: r.userAvatar, userRole: 'influencer', userPiNumber: user?.piNumber, collabTitle: r.collaborationTitle,
                collaborationId: r.collaborationId, collabType: r.collaborationType, timestamp: r.timestamp,
                bankDetails: r.bankDetails, upiId: r.upiId,
                collabId: r.collabId || collabIdMap.get(r.collaborationId),
                originalRequest: r,
            }
        });

        const r: PayoutQueueItem[] = refunds.map(r => {
            const user = userMap.get(r.brandId);
            return {
                id: r.id, requestType: 'Refund', status: r.status, amount: r.amount, userName: r.brandName,
                userAvatar: r.brandAvatar, userRole: 'brand', userPiNumber: user?.piNumber, brandName: r.brandName, collabTitle: r.collabTitle,
                collaborationId: r.collaborationId, collabType: r.collabType, timestamp: r.timestamp,
                bankDetails: r.bankDetails, panNumber: r.panNumber, description: r.description,
                collabId: r.collabId || collabIdMap.get(r.collaborationId),
                originalRequest: r,
            }
        });
        
        const d: PayoutQueueItem[] = dailyPayouts.map(r => {
            const user = userMap.get(r.userId);
            // FIX: Add missing 'originalRequest' property to satisfy the PayoutQueueItem type.
            return {
                id: r.id, requestType: 'Daily Payout', status: r.status, amount: r.approvedAmount || 0, userName: r.userName,
                userAvatar: '', userRole: r.userRole, userPiNumber: user?.piNumber, collabTitle: `Daily Payout for ${r.collaborationId}`,
                collaborationId: r.collaborationId, collabType: r.collaborationType, timestamp: r.timestamp, originalRequest: r,
                collabId: r.collabId || collabIdMap.get(r.collaborationId),
            }
        });

        return [...p, ...r, ...d].sort((a, b) => getTime(b.timestamp) - getTime(a.timestamp));
    }, [payouts, refunds, dailyPayouts, collaborations, userMap]);
    
    const filteredRequests = useMemo(() => {
        let results = combinedRequests;

        if (filter === 'processing') {
            results = results.filter(r => r.status === 'processing' || r.status === 'on_hold');
        } else if (filter === 'pending') {
            results = results.filter(r => r.status === 'pending');
        }
    
        if (searchQuery.trim() === '') {
            return results;
        }
    
        const lowercasedQuery = searchQuery.toLowerCase();
    
        return results.filter(item => {
            return (
                item.userName.toLowerCase().includes(lowercasedQuery) ||
                (item.userPiNumber && item.userPiNumber.toLowerCase().includes(lowercasedQuery)) ||
                item.collabTitle.toLowerCase().includes(lowercasedQuery) ||
                (item.collabId && item.collabId.toLowerCase().includes(lowercasedQuery)) ||
                item.requestType.toLowerCase().includes(lowercasedQuery) ||
                item.status.toLowerCase().includes(lowercasedQuery) ||
                String(item.amount).includes(lowercasedQuery)
            );
        });
    }, [combinedRequests, filter, searchQuery]);

    const handleStatusUpdateRequest = (item: PayoutQueueItem, status: PayoutQueueItem['status']) => {
        setConfirmation({ item, status });
    };

    const executeStatusUpdate = async (details: { reason?: string; amount?: number }) => {
        if (!confirmation) return;
        
        const { item, status } = confirmation;
        const { reason, amount } = details;

        setIsUpdatingStatus(true);
        try {
            // New: Process payout through backend when approving
            if (status === 'approved' && (item.requestType === 'Payout' || item.requestType === 'Daily Payout')) {
                try {
                    await apiService.processPayout(item.id);
                    alert("Payout processed successfully via backend. Updating status in database...");
                } catch (payoutError: any) {
                    // Throw a more specific error to be caught by the outer block
                    throw new Error(`Payout Processing Failed: ${payoutError.message}`);
                }
            }

            switch (item.requestType) {
                case 'Payout':
                    await apiService.updatePayoutStatus(item.id, status, item.collaborationId, item.collabType, reason);
                    break;
                case 'Refund':
                    const refundUpdateData: Partial<RefundRequest> = { status };
                    if (reason !== undefined) refundUpdateData.rejectionReason = reason;
                    await apiService.updateRefundRequest(item.id, refundUpdateData);
                    break;
                case 'Daily Payout':
                    if (status === 'approved' || status === 'rejected') {
                        await apiService.updateDailyPayoutRequestStatus(item.id, item.collaborationId, item.collabType as 'ad_slot' | 'banner_booking', status, amount, reason);
                    } else { // 'on_hold' or 'processing'
                        await apiService.updateDailyPayoutRequest(item.id, { status });
                    }
                    break;
            }
            onUpdate();
        } catch (error) {
            console.error("Failed to complete action:", error);
            alert(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsUpdatingStatus(false);
            setConfirmation(null);
        }
    };
    
    const handleSaveDetails = async (item: PayoutQueueItem, data: Partial<PayoutRequest | RefundRequest>) => {
        try {
            if (item.requestType === 'Payout') {
                await apiService.updatePayoutRequest(item.id, data);
            } else if (item.requestType === 'Refund') {
                await apiService.updateRefundRequest(item.id, data as Partial<RefundRequest>);
            }
            setEditingItem(null);
            onUpdate();
        } catch (error) {
            console.error("Failed to update details:", error);
            alert("Failed to save details.");
        }
    };
    
    return (
        <div className="p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-4">Payouts & Refunds</h2>

            <div className="mb-4 relative">
                <input
                    type="text"
                    placeholder="Search by user, title, ID, status, amount..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                />
            </div>

            <div className="flex space-x-2 mb-4">
                <button onClick={() => setFilter('pending')} className={`px-3 py-1 text-sm rounded-md ${filter === 'pending' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Pending</button>
                <button onClick={() => setFilter('processing')} className={`px-3 py-1 text-sm rounded-md ${filter === 'processing' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Processing/Hold</button>
                <button onClick={() => setFilter('all')} className={`px-3 py-1 text-sm rounded-md ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>All</button>
            </div>
            <div className="flex-1 overflow-auto bg-white rounded-lg shadow-inner">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Collab ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredRequests.map(item => (
                            <tr key={item.id}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <img className="h-8 w-8 rounded-full" src={item.userAvatar} alt={item.userName} />
                                        <div className="ml-2">
                                            <div className="text-sm font-medium max-w-40 truncate" title={item.userName}>{item.userName}</div>
                                            {item.userPiNumber && <div className="text-xs text-gray-400 font-mono">{item.userPiNumber}</div>}
                                            <div className="text-xs text-gray-500 capitalize">{item.userRole}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-sm font-semibold">{item.collabTitle}</div>
                                    <div className="text-xs text-gray-600">{item.requestType}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">
                                     ₹{item.amount.toLocaleString('en-IN')}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                                    <div className="max-w-28 truncate" title={item.collabId || undefined}>
                                        {item.collabId || 'N/A'}
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {safeToLocaleString(item.timestamp)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    <StatusBadge status={item.status} />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right space-x-2">
                                     <button onClick={() => setViewingDetails(item)} className="text-indigo-600 hover:underline">Details</button>
                                     {item.requestType !== 'Daily Payout' && (
                                        <button onClick={() => setEditingItem(item)} className="text-blue-600 hover:underline">Edit</button>
                                     )}
                                    <ActionDropdown item={item} onRequestAction={handleStatusUpdateRequest} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredRequests.length === 0 && <p className="p-6 text-center text-gray-500">No requests found.</p>}
            </div>
            {editingItem && (
                <EditDetailsModal
                    item={editingItem}
                    onClose={() => setEditingItem(null)}
                    onSave={handleSaveDetails}
                />
            )}
            {viewingDetails && (
                 <RequestDetailsModal item={viewingDetails} onClose={() => setViewingDetails(null)} />
            )}
            {confirmation && (
                <ConfirmationModal 
                    onConfirm={executeStatusUpdate}
                    onCancel={() => setConfirmation(null)}
                    isSending={isUpdatingStatus}
                    confirmationDetails={confirmation}
                />
            )}
        </div>
    );
};

export default PayoutsPanel;