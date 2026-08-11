/**
 * Frontend Razorpay Checkout helper for Stall-App (React + Vite + Firebase)
 * --------------------------------------------------------------------------
 * Usage:
 *   import { payWebsiteBuildFee, subscribeToPremium } from "./razorpayCheckout";
 *
 *   <button onClick={() => payWebsiteBuildFee(vendorId, "in_advanced")}>
 *     Pay for Advanced Website
 *   </button>
 *
 *   <button onClick={() => subscribeToPremium(vendorId, "in_monthly")}>
 *     Go Premium (Monthly)
 *   </button>
 *
 * Add this to your index.html <head> once:
 *   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase"; // your existing Firebase app init

const functions = getFunctions(app);

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

// ------------------------------------------------------------------
// One-time payment: website build fee
// ------------------------------------------------------------------
export async function payWebsiteBuildFee(vendorId, tier) {
  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error("Razorpay SDK failed to load. Check your connection.");

  const createOrder = httpsCallable(functions, "createOrder");
  const { data } = await createOrder({ vendorId, tier });
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
          const verifyOrderPayment = httpsCallable(functions, "verifyOrderPayment");
          const result = await verifyOrderPayment({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
          resolve(result.data);
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled by user")),
      },
      theme: { color: "#000000" },
    });
    rzp.on("payment.failed", (resp) => reject(new Error(resp.error.description)));
    rzp.open();
  });
}

// ------------------------------------------------------------------
// Recurring subscription: Premium plan
// ------------------------------------------------------------------
export async function subscribeToPremium(vendorId, planKey) {
  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error("Razorpay SDK failed to load. Check your connection.");

  const createSubscription = httpsCallable(functions, "createSubscription");
  const { data } = await createSubscription({ vendorId, planKey });
  const { subscriptionId, keyId } = data;

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: keyId,
      subscription_id: subscriptionId,
      name: "STALL",
      description: `Premium subscription (${planKey})`,
      handler: (response) => {
        // Actual activation is confirmed via the server-side webhook
        // (subscription.activated / subscription.charged), which is the
        // source of truth. This just tells the UI checkout succeeded.
        resolve({
          subscriptionId: response.razorpay_subscription_id,
          paymentId: response.razorpay_payment_id,
        });
      },
      modal: {
        ondismiss: () => reject(new Error("Subscription checkout cancelled by user")),
      },
      theme: { color: "#000000" },
    });
    rzp.on("payment.failed", (resp) => reject(new Error(resp.error.description)));
    rzp.open();
  });
}
