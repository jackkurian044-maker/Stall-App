// src/websiteBuildCheckout.js
//
// Frontend Razorpay checkout for the one-time website build fee.
// Companion to your existing PremiumGate.jsx subscription checkout —
// same pattern, but a one-time Order instead of a Subscription.
//
// Requires (once, in index.html):
//   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>

import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "./firebase"; // adjust to match your actual firebase.js exports

const functions = getFunctions();

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// tier: "in_basic" | "in_advanced" | "ae_basic" | "ae_advanced"
export async function payWebsiteBuildFee(tier) {
  const vendorId = auth.currentUser?.uid;
  if (!vendorId) throw new Error("Not signed in");

  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error("Razorpay SDK failed to load. Check your connection.");

  const createWebsiteBuildOrder = httpsCallable(functions, "createWebsiteBuildOrder");
  const { data } = await createWebsiteBuildOrder({ vendorId, tier });
  const { orderId, amount, currency, keyId } = data;

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: keyId,
      amount,
      currency,
      name: "STALL",
      description: `Website build (${tier})`,
      order_id: orderId,
      handler: async (response) => {
        try {
          const verifyWebsiteBuildPayment = httpsCallable(functions, "verifyWebsiteBuildPayment");
          const result = await verifyWebsiteBuildPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          resolve(result.data);
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
      theme: { color: "#000000" },
    });
    rzp.on("payment.failed", (resp) => reject(new Error(resp.error.description)));
    rzp.open();
  });
}