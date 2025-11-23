
import React, { useState } from 'react';
import { User, PlatformSettings } from '../types';
import { auth, db, BACKEND_URL, RAZORPAY_KEY_ID } from '../services/firebase';
import { apiService } from '../services/apiService';
import { load } from "@cashfreepayments/cashfree-js";
import { doc, setDoc, serverTimestamp, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
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
    Razorpay: any;
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

  // Reusable Client-Side Fulfillment Logic
  const performClientSideFulfillment = async (orderId: string, paymentId: string, coinsDeducted: number) => {
        console.log(` performing client-side fulfillment for ${orderId}`);
        try {
            // 1. Create/Update Transaction Record
            await setDoc(doc(db, 'transactions', orderId), {
                userId: user.id,
                type: 'payment',
                description: transactionDetails.description || 'Payment',
                relatedId: transactionDetails.relatedId,
                collabId: transactionDetails.collabId || null,
                collabType: collabType,
                amount: finalPayableAmount,
                coinsUsed: coinsDeducted,
                status: 'completed',
                transactionId: orderId,
                timestamp: serverTimestamp(),
                paymentGateway: 'razorpay',
                paymentGatewayDetails: {
                    razorpayPaymentId: paymentId,
                    mode: 'client_side_fallback'
                }
            }, { merge: true });
            
            // 2. Deduct Coins
            if (coinsDeducted > 0) {
                const freshUserSnap = await getDoc(doc(db, 'users', user.id));
                if(freshUserSnap.exists()) {
                    const currentCoins = freshUserSnap.data().coins || 0;
                    await updateDoc(doc(db, 'users', user.id), { coins: Math.max(0, currentCoins - coinsDeducted) });
                }
            }

            // 3. Trigger Item Specific Logic
            if (collabType === 'membership') {
                const now = Timestamp.now();
                const expiryDate = new Date(now.toDate());
                
                // Determine duration based on plan ID
                const planId = transactionDetails.relatedId;
                if (planId === 'basic') {
                    expiryDate.setMonth(expiryDate.getMonth() + 1);
                } else if (planId === 'pro') {
                    expiryDate.setMonth(expiryDate.getMonth() + 6);
                } else {
                    // Premium, Pro 10/20/Unlimited usually 1 year
                    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
                }
                
                await updateDoc(doc(db, 'users', user.id), {
                    'membership.isActive': true,
                    'membership.plan': planId,
                    'membership.startsAt': now,
                    'membership.expiresAt': Timestamp.fromDate(expiryDate)
                });
                
                if (user.role === 'influencer') {
                    await updateDoc(doc(db, 'influencers', user.id), { membershipActive: true });
                }
            } 
            else if (collabType.startsWith('boost_')) {
                const boostType = collabType.split('_')[1];
                const targetId = transactionDetails.relatedId;
                
                await apiService.activateBoost(
                    user.id, 
                    boostType as any, 
                    targetId, 
                    boostType === 'profile' ? 'profile' : boostType === 'campaign' ? 'campaign' : 'banner'
                );
            }
            else {
                // For regular collabs, update status
                // Map collabType to collection name
                const collectionMap: any = {
                    direct: 'collaboration_requests',
                    campaign: 'campaign_applications',
                    ad_slot: 'ad_slot_requests',
                    banner_booking: 'banner_booking_requests'
                };
                const collectionName = collectionMap[collabType];
                if (collectionName && transactionDetails.relatedId) {
                     await updateDoc(doc(db, collectionName, transactionDetails.relatedId), {
                         status: 'in_progress',
                         paymentStatus: 'paid'
                     });
                }
            }
            
            return true;
        } catch (dbErr) {
            console.error("Client-side fulfillment failed:", dbErr);
            return false;
        }
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

    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("You must be logged in to make a payment.");
      }

      const idToken = await firebaseUser.getIdToken();
      const activeGateway = platformSettings.activePaymentGateway?.toLowerCase();
      const selectedGateway = activeGateway === 'cashfree' ? 'cashfree' : 'razorpay';
      
      const API_URL =
        selectedGateway === "razorpay"
          ? "https://razorpay-backeb-nd.onrender.com"
          : "https://partnerpayment-backend.onrender.com";

      const body = {
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

      let data;

      try {
        const response = await fetch(`${API_URL}/create-order`, {
          method: "POST",
          headers: selectedGateway === "razorpay"
              ? { "Content-Type": "application/json" }
              : { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        data = await response.json();
      } catch (creationErr: any) {
        console.warn("Order creation failed. Using fallback.", creationErr);
        if (selectedGateway === "razorpay") {
          data = {
            gateway: "razorpay",
            key_id: platformSettings.razorpayKeyId || RAZORPAY_KEY_ID,
            amount: Math.round(finalPayableAmount * 100),
            currency: "INR",
            id: undefined,
            fallbackMode: true,
            coinsUsed: useCoins ? maxRedeemableCoins : 0,
            internal_order_id: `fallback_${Date.now()}_${Math.floor(Math.random() * 1000)}`
          };
        } else {
          throw new Error("Payment server unreachable.");
        }
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

      const razorpayOrderId = data.payment_session_id || data.order?.id || data.id || data.order_id;
      const cashfreeSessionId = data.payment_session_id || data.id || data.session?.id;
      const isRazorpay = data.gateway === "razorpay" || selectedGateway === "razorpay";

      if (isRazorpay) {
        if (!window.Razorpay) {
          throw new Error("Razorpay SDK failed to load.");
        }

        const options: any = {
          key: data.key_id || RAZORPAY_KEY_ID,
          amount: data.amount,
          currency: data.currency || "INR",
          name: "BIGYAPON",
          description: transactionDetails.description,
          ...(razorpayOrderId && !data.fallbackMode ? { order_id: razorpayOrderId } : {}),

          handler: async function (response: any) {
            const paymentId = response.razorpay_payment_id;
            const orderIdToUse = data.internal_order_id || razorpayOrderId;
            const coinsToDeduct = data.coinsUsed || 0;

            // Fallback Mode or Standard Mode failure handler
            const doClientFulfillment = async () => {
                const success = await performClientSideFulfillment(orderIdToUse, paymentId, coinsToDeduct);
                if (success) {
                    setStatus("idle");
                    onClose();
                    window.location.href = `/?order_id=${orderIdToUse}&gateway=razorpay&fallback=true`;
                } else {
                    setError("Payment successful but activation failed. Contact support with ID: " + paymentId);
                    setStatus("error");
                }
            };

            if (data.fallbackMode) {
                await doClientFulfillment();
            } else {
                try {
                    // Attempt Backend Verification
                    const verifyRes = await fetch(`${BACKEND_URL}/verify-razorpay`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpayOrderId: response.razorpay_order_id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature,
                            orderId: data.internal_order_id 
                        }),
                    });

                    const result = await verifyRes.json();

                    if (verifyRes.ok && result.success) {
                        setStatus("idle");
                        onClose();
                        window.location.href = `/?order_id=${data.internal_order_id}&gateway=razorpay`;
                    } else {
                        console.warn("Backend verification failed, trying client-side fix.");
                        await doClientFulfillment();
                    }
                } catch (err) {
                    console.error("Verification fetch failed, using client-side fallback", err);
                    await doClientFulfillment();
                }
            }
          },
          prefill: { name: user.name, email: user.email, contact: cleanPhone },
          theme: { color: "#4F46E5" },
          modal: { ondismiss: function () { setStatus("idle"); } },
        };

        const rzp1 = new window.Razorpay(options);
        rzp1.on("payment.failed", function (response: any) {
          setError(`Payment Failed: ${response.error.description}`);
          setStatus("error");
        });
        rzp1.open();
      } else {
        if (!cashfreeSessionId) throw new Error("Missing Cashfree session");
        const cashfree = await load({ mode: data.environment || "production" });
        await cashfree.checkout({ paymentSessionId: cashfreeSessionId, redirectTarget: "_self" });
      }

    } catch (err: any) {
      console.error("Payment error:", err);
      let msg = err.message || "Something went wrong.";
      if (msg.includes("Failed to fetch")) msg = "Connection error. Please check internet.";
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
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Enter mobile number" className="mt-1 w-full p-2 border rounded" />
                </div>
              )}

              <div className="space-y-3 text-sm mt-4 dark:text-gray-300">
                <div className="flex justify-between"><span>Subtotal:</span><span>₹{baseAmount.toFixed(2)}</span></div>
                {processingCharge > 0 && <div className="flex justify-between text-gray-500"><span>Processing Fee:</span><span>₹{processingCharge.toFixed(2)}</span></div>}
                {gstOnFees > 0 && <div className="flex justify-between text-gray-500"><span>GST on Fees:</span><span>₹{gstOnFees.toFixed(2)}</span></div>}

                {userCoins > 0 && (
                    <div className="p-3 bg-indigo-50 dark:bg-gray-700 rounded-lg border border-indigo-100 dark:border-gray-600 mt-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CoinIcon className="w-5 h-5 text-yellow-500" />
                                <div><p className="font-semibold text-gray-800 dark:text-white">Use Coins</p><p className="text-xs text-gray-500 dark:text-gray-400">Balance: {userCoins}</p></div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">- ₹{useCoins ? maxRedeemableCoins : 0}</span>
                                <input type="checkbox" checked={useCoins} onChange={(e) => setUseCoins(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"/>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Max redeemable: 100 coins (1 Coin = ₹1)</p>
                    </div>
                )}

                <div className="flex justify-between font-bold text-lg pt-4 border-t dark:border-gray-700">
                  <span>Total Payable:</span><span>₹{finalPayableAmount.toFixed(2)}</span>
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
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded border border-red-200"><strong>Error:</strong> {error}</div>
          )}
        </div>

        {status !== "processing" && (
          <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-b-2xl">
            <button onClick={handlePayment} className="w-full py-3 font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all">
              Pay ₹{finalPayableAmount.toFixed(2)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
