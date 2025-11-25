import React, { useState } from 'react';
import { LogoIcon } from './Icons';
import { BACKEND_URL } from '../services/firebase';

const PaymentPage: React.FC = () => {
    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePayment = async () => {
        if (!amount || !phone) { setError("Fill all fields"); return; }
        setIsLoading(true);
        try {
            const returnUrl = window.location.origin + '/';
            const res = await fetch(BACKEND_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    amount, 
                    phone, 
                    customerId: "guest", 
                    collabType: "direct",
                    returnUrl: returnUrl
                })
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data.message);
            
            const cashfree = new window.Cashfree({ mode: data.environment });
            cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: "_self" });
        } catch (e: any) {
            setError(e.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm text-center">
                <LogoIcon className="h-10 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-4">Quick Payment</h2>
                <input type="number" placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full p-3 mb-3 border rounded" />
                <input type="tel" placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-3 mb-3 border rounded" />
                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                <button onClick={handlePayment} disabled={isLoading} className="w-full bg-indigo-600 text-white py-3 rounded font-bold hover:bg-indigo-700">
                    {isLoading ? "Processing..." : "Pay Now"}
                </button>
            </div>
        </div>
    );
};
export default PaymentPage;