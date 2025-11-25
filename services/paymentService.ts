
import { BACKEND_URL } from './firebase';

declare global {
  interface Window {
    Cashfree: any;
  }
}

export interface PaymentOptions {
  userId: string;
  type: string;
  amount: number;
  planId?: string;
  additionalMeta?: any;
  customerPhone: string;
  customerEmail?: string;
  customerName?: string;
  relatedId?: string;
  collabId?: string;
  description?: string;
}

export const initiatePayment = async ({
  userId,
  type,
  amount,
  planId,
  additionalMeta,
  customerPhone,
  customerEmail,
  customerName,
  relatedId,
  collabId,
  description
}: PaymentOptions) => {
  try {
    // Call Firebase Cloud Function using the configured BACKEND_URL
    const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          collabType: type, // Mapping 'type' to 'collabType' expected by backend
          planId,
          amount,
          phone: customerPhone, // Backend expects 'phone'
          customerPhone, 
          customerEmail,
          customerName,
          additionalMeta,
          customerId: userId,
          relatedId,
          collabId,
          description
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.message || "Order creation failed");
    }

    // Handle 100% coin redemption success (amount 0)
    if (data.success && amount === 0) {
         return { success: true, orderId: data.orderId || data.order_id, result: { message: "Paid with coins" } };
    }

    if (!data.paymentSessionId && !data.payment_session_id) {
      throw new Error("Payment session generation failed");
    }

    const paymentSessionId = data.paymentSessionId || data.payment_session_id;
    const orderId = data.orderId || data.order_id;

    if (!window.Cashfree) {
      throw new Error("Cashfree SDK not loaded");
    }

    const cashfree = new window.Cashfree({
      mode: data.environment || "production", 
    });

    const result = await cashfree.checkout({
      paymentSessionId,
      redirectTarget: "_self", 
    });

    return { success: true, orderId, result };
  } catch (error: any) {
    console.error("Payment Initiation Error:", error);
    return { success: false, error: error.message || "Payment failed" };
  }
};
