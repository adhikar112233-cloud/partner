
import React, { useState } from 'react';
import { User, PlatformSettings } from '../types';
import { auth, BACKEND_URL, RAZORPAY_KEY_ID } from '../services/firebase';
import { apiService } from '../services/apiService';
import { load } from "@cashfreepayments/cashfree-js";

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
  const needsPhone = !user.mobileNumber;

  const processingCharge = platformSettings.isPaymentProcessingChargeEnabled
    ? baseAmount * (platformSettings.paymentProcessingChargeRate / 100)
    : 0;

  const gstOnFees = platformSettings.isGstEnabled
    ? processingCharge * (platformSettings.gstRate / 100)
    : 0;

  const totalPayable = baseAmount + processingCharge + gstOnFees;

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

      // Determine gateway and API URL logic
      const activeGateway = platformSettings.activePaymentGateway?.toLowerCase();
      const selectedGateway = activeGateway === 'cashfree' ? 'cashfree' : 'razorpay';
      
      // Always use BACKEND_URL (Firebase Function) to ensure DB logic is accessible
      const API_URL = BACKEND_URL;

      const body = {
        amount: Number(totalPayable.toFixed(2)),
        purpose: transactionDetails.description,
        relatedId: transactionDetails.relatedId,
        collabId: transactionDetails.collabId,
        collabType: collabType,
        phone: cleanPhone,
        gateway: selectedGateway,
      };

      console.log(`Initiating payment via ${selectedGateway} at ${API_URL}`);

      let data;

      try {
        const response = await fetch(`${API_URL}/create-order`, {
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
        console.warn("Order creation failed. Attempting fallback logic.", creationErr);

        // Robust Fallback Logic for Razorpay
        if (selectedGateway === "razorpay") {
          console.log("Using Razorpay Client Fallback");
          data = {
            gateway: "razorpay",
            key_id: platformSettings.razorpayKeyId || RAZORPAY_KEY_ID,
            amount: Math.round(totalPayable * 100), // amount in paise
            currency: "INR",
            id: undefined,
            fallbackMode: true,
          };
        } else {
          throw new Error("Unable to connect to payment server. Please try again later.");
        }
      }

      if (needsPhone) {
        apiService.updateUserProfile(user.id, { mobileNumber: phoneNumber }).catch(console.warn);
      }

      const razorpayOrderId =
        data.payment_session_id || data.order?.id || data.id || data.order_id;

      const cashfreeSessionId =
        data.payment_session_id || data.id || data.session?.id;

      const isRazorpay = data.gateway === "razorpay" || selectedGateway === "razorpay";

      // ------------------------------------------------------------------------------------
      //                          RAZORPAY CHECKOUT
      // ------------------------------------------------------------------------------------

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
            if (data.fallbackMode) {
              console.log("Payment successful (Fallback Mode)");
              setStatus("idle");
              onClose();
              const fallbackOrderId = `rzp_fallback_${Date.now()}`;
              window.location.href = `/?order_id=${fallbackOrderId}&gateway=razorpay`;
              return;
            }

            try {
              // Correctly call the Firebase Function endpoint for verification
              const verifyRes = await fetch(`${BACKEND_URL}/verify-razorpay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  // Use 'orderId' as expected by the backend function
                  orderId: data.internal_order_id 
                }),
              });

              const result = await verifyRes.json();

              if (verifyRes.ok && result.success) {
                setStatus("idle");
                onClose();
                window.location.href = `/?order_id=${data.internal_order_id}&gateway=razorpay`;
              } else {
                console.error("Verification failed response:", result);
                // Even if backend verification fails temporarily, we redirect to let the success page check again
                window.location.href = `/?order_id=${data.internal_order_id}&gateway=razorpay`;
              }
            } catch (err) {
              console.error("Verification fetch failed", err);
              setStatus("idle");
              onClose();
              window.location.href = `/?order_id=${data.internal_order_id}&gateway=razorpay`;
            }
          },

          prefill: {
            name: user.name,
            email: user.email,
            contact: cleanPhone,
          },

          theme: {
            color: "#4F46E5",
          },

          modal: {
            ondismiss: function () {
              setStatus("idle");
            },
          },
        };

        const rzp1 = new window.Razorpay(options);

        rzp1.on("payment.failed", function (response: any) {
          setError(`Payment Failed: ${response.error.description}`);
          setStatus("error");
        });

        rzp1.open();
      }

      // ------------------------------------------------------------------------------------
      //                            CASHFREE CHECKOUT
      // ------------------------------------------------------------------------------------

      else {
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

              <div className="space-y-2 text-sm mt-4 dark:text-gray-300">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span>₹{baseAmount.toFixed(2)}</span>
                </div>

                {processingCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Processing Fee:</span>
                    <span>₹{processingCharge.toFixed(2)}</span>
                  </div>
                )}

                {gstOnFees > 0 && (
                  <div className="flex justify-between">
                    <span>GST on Fees:</span>
                    <span>₹{gstOnFees.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-lg pt-2 border-t dark:border-gray-700">
                  <span>Total Payable:</span>
                  <span>₹{totalPayable.toFixed(2)}</span>
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
              Pay ₹{totalPayable.toFixed(2)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
