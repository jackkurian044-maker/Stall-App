// PremiumGate.jsx
// Drop this in: src/PremiumGate.jsx
// Import in VendorDashboard.jsx — see integration comment at bottom of this file

import { useState, useEffect, useMemo } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "./firebase";
import { COLORS } from "./constants";
import { regionFromLatLng } from "./geo";
import { Zap, CheckCircle, XCircle, CreditCard, AlertCircle } from "lucide-react";

const PLAN_NAME = "Stall Premium";

// Display-only pricing table — must match SUBSCRIPTION_PLANS in
// functions/index.js. The amount actually charged is always
// recomputed server-side from the vendor's listing location, so this
// being stale would only show the wrong price, not charge the wrong one.
const PRICING = {
  in: { symbol: "₹", monthly: 499, annual: 4999 },
  ae: { symbol: "AED ", monthly: 100, annual: 999 },
};

function formatPrice(region, cycle) {
  const p = PRICING[region];
  const amount = cycle === "annual" ? p.annual : p.monthly;
  return `${p.symbol}${amount.toLocaleString("en-IN")}`;
}

const FEATURES = [
  "⭐ Auto-respond to every Google review instantly",
  "🤖 AI-powered personalised responses (5★ to 1★)",
  "📊 Review analytics dashboard",
  "🔄 Runs 24/7 — no manual effort needed",
  "✎ Override any response manually anytime",
  "🌐 Multi-language support (EN, HI, KN, TA, TE)",
];

export default function PremiumGate({ user, listing }) {
  const [premium, setPremium] = useState(null); // null = loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [billingCycle, setBillingCycle] = useState("monthly"); // "monthly" | "annual"

  // premium_vendors and the Cloud Functions are keyed by the vendor's
  // Firebase Auth uid (context.auth.uid on the backend) — NOT the
  // listing id, since one account can own multiple listings.
  const vendorId = user?.uid;

  // Display-only region guess from the listing's own coordinates — the
  // backend independently re-derives this from the vendor's saved
  // listing when the subscription is actually created, so this is just
  // for showing the right currency before checkout opens.
  const region = useMemo(() => regionFromLatLng(listing?.lat, listing?.lng), [listing?.lat, listing?.lng]);

  const functions = getFunctions();

  // Listen to premium status in real-time
  useEffect(() => {
    if (!vendorId) return;
    const ref = doc(db, "premium_vendors", vendorId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setStatusError(false);
        setPremium(snap.exists() ? snap.data() : { isPremium: false });
      },
      (err) => {
        console.error("Premium status listener error:", err);
        setStatusError(true);
        setPremium({ isPremium: false }); // stop the infinite loading state
      }
    );
    return unsub;
  }, [vendorId]);

  // Load Razorpay script
  useEffect(() => {
    if (!document.getElementById("razorpay-script")) {
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  async function handleSubscribe() {
    setError("");
    setLoading(true);
    try {
      // Step 1: Create subscription on backend — region and final price
      // are determined server-side from the vendor's own listing, not
      // from anything sent here.
      const createSubscription = httpsCallable(functions, "createSubscription");
      const { data } = await createSubscription({
        vendorId,
        vendorName: listing?.name || user?.displayName || "Vendor",
        vendorEmail: user?.email || "",
        billingCycle,
      });

      if (!data.subscriptionId) throw new Error("Failed to create subscription");
      if (!data.keyId) throw new Error("Payment setup incomplete. Contact support.");

      // Step 2: Open Razorpay checkout — key and price both come from
      // the backend response, never from a frontend env var/constant.
      const cyclePrice = data.currency === "AED"
        ? `AED ${(data.amount / 100).toLocaleString("en-IN")}`
        : `₹${(data.amount / 100).toLocaleString("en-IN")}`;
      const options = {
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "Stall App",
        description: `${PLAN_NAME} — ${cyclePrice}/${billingCycle === "annual" ? "year" : "month"}`,
        image: "/stall-logo.png", // your logo path
        handler: async (response) => {
          // Step 3: Verify payment on backend
          try {
            const verifySubscription = httpsCallable(functions, "verifySubscription");
            await verifySubscription({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
              vendorId,
            });
            // Firestore listener above will auto-update UI
          } catch (err) {
            setError("Payment received but activation failed. Contact support.");
          }
        },
        prefill: {
          name: user?.displayName || listing?.name || "",
          email: user?.email || "",
        },
        theme: { color: COLORS.ink },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => {
        setError(`Payment failed: ${resp.error.description}`);
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setError("");
    try {
      const cancelSubscription = httpsCallable(functions, "cancelSubscription");
      await cancelSubscription({ vendorId }); // backend actually uses context.auth.uid, but keep payload consistent
      setShowConfirmCancel(false);
    } catch (err) {
      setError("Couldn't cancel — please try again or contact support.");
    } finally {
      setCancelling(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "9px 10px", borderRadius: 14,
    border: `1.5px solid ${COLORS.ink}`, fontSize: 13,
    background: "#fff", boxSizing: "border-box",
  };

  const cardStyle = {
    background: "#fff",
    border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  };

  // Loading state
  if (premium === null) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", color: "#999", fontSize: 13 }}>
        Loading premium status...
      </div>
    );
  }

  // ── ACTIVE PREMIUM ──────────────────────────────────────────
  if (premium.isPremium) {
    return (
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 16, background: COLORS.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <div className="font-display" style={{ fontSize: 16, fontWeight: 700 }}>
              {PLAN_NAME} — Active ✦
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>
              {premium.currency === "AED" ? "AED " : "₹"}
              {premium.amount ? (premium.amount / 100).toLocaleString("en-IN") : "—"}
              /{premium.billingCycle === "annual" ? "year" : "month"} · Next billing: {premium.nextBillingDate
                ? new Date(premium.nextBillingDate.seconds * 1000).toLocaleDateString("en-IN")
                : "auto-renewal"}
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#E1F5EE", color: "#085041", fontWeight: 600 }}>
            ✓ Auto-review active
          </span>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#E6F1FB", color: "#0C447C", fontWeight: 600 }}>
            Plan: {premium.billingCycle === "annual" ? "Annual" : "Monthly"}
          </span>
          {premium.subscriptionId && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#F3F4F6", color: "#6B7280", fontFamily: "monospace" }}>
              {premium.subscriptionId.slice(0, 16)}...
            </span>
          )}
        </div>

        {/* Payment history */}
        {premium.payments?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Payment history</div>
            {premium.payments.slice(0, 3).map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
                <span style={{ color: "#374151" }}>{premium.currency === "AED" ? "AED " : "₹"}{p.amount / 100}</span>
                <span style={{ color: "#6B7280" }}>{new Date(p.paidAt?.seconds * 1000).toLocaleDateString("en-IN")}</span>
                <span style={{ color: "#1D9E75", fontWeight: 600 }}>✓ Paid</span>
              </div>
            ))}
          </div>
        )}

        {/* Cancel */}
        {!showConfirmCancel ? (
          <button
            onClick={() => setShowConfirmCancel(true)}
            style={{ background: "transparent", border: `1.5px solid #E24B4A`, borderRadius: 14, padding: "7px 14px", fontSize: 12, color: "#E24B4A", cursor: "pointer", fontWeight: 600 }}
          >
            Cancel subscription
          </button>
        ) : (
          <div style={{ background: "#FEF3F2", border: "1px solid #FECACA", borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#991B1B", marginBottom: 6 }}>
              Cancel Premium?
            </div>
            <div style={{ fontSize: 12, color: "#7F1D1D", marginBottom: 12 }}>
              Auto-review responses will stop at the end of your current billing period. You can resubscribe anytime.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{ background: "#E24B4A", border: "none", borderRadius: 14, padding: "8px 16px", fontSize: 12, color: "#fff", cursor: "pointer", fontWeight: 600 }}
              >
                {cancelling ? "Cancelling..." : "Yes, cancel"}
              </button>
              <button
                onClick={() => setShowConfirmCancel(false)}
                style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 14, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}
              >
                Keep Premium
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#E24B4A", marginTop: 10 }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}
      </div>
    );
  }

  // ── NOT PREMIUM — UPGRADE CARD ───────────────────────────────
  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={18} /> Upgrade to Premium
        </div>
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#F3F4F6", color: "#6B7280", fontWeight: 600 }}>
          ✦ Premium
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        Let AI respond to every Google review automatically — 24/7, no effort needed.
      </div>

      {statusError && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#E24B4A", marginBottom: 14 }}>
          <AlertCircle size={13} /> Couldn't load your current plan status. If you already subscribed, try refreshing the page.
        </div>
      )}

      {/* Billing cycle toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["monthly", "annual"].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setBillingCycle(c)}
            style={{
              flex: 1, padding: "7px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${COLORS.ink}`, cursor: "pointer",
              background: billingCycle === c ? COLORS.ink : "#fff",
              color: billingCycle === c ? "#fff" : COLORS.ink,
            }}
          >
            {c === "monthly" ? "Monthly" : "Annual · save ~17%"}
          </button>
        ))}
      </div>

      {/* Pricing */}
      <div style={{ background: "#F9FAFB", borderRadius: 16, padding: "14px 16px", marginBottom: 16, border: "1px solid #E5E7EB" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: COLORS.ink }}>{formatPrice(region, billingCycle)}</span>
          <span style={{ fontSize: 14, color: "#6B7280" }}>/{billingCycle === "annual" ? "year" : "month"}</span>
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
          {billingCycle === "annual" ? "Auto-renews yearly" : "Auto-renews monthly"} · Cancel anytime · Billed via Razorpay
          {region === "ae" ? " · UAE pricing" : ""}
        </div>
      </div>

      {/* Features */}
      <div style={{ marginBottom: 18 }}>
        {FEATURES.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7, fontSize: 13, color: "#374151" }}>
            {f}
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="stall-btn"
        style={{
          width: "100%", background: loading ? `${COLORS.ink}88` : COLORS.ink,
          color: "#fff", border: "none", borderRadius: 14, padding: "12px",
          fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <CreditCard size={16} />
        {loading ? "Opening payment..." : `Subscribe for ${formatPrice(region, billingCycle)}/${billingCycle === "annual" ? "year" : "month"}`}
      </button>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#E24B4A", marginTop: 10 }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 10 }}>
        Secured by Razorpay · UPI, Cards, Netbanking accepted
      </div>
    </div>
  );
}

/*
─────────────────────────────────────────────────────────────
INTEGRATION: Add to VendorDashboard.jsx
─────────────────────────────────────────────────────────────

1. Import at top of VendorDashboard.jsx:
   import PremiumGate from "./PremiumGate";
   import ReviewAutoResponder from "./ReviewAutoResponder";

2. Add a state for active tab:
   const [dashTab, setDashTab] = useState("listings"); // "listings" | "premium"

3. Add tab bar just before your listings div (the right column):

   <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
     {["listings", "premium"].map(t => (
       <button
         key={t}
         onClick={() => setDashTab(t)}
         className="stall-btn"
         style={{
           padding: "7px 16px", borderRadius: 14, fontSize: 13, fontWeight: 600,
           border: `1.5px solid ${COLORS.ink}`,
           background: dashTab === t ? COLORS.ink : "#fff",
           color: dashTab === t ? "#fff" : COLORS.ink,
         }}
       >
         {t === "listings" ? "My Listings" : "⚡ Premium"}
       </button>
     ))}
   </div>

4. Wrap existing listings JSX:
   {dashTab === "listings" && (
     // ... your existing listings map code ...
   )}

5. Add Premium tab content:
   {dashTab === "premium" && (
     <div>
       <PremiumGate user={user} listing={listings[0]} />
       {listings[0] && <ReviewAutoResponder listing={listings[0]} />}
     </div>
   )}
─────────────────────────────────────────────────────────────
*/