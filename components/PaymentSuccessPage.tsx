
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { auth, db, BACKEND_URL } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PaymentSuccessPageProps {
    user: User;
    onComplete: () => void;
}

const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onComplete }) => {
    const [status, setStatus] = useState("⌛ Checking payment status...");
    const [isSuccess, setIsSuccess] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 5;
    // Fix: Use ReturnType<typeof setTimeout> instead of NodeJS.Timeout to avoid namespace issues
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("order_id");
        
        if (!orderId) {
            setStatus("⚠️ Order ID missing.");
            setIsChecking(false);
            return;
        }

        // Initial Check
        checkPayment(orderId);

        return () => {
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        };
    }, [user]);

    const checkPayment = async (orderId: string, isManual = false) => {
        const params = new URLSearchParams(window.location.search);
        const isFallback = params.get("fallback") === "true";
        const gateway = params.get("gateway");

        if (isManual) {
            setStatus("⌛ Verifying transaction...");
        }
        setIsChecking(true);

        // Robustness: Handle local fallback verification if the initial payment used fallback mode
        // or if it was a wallet payment which is processed client-side/serverless-side transactionally.
        if (isFallback || gateway === 'wallet') {
            try {
                if (!auth.currentUser) throw new Error("User not authenticated");
                const docRef = doc(db, 'transactions', orderId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().status === 'completed') {
                    setStatus("🎉 Payment Successful!");
                    setIsSuccess(true);
                    setIsChecking(false);
                } else {
                    setStatus("⚠️ Verification pending. Please check again.");
                    setIsChecking(false);
                }
            } catch (e) {
                console.error(e);
                setStatus("⚠️ Error checking local record.");
                setIsChecking(false);
            }
            return;
        }

        // Main Logic: Poll the backend for standard Gateway payments
        try {
            if (!auth.currentUser) {
                setStatus("⚠️ Authentication required.");
                setIsChecking(false);
                return;
            }

            const token = await auth.currentUser.getIdToken();

            const res = await fetch(
                `${BACKEND_URL}/verify-order/${orderId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const data = await res.json();

            if (data.order_status === 'PAID' || data.order_status === 'completed') {
                setStatus("🎉 Payment Successful!");
                setIsSuccess(true);
                setIsChecking(false);
            } else {
                // If not yet paid, decide whether to retry
                if (!isManual && retryCount < maxRetries) {
                    setStatus(`⌛ Payment processing... (${retryCount + 1}/${maxRetries})`);
                    retryTimeoutRef.current = setTimeout(() => {
                        setRetryCount(prev => prev + 1);
                        checkPayment(orderId, false);
                    }, 2000); // Poll every 2 seconds
                } else {
                    setStatus("⌛ Payment pending. Click below to refresh.");
                    setIsChecking(false);
                }
            }
        } catch (err) {
            console.error(err);
            setStatus("⚠️ Error verifying payment. Please check again.");
            setIsChecking(false);
        }
    };

    const handleManualCheck = () => {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("order_id");
        if (orderId) {
            // Reset retries for manual check to prevent infinite loop but allow user triggered checks
            checkPayment(orderId, true);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl text-center border border-gray-100 dark:border-gray-700">
                <div className="text-6xl mb-6 animate-bounce">
                    {isSuccess ? '🎉' : status.includes('Error') || status.includes('⚠️') ? '⚠️' : '⏳'}
                </div>
                
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
                    {status}
                </h1>
                
                {!isSuccess && (
                     <p className="text-gray-500 dark:text-gray-400 mt-2">
                        Transaction ID: <span className="font-mono text-xs">{new URLSearchParams(window.location.search).get("order_id")}</span>
                        <br/>
                        Please wait while we confirm your payment.
                     </p>
                )}

                <div className="mt-8 space-y-3">
                    {isSuccess ? (
                        <button 
                            onClick={onComplete}
                            className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                        >
                            Continue to Dashboard
                        </button>
                    ) : (
                        <button 
                            onClick={handleManualCheck}
                            disabled={isChecking}
                            className="w-full px-6 py-3 bg-indigo-100 text-indigo-700 font-bold text-lg rounded-xl hover:bg-indigo-200 transition-all disabled:opacity-50"
                        >
                            {isChecking ? 'Verifying...' : 'Check Again'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentSuccessPage;
