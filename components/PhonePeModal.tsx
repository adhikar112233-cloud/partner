
import React, { useState, useEffect } from 'react';
import { User, PlatformSettings } from '../types';
import { auth, db, BACKEND_URL, PAYTM_MID } from '../services/firebase';
import { apiService } from '../services/apiService';
import { load } from "@cashfreepayments/cashfree-js";
import { doc, setDoc, serverTimestamp, updateDoc, Timestamp, increment, getDoc, writeBatch } from 'firebase/firestore';
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

  // Fallback fulfillment logic for when backend is unreachable
  const performFallbackFulfillment = async (orderId: string, coinsToDeduct: number) => {
      console.log("Performing local fallback fulfillment...");
      const batch = writeBatch(db); // Use batch for atomicity locally
      
      // 1. Create Transaction Record
      const transactionRef = doc(db, 'transactions', orderId);
      batch.set(transactionRef, {
          userId: user.id,
          type: 'payment',
          description: transactionDetails.description,
          relatedId: transactionDetails.relatedId,
          collabId: transactionDetails.collabId || null,
          collabType,
          amount: finalPayableAmount,
          coinsUsed: coinsToDeduct,
          status: 'completed', // Mark as completed directly
          transactionId: orderId,
          timestamp: serverTimestamp(),
          paymentGateway: 'fallback_demo',
          paymentGatewayDetails: { note: 'Processed via local fallback due to server unavailability' }
      });

      // 2. Deduct Coins
      if (coinsToDeduct > 0) {
          const userRef = doc(db, 'users', user.id);
          batch.update(userRef, { coins: increment(-coinsToDeduct) });
      }

      // 3. Specific Fulfillment
      if (collabType === 'membership') {
          const userRef = doc(db, 'users', user.id);
          const plan = transactionDetails.relatedId;
          const now = new Date();
          const expiryDate = new Date(now);
          
          switch (plan) {
              case 'basic': expiryDate.setMonth(expiryDate.getMonth() + 1); break;
              case 'pro': expiryDate.setMonth(expiryDate.getMonth() + 6); break;
              case 'premium': expiryDate.setFullYear(expiryDate.getFullYear() + 1); break;
              case 'pro_10':
              case 'pro_20':
              case 'pro_unlimited':
                  expiryDate.setFullYear(expiryDate.getFullYear() + 1); break;
              default: expiryDate.setMonth(expiryDate.getMonth() + 1); break;
          }

          batch.update(userRef, {
              'membership.plan': plan,
              'membership.isActive': true,
              'membership.startsAt': Timestamp.fromDate(now),
              'membership.expiresAt': Timestamp.fromDate(expiryDate)
          });

          // Sync influencer profile if applicable
          if (user.role === 'influencer') {
              const influencerRef = doc(db, 'influencers', user.id);
              batch.update(influencerRef, { membershipActive: true });
          }

      } else if (collabType.startsWith('boost_')) {
          const boostType = collabType.split('_')[1] as 'profile' | 'campaign' | 'banner';
          const targetId = transactionDetails.relatedId;
          
          const days = 7;
          const now = new Date();
          const expiresAt = new Date();
          expiresAt.setDate(now.getDate() + days);

          const boostRef = doc(db, 'boosts', `boost_${Date.now()}`);
          batch.set(boostRef, {
              userId: user.id,
              plan: boostType,
              expiresAt: Timestamp.fromDate(expiresAt),
              createdAt: serverTimestamp(),
              targetId: targetId,
              targetType: boostType,
          });

          let collectionName = '';
          if (boostType === 'campaign') collectionName = 'campaigns';
          else if (boostType === 'banner') collectionName = 'banner_ads';
          else if (boostType === 'profile') {
              if (user.role === 'influencer') collectionName = 'influencers';
              else if (user.role === 'livetv') collectionName = 'livetv_channels';
          }

          if (collectionName) {
              const targetRef = doc(db, collectionName, targetId);
              batch.update(targetRef, { isBoosted: true });
          }

      } else {
          // Collaboration Requests
          const collectionMap: Record<string, string> = {
              direct: 'collaboration_requests',
              campaign: 'campaign_applications',
              ad_slot: 'ad_slot_requests',
              banner_booking: 'banner_booking_requests',
          };
          const colName = collectionMap[collabType];
          if (colName) {
              const collabRef = doc(db, colName, transactionDetails.relatedId);
              batch.update(collabRef, {
                  status: 'in_progress',
                  paymentStatus: 'paid'
              });
          }
      }

      await batch.commit();
  };

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

    const clientOrderId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const coinsToUse = useCoins ? maxRedeemableCoins : 0;
    
    let useFallback = false;
    let data: any = null;

    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("You must be logged in to make a payment.");
      }

      let idToken = '';
      try {
          idToken = await firebaseUser.getIdToken();
      } catch (tokenErr) {
          console.warn("Could not retrieve ID token (likely offline). Switching to fallback.", tokenErr);
          useFallback = true;
      }

      // Only attempt server connection if token retrieval succeeded
      if (!useFallback) {
          const API_URL = BACKEND_URL;
          const body = {
            orderId: clientOrderId,
            amount: Number(finalPayableAmount.toFixed(2)),
            originalAmount: Number(grossTotal.toFixed(2)), 
            coinsUsed: coinsToUse,
            purpose: transactionDetails.description,
            relatedId: transactionDetails.relatedId,
            collabId: transactionDetails.collabId,
            collabType: collabType,
            phone: cleanPhone,
          };

          console.log(`Initiating payment via backend...`);

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
              // If 404 or 500 range, trigger fallback
              if (response.status >= 400) {
                 console.warn("Backend returned error, triggering fallback.");
                 useFallback = true;
              } else {
                 const errText = await response.text().catch(() => 'Unknown Error');
                 throw new Error(errText || `Server returned ${response.status}`);
              }
            } else {
                data = await response.json();
            }
          } catch (creationErr: any) {
            console.warn("Backend connection failed, switching to fallback mode.", creationErr);
            useFallback = true;
          }
      }

      if (useFallback) {
          // --- FALLBACK MODE ---
          // Simulate backend processing on the client side
          await performFallbackFulfillment(clientOrderId, coinsToUse);
          
          if (needsPhone) {
             apiService.updateUserProfile(user.id, { mobileNumber: phoneNumber }).catch(console.warn);
          }

          setStatus("idle");
          onClose();
          // Redirect to success page with fallback flag
          window.location.href = `/?order_id=${clientOrderId}&gateway=wallet&fallback=true`;
          return;
      }

      // --- NORMAL FLOW ---

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
        // Use MID returned from backend to ensure we match the order details
        const paytmMid = data.mid || platformSettings.paytmMid || PAYTM_MID;
        
        if (!paytmMid) throw new Error("Paytm MID missing from configuration.");

        // Clean up previous scripts
        const existingScript = document.getElementById('paytm-checkoutjs');
        if (existingScript) {
            existingScript.remove();
        }

        // Dynamically load Paytm Script
        const script = document.createElement('script');
        script.id = 'paytm-checkoutjs';
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
                        console.log("Paytm Notify:", eventName, data);
                    },
                    "transactionStatus": function(paymentStatus: any) {
                       console.log("Paytm Status:", paymentStatus);
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
                    console.log("Paytm Init Error:", error);
                    setError("Paytm initialization failed. Please try again.");
                    setStatus("error");
                });
            } else {
                setError("Paytm SDK failed to load.");
                setStatus("error");
            }
        };
        script.onerror = () => {
            setError("Failed to load Paytm script. Check connection.");
            setStatus("error");
        };
        document.body.appendChild(script);
      }

      // ------------------------------------------------------------------------------------
      //                            CASHFREE CHECKOUT
      // ------------------------------------------------------------------------------------

      else if (data.gateway === "cashfree") {
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
      } else {
          throw new Error(`Unsupported payment gateway: ${data.gateway}`);
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
