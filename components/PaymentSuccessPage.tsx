
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { auth, db } from '../services/firebase';
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
        const gateway = params.get("gateway");
        const isFallback = params.get("fallback") === "true";

        async function check() {
            if (!orderId) {
               setStatus("⚠️ Order ID missing.");
               return;
            }

            // Robustness: Handle local fallback/wallet verification if applicable
            // This ensures payments made via internal wallet or fallback mode don't hang.
            if (gateway === 'wallet' || isFallback) {
                 try {
                    if (!auth.currentUser) throw new Error("User not authenticated");
                    const docRef = doc(db, 'transactions', orderId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists() && docSnap.data().status === 'completed') {
                        setStatus("🎉 Payment Successful! Subscription Activated.");
                        setIsSuccess(true);
                    } else {
                        setStatus("⚠️ Could not verify payment locally.");
                    }
                } catch (e) {
                    console.error(e);
                    setStatus("⚠️ Error checking local record.");
                }
                return;
            }

            // Main Logic: Poll the backend as requested
            try {
                const res = await fetch(
                    `https://partnerpayment-backend.onrender.com/payment-status/${orderId}`
                );

                const data = await res.json();

                if (data.success) {
                    setStatus("🎉 Payment Successful! Subscription Activated.");
                    setIsSuccess(true);
                    // TODO: Call your user update API if needed here, 
                    // though typically the backend webhook handles the DB update.
                } else {
                    setStatus("⏳ Payment still processing... retrying...");
                    setTimeout(check, 4000);
                }
            } catch (err) {
                console.error(err);
                setStatus("⚠️ Error verifying payment.");
            }
        }

        check();
    }, []);

    return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-2xl mt-10 text-center border border-gray-100 dark:border-gray-700">
            <div className="text-6xl mb-6 animate-bounce">
                {isSuccess ? '🎉' : status.includes('Error') || status.includes('⚠️') ? '⚠️' : '⏳'}
            </div>
            
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">
                {status}
            </h1>
            
            {!isSuccess && !status.includes('Error') && !status.includes('⚠️') && (
                 <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">Please do not close this window while we confirm your transaction.</p>
            )}

            {isSuccess && (
                <div className="mt-10">
                    <button 
                        onClick={onComplete}
                        className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                    >
                        Go to Dashboard
                    </button>
                </div>
            )}
        </div>
    );
};

export default PaymentSuccessPage;
