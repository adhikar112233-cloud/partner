

import React, { useState } from 'react';
import { AnyCollaboration, User } from '../types';
import { Timestamp } from 'firebase/firestore';
import { apiService } from '../services/apiService';

interface CollabDetailsModalProps {
    collab: AnyCollaboration;
    onClose: () => void;
    currentUser?: User; // Pass the logged-in user to check permissions
}

const toJsDate = (ts: any): Date | undefined => {
    if (!ts) return undefined;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    return undefined;
};

const CollabDetailsModal: React.FC<CollabDetailsModalProps> = ({ collab, onClose, currentUser }) => {
    const [sendingReminder, setSendingReminder] = useState<string | null>(null);

    const getTitle = () => {
        if ('title' in collab) return collab.title;
        if ('campaignTitle' in collab) return collab.campaignTitle;
        if ('campaignName' in collab) return collab.campaignName;
        return 'Untitled';
    };

    const getPartnerName = () => {
        if ('influencerName' in collab) return collab.influencerName;
        if ('liveTvName' in collab) return (collab as any).liveTvName;
        if ('agencyName' in collab) return (collab as any).agencyName;
        if ('brandName' in collab) return collab.brandName;
        return 'Unknown';
    };

    const getDescription = () => {
        if ('message' in collab) return collab.message;
        if ('description' in collab) return (collab as any).description; // Some types might have description
        return 'No description provided.';
    };

    const emiSchedule = ('emiSchedule' in collab) ? (collab as any).emiSchedule : null;
    const isStaff = currentUser?.role === 'staff';

    const handleSendReminder = async (emi: any) => {
        if (!collab.brandId) return;
        setSendingReminder(emi.id);
        try {
            await apiService.sendUserNotification(
                collab.brandId,
                "Payment Reminder",
                `Your EMI payment for ${getTitle()} (${emi.description}) is due on ${new Date(emi.dueDate).toLocaleDateString()}. Please pay to avoid penalties.`
            );
            alert("Reminder sent successfully!");
        } catch (error) {
            console.error("Failed to send reminder:", error);
            alert("Failed to send reminder.");
        } finally {
            setSendingReminder(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Collaboration Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{getTitle()}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Partner: {getPartnerName()}</p>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Date & Time</span>
                            <span className="text-sm text-gray-800 dark:text-gray-200">{toJsDate(collab.timestamp)?.toLocaleString()}</span>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Status</span>
                            <span className="text-sm font-semibold capitalize text-indigo-600 dark:text-indigo-400">{collab.status.replace(/_/g, ' ')}</span>
                        </div>
                    </div>

                    {/* Content/Message */}
                    <div>
                        <span className="text-xs text-gray-500 uppercase font-bold block mb-2">Details / Message</span>
                        <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                            {getDescription()}
                        </div>
                    </div>

                    {/* Financials */}
                    <div>
                        <span className="text-xs text-gray-500 uppercase font-bold block mb-2">Financials</span>
                        <div className="flex justify-between items-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount</span>
                            <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                {collab.finalAmount || (collab as any).budget || (collab as any).paymentOffer || 'N/A'}
                            </span>
                        </div>
                        {collab.currentOffer && (
                            <p className="text-xs text-gray-500 mt-2 text-right">
                                Latest Offer: {collab.currentOffer.amount} (by {collab.currentOffer.offeredBy})
                            </p>
                        )}
                        {('dailyRate' in collab) && (collab as any).dailyRate && (
                            <p className="text-xs text-gray-500 mt-1 text-right">
                                Agreed Daily Rate: ₹{(collab as any).dailyRate}/day
                            </p>
                        )}
                    </div>

                    {/* EMI Schedule */}
                    {emiSchedule && emiSchedule.length > 0 && (
                        <div>
                            <span className="text-xs text-gray-500 uppercase font-bold block mb-2">EMI Schedule</span>
                            <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 dark:bg-gray-700">
                                        <tr>
                                            <th className="p-2">Installment</th>
                                            <th className="p-2">Due Date</th>
                                            <th className="p-2">Amount</th>
                                            <th className="p-2">Status</th>
                                            {isStaff && <th className="p-2 text-right">Action</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {emiSchedule.map((emi: any, idx: number) => (
                                            <tr key={idx} className="dark:text-gray-300">
                                                <td className="p-2">{emi.description.split('(')[0]}</td>
                                                <td className="p-2">{new Date(emi.dueDate).toLocaleDateString()}</td>
                                                <td className="p-2">₹{emi.amount.toLocaleString()}</td>
                                                <td className="p-2">
                                                    <span className={`px-1.5 py-0.5 rounded ${emi.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {emi.status}
                                                    </span>
                                                </td>
                                                {isStaff && (
                                                    <td className="p-2 text-right">
                                                        {emi.status !== 'paid' && (
                                                            <button 
                                                                onClick={() => handleSendReminder(emi)}
                                                                disabled={sendingReminder === emi.id}
                                                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-[10px] font-semibold disabled:opacity-50"
                                                            >
                                                                {sendingReminder === emi.id ? 'Sending...' : 'Send Reminder'}
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Ad Specific Details */}
                    {('startDate' in collab) && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Start Date</span>
                                <span className="text-sm dark:text-gray-200">{(collab as any).startDate}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase font-bold block mb-1">End Date</span>
                                <span className="text-sm dark:text-gray-200">{(collab as any).endDate}</span>
                            </div>
                        </div>
                    )}

                    {/* Rejection/Cancellation Reason */}
                    {(collab.rejectionReason) && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800">
                            <span className="text-xs text-red-600 dark:text-red-400 uppercase font-bold block mb-1">Cancellation / Rejection Reason</span>
                            <p className="text-sm text-red-800 dark:text-red-200">{collab.rejectionReason}</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CollabDetailsModal;
