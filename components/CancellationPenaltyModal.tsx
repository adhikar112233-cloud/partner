
import React, { useState } from 'react';
import { ExclamationTriangleIcon } from './Icons';

interface CancellationPenaltyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    penaltyAmount: number;
    isProcessing: boolean;
}

const CancellationPenaltyModal: React.FC<CancellationPenaltyModalProps> = ({ isOpen, onClose, onConfirm, penaltyAmount, isProcessing }) => {
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md transform transition-all scale-100" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 text-red-600 rounded-full flex-shrink-0">
                        <ExclamationTriangleIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Cancel Collaboration?</h3>
                        <div className="text-gray-600 dark:text-gray-300 text-sm space-y-3">
                            <p>
                                Are you sure you want to cancel this booking? This action cannot be undone and will negatively impact your reputation score.
                            </p>
                            {penaltyAmount > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">
                                    <p className="font-bold text-red-700 dark:text-red-400 mb-1">⚠️ Cancellation Penalty</p>
                                    <p className="text-red-600 dark:text-red-300">
                                        A penalty of <span className="font-bold">₹{penaltyAmount}</span> will be applied to your account and deducted from future payouts.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for Cancellation</label>
                    <textarea 
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Please explain why you are cancelling..."
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                    />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button 
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                        Keep Collaboration
                    </button>
                    <button 
                        onClick={() => onConfirm(reason)}
                        disabled={isProcessing || !reason.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 shadow-md transition-colors"
                    >
                        {isProcessing ? 'Cancelling...' : (penaltyAmount > 0 ? `Confirm & Pay Penalty` : 'Confirm Cancellation')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CancellationPenaltyModal;
