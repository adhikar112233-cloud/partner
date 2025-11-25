import React, { useState } from 'react';
import { User, PlatformSettings } from '../types';
import { auth, BACKEND_URL } from '../services/firebase';
import { CoinIcon, LockClosedIcon } from './Icons';

interface PaymentModalProps {
  user: User;
  collabType: string;
  baseAmount: number;
  platformSettings: PlatformSettings;
  onClose: () => void;
  transactionDetails: {
    userId: string;
    description: string;
    relatedId: string;
    collabId?: string;
  };
}

declare global {
  interface Window {
    Cashfree: any;
  }
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  user,
  collabType,
  baseAmount,
  platformSettings,
  onClose,
  transactionDetails
}) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(user.mobileNumber || '');
  const [useCoins, setUseCoins] = useState(false);
  
  const processingCharge = platformSettings.isPaymentProcessingChargeEnabled
    ? baseAmount * (platformSettings.paymentProcessingChargeRate / 100)
    : 0;
  const gstOnFees = platformSettings.isGstEnabled
    ? processingCharge * (platformSettings.gstRate / 100)
    : 0;
  const grossTotal = baseAmount + processingCharge + gstOnFees;
  const userCoins = user.coins || 0;
  const maxRedeemableCoins = Math.min(userCoins, 100, Math.floor(grossTotal));
  const discountAmount = useCoins ? maxRedeemableCoins : 0;
  const finalPayableAmount = Math.max(0, grossTotal - discountAmount);

  const handlePayment = async () => {
    // Clean phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setStatus("processing");
    setError(null);

    try {
      // 1. Talk to our "Brain" (Backend) to get permission
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(finalPayableAmount.toFixed(2)),
          phone: cleanPhone,
          customerId: user.id,
          userId: user.id,
          description: transactionDetails.description,
          relatedId: transactionDetails.relatedId,
          collabType: collabType,
          coinsUsed: useCoins ? maxRedeemableCoins : 0
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Failed to start payment");

      // 2. If amount is 0 (Paid by coins), we are done
      if (data.paymentSessionId === "COIN-ONLY") {
          onClose(); 
          window.location.reload(); // Refresh to show updates
          return;
      }

      // 3. Launch Cashfree Popup
      if (!window.Cashfree) throw new Error("Cashfree SDK not found");
      
      const cashfree = new window.Cashfree({ mode: data.environment }); // sandbox or production
      await cashfree.checkout({
          paymentSessionId: data.paymentSessionId,
          redirectTarget: "_self"
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong");
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold dark:text-gray-100">Payment</h2>
          <button onClick={onClose} className="text-2xl dark:text-gray-400">&times;</button>
        </div>

        <div className="p-6">
          {status !== "processing" ? (
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:text-white" placeholder="10-digit number" />
               </div>

               <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded space-y-2 text-sm">
                  <div className="flex justify-between"><span>Subtotal:</span><span>₹{baseAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Processing Fee + GST:</span><span>₹{(processingCharge + gstOnFees).toFixed(2)}</span></div>
                  
                  {userCoins > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={useCoins} onChange={e => setUseCoins(e.target.checked)} />
                            <span>Use {maxRedeemableCoins} Coins</span>
                        </div>
                        <span className="text-green-600">- ₹{useCoins ? maxRedeemableCoins : 0}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-300 dark:border-gray-600">
                      <span>Total:</span><span>₹{finalPayableAmount.toFixed(2)}</span>
                  </div>
               </div>

               {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

               <button onClick={handlePayment} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700">
                   Pay Now
               </button>
            </div>
          ) : (
            <div className="text-center py-8">
               <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
               <p>Processing Secure Payment...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;