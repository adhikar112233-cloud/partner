
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { auth, db, BACKEND_URL } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PaymentSuccessPageProps {
    user: User;
    onComplete: () => void;
}

interface TransactionDetails {
    amount: number;
    description: string;
    transactionId: string;
    status: string;
    timestamp: any;
    collabType?: string;
    paymentGateway?: string;
    paymentGatewayDetails?: any;
}

const CheckIcon = () => (
    <div className="rounded-full bg-green-100 p-4">
        <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
    </div>
);

const ErrorIcon = () => (
    <div className="rounded-full bg-red-100 p-4">
        <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
    </div>
);

const SpinnerIcon = () => (
    <div className="rounded-full bg-indigo-100 p-4">
        <svg className="w-16 h-16 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onComplete }) => {
    const [statusMessage, setStatusMessage] = useState("Confirming order...");
    const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
    const [verificationState, setVerificationState] = useState<'processing' | 'success' | 'failed'>('processing');
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 15; // 30 seconds max auto-polling
    
    const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("order_id");
        
        if (!orderId) {
            setVerificationState('failed');
            setStatusMessage("Invalid Request: Order ID missing");
            return;
        }

        // Initial Fetch & Start Polling
        verifyTransaction(orderId);

        return () => {
            isMounted.current = false;
            if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
        };
    }, []);

    const fetchTransactionFromFirestore = async (orderId: string) => {
        try {
            const docRef = doc(db, 'transactions', orderId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as TransactionDetails;
                if (isMounted.current) setTransaction(data);
                return data;
            }
        } catch (e) {
            console.error("Error fetching transaction:", e);
        }
        return null;
    };

    const verifyTransaction = async (orderId: string, manual = false) => {
        if (manual) {
            setVerificationState('processing');
            setStatusMessage("Re-verifying...");
        }

        // 1. Check Firestore First (Fastest)
        const txData = await fetchTransactionFromFirestore(orderId);
        
        if (txData && txData.status === 'completed') {
            if (isMounted.current) {
                setVerificationState('success');
                setStatusMessage("Payment Successful");
            }
            return;
        }

        if (txData && txData.status === 'failed') {
            if (isMounted.current) {
                setVerificationState('failed');
                setStatusMessage("Payment Failed");
            }
            return;
        }

        // 2. If still pending, call Backend Verification API
        try {
            // Ensure auth token is fresh
            if (!auth.currentUser) await new Promise(resolve => setTimeout(resolve, 1000)); // Small wait for auth init
            
            if (auth.currentUser) {
                const token = await auth.currentUser.getIdToken();
                const res = await fetch(`${BACKEND_URL}/verify-order/${orderId}`, {
                    headers: { "Authorization": "Bearer " + token }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.order_status === 'PAID') {
                        // Fetch one last time to get updated data from Firestore (fulfilled by backend)
                        setTimeout(() => fetchTransactionFromFirestore(orderId), 1000);
                        if (isMounted.current) {
                            setVerificationState('success');
                            setStatusMessage("Payment Successful");
                        }
                        return;
                    }
                }
            }
        } catch (err) {
            console.warn("Backend verification failed:", err);
        }

        // 3. Poll / Retry Logic
        if (isMounted.current && (manual || retryCount < maxRetries)) {
            if (!manual) setRetryCount(prev => prev + 1);
            pollingTimerRef.current = setTimeout(() => verifyTransaction(orderId), 2000);
        } else if (isMounted.current) {
            // Stop auto-polling, let user retry manually
            setStatusMessage("Still processing...");
        }
    };

    const handleManualCheck = () => {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("order_id");
        if (orderId) verifyTransaction(orderId, true);
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return new Date().toLocaleString();
        if (timestamp.toDate) return timestamp.toDate().toLocaleString();
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden relative">
                {/* Status Bar */}
                <div className={`h-2 w-full transition-colors duration-500 ${
                    verificationState === 'success' ? 'bg-green-500' : 
                    verificationState === 'failed' ? 'bg-red-500' : 
                    'bg-indigo-500 animate-pulse'
                }`}></div>

                <div className="p-8 flex flex-col items-center text-center">
                    {/* Animated Icon */}
                    <div className="mb-6 transform transition-all duration-500 hover:scale-110">
                        {verificationState === 'success' && <CheckIcon />}
                        {verificationState === 'failed' && <ErrorIcon />}
                        {verificationState === 'processing' && <SpinnerIcon />}
                    </div>

                    <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
                        {statusMessage}
                    </h2>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                        {verificationState === 'processing' 
                            ? "We are verifying your payment with the bank. This may take a few moments." 
                            : verificationState === 'success' 
                                ? "Thank you for your purchase! Your order has been confirmed." 
                                : "We couldn't confirm your payment. Please check if the amount was deducted."}
                    </p>

                    {/* Digital Receipt Card */}
                    {transaction && (
                        <div className="w-full bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 relative">
                            {/* Punch holes effect */}
                            <div className="absolute -left-3 top-1/2 w-6 h-6 bg-white dark:bg-gray-800 rounded-full border-r border-gray-200 dark:border-gray-700"></div>
                            <div className="absolute -right-3 top-1/2 w-6 h-6 bg-white dark:bg-gray-800 rounded-full border-l border-gray-200 dark:border-gray-700"></div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-600 pb-4">
                                    <span className="text-sm text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Total Paid</span>
                                    <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                                        ₹{transaction.amount.toLocaleString()}
                                    </span>
                                </div>
                                
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Order ID</span>
                                        <span className="font-mono font-medium text-gray-800 dark:text-gray-200 truncate max-w-[150px]" title={transaction.transactionId}>
                                            {transaction.transactionId}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Date</span>
                                        <span className="text-gray-800 dark:text-gray-200 text-right font-medium">
                                            {formatDate(transaction.timestamp)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Item</span>
                                        <span className="font-medium text-gray-800 dark:text-gray-200 text-right truncate max-w-[180px]">
                                            {transaction.description}
                                        </span>
                                    </div>
                                    {transaction.paymentGateway && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 dark:text-gray-400">Method</span>
                                            <span className="font-medium text-gray-800 dark:text-gray-200 capitalize">
                                                {transaction.paymentGateway}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-8 w-full space-y-3">
                        {verificationState === 'success' ? (
                            <button 
                                onClick={onComplete}
                                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                            >
                                Continue to Dashboard
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <button 
                                    onClick={handleManualCheck}
                                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all"
                                >
                                    {verificationState === 'processing' ? 'Refresh Status' : 'Retry Check'}
                                </button>
                                {verificationState === 'failed' && (
                                    <button 
                                        onClick={onComplete}
                                        className="w-full py-3 px-4 border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Back to Dashboard
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentSuccessPage;
