import { useEffect, useState } from "react";

export default function PaymentSuccess() {
  const [status, setStatus] = useState("⏳ Verifying your payment...");
  const [loading, setLoading] = useState(true);
  const [allowRetry, setAllowRetry] = useState(false);

  // get order ID from URL
  const orderId = new URLSearchParams(window.location.search).get("order_id");

  async function checkStatus() {
    if (!orderId) {
      setStatus("❌ No order ID found!");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `https://partnerpayment-backend.onrender.com/payment-status/${orderId}`
      );

      const data = await response.json();

      if (data.success === true || data.status === "PAID") {
        setStatus("🎉 Payment Confirmed! Redirecting...");
        setLoading(false);

        // redirect after success
        setTimeout(() => {
          window.location.href = "/dashboard"; 
        }, 2000);

      } else {
        setStatus("⌛ Waiting for confirmation from bank...");
        setLoading(false);

        // retry automatically after 4 seconds
        setTimeout(checkStatus, 4000);
      }

    } catch (error) {
      setStatus("⚠️ Error verifying payment. Please try again.");
      setLoading(false);
    }
  }

  useEffect(() => {
    checkStatus();

    // show retry button after 10 sec
    setTimeout(() => setAllowRetry(true), 10000);
  }, []);

  return (
    <div style={{
      marginTop: "100px",
      textAlign: "center",
      fontSize: "22px",
      padding: "20px",
      fontFamily: "Arial"
    }}>
      <h2>{status}</h2>

      {loading && <p>⏳ Checking status...</p>}

      {allowRetry && (
        <button
          onClick={checkStatus}
          style={{
            marginTop: "20px",
            padding: "12px 25px",
            fontSize: "18px",
            borderRadius: "8px",
            cursor: "pointer",
            background: "#007bff",
            color: "white",
            border: "none"
          }}
        >
          🔄 Re-Check Status
        </button>
      )}
    </div>
  );
}
