import { useEffect, useState } from "react";

interface Props {
  user: any;
  onComplete: () => void;
}

const PaymentSuccessPage: React.FC<Props> = ({ user, onComplete }) => {
  const [status, setStatus] = useState("⏳ Verifying payment...");
  const [loading, setLoading] = useState(true);
  const [allowRetry, setAllowRetry] = useState(false);

  const orderId = new URLSearchParams(window.location.search).get("order_id");

  const checkStatus = async () => {
    if (!orderId) {
      setStatus("❌ Invalid Payment — No Order ID");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `https://partnerpayment-backend.onrender.com/payment-status/${orderId}`
      );

      const data = await response.json();

      if (data.success === true || data.status === "PAID") {
        setStatus("🎉 Payment Successful! Redirecting...");
        setLoading(false);

        setTimeout(() => {
          onComplete(); // 🚀 redirects to dashboard automatically
        }, 2000);
      } else {
        setStatus("⌛ Waiting for bank confirmation...");
        setLoading(false);

        // auto retry every 4 sec
        setTimeout(checkStatus, 4000);
      }
    } catch {
      setStatus("⚠ Network error — Tap retry");
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    setTimeout(() => setAllowRetry(true), 10000);
  }, []);

  return (
    <div
      style={{
        marginTop: "120px",
        textAlign: "center",
        padding: "20px",
        fontSize: "24px",
      }}
    >
      <h2>{status}</h2>

      {loading && <p>🔄 Checking status...</p>}

      {allowRetry && (
        <button
          onClick={checkStatus}
          style={{
            marginTop: "20px",
            padding: "12px 25px",
            fontSize: "18px",
            borderRadius: "8px",
            background: "#4f46e5",
            color: "white",
            cursor: "pointer",
            border: "none",
          }}
        >
          🔁 Retry
        </button>
      )}
    </div>
  );
};

export default PaymentSuccessPage;
