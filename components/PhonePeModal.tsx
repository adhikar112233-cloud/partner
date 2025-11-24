
import React, { useState } from 'react';
import { User, PlatformSettings } from '../types';
import { auth, db, BACKEND_URL, PAYTM_MID } from '../services/firebase';
import { apiService } from '../services/apiService';
import { load } from "@cashfreepayments/cashfree-js";
import { doc, setDoc, serverTimestamp, updateDoc, Timestamp } from 'firebase/firestore';
import { CoinIcon } from './Icons';

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

    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("You must be logged in to make a payment.");
      }

      const idToken = await firebaseUser.getIdToken();

      const activeGateway = platformSettings.activePaymentGateway?.toLowerCase();
      const selectedGateway = activeGateway === 'cashfree' ? 'cashfree' : 'paytm';
      
      const API_URL = BACKEND_URL;
      // Use "ORD_" prefix as requested
      const orderId = `ORD_${Date.now()}`;

      const body = {
        orderId: orderId,
        amount: Number(finalPayableAmount.toFixed(2)),
        originalAmount: Number(grossTotal.toFixed(2)), 
        coinsUsed: useCoins ? maxRedeemableCoins : 0,
        purpose: transactionDetails.description,
        relatedId: transactionDetails.relatedId,
        collabId: transactionDetails.collabId,
        collabType: collabType,
        phone: cleanPhone,
        gateway: selectedGateway,
      };

      console.log(`Initiating payment via ${selectedGateway}`);

      let data;

      try {
        const response = await fetch(`${API_URL}/createOrder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + idToken,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => 'Unknown Error');
          throw new Error(errText || `Server returned ${response.status}`);
        }

        data = await response.json();
      } catch (creationErr: any) {
        console.warn("Order creation failed.", creationErr);
        throw new Error("Unable to connect to payment server. Please try again later.");
      }

      if (needsPhone) {
        apiService.updateUserProfile(user.id, { mobileNumber: phoneNumber }).catch(console.warn);
      }
      
      if (data.gateway === 'wallet') {
          setStatus("idle");
          onClose();
          window.location.href = `/?order_id=${data.order_id}&gateway=wallet`;
          return;
      }

      // ------------------------------------------------------------------------------------
      //                          PAYTM CHECKOUT
      // ------------------------------------------------------------------------------------

      if (data.gateway === "paytm") {
        // Use MID from settings if available, otherwise fallback to hardcoded or env var in services
        const paytmMid = platformSettings.paytmMid || PAYTM_MID;
        
        if (!paytmMid) throw new Error("Paytm MID not configured");

        // Dynamically load Paytm Script
        const script = document.createElement('script');
        script.src = `https://securegw.paytm.in/merchantpgpui/checkoutjs/merchants/${paytmMid}.js`;
        script.crossOrigin = "anonymous";
        script.onload = () => {
            const config = {
                "root": "",
                "flow": "DEFAULT",
                "data": {
                    "orderId": data.order_id,
                    "token": data.txnToken,
                    "tokenType": "TXN_TOKEN",
                    "amount": data.amount
                },
                "handler": {
                    "notifyMerchant": function(eventName: string, data: any) {
                        console.log("notifyMerchant handler function called");
                        console.log("eventName => ", eventName);
                        console.log("data => ", data);
                    },
                    "transactionStatus": function(paymentStatus: any) {
                       console.log("transactionStatus => ", paymentStatus);
                       if (window.Paytm && window.Paytm.CheckoutJS) {
                           window.Paytm.CheckoutJS.close();
                       }
                       // Redirect to verify on success/failure
                       window.location.href = `/?order_id=${data.internal_order_id}&gateway=paytm`;
                    }
                }
            };

            if (window.Paytm && window.Paytm.CheckoutJS) {
                window.Paytm.CheckoutJS.init(config).then(function onSuccess() {
                    window.Paytm.CheckoutJS.invoke();
                }).catch(function onError(error: any) {
                    console.log("error => ", error);
                    setError("Paytm initialization failed.");
                    setStatus("error");
                });
            } else {
                setError("Paytm SDK failed to load.");
                setStatus("error");
            }
        };
        script.onerror = () => {
            setError("Failed to load Paytm script.");
            setStatus("error");
        };
        document.body.appendChild(script);
      }

      // ------------------------------------------------------------------------------------
      //                            CASHFREE CHECKOUT
      // ------------------------------------------------------------------------------------

      else {
        const cashfreeSessionId = data.payment_session_id;
        
        if (!cashfreeSessionId) {
          throw new Error("Missing Cashfree payment_session_id");
        }

        const cashfree = await load({
          mode: data.environment || "production",
        });

        await cashfree.checkout({
          paymentSessionId: cashfreeSessionId,
          redirectTarget: "_self",
        });
      }

    } catch (err: any) {
      console.error("Payment error:", err);
      let msg = err.message || "Something went wrong.";
      if (msg.includes("Failed to fetch")) {
        msg = "Unable to connect to payment server. Please try again later.";
      }
      setError(msg);
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
              <p className="text-xs text-gray-400 mt-1">Connecting to secure gateway...</p>
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
              className="w-full py-3 font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              Pay via {platformSettings.activePaymentGateway === 'cashfree' ? 'Cashfree' : 'Paytm'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
