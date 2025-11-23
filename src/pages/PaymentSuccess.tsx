import { useEffect, useState } from "react";

export default function PaymentSuccess() {
  const [status, setStatus] = useState("⏳ Verifying your payment...");

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get("order_id");

    async function verify() {
      try {
        const res = await fetch(
          `https://partnerpayment-backend.onrender.com/payment-status/${orderId}`
        );
        const data = await res.json();

        if (data?.order_status === "PAID") {
          setStatus("🎉 Payment successful! Your subscription is now active.");
        } else {
          setStatus("⏳ Waiting for confirmation... retrying...");
          setTimeout(verify, 4000);
        }
      } catch {
        setStatus("❌ Something went wrong. Please contact support.");
      }
    }

    verify();
  }, []);

  return (
    <div style={{ marginTop: "80px", textAlign: "center", fontSize: "24px" }}>
      {status}
    </div>
  );
}
