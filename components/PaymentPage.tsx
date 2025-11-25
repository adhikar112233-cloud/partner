
import React, { useState, useEffect } from 'react';
import { LogoIcon } from './Icons';
import { BACKEND_URL } from '../services/firebase';

declare global {
  interface Window {
    Cashfree: any;
  }
}

const PaymentPage: React.FC = () => {
    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const storedPhone = localStorage.getItem("userPhone");
        if (storedPhone) {
            setPhone(storedPhone);
        }
    }, []);

    const handlePayment = async () => {
        setError(null);
        
        const amountNum = Number(amount);
        if (!amount || amountNum <= 0) {
            setError("Please enter a valid amount greater than 0.");
            return;
        }
        if (!phone || phone.length < 10) {
            setError("Please enter a valid 10-digit mobile number.");
            return;
        }

        setIsLoading(true);

        // Persist phone for future use
        localStorage.setItem("userPhone", phone);

        try {
            // 1. Create Order
            const guestId = "GUEST_" + Date.now();
            
            const response = await fetch(BACKEND_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: amountNum,
                    phone: phone,
                    customerId: guestId, 
                    collabType: "direct", // Default type for standalone page
                    purpose: "Web Payment",
                    relatedId: "payment_page_" + Date.now(),
                    collabId: "PAY_" + Date.now()
                }),
            });

            const data = await response.json();
            console.log("Payment response:", data);

            if (!data.payment_session_id && !data.paymentSessionId) {
                throw new Error("Payment failed — backend could not create order.");
            }

            const paymentSessionId = data.payment_session_id || data.paymentSessionId;

            // 2. Checkout
            if (!window.Cashfree) {
                throw new Error("Cashfree SDK not loaded");
            }

            // Use production mode as per snippet logic, or fallback to backend hint
            const mode = data.environment || "production"; 
            const cashfree = new window.Cashfree({ mode: mode });
            
            await cashfree.checkout({
                paymentSessionId: paymentSessionId,
                redirectTarget: "_self"
            });

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 font-sans">
            <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border border-gray-100">
                <div className="flex justify-center mb-6">
                    <LogoIcon showTagline={false} className="h-12 w-auto" />
                </div>
                
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Secure Payment</h2>
                <p className="text-gray-500 mb-8 text-sm">Enter details to proceed with payment</p>
                
                <div className="text-left space-y-4">
                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                        <input 
                            id="amount" 
                            type="number" 
                            placeholder="Enter Amount" 
                            min="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        />
                    </div>

                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                        <input 
                            id="phone" 
                            type="tel" 
                            placeholder="10-digit Mobile Number" 
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        />
                    </div>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                        {error}
                    </div>
                )}
                
                <button 
                    onClick={handlePayment}
                    disabled={isLoading}
                    className="mt-8 w-full py-3.5 px-6 bg-gradient-to-r from-teal-400 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Processing...' : 'Pay Now'}
                </button>

                <div className="mt-6 flex items-center justify-center text-xs text-gray-400 gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                    </svg>
                    Secured by Cashfree Payments
                </div>
            </div>
        </div>
    );
};

export default PaymentPage;
