
import React, { useState, useEffect } from 'react';
import { User, PlatformSettings } from '../types';
import { auth, db, BACKEND_URL, PAYTM_MID } from '../services/firebase';
import { doc, serverTimestamp, writeBatch, Timestamp, increment } from 'firebase/firestore';
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
    Paytm: any;
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
  const userCoins = user.coins || 0;
  const [useCoins, setUseCoins] = useState(userCoins > 0);
  const needsPhone = !user.mobileNumber;

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

  useEffect(() => {
    // Cleanup any existing Paytm scripts on mount/unmount to prevent duplicates
    return () => {
        const existingScript = document.getElementById('paytm-checkoutjs');
        if (existingScript) {
            existingScript.remove();
        }
    };
  }, []);

  const handlePayment = async () => {
    const cleanPhone = (needsPhone ? phoneNumber : user.mobileNumber)
      .replace(/\D/g, '')
      .slice(-10);

    if (needsPhone && cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setStatus("processing");
    setError(null);

    // Generate a client-side ID as a fallback/reference
    const clientOrderId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const coinsToUse = useCoins ? maxRedeemableCoins : 0;
    
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("You must be logged in to make a payment.");
      }

      // Get current gateway preference
      const gateway = platformSettings.activePaymentGateway || 'paytm';
      const method = gateway.toUpperCase(); // "PAYTM" or "CASHFREE"

      // Construct Request Body matching the required signature:
      // { amount, method, userId }
      // We include extra fields for the backend to process logic (coins, purpose, etc)
      const body = {
        amount: Number(finalPayableAmount.toFixed(2)),
        method: method,
        userId: user.id,
        // Pass extra fields for backend logic
        coinsUsed: coinsToUse,
        description: transactionDetails.description,
        phone: cleanPhone,
        relatedId: transactionDetails.relatedId,
        collabId: transactionDetails.collabId,
        collabType: collabType
      };

      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
         throw new Error(`Payment initiation failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Payment Response:", data);

      // Use the Order ID from backend if provided, else fallback to our client ID
      const orderId = data.orderId || data.order_id || clientOrderId;

      // Save transaction record locally for tracking/fulfillment
      await db.collection('transactions').doc(orderId).set({
            userId: user.id,
            type: 'payment',
            description: transactionDetails.description,
            relatedId: transactionDetails.relatedId,
            collabId: transactionDetails.collabId || null,
            collabType,
            amount: body.amount,
            coinsUsed: coinsToUse || 0,
            status: 'pending',
            transactionId: orderId,
            timestamp: serverTimestamp(),
            paymentGateway: gateway,
      });

      if (method === "PAYTM") {
          if (data.txnToken) {
             const txnToken = data.txnToken;
             const paytmMid = data.mid || platformSettings.paytmMid || PAYTM_MID; 
             
             // Initialize Paytm JS Checkout
             const existingScript = document.getElementById('paytm-checkoutjs');
             if (existingScript) existingScript.remove();

             const script = document.createElement('script');
             script.id = 'paytm-checkoutjs';
             script.src = `https://securegw.paytm.in/merchantpgpui/checkoutjs/merchants/${paytmMid}.js`;
             script.crossOrigin = "anonymous";
             
             script.onload = () => {
                 if (window.Paytm && window.Paytm.CheckoutJS) {
                     const config = {
                         "root": "",
                         "flow": "DEFAULT",
                         "data": { 
                             "orderId": orderId,
                             "token": txnToken, 
                             "tokenType": "TXN_TOKEN", 
                             "amount": body.amount.toString() 
                         },
                         "handler": {
                             "transactionStatus": function(paymentStatus: any) {
                                window.Paytm.CheckoutJS.close();
                                // Redirect to success page
                                window.location.href = `/?order_id=${orderId}&gateway=paytm`;
                             },
                             "notifyMerchant": function(eventName: string, data: any) { console.log("Paytm Notify:", eventName, data); }
                         }
                     };
                     window.Paytm.CheckoutJS.init(config).then(() => window.Paytm.CheckoutJS.invoke()).catch(() => { throw new Error("Paytm Init Failed"); });
                 } else {
                     throw new Error("Paytm SDK not loaded");
                 }
             };
             script.onerror = () => { throw new Error("Paytm Script Failed to Load"); };
             document.body.appendChild(script);

          } else {
              throw new Error("Paytm Token missing from response");
          }
      } else if (method === "CASHFREE") {
          if (data.payment_link) {
              window.location.href = data.payment_link;
          } else {
              throw new Error("Cashfree payment link missing from response");
          }
      } else {
          // Handle wallet only or other
          if (body.amount === 0 && data.success) {
             window.location.href = `/?order_id=${orderId}&gateway=wallet&fallback=true`;
          } else {
             throw new Error("Unknown payment method response");
          }
      }

    } catch (err: any) {
      console.warn("Payment flow failed.", err);
      setError("Payment failed. Please check your connection and try again. " + (err.message || ''));
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
              {needsPhone && (
                <div className="p-4 bg-yellow-50 border rounded-lg mb-4">
                  <label className="block font-semibold text-yellow-800">Contact Number Required</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter mobile number"
                    className="mt-1 w-full p-2 border rounded"
                  />
                </div>
              )}

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
