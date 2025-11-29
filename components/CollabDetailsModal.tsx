
import React from 'react';
import { AnyCollaboration } from '../types';
import { Timestamp } from 'firebase/firestore';

interface CollabDetailsModalProps {
    collab: AnyCollaboration;
    onClose: () => void;
}

const toJsDate = (ts: any): Date | undefined => {
    if (!ts) return undefined;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    return undefined;
};

const CollabDetailsModal: React.FC<CollabDetailsModalProps> = ({ collab, onClose }) => {
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
                    </div>

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
