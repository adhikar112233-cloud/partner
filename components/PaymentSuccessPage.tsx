
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { auth, db, BACKEND_URL } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PaymentSuccessPageProps {
    user: User;
    onComplete: () => void;
}

const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onComplete }) => {
    const [status, setStatus] = useState("⌛ Checking payment...");
    const [isSuccess, setIsSuccess] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

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

    }, [user]);

    const checkPayment = async (orderId: string) => {
        const params = new URLSearchParams(window.location.search);
        const isFallback = params.get("fallback") === "true";
        const gateway = params.get("gateway");

        setStatus("⌛ Verifying transaction...");
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
                } else {
                    setStatus("⚠️ Verification pending. Please wait or check again.");
                }
            } catch (e) {
                console.error(e);
                setStatus("⚠️ Error checking local record.");
            } finally {
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
            } else {
                setStatus("⌛ Payment pending... If money was deducted, it will update shortly.");
                // Retry automatically once after 3 seconds
                // But rely on user for further retries to avoid infinite loops
                setTimeout(() => {
                   // Optional: we could recurse here, but let's let the user click
                }, 3000);
            }
        } catch (err) {
            console.error(err);
            setStatus("⚠️ Error verifying payment. Please try checking again.");
        } finally {
            setIsChecking(false);
        }
    };

    const handleManualCheck = () => {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("order_id");
        if (orderId) checkPayment(orderId);
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
                        If the amount was deducted, please wait a moment or click "Check Again".
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
