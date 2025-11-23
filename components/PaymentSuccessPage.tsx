
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PaymentSuccessPageProps {
    user: User;
    onComplete: () => void;
}

const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onComplete }) => {
    const [status, setStatus] = useState<'verifying' | 'success' | 'failed' | 'error'>('verifying');
    const [output, setOutput] = useState<any | null>(null);
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

                const params = new URLSearchParams(window.location.search);
                const orderId = params.get("order_id");
                const isFallback = params.get("fallback") === "true";
                const gateway = params.get("gateway");
                
                if (!orderId) {
                    setStatus('error');
                    setErrorMessage("Order ID not found in URL.");
                    return;
                }

                // If fallback mode or wallet was used, verify directly against Firestore
                if (isFallback || gateway === 'wallet') {
                    const docRef = doc(db, 'transactions', orderId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists() && docSnap.data().status === 'completed') {
                        setStatus('success');
                        return;
                    } else {
                        setStatus('failed');
                        setErrorMessage("Could not verify payment status locally.");
                        return;
                    }
                }

                // Polling function for payment status
                const checkPaymentStatus = async () => {
                    try {
                        const response = await fetch(`https://partnerpayment-backend.onrender.com/payment-status/${orderId}`);
                        const data = await response.json();
                        setOutput(data);

                        if (data.success || data.status === 'SUCCESS' || data.order_status === 'PAID' || data.order_status === 'completed') {
                            setStatus('success');
                        } else {
                            // Retry after 5 seconds as requested
                            setTimeout(checkPaymentStatus, 5000);
                        }
                    } catch (err: any) {
                        console.error("Error polling status:", err);
                        // Continue polling even on error, might be temporary network issue
                        setTimeout(checkPaymentStatus, 5000);
                    }
                };

                // Start verification process
                checkPaymentStatus();

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
                    <p className="text-gray-500 mt-2" id="status">⏳ Waiting for payment update...</p>
                </div>
            )}

            {status === 'success' && (
                <div className="text-center">
                    <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h1 className="mt-4 text-3xl font-bold text-green-600">Payment Success ✔</h1>
                    <p className="text-gray-600 dark:text-gray-300 mt-2" id="status">🎉 Payment Successful! Your account has been updated.</p>
                </div>
            )}

            {status === 'failed' && (
                <div className="text-center">
                    <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h1 className="mt-4 text-3xl font-bold text-red-600">Payment Not Confirmed</h1>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">{errorMessage || 'Your payment could not be confirmed. Please check with support.'}</p>
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
            
            {output && !output.success && status !== 'success' && (
                <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Server Response:</h3>
                    <pre id="output" className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded-md text-xs overflow-x-auto text-left">
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
