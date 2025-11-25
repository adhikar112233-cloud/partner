
import React, { useState, useEffect } from 'react';
import { User, PlatformSettings } from '../types';
import { auth, BACKEND_URL } from '../services/firebase';
import { CoinIcon, LockClosedIcon } from './Icons';

interface PaymentModalProps {
  user: User;
  collabType:
    | 'direct'
    | 'campaign'
    | 'ad_slot'
    | 'banner_booking'
    | 'membership'
    | 'boost_profile'
    | 'boost_campaign'
    | 'boost_banner';
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
  const [phoneNumber, setPhoneNumber] = useState(() => {
      return localStorage.getItem("userPhone") || user.mobileNumber || '';
  });
  const userCoins = user.coins || 0;
  const [useCoins, setUseCoins] = useState(userCoins > 0);
  
  const processingCharge = platformSettings.isPaymentProcessingChargeEnabled
    ? baseAmount * (platformSettings.paymentProcessingChargeRate / 100)
    : 0;

  const gstOnFees = platformSettings.isGstEnabled
    ? processingCharge * (platformSettings.gstRate / 100)
    : 0;

  const grossTotal = baseAmount + processingCharge + gstOnFees;

  const maxRedeemableCoins = Math.min(userCoins, 100, Math.floor(grossTotal));
  
  const discountAmount = useCoins ? maxRedeemableCoins : 0;
  const finalPayableAmount = Math.max(0, grossTotal - discountAmount);

  const handlePayment = async () => {
    const cleanPhone = (phoneNumber || user.mobileNumber || '')
      .replace(/\D/g, '')
      .slice(-10);

    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    localStorage.setItem("userPhone", cleanPhone);

    setStatus("processing");
    setError(null);

    const coinsToUse = useCoins ? maxRedeemableCoins : 0;
    
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("You must be logged in to make a payment.");
      }

      const body = {
        amount: Number(finalPayableAmount.toFixed(2)),
        customerId: user.id,
        userId: user.id,
        coinsUsed: coinsToUse,
        description: transactionDetails.description,
        phone: cleanPhone,
        relatedId: transactionDetails.relatedId,
        collabId: transactionDetails.collabId,
        collabType: collabType
      };

      // Call Cloud Function
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
         throw new Error(data.message || "Payment initiation failed");
      }

      // Handle full coin payment (amount 0)
      if (finalPayableAmount === 0 && data.success) {
          window.location.href = `/?order_id=${data.orderId}`;
          return;
      }

      const sessionId = data.paymentSessionId;
      
      if (!sessionId) {
          throw new Error("Payment failed — session ID missing.");
      }

      if (!window.Cashfree) {
          throw new Error("Cashfree SDK not loaded.");
      }

      // Use the environment returned by the backend (sandbox or production)
      const mode = data.environment || "production";
      const cashfree = new window.Cashfree({ mode: mode });

      await cashfree.checkout({
          paymentSessionId: sessionId,
          redirectTarget: "_self"
      });

    } catch (err: any) {
      console.warn("Payment flow failed.", err);
      setError(err.message || 'Payment failed');
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold dark:text-gray-100">Complete Payment</h2>
          <button onClick={onClose} className="text-2xl dark:text-gray-400">&times;</button>
        </div>

        <div className="p-6 min-h-[250px]">
          {status !== "processing" ? (
            <>
              <div className="p-4 bg-yellow-50 border rounded-lg mb-4">
                  <label className="block font-semibold text-yellow-800">Contact Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter mobile number"
                    className="mt-1 w-full p-2 border rounded"
                  />
              </div>

              <div className="space-y-3 text-sm mt-4 dark:text-gray-300">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{baseAmount.toFixed(2)}</span>
                </div>

                {processingCharge > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Processing Fee:</span>
                    <span>₹{processingCharge.toFixed(2)}</span>
                  </div>
                )}

                {gstOnFees > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>GST on Fees:</span>
                    <span>₹{gstOnFees.toFixed(2)}</span>
                  </div>
                )}

                {userCoins > 0 && (
                    <div className="p-3 bg-indigo-50 dark:bg-gray-700 rounded-lg border border-indigo-100 dark:border-gray-600 mt-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CoinIcon className="w-5 h-5 text-yellow-500" />
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-white">Use Coins</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Balance: {userCoins}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">- ₹{useCoins ? maxRedeemableCoins : 0}</span>
                                <input 
                                    type="checkbox" 
                                    checked={useCoins}
                                    onChange={(e) => setUseCoins(e.target.checked)}
                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Max redeemable: 100 coins per transaction (1 Coin = ₹1)</p>
                    </div>
                )}

                <div className="flex justify-between font-bold text-lg pt-4 border-t dark:border-gray-700">
                  <span>Total Payable:</span>
                  <span>₹{finalPayableAmount.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-8">
              <div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin mx-auto border-indigo-600"></div>
              <p className="mt-2 text-gray-500">Processing payment...</p>
              <p className="text-xs text-gray-400 mt-1">
                  {error ? "Retrying..." : "Redirecting to Cashfree..."}
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {status !== "processing" && (
          <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-b-2xl">
            <button
              onClick={handlePayment}
              className="w-full py-3 font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center"
            >
              <LockClosedIcon className="w-5 h-5 mr-2" />
              Pay Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
