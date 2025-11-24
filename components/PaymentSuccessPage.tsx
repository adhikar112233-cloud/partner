
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

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("order_id");
        const isFallback = params.get("fallback") === "true";
        const gateway = params.get("gateway");

        let isMounted = true;

        async function check() {
            if (!orderId) {
                if (isMounted) setStatus("⚠️ Order ID missing.");
                return;
            }

            // Robustness: Handle local fallback verification if the initial payment used fallback mode
            // or if it was a wallet payment which is processed client-side/serverless-side transactionally.
            if (isFallback || gateway === 'wallet') {
                try {
                    if (!auth.currentUser) throw new Error("User not authenticated");
                    const docRef = doc(db, 'transactions', orderId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists() && docSnap.data().status === 'completed') {
                        if (isMounted) {
                            setStatus("🎉 Payment Successful!");
                            setIsSuccess(true);
                        }
                    } else {
                        if (isMounted) setStatus("⚠️ Could not verify payment locally. It may be pending.");
                    }
                } catch (e) {
                    console.error(e);
                    if (isMounted) setStatus("⚠️ Error checking local record.");
                }
                return;
            }

            // Main Logic: Poll the backend for standard Gateway payments
            try {
                if (!auth.currentUser) {
                    if (isMounted) setStatus("⚠️ Authentication required.");
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
                    if (isMounted) {
                        setStatus("🎉 Payment Successful!");
                        setIsSuccess(true);
                    }
                } else {
                    if (isMounted) setStatus("⌛ Payment processing... please wait.");
                    // Retry after 3 seconds to allow webhook/processing time
                    setTimeout(() => {
                        if (isMounted) check();
                    }, 3000);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) setStatus("⚠️ Error verifying payment. Please contact support.");
            }
        }

        check();

        return () => {
            isMounted = false;
        };
    }, [user]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl text-center border border-gray-100 dark:border-gray-700">
                <div className="text-6xl mb-6 animate-bounce">
                    {isSuccess ? '🎉' : status.includes('Error') || status.includes('⚠️') ? '⚠️' : '⏳'}
                </div>
                
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
                    {status}
                </h1>
                
                {!isSuccess && !status.includes('Error') && !status.includes('⚠️') && (
                     <p className="text-gray-500 dark:text-gray-400 mt-2">Please do not close this window while we confirm your transaction.</p>
                )}

                {isSuccess && (
                    <div className="mt-8">
                        <button 
                            onClick={onComplete}
                            className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                        >
                            Continue to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentSuccessPage;
