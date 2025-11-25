
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { auth, BACKEND_URL } from '../services/firebase';

interface PaymentSuccessPageProps {
    user: User;
    onComplete: () => void;
}

const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onComplete }) => {
    const [status, setStatus] = useState("Checking...");
    const [orderId, setOrderId] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("order_id");
        setOrderId(id);

        const checkStatus = async () => {
            if (!id) {
                setStatus("Order ID missing");
                return;
            }

            try {
                // Use existing auth if available for backend verification
                let headers: Record<string, string> = { "Content-Type": "application/json" };
                const currentUser = auth.currentUser;
                if (currentUser) {
                    const token = await currentUser.getIdToken();
                    headers['Authorization'] = `Bearer ${token}`;
                }

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
                    setStatus("Error verifying");
                }
            } catch (e) {
                console.error(e);
                setStatus("Network Error");
            }
        };

        // Initial check with a small delay to allow webhook processing
        const timer = setTimeout(checkStatus, 1500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center pt-20 bg-gray-50 font-sans text-center">
            <div className="border-2 border-green-500 p-8 inline-block rounded-xl bg-white shadow-lg max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">🎉 Payment Successful!</h2>
                <p className="text-gray-600 mb-2">
                    Order ID: <span className="font-mono font-medium select-all">{orderId || '...'}</span>
                </p>
                <p className="text-lg mb-6">
                    Status: <strong className={`font-bold ${status === 'PAID' ? 'text-green-600' : 'text-yellow-600'}`}>{status}</strong>
                </p>
                
                <button 
                    onClick={onComplete}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-md"
                >
                    Continue to Dashboard
                </button>
            </div>
        </div>
    );
};

export default PaymentSuccessPage;
