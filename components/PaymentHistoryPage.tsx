import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, PayoutRequest, RefundRequest } from '../types';
import { apiService } from '../services/apiService';
import { Timestamp } from 'firebase/firestore';
import { ExclamationTriangleIcon } from './Icons';
import CashfreeModal from './PhonePeModal';

interface CombinedHistoryItem {
    date: Date | undefined;
    description: string;
    type: 'Payment Made' | 'Payout' | 'Refund';
    amount: number;
    status: string;
    transactionId: string;
    collaborationId: string;
    collabId?: string;
    deductedPenalty?: number;
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

const PaymentHistoryPage: React.FC<{ user: User }> = ({ user }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
    const [refunds, setRefunds] = useState<RefundRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'payments' | 'payouts' | 'penalties'>('all');
    const [showPayPenaltyModal, setShowPayPenaltyModal] = useState(false);
    const [platformSettings, setPlatformSettings] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const promises = [
                    apiService.getTransactionsForUser(user.id),
                    apiService.getPayoutHistoryForUser(user.id),
                    apiService.getPlatformSettings()
                ];

                // If user is brand, fetch refunds
                let brandRefunds: RefundRequest[] = [];
                if (user.role === 'brand') {
                    brandRefunds = await apiService.getRefundsForUser(user.id);
                }

                const [userTransactions, userPayouts, settings] = await Promise.all(promises);
                
                setTransactions(userTransactions);
                setPayouts(userPayouts);
                setRefunds(brandRefunds);
                setPlatformSettings(settings);
            } catch (err) {
                console.error(err);
                setError("Failed to load payment history.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user.id, user.role]);

    const combinedHistory = useMemo<CombinedHistoryItem[]>(() => {
        const safeToDate = (ts: any): Date | undefined => {
            if (!ts) return undefined;
            if (ts instanceof Date) return ts;
            if (typeof ts.toDate === 'function') return ts.toDate();
            if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
            if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
            if (ts.seconds !== undefined && ts.nanoseconds !== undefined) return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
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
            deductedPenalty: p.deductedPenalty
        }));

        const mappedRefunds: CombinedHistoryItem[] = refunds.map(r => ({
            date: safeToDate(r.timestamp),
            description: r.collaborationTitle || r.description,
            type: 'Refund',
            amount: r.amount,
            status: r.status,
            transactionId: r.id,
            collaborationId: r.collaborationId,
            collabId: r.collabId,
        }));

        return [...mappedTransactions, ...mappedPayouts, ...mappedRefunds].sort((a, b) => {
            const timeA = a.date instanceof Date ? a.date.getTime() : 0;
            const timeB = b.date instanceof Date ? b.date.getTime() : 0;
            return timeB - timeA;
        });
    }, [transactions, payouts, refunds]);

    const filteredHistory = useMemo(() => {
        if (activeTab === 'payments') return combinedHistory.filter(item => item.type === 'Payment Made');
        if (activeTab === 'payouts') {
            // If brand, show refunds under this tab
            if (user.role === 'brand') {
                return combinedHistory.filter(item => item.type === 'Refund');
            }
            return combinedHistory.filter(item => item.type === 'Payout');
        }
        if (activeTab === 'penalties') {
            return combinedHistory.filter(item => 
                (item.deductedPenalty && item.deductedPenalty > 0) || 
                (item.description && item.description.toLowerCase().includes('penalty'))
            );
        }
        return combinedHistory;
    }, [activeTab, combinedHistory, user.role]);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Payment History</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">View your transactions, {user.role === 'brand' ? 'refunds' : 'payouts'}, and penalties.</p>
            </div>

            {/* Penalty Alert Section */}
            {(user.pendingPenalty && user.pendingPenalty > 0) || activeTab === 'penalties' ? (
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400 mt-1" />
                        <div>
                            <h3 className="font-bold text-red-800 dark:text-red-300">
                                {user.pendingPenalty && user.pendingPenalty > 0 ? `Pending Penalty: ₹${user.pendingPenalty.toLocaleString()}` : "No Pending Penalties"}
                            </h3>
                            {user.pendingPenalty && user.pendingPenalty > 0 ? (
                                <p className="text-sm text-red-700 dark:text-red-400">
                                    This amount will be deducted from your next payout due to previous cancellations.
                                </p>
                            ) : (
                                <p className="text-sm text-green-700 dark:text-green-400">
                                    You have no outstanding penalties.
                                </p>
                            )}
                        </div>
                    </div>
                    {user.pendingPenalty && user.pendingPenalty > 0 && (
                        <button 
                            onClick={() => setShowPayPenaltyModal(true)}
                            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-md transition-colors whitespace-nowrap"
                        >
                            Clear Penalty Now
                        </button>
                    )}
                </div>
            ) : null}

            <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('all')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                    All
                </button>
                <button 
                    onClick={() => setActiveTab('payments')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'payments' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                    Payments Made
                </button>
                <button 
                    onClick={() => setActiveTab('payouts')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'payouts' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                    {user.role === 'brand' ? 'Refunds' : 'Payouts'}
                </button>
                <button 
                    onClick={() => setActiveTab('penalties')} 
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'penalties' ? 'border-red-600 text-red-600 dark:border-red-400 dark:text-red-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                    Penalties
                </button>
            </div>

            {isLoading ? <p className="text-center py-10 dark:text-gray-300">Loading history...</p> : 
            error ? <p className="text-center py-10 text-red-500">{error}</p> :
            filteredHistory.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <p className="text-gray-500 dark:text-gray-400">No history found.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl overflow-hidden flex-1">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Collab ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredHistory.map((item, index) => (
                                    <tr key={`${item.transactionId}-${index}`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.date?.toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate" title={item.description}>
                                            {item.description}
                                            {item.deductedPenalty ? (
                                                <span className="block text-xs text-red-500 mt-1">Penalty Deducted: -₹{item.deductedPenalty}</span>
                                            ) : null}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                            {item.collabId || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`font-semibold ${item.type === 'Payment Made' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{item.type}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-semibold">
                                            {item.type === 'Payment Made' ? '-' : '+'} ₹{item.amount.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={item.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showPayPenaltyModal && platformSettings && (
                <CashfreeModal
                    user={user}
                    collabType="penalty_payment"
                    baseAmount={user.pendingPenalty || 0}
                    platformSettings={platformSettings}
                    onClose={() => {
                        setShowPayPenaltyModal(false);
                        window.location.reload(); // Refresh to update user data
                    }}
                    transactionDetails={{
                        userId: user.id,
                        description: `Penalty Payment`,
                        relatedId: user.id, // User paying for themselves
                    }}
                />
            )}
        </div>
    );
};

export default PaymentHistoryPage;