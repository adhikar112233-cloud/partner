
import React, { useState } from 'react';
import { User, PlatformSettings } from '../types';
import { auth, BACKEND_URL, CASHFREE_URL, RAZORPAY_URL } from '../services/firebase';
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
  
  // Determine which backend URL to use based on the active gateway setting
  const API_URL = platformSettings.activePaymentGateway === 'razorpay' 
    ? RAZORPAY_URL 
    : (platformSettings.activePaymentGateway === 'cashfree' ? CASHFREE_URL : BACKEND_URL);

  const processingCharge = platformSettings.isPaymentProcessingChargeEnabled
    ? baseAmount * (platformSettings.paymentProcessingChargeRate / 100)
    : 0;

  const gstOnFees = platformSettings.isGstEnabled
    ? processingCharge * (platformSettings.gstRate / 100)
    : 0;

  const totalPayable = baseAmount + processingCharge + gstOnFees;

  const handlePayment = async () => {
    const cleanPhone = (needsPhone ? phoneNumber : user.mobileNumber).replace(/\D/g, '').slice(-10);

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
  
      const body = {
        amount: Number(totalPayable.toFixed(2)),
        purpose: transactionDetails.description,
        relatedId: transactionDetails.relatedId,
        collabId: transactionDetails.collabId,
        collabType: collabType,
        phone: cleanPhone,
        gateway: platformSettings.activePaymentGateway, // Send preference to backend
      };
  
      const response = await fetch(
        `${API_URL}/create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + idToken,
          },
          body: JSON.stringify(body)
        }
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.message || "Could not create order. Please check your connection.");
      }

      // Update user phone if it was missing
      if (needsPhone) {
        apiService.updateUserProfile(user.id, { mobileNumber: phoneNumber }).catch(console.warn);
      }

      // Robust check for payment identifiers
      // Backend is expected to return 'id' (mapped from order_id or payment_session_id)
      if (!data || (!data.id && !data.payment_session_id && !data.order_id)) {
          throw new Error("Payment session missing in server response.");
      }

      // Determine Gateway Logic
      // Prefer explicit gateway flag from backend, otherwise fall back to settings
      const isRazorpay = data.gateway === 'razorpay' || platformSettings.activePaymentGateway === 'razorpay';

      if (isRazorpay) {
          // --- RAZORPAY FLOW ---
          if (!window.Razorpay) {
              throw new Error("Razorpay SDK failed to load. Please refresh the page.");
          }

          const options = {
              key: data.key_id,
              amount: data.amount,
              currency: data.currency,
              name: "BIGYAPON",
              description: transactionDetails.description,
              order_id: data.order_id || data.id, // Use the ID returned
              handler: async function (response: any) {
                  try {
                      const verifyRes = await fetch(`${API_URL}/verify-razorpay`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              orderId: data.internal_order_id,
                              razorpayPaymentId: response.razorpay_payment_id,
                              razorpayOrderId: response.razorpay_order_id,
                              razorpaySignature: response.razorpay_signature
                          })
                      });
                      
                      if (verifyRes.ok) {
                          onClose();
                          window.location.href = `/?order_id=${data.internal_order_id}`;
                      } else {
                          setError("Payment verification failed.");
                          setStatus("error");
                      }
                  } catch (e) {
                      setError("Verification network error.");
                      setStatus("error");
                  }
              },
              prefill: {
                  name: user.name,
                  email: user.email,
                  contact: cleanPhone
              },
              theme: {
                  color: "#4F46E5"
              }
          };

          const rzp1 = new window.Razorpay(options);
          rzp1.on('payment.failed', function (response: any){
                setError(`Payment Failed: ${response.error.description}`);
                setStatus("error");
          });
          rzp1.open();

      } else {
          // --- CASHFREE FLOW ---
          const sessionId = data.payment_session_id || data.id;
          
          if (!sessionId) {
            throw new Error("Payment session ID missing for Cashfree transaction.");
          }

          const cashfree = await load({
            mode: data.environment || "production" 
          });

          await cashfree.checkout({
            paymentSessionId: sessionId,
            redirectTarget: "_self"
          });
      }
  
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "An unknown error occurred.");
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Complete Payment</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 text-2xl">&times;</button>
        </div>
        
        <div className="p-6 min-h-[250px]">
            {status !== 'processing' ? (
                <div className="space-y-4">
                    {needsPhone && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                            <label htmlFor="phone-number" className="block text-sm font-semibold text-yellow-800 dark:text-yellow-200">Contact Number Required</label>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">Please provide your mobile number to proceed.</p>
                            <input
                                type="tel"
                                id="phone-number"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="Enter your mobile number"
                                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                required
                            />
                        </div>
                    )}
                    <div className="space-y-2 text-sm">
                        <p className="font-semibold text-gray-700 dark:text-gray-300">Payment for: <span className="font-normal">{transactionDetails.description}</span></p>
                        <div className="flex justify-between text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">Amount:</span><span>₹{baseAmount.toFixed(2)}</span></div>
                        {processingCharge > 0 && <div className="flex justify-between text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">Processing Fee:</span><span>₹{processingCharge.toFixed(2)}</span></div>}
                        {gstOnFees > 0 && <div className="flex justify-between text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">GST on Fees:</span><span>₹{gstOnFees.toFixed(2)}</span></div>}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t dark:border-gray-600"><span className="dark:text-gray-200">Total Payable:</span><span className="dark:text-gray-100">₹{totalPayable.toFixed(2)}</span></div>
                    </div>
                </div>
            ) : (
                <div className="text-center p-8">
                    <div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin border-indigo-500 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Processing payment...</p>
                </div>
            )}

            {status === 'error' && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-700">
                    <strong>Error:</strong> {error}
                </div>
            )}
        </div>
        
        {status !== 'processing' && (
          <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-b-2xl">
              <button onClick={handlePayment} className="w-full py-3 font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300">
                  {`Proceed to Pay ₹${totalPayable.toFixed(2)}`}
              </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
