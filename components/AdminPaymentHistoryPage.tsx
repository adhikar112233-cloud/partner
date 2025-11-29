import React, { useState, useMemo } from 'react';
import { User, Transaction, PayoutRequest, UserRole } from '../types';
import { Timestamp } from 'firebase/firestore';
import { SparklesIcon } from './Icons';

interface AdminPaymentHistoryPageProps {
    transactions: Transaction[];
    payouts: PayoutRequest[];
    allUsers: User[];
    collaborations: { id: string; trackingId?: string }[];
}

interface CombinedHistoryItem {
    date: Date | undefined;
    description: string;
    type: 'Payment Made' | 'Payout';
    amount: number;
    status: string;
    transactionId: string;
    paymentRefId: string;
    userName: string;
    userAvatar: string;
    userRole: UserRole;
    userPiNumber?: string;
    collaborationId: string;
    collabId?: string;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const s = status.toLowerCase();
    let colorClasses = "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    if (s === 'completed' || s === 'approved') {
        colorClasses = "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300";
    } else if (s === 'pending') {
        colorClasses = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300";
    } else if (s === 'rejected' || s === 'failed') {
        colorClasses = "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300";
    }
    return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClasses} capitalize`}>{status.replace('_', ' ')}</span>;
};

const AdminPaymentHistoryPage: React.FC<AdminPaymentHistoryPageProps> = ({ transactions, payouts, allUsers, collaborations }) => {
    const [activeTab, setActiveTab] = useState<'all' | 'payments' | 'payouts'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const combinedHistory = useMemo<CombinedHistoryItem[]>(() => {
        const userMap: Map<string, User> = new Map(allUsers.map(u => [u.id, u]));
        const collabIdMap = new Map<string, string>();
        collaborations.forEach(c => {
            if (c.trackingId) collabIdMap.set(c.id, c.trackingId);
        });
        
        const safeToDate = (ts: any): Date | undefined => {
            if (!ts) return undefined;
            if (ts instanceof Date) return ts;
            if (typeof ts.toDate === 'function') return ts.toDate();
            if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
            if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
            if (ts.seconds !== undefined && ts.nanoseconds !== undefined) return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
            return undefined;
        };

        const mappedTransactions: CombinedHistoryItem[] = transactions.map(t => {
            const user = userMap.get(t.userId);
            const refId = t.paymentGatewayDetails?.razorpayPaymentId || t.paymentGatewayDetails?.referenceId || t.paymentGatewayDetails?.payment_id || '-';
            
            let visibleCollabId = t.collabId;
            if (!visibleCollabId) visibleCollabId = t.paymentGatewayDetails?.order_tags?.collabId;
            if (!visibleCollabId && t.relatedId) visibleCollabId = collabIdMap.get(t.relatedId);
            
            if (!visibleCollabId && t.relatedId && (
                t.description?.toLowerCase().includes('collaboration') || 
                t.description?.toLowerCase().includes('campaign') || 
                t.description?.toLowerCase().includes('ad')
            )) {
                visibleCollabId = t.relatedId;
            }

            return {
                date: safeToDate(t.timestamp),
                description: t.description,
                type: 'Payment Made',
                amount: t.amount,
                status: t.status,
                transactionId: t.transactionId,
                paymentRefId: refId,
                userName: user?.name || 'Unknown User',
                userAvatar: user?.avatar || '',
                userRole: user?.role || 'brand',
                userPiNumber: user?.piNumber,
                collaborationId: t.relatedId,
                collabId: visibleCollabId,
            };
        });

        const mappedPayouts: CombinedHistoryItem[] = payouts.map(p => {
            const user = userMap.get(p.userId);
            
            let visibleCollabId = p.collabId;
            if (!visibleCollabId && p.collaborationId) visibleCollabId = collabIdMap.get(p.collaborationId);
            if (!visibleCollabId) visibleCollabId = p.collaborationId;

            return {
                date: safeToDate(p.timestamp),
                description: p.collaborationTitle,
                type: 'Payout',
                amount: p.amount,
                status: p.status,
                transactionId: p.id,
                paymentRefId: '-',
                userName: p.userName,
                userAvatar: p.userAvatar,
                userRole: user?.role || 'influencer',
                userPiNumber: user?.piNumber,
                collaborationId: p.collaborationId || '',
                collabId: visibleCollabId,
            };
        });

        return [...mappedTransactions, ...mappedPayouts].sort((a, b) => {
            const timeA = a.date instanceof Date ? a.date.getTime() : 0;
            const timeB = b.date instanceof Date ? b.date.getTime() : 0;
            return timeB - timeA;
        });
    }, [transactions, payouts, allUsers, collaborations]);
    
    const filteredHistory = useMemo(() => {
        let history = combinedHistory;

        if (activeTab === 'payments') {
            history = history.filter(item => item.type === 'Payment Made');
        }
        if (activeTab === 'payouts') {
            history = history.filter(item => item.type === 'Payout');
        }

        if (searchQuery.trim() === '') {
            return history;
        }
    
        const lowercasedQuery = searchQuery.toLowerCase();
        
        return history.filter(item => {
            return (
                item.userName.toLowerCase().includes(lowercasedQuery) ||
                (item.userPiNumber && item.userPiNumber.toLowerCase().includes(lowercasedQuery)) ||
                item.description.toLowerCase().includes(lowercasedQuery) ||
                (item.collabId && item.collabId.toLowerCase().includes(lowercasedQuery)) ||
                item.transactionId.toLowerCase().includes(lowercasedQuery) ||
                item.paymentRefId.toLowerCase().includes(lowercasedQuery) ||
                item.type.toLowerCase().includes(lowercasedQuery) ||
                item.status.toLowerCase().includes(lowercasedQuery) ||
                String(item.amount).includes(lowercasedQuery)
            );
        });
    }, [combinedHistory, activeTab, searchQuery]);

    const TabButton: React.FC<{ tab: typeof activeTab, children: React.ReactNode }> = ({ tab, children }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-indigo-100 text-indigo-700 dark:bg-gray-700 dark:text-indigo-300' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900'}`}
        >
            {children}
        </button>
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 px-6 pt-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Platform Payment History</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Review all payments and payouts across the platform.</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden mt-6 mx-6 mb-6 flex flex-col flex-1 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center flex-wrap gap-4 flex-shrink-0">
                    <nav className="flex space-x-2">
                        <TabButton tab="all">All</TabButton>
                        <TabButton tab="payments">Payments Made</TabButton>
                        <TabButton tab="payouts">Payouts</TabButton>
                    </nav>
                     <div className="relative w-full sm:w-auto sm:max-w-md">
                        <input
                            type="text"
                            placeholder="Search by user, ID, Collab ID, amount..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {filteredHistory.length === 0 ? (
                        <p className="p-6 text-center text-gray-500 dark:text-gray-400">No transactions found for the current filter.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[1200px] divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Collab ID</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order ID</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Payment Ref ID</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredHistory.map((item, index) => (
                                        <tr key={`${item.transactionId}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {item.date?.toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-8 w-8">
                                                        <img className="h-8 w-8 rounded-full object-cover" src={item.userAvatar || 'https://via.placeholder.com/40'} alt="" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{item.userName}</div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{item.userRole}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={item.description}>
                                                {item.description}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-gray-500 dark:text-gray-400">
                                                {item.collabId || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                                                <span className={item.type === 'Payment Made' ? 'text-green-600' : 'text-red-600'}>
                                                    {item.type === 'Payment Made' ? '+' : '-'} ₹{item.amount.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <StatusBadge status={item.status} />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">
                                                {item.transactionId}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">
                                                {item.paymentRefId}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPaymentHistoryPage;