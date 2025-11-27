
import React, { useState } from 'react';
import { User, PlatformSettings } from '../types';
import { BACKEND_URL } from '../services/firebase';

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
  const [status, setStatus] = useState<'idle' | 'processing' | 'error' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(user.mobileNumber || '');
  const [useCoins, setUseCoins] = useState(false);
  
  // Calculate Brand Fees using specific flags
  const processingCharge = platformSettings.isBrandPlatformFeeEnabled
    ? baseAmount * (platformSettings.paymentProcessingChargeRate / 100)
    : 0;
    
  const gstOnFees = platformSettings.isBrandGstEnabled
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
      // Get current domain to redirect back to
      const returnUrl = window.location.origin + '/';

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
          collabId: transactionDetails.collabId, // Passed to backend
          collabType: collabType,
          coinsUsed: useCoins ? maxRedeemableCoins : 0,
          returnUrl: returnUrl // Send current domain
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Failed to start payment");

      // 2. If amount is 0 (Paid by coins), show success and reload
      if (data.paymentSessionId === "COIN-ONLY") {
          setStatus("success");
          setTimeout(() => {
              onClose(); 
              window.location.reload(); // Refresh to show updates
          }, 2000);
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
             <span className="bg-indigo-100 text-indigo-600 p-1 rounded">₹</span> Secure Payment
          </h2>
          <button onClick={onClose} disabled={status === 'processing'} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {status === "success" ? (
             <div className="text-center py-8 animate-fade-in-down">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Payment Successful!</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Paid using coins.</p>
             </div>
          ) : status === "processing" ? (
            <div className="text-center py-10">
               <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
               <p className="text-gray-700 dark:text-gray-300 font-medium">Processing Secure Payment...</p>
               <p className="text-xs text-gray-500 mt-2">Please do not close this window.</p>
            </div>
          ) : (
            <div className="space-y-5">
               <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Mobile Number</label>
                  <input 
                    type="tel" 
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value)} 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none transition-all" 
                    placeholder="10-digit number" 
                  />
               </div>

               <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3 text-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between text-gray-600 dark:text-gray-300"><span>Base Amount</span><span>₹{baseAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between text-gray-500 text-xs"><span>Processing Fee + GST</span><span>₹{(processingCharge + gstOnFees).toFixed(2)}</span></div>
                  
                  {userCoins > 0 && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={useCoins} onChange={e => setUseCoins(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-gray-700 dark:text-gray-200 font-medium">Redeem {maxRedeemableCoins} Coins</span>
                        </label>
                        <span className="text-green-600 font-medium">- ₹{useCoins ? maxRedeemableCoins : 0}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between font-bold text-lg pt-3 border-t border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                      <span>Total Payable</span><span>₹{finalPayableAmount.toFixed(2)}</span>
                  </div>
               </div>

               {error && <div className="text-red-600 text-sm bg-red-50 border border-red-100 p-3 rounded-lg flex items-start gap-2">
                   <span className="mt-0.5">⚠️</span> <p>{error}</p>
               </div>}

               <button onClick={handlePayment} className="w-full py-3.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all active:scale-95">
                   Pay Now
               </button>
               
               <div className="flex justify-center items-center gap-1.5 text-[10px] text-gray-400 mt-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
                    Secured by Cashfree Payments
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
