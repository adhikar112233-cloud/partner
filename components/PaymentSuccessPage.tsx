import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { auth } from '../services/firebase';

interface PaymentSuccessPageProps {
    user: User;
    onComplete: () => void;
}

const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onComplete }) => {
    const [status, setStatus] = useState<'verifying' | 'success' | 'failed' | 'error'>('verifying');
    const [output, setOutput] = useState<object | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const verifyPayment = async () => {
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) {
                    setStatus('error');
                    setErrorMessage("Login required to verify payment!");
                    return;
                }

                const idToken = await firebaseUser.getIdToken();
                const params = new URLSearchParams(window.location.search);
                const orderId = params.get("order_id");

                if (!orderId) {
                    setStatus('error');
                    setErrorMessage("Order ID not found in URL.");
                    return;
                }

                const res = await fetch(`https://bigyaponn-backend.onrender.com/verify-order/${orderId}`, {
                    headers: { "Authorization": "Bearer " + idToken }
                });

                const data = await res.json();
                setOutput(data);

                if (res.ok && data.order_status === "PAID") {
                    setStatus('success');
                } else {
                    setStatus('failed');
                }

            } catch (err: any) {
                console.error("Verification failed:", err);
                setStatus('error');
                setErrorMessage(err.message || "An unexpected error occurred during verification.");
            }
        };

        verifyPayment();
    }, [user]);

    return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
            {status === 'verifying' && (
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-500 mx-auto"></div>
                    <h2 className="mt-4 text-2xl font-bold text-gray-800 dark:text-gray-100">Verifying Payment...</h2>
                </div>
            )}

            {status === 'success' && (
                <div className="text-center">
                    <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h1 className="mt-4 text-3xl font-bold text-green-600">Payment Success ✔</h1>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">Your payment has been confirmed. Thank you!</p>
                </div>
            )}

            {status === 'failed' && (
                <div className="text-center">
                    <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h1 className="mt-4 text-3xl font-bold text-red-600">Payment Not Confirmed</h1>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">Your payment could not be confirmed. Please check your payment provider.</p>
                </div>
            )}
            
            {status === 'error' && (
                 <div className="text-center">
                    <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h1 className="mt-4 text-3xl font-bold text-red-600">An Error Occurred</h1>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">{errorMessage}</p>
                </div>
            )}
            
            {output && (
                <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Server Response:</h3>
                    <pre id="output" className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded-md text-xs overflow-x-auto">
                        {JSON.stringify(output, null, 2)}
                    </pre>
                </div>
            )}

            <div className="mt-8 text-center">
                <button 
                    onClick={onComplete}
                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700"
                >
                    Go to Dashboard
                </button>
            </div>
        </div>
    );
};

export default PaymentSuccessPage;
