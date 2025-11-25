
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
      // Pre-fill from localStorage if available, otherwise user profile
      return localStorage.getItem("userPhone") || user.mobileNumber || '';
  });
  const userCoins = user.coins || 0;
  const [useCoins, setUseCoins] = useState(userCoins > 0);
  const needsPhone = !user.mobileNumber && !phoneNumber;

  // 1. Calculate Base Fees
  const processingCharge = platformSettings.isPaymentProcessingChargeEnabled
    ? baseAmount * (platformSettings.paymentProcessingChargeRate / 100)
    : 0;

  const gstOnFees = platformSettings.isGstEnabled
    ? processingCharge * (platformSettings.gstRate / 100)
    : 0;

  const grossTotal = baseAmount + processingCharge + gstOnFees;

  // 2. Calculate Coin Deduction
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

    // Save phone to localStorage for future convenience
    localStorage.setItem("userPhone", cleanPhone);

    setStatus("processing");
    setError(null);

    // Generate a client-side ID matching format "ORDER-" + Date.now()
    const clientOrderId = "ORDER-" + Date.now();
    const coinsToUse = useCoins ? maxRedeemableCoins : 0;
    
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("You must be logged in to make a payment.");
      }

      // Construct Request Body
      const body = {
        orderId: clientOrderId,
        amount: Number(finalPayableAmount.toFixed(2)),
        customerId: user.id,
        method: 'CASHFREE', // Forced Cashfree
        userId: user.id,
        coinsUsed: coinsToUse,
        description: transactionDetails.description,
        phone: cleanPhone,
        customerPhone: cleanPhone, // Send as both for compatibility
        relatedId: transactionDetails.relatedId,
        collabId: transactionDetails.collabId,
        collabType: collabType
      };

      // Call the specific Cloud Function Endpoint
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await response.json();
      } else {
          const text = await response.text();
          console.error("Non-JSON response:", text);
          throw new Error(`Server Error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
         throw new Error(data.message || `Payment initiation failed: ${response.statusText}`);
      }

      console.log("Payment Response:", data);

      // Use the Order ID from backend if provided, else fallback to our client ID
      const orderId = data.orderId || data.order_id || clientOrderId;

      // CASHFREE LOGIC
      const sessionId = data.paymentSessionId || data.payment_session_id;
      
      if (!sessionId) {
          // Handle wallet only success where amount is 0
          if (body.amount === 0 && data.success) {
              window.location.href = `/?order_id=${orderId}&gateway=wallet&fallback=true`;
              return;
          }
          throw new Error("Payment failed — backend could not create order (Session ID missing).");
      }

      try {
          let cashfree;
          
          // 1. Try using window.Cashfree (loaded via script tag in index.html)
          if (window.Cashfree) {
              // SDK v3 usage: Factory function without 'new'
              // Use environment from response or fallback to logic
              const appId = platformSettings.paymentGatewayApiId || "";
              const isSandbox = appId.toUpperCase().startsWith("TEST");
              const mode = data.environment || (isSandbox ? "sandbox" : "production");
              
              cashfree = window.Cashfree({ mode: mode });
          } else {
              throw new Error("Cashfree SDK not loaded in browser");
          }

          if (!cashfree) throw new Error("Failed to initialize Cashfree SDK");

          await cashfree.checkout({
              paymentSessionId: sessionId,
              redirectTarget: "_self"
          });

      } catch (sdkError) {
          console.error("Cashfree SDK Error", sdkError);
          // Fallback to payment link if SDK fails entirely
          if (data.payment_link) {
              window.location.href = data.payment_link;
          } else {
              throw new Error("Cashfree SDK failed to load: " + (sdkError as Error).message);
          }
      }

    } catch (err: any) {
      console.warn("Payment flow failed.", err);
      setError("Payment failed: " + (err.message || 'Unknown error'));
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

                {/* Coin Redemption Section */}
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
                  {error ? "Retrying..." : "Connecting to secure gateway..."}
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
