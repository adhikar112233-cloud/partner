
import React, { useState, useEffect } from 'react';
import { User, AdSlotRequest, BannerAdBookingRequest, EmiItem } from '../types';
import { apiService } from '../services/apiService';
import { ExclamationTriangleIcon, BanknotesIcon } from './Icons';

interface EmiReminderSplashProps {
    user: User;
    onClose: () => void;
    onPayNow: (collab: AdSlotRequest | BannerAdBookingRequest, emi: EmiItem) => void;
}

const EmiReminderSplash: React.FC<EmiReminderSplashProps> = ({ user, onClose, onPayNow }) => {
    const [pendingEmi, setPendingEmi] = useState<{ collab: AdSlotRequest | BannerAdBookingRequest, emi: EmiItem } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [countdown, setCountdown] = useState(7); // 7 second skip

    useEffect(() => {
        const checkEmis = async () => {
            try {
                // Fetch active bookings for brand
                const [tvRequests, bannerRequests] = await Promise.all([
                    apiService.getAdSlotRequestsForBrand(user.id),
                    apiService.getBannerAdBookingRequestsForBrand(user.id)
                ]);
                
                const allRequests = [...tvRequests, ...bannerRequests];
                
                // Find first pending/overdue EMI that is due within next 3 days or past due
                const now = new Date();
                const threeDaysFromNow = new Date();
                threeDaysFromNow.setDate(now.getDate() + 3);

                for (const req of allRequests) {
                    if (req.paymentPlan === 'emi' && req.emiSchedule) {
                        const nextDue = req.emiSchedule.find(e => e.status === 'pending' || e.status === 'overdue');
                        if (nextDue) {
                            const dueDate = new Date(nextDue.dueDate);
                            if (dueDate <= threeDaysFromNow) {
                                setPendingEmi({ collab: req, emi: nextDue });
                                break; 
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to check EMIs", e);
            } finally {
                setIsLoading(false);
            }
        };

        if (user.role === 'brand') {
            checkEmis();
        } else {
            setIsLoading(false);
        }
    }, [user.id, user.role]);

    useEffect(() => {
        if (pendingEmi && countdown > 0) {
            const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        } else if (pendingEmi && countdown === 0) {
            onClose(); // Auto skip
        } else if (!pendingEmi && !isLoading) {
            onClose(); // No EMI, just close immediately
        }
    }, [pendingEmi, countdown, isLoading, onClose]);

    if (!pendingEmi) return null;

    const isOverdue = new Date(pendingEmi.emi.dueDate) < new Date();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex justify-center items-center z-[200] p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md text-center transform transition-all scale-100 border-4 border-red-500">
                <div className="flex justify-center mb-4">
                    <div className="p-4 bg-red-100 text-red-600 rounded-full animate-pulse">
                        <ExclamationTriangleIcon className="w-12 h-12" />
                    </div>
                </div>
                
                <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white mb-2">
                    {isOverdue ? '⚠️ Payment Overdue!' : 'Upcoming Payment Due'}
                </h2>
                
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Your {pendingEmi.emi.description} for <strong>{pendingEmi.collab.campaignName}</strong> is {isOverdue ? 'overdue' : 'due soon'}.
                    <br/>
                    <span className="text-sm text-red-500 mt-2 block">Failure to pay may result in booking cancellation.</span>
                </p>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6 flex justify-between items-center border border-gray-200 dark:border-gray-600">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Due Amount:</span>
                    <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">₹{pendingEmi.emi.amount.toLocaleString()}</span>
                </div>

                <div className="flex gap-3 flex-col">
                    <button 
                        onClick={() => onPayNow(pendingEmi.collab, pendingEmi.emi)}
                        className="w-full py-3.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg flex justify-center items-center gap-2"
                    >
                        <BanknotesIcon className="w-5 h-5" /> Pay Now
                    </button>
                    
                    <button 
                        onClick={onClose}
                        className="w-full py-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 text-sm font-medium"
                    >
                        Skip for now ({countdown}s)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmiReminderSplash;
