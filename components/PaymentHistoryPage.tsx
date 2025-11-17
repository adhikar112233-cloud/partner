import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, PayoutRequest } from '../types';
import { apiService } from '../services/apiService';
import { Timestamp } from 'firebase/firestore';

interface CombinedHistoryItem {
    date: Date | undefined;
    description: string;
    type: 'Payment Made' | 'Payout';
    amount: number;
    status: string;
    transactionId: string;
    collaborationId: string;
    collabId?: string;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const s = status.toLowerCase();
    let colorClasses = "bg-gray-100 text-gray-800";
    if (s === 'completed' || s === 'approved') {
        colorClasses = "bg-green-100 text-green-800";
    } else if (s === 'pending') {
        colorClasses = "bg-yellow-100 text-yellow-800";
    } else if (s === 'rejected' || s === 'failed') {
        colorClasses = "bg-red-100 text-red-800";
    }
    return <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClasses} capitalize`}>{status.replace('_', ' ')}</span>;
};

const PaymentHistoryPage: React.FC<{ user: User }> = ({ user }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'payments' | 'payouts'>('all');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [userTransactions, userPayouts] = await Promise.all([
                    apiService.getTransactionsForUser(user.id),
                    apiService.getPayoutHistoryForUser(user.id),
                ]);
                setTransactions(userTransactions);
                setPayouts(userPayouts);
            } catch (err) {
                console.error(err);
                setError("Failed to load payment history.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user.id]);

    const combinedHistory = useMemo<CombinedHistoryItem[]>(() => {
        const safeToDate = (ts: any): Date | undefined => {
            if (ts && typeof ts.toDate === 'function') {
                try {
                    return ts.toDate();
                } catch (e) {
                    return undefined;
                }
            }
            return undefined;
        };

        const mappedTransactions: CombinedHistoryItem[] = transactions.map(t => ({
            date: safeToDate(t.timestamp),
            description: t.description,
            type: 'Payment Made',
            amount: t.amount,
            status: t.status,
            transactionId: t.transactionId,
            collaborationId: t.relatedId,
            collabId: t.collabId,
        }));

        const mappedPayouts: CombinedHistoryItem[] = payouts.map(p => ({
            date: safeToDate(p.timestamp),
            description: p.collaborationTitle,
            type: 'Payout',
            amount: p.amount,
            status: p.status,
            transactionId: p.id,
            collaborationId: p.collaborationId,
            collabId: p.collabId,
        }));

        return [...mappedTransactions, ...mappedPayouts].sort((a, b) => {
            const timeA = a.date instanceof Date ? a.date.getTime() : 0;
            const timeB = b.date instanceof Date ? b.date.getTime() : 0;
            return timeB - timeA;
        });
    }, [transactions, payouts]);
    
    const filteredHistory = useMemo(() => {
        if (activeTab === 'payments') {
            return combinedHistory.filter(item => item.type === 'Payment Made');
        }
        if (activeTab === 'payouts') {
            return combinedHistory.filter(item => item.type === 'Payout');
        }
        return combinedHistory;
    }, [combinedHistory, activeTab]);

    const TabButton: React.FC<{ tab: typeof activeTab, children: React.ReactNode }> = ({ tab, children }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === tab ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >
            {children}
        </button>
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Payment History</h1>
                <p className="text-gray-500 mt-1">Review all your payments and payouts on BIGYAPON.</p>
            </div>
            <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
                <div className="p-4 border-b">
                    <nav className="flex space-x-2">
                        <TabButton tab="all">All</TabButton>
                        <TabButton tab="payments">Payments Made</TabButton>
                        <TabButton tab="payouts">Payouts</TabButton>
                    </nav>
                </div>
                {isLoading ? (
                    <p className="p-6 text-center text-gray-500">Loading history...</p>
                ) : error ? (
                    <p className="p-6 text-center text-red-500">{error}</p>
                ) : filteredHistory.length === 0 ? (
                    <p className="p-6 text-center text-gray-500">No transactions found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collab ID</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredHistory.map((item, index) => (
                                    <tr key={index}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.date?.toLocaleString() || 'Invalid Date'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.description}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.collabId || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className={`font-semibold ${item.type === 'Payment Made' ? 'text-red-600' : 'text-green-600'}`}>{item.type}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                            {item.type === 'Payment Made' ? '-' : '+'} ₹{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={item.status} /></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.transactionId}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentHistoryPage;