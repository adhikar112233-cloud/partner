import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { auth, BACKEND_URL } from '../services/firebase';

interface PaymentSuccessPageProps {
    user: User;
    onComplete: () => void;
}

const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onComplete }) => {
    const [status, setStatus] = useState<'Checking...' | 'PAID' | 'PENDING' | 'FAILED'>("Checking...");
    const [orderId, setOrderId] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("order_id");
        setOrderId(id);

        if (id) {
            // Initial check with a small delay to allow webhook/backend processing
            const timer = setTimeout(() => checkStatus(id), 1500);
            return () => clearTimeout(timer);
        } else {
            setStatus("FAILED");
        }
    }, []);

    useEffect(() => {
        if (status === 'PAID') {
            setCountdown(5);
            const interval = setInterval(() => {
                setCountdown((prev) => {
                    if (prev === 1) {
                        clearInterval(interval);
                        onComplete();
                        return 0;
                    }
                    return (prev || 0) - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [status]);

    const checkStatus = async (id: string) => {
        setStatus("Checking...");
        try {
            let headers: Record<string, string> = { "Content-Type": "application/json" };
            const currentUser = auth.currentUser;
            if (currentUser) {
                const token = await currentUser.getIdToken();
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Using the verify-order endpoint added to the backend function
            const response = await fetch(`${BACKEND_URL}/verify-order/${id}`, {
                method: 'GET',
                headers: headers
            });

            if (response.ok) {
                const data = await response.json();
                if (data.order_status === 'PAID' || data.order_status === 'completed') {
                    setStatus("PAID");
                } else {
                    setStatus(data.order_status || "PENDING");
                }
            } else {
                setStatus("FAILED");
            }
        } catch (e) {
            console.error(e);
            setStatus("FAILED");
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 font-sans">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-gray-100 dark:border-gray-700 transition-all duration-300">
                {status === 'PAID' ? (
                    <div className="animate-fade-in-down">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Payment Successful!</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-2">
                            Order ID: <span className="font-mono font-medium select-all bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-sm">{orderId || '...'}</span>
                        </p>
                        <p className="text-green-600 dark:text-green-400 font-semibold mb-8">Transaction Verified & History Updated</p>
                        
                        {countdown !== null && (
                            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Redirecting in {countdown}s...</p>
                        )}
                        
                        <button 
                            onClick={onComplete}
                            className="w-full py-3 px-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                        >
                            Continue to Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="animate-pulse">
                        <div className="w-20 h-20 bg-yellow-50 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                             <span className="text-4xl">⏳</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                            {status === 'Checking...' ? 'Verifying Payment...' : status === 'PENDING' ? 'Payment Pending' : 'Verification Failed'}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                            Order ID: <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{orderId || '...'}</span>
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mb-8">
                            {status === 'FAILED' ? "We couldn't verify the payment status. Please try again or contact support." : "Please wait while we confirm your transaction status with the gateway."}
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => orderId && checkStatus(orderId)}
                                className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors"
                            >
                                Check Status Again
                            </button>
                            <button 
                                onClick={onComplete}
                                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                            >
                                Skip & Check Later
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentSuccessPage;