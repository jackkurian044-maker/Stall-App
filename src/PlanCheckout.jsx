import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Check, CreditCard, ShieldCheck, Zap } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";
import { STALL_PLANS } from "./planCatalog";

const RAZORPAY_URL = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector('script[src="' + RAZORPAY_URL + '"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Razorpay failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_URL;
    script.async = true;
    script.onload = () => window.Razorpay ? resolve() : reject(new Error("Razorpay is unavailable"));
    script.onerror = () => reject(new Error("Razorpay failed to load"));
    document.head.appendChild(script);
  });
}

const PLAN_ORDER = ["verified", "digital_growth", "growth_setup"];

export default function PlanCheckout({ user, listing }) {
  const [premium, setPremium] = useState(null);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requestedPlan, setRequestedPlan] = useState("");

  useEffect(() => {
    try {
      const plan = window.sessionStorage.getItem("stallUpgradePlan") || "";
      if (PLAN_ORDER.includes(plan)) setRequestedPlan(plan);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onSnapshot(doc(db, "premium_vendors", user.uid), snap => {
      setPremium(snap.exists() ? snap.data() : null);
    });
  }, [user?.uid]);

  if (!listing?.id) {
    return (
      <div style={card}>
        <strong>Choose a plan after you create or claim your business listing.</strong>
        <div style={muted}>Paid plans are attached to the business listing, so we never activate a plan for the wrong store.</div>
      </div>
    );
  }

  const current = premium?.isPremium
    ? (premium.tier === "growth_setup" ? "growth_setup" : "digital_growth")
    : listing.isVerified || ["verified", "digital_growth", "growth_setup"].includes(listing.planKey)
      ? listing.planKey
      : "free";

  const checkout = async (planKey) => {
    setError("");
    setMessage("");
    setWorking(planKey);
    try {
      await loadRazorpay();
      const functions = getFunctions();

      if (planKey === "verified") {
        const createOrder = httpsCallable(functions, "createVerifiedOrder");
        const { data } = await createOrder({ listingId: listing.id });
        await new Promise((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: data.keyId,
            order_id: data.orderId,
            amount: data.amount,
            currency: data.currency,
            name: "STall",
            description: "STall Verified — ₹99 one-time",
            prefill: { name: user?.displayName || listing.name || "", email: user?.email || "" },
            theme: { color: COLORS.ink },
            handler: async response => {
              try {
                const verify = httpsCallable(functions, "verifyVerifiedPayment");
                await verify(response);
                setMessage("STall Verified is now active for this business.");
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            modal: { ondismiss: () => reject(new Error("Payment window closed")) },
          });
          rzp.on("payment.failed", e => reject(new Error(e?.error?.description || "Payment failed")));
          rzp.open();
        });
      } else {
        const createSubscription = httpsCallable(functions, "createSubscription");
        const { data } = await createSubscription({
          vendorId: user.uid,
          vendorName: listing.name || user.displayName || "Vendor",
          vendorEmail: user.email || "",
          product: planKey,
          billingCycle: "monthly",
        });
        const price = data.currency === "AED" ? "AED " + (data.amount / 100) : "₹" + (data.amount / 100);
        await new Promise((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: data.keyId,
            subscription_id: data.subscriptionId,
            name: "STall",
            description: STALL_PLANS[planKey].name + " — " + price + "/month",
            image: "/stall-logo.png",
            prefill: { name: user?.displayName || listing.name || "", email: user?.email || "" },
            theme: { color: COLORS.ink },
            handler: async response => {
              try {
                const verify = httpsCallable(functions, "verifySubscription");
                await verify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                  vendorId: user.uid,
                });
                setMessage(STALL_PLANS[planKey].name + " is now active.");
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            modal: { ondismiss: () => reject(new Error("Payment window closed")) },
          });
          rzp.on("payment.failed", e => reject(new Error(e?.error?.description || "Payment failed")));
          rzp.open();
        });
      }
    } catch (e) {
      setError(e?.message || "Payment could not be started.");
    } finally {
      setWorking("");
    }
  };

  return (
    <section style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Zap size={18} color={COLORS.marigold} />
        <div style={{ fontSize: 18, fontWeight: 900 }}>STall Plans</div>
      </div>
      <div style={muted}>Plans are activated only after verified Razorpay payment. Your current business: <strong>{listing.name}</strong></div>
      {requestedPlan && current !== requestedPlan && STALL_PLANS[requestedPlan] && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#EEF6FF", border: "1px solid #93C5FD", color: "#123B66" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em" }}>You selected this plan</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 3 }}>
            {STALL_PLANS[requestedPlan].name} — ₹{STALL_PLANS[requestedPlan].price.toLocaleString("en-IN")} {STALL_PLANS[requestedPlan].billing === "monthly" ? "/ month" : "one-time"}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Click the matching payment button below to open Razorpay. The amount shown there is the amount you will pay.</div>
        </div>
      )}

      {(current === "digital_growth" || current === "growth_setup") && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <a
            href={window.location.origin + "/?store=" + encodeURIComponent(listing.id)}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: COLORS.ink, color: "#fff", textDecoration: "none", borderRadius: 9, padding: "9px 12px", fontWeight: 800, fontSize: 12 }}
          >
            Open STall Landing Page
          </a>
        </div>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {PLAN_ORDER.map(key => {
          const p = STALL_PLANS[key];
          const isCurrent = current === key;
          const locked = current === "growth_setup" || (current === "digital_growth" && key !== "growth_setup");
          const upgradePending = current === "digital_growth" && key === "growth_setup";
          return (
            <div key={key} style={{ border: isCurrent ? "2px solid " + COLORS.teal : "1px solid #ddd", borderRadius: 12, padding: 13, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{p.name}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, marginTop: 3 }}>₹{p.price.toLocaleString("en-IN")} <span style={{ fontSize: 11, fontWeight: 600, color: "#777" }}>{p.billing === "monthly" ? "/ month" : "one-time"}</span></div>
                  <div style={{ fontSize: 11.5, color: "#666", marginTop: 5 }}>Local visibility: {p.visibilityKm ? "up to " + p.visibilityKm + " KM" : "basic listing"}</div>
                </div>
                {isCurrent ? (
                  <span style={{ padding: "5px 9px", borderRadius: 999, background: "#E1F5EE", color: "#085041", fontSize: 11, fontWeight: 800 }}>ACTIVE</span>
                ) : (
                  <button type="button" disabled={Boolean(working) || locked || upgradePending} onClick={() => checkout(key)} style={{ border: "none", borderRadius: 9, padding: "9px 12px", background: locked || upgradePending ? "#ddd" : COLORS.ink, color: locked || upgradePending ? "#888" : "#fff", fontWeight: 800, cursor: locked || upgradePending ? "not-allowed" : "pointer" }}>
                    {working === key ? "Opening…" : upgradePending ? "Upgrade flow next" : (p.billing === "monthly" ? "Pay ₹" + p.price.toLocaleString("en-IN") + "/month" : "Pay ₹" + p.price.toLocaleString("en-IN"))}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {current === "digital_growth" && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 9, background: "#FFF7ED", color: "#9A3412", fontSize: 11.5 }}>
          Growth Setup upgrade is intentionally held here until the existing subscription can be changed without creating a second active Razorpay subscription.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14, fontSize: 11.5, color: "#555" }}>
        <span><Check size={13} style={{ verticalAlign: "middle" }} /> Verified payment activation</span>
        <span><ShieldCheck size={13} style={{ verticalAlign: "middle" }} /> Server-side price validation</span>
        <span><CreditCard size={13} style={{ verticalAlign: "middle" }} /> Razorpay checkout</span>
      </div>

      {message && <div style={{ marginTop: 12, padding: 10, borderRadius: 9, background: "#E1F5EE", color: "#085041", fontSize: 12 }}>{message}</div>}
      {error && <div style={{ marginTop: 12, padding: 10, borderRadius: 9, background: "#FEF2F2", color: "#991B1B", fontSize: 12 }}>{error}</div>}
    </section>
  );
}

const card = { background: "#fff", border: "2px solid " + COLORS.ink, borderRadius: 12, padding: 18, marginBottom: 14 };
const muted = { fontSize: 12, color: "#666", marginTop: 4, lineHeight: 1.45 };
