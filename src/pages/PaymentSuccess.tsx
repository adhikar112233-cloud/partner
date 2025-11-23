import { useEffect, useState } from "react";

export default function PaymentSuccess() {
  const [status, setStatus] = useState("⏳ Verifying your payment...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");

    async function verify() {
      try {
        const response = await fetch(
          `https://partnerpayment-backend.onrender.com/payment-status/${orderId}`
        );
        const data = await response.json();

        if (data?.order_status === "PAID") {
          setStatus("🎉 Payment successful! Your subscription is now active.");
        } else {
          setStatus("⏳ Still waiting... retrying...");
          setTimeout(verify, 5000);
        }
      } catch {
        setStatus("❌ Error verifying payment. Please contact support.");
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
