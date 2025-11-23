import { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

interface Props {
  user: any;
  onComplete: () => void;
}

export default function PaymentSuccessPage({ user, onComplete }: Props) {
  const [status, setStatus] = useState("⏳ Verifying your payment...");

  const BASE_URL = "https://partnerpayment-backend.onrender.com"; // backend URL

  const orderId = new URLSearchParams(window.location.search).get("order_id");

  useEffect(() => {
    if (!orderId) {
      setStatus("❌ No order found.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`${BASE_URL}/payment-status/${orderId}`);
        const data = await res.json();

        if (data.success && data.status === "PAID") {
          setStatus("🎉 Payment Successful! Activating your account...");

          await saveTransaction(orderId);

          setTimeout(() => {
            onComplete();
          }, 2500);
        } else {
          setStatus("⏳ Waiting for bank confirmation...");
          setTimeout(verify, 4000);
        }
      } catch {
        setStatus("⚠️ Network error. Retrying...");
        setTimeout(verify, 5000);
      }
    }

    verify();
  }, []);

  async function saveTransaction(orderId: string) {
    const transactionRef = doc(db, "transactions", orderId);

    await setDoc(transactionRef, {
      orderId,
      userId: user.id,
      email: user.email,
      status: "success",
      amount: user.membership?.price || 0,
      date: serverTimestamp(),
    });

    // Activate membership
    if (user && user.membership) {
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, {
        "membership.isActive": true,
        "membership.activatedAt": serverTimestamp(),
      });
    }
  }

  return (
    <div
      style={{
        marginTop: "80px",
        textAlign: "center",
        fontSize: "24px",
        padding: "20px",
      }}
    >
      🔍 Checking Status...
      <br />
      <br />
      <strong>{status}</strong>

      {status.includes("bank confirmation") && (
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "30px",
            padding: "12px 22px",
            fontSize: "18px",
            borderRadius: "8px",
            background: "#4F46E5",
            color: "white",
          }}
        >
          🔁 Refresh Now
        </button>
      )}
    </div>
  );
}
