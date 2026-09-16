import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { CheckCircle2, CreditCard, Eye, Globe2, MessageCircle, Navigation, Phone, ShieldCheck, Sparkles, Star, TrendingUp, Zap } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";
import { regionFromLatLng } from "./geo";

const cardStyle = { background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 18 };
const PRICING = {
  in: { symbol: "₹", monthly: 499, annual: 4999 },
  ae: { symbol: "AED ", monthly: 100, annual: 999 },
};
const RAZORPAY_CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayCheckout() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_URL}"]`);
    const script = existing || document.createElement("script");
    let settled = false;
    const finish = (ok) => { if (!settled) { settled = true; resolve(ok); } };
    script.addEventListener("load", () => finish(Boolean(window.Razorpay)), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    if (!existing) {
      script.src = RAZORPAY_CHECKOUT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
    window.setTimeout(() => finish(Boolean(window.Razorpay)), 10000);
  });
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export default function VendorPremiumWorkspace({ user, listing }) {
  const [premium, setPremium] = useState(null);
  const [gbp, setGbp] = useState(null);
  const [boost, setBoost] = useState(null);
  const [premiumLoading, setPremiumLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [working, setWorking] = useState(false);
  const [gbpWorking, setGbpWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onSnapshot(doc(db, "premium_vendors", user.uid), (snap) => {
      setPremium(snap.exists() ? snap.data() : null);
      setPremiumLoading(false);
    }, () => { setPremium(null); setPremiumLoading(false); });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const q = query(collection(db, "gbp_connections"), where("ownerId", "==", user.uid));
    return onSnapshot(q, (snap) => setGbp(snap.empty ? null : snap.docs[0].data()), () => setGbp(null));
  }, [user?.uid]);

  useEffect(() => {
    if (!listing?.id) { setBoost(null); return undefined; }
    return onSnapshot(doc(db, "vendors", listing.id, "boost", "latest"), (snap) => setBoost(snap.exists() ? snap.data() : null), () => setBoost(null));
  }, [listing?.id]);

  const stats = useMemo(() => ({
    views: Number(listing?.viewCount || 0),
    calls: Number(listing?.callCount || 0),
    whatsapp: Number(listing?.whatsappCount || 0),
    directions: Number(listing?.directionsCount || 0),
  }), [listing]);

  if (!listing) return (
    <div style={{ ...cardStyle, textAlign: "center", padding: 34 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: COLORS.ink, color: COLORS.marigold, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={22} /></div>
      <div className="font-display" style={{ fontSize: 19, fontWeight: 800, marginTop: 12 }}>Premium starts with your business</div>
      <div style={{ fontSize: 12.5, color: "#666", marginTop: 6, maxWidth: 520, marginInline: "auto" }}>Create or claim your listing first. Your Premium workspace becomes store-specific once the business is connected.</div>
    </div>
  );

  const active = Boolean(premium?.isPremium || listing.isPremium);
  const adminGranted = premium?.status === "admin_granted";
  const cancelling = premium?.status === "cancelling";
  const source = adminGranted ? "STall granted" : premium?.status === "admin_revoked" ? "Revoked" : active ? "Subscription" : "Not active";
  const boostActive = Boolean(boost?.isActive || boost?.active || boost?.status === "active");
  const gbpConnected = Boolean(gbp?.connected || gbp?.isConnected || gbp?.status === "connected" || gbp?.placeId || gbp?.locationId);
  const directActions = stats.calls + stats.whatsapp;
  const region = regionFromLatLng(listing.lat, listing.lng);
  const price = PRICING[region][billingCycle];
  const currency = PRICING[region].symbol;

  async function connectGBP() {
    setError("");
    setGbpWorking(true);
    try {
      const beginGbpOauth = httpsCallable(getFunctions(), "beginGbpOauth");
      const { data } = await beginGbpOauth();
      if (!data?.state) throw new Error("Google connection could not be started. Please try again.");
      const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
      const redirectUri = import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI;
      if (!clientId || !redirectUri) throw new Error("Google connection is not configured in this deployment.");
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/business.manage",
        access_type: "offline",
        prompt: "consent",
        state: data.state,
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } catch (err) {
      console.error("Failed to start GBP connection:", err);
      setError(err?.message || "Unable to start Google Business connection.");
      setGbpWorking(false);
    }
  }

  async function subscribe() {
    setError(""); setWorking(true);
    try {
      const razorpayReady = await loadRazorpayCheckout();
      if (!razorpayReady) throw new Error("Razorpay checkout could not load. Please check your internet connection and try again.");

      const functions = getFunctions();
      const createSubscription = httpsCallable(functions, "createSubscription");
      const { data } = await withTimeout(
        createSubscription({ vendorId: user.uid, vendorName: listing.name || user.displayName || "Vendor", vendorEmail: user.email || "", billingCycle }),
        20000,
        "Premium payment setup timed out. Please try again."
      );
      if (!data?.subscriptionId || !data?.keyId) throw new Error("Payment setup is incomplete. Please try again.");
      if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable. Please refresh and try again.");

      const rzp = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "STALL",
        description: `Stall Premium — ${data.currency === "AED" ? "AED " : "₹"}${(data.amount / 100).toLocaleString("en-IN")}/${billingCycle === "annual" ? "year" : "month"}`,
        image: "/stall-logo.png",
        prefill: { name: user.displayName || listing.name || "", email: user.email || "" },
        theme: { color: COLORS.ink },
        handler: async (response) => {
          try {
            const verifySubscription = httpsCallable(functions, "verifySubscription");
            await withTimeout(
              verifySubscription({ razorpay_payment_id: response.razorpay_payment_id, razorpay_subscription_id: response.razorpay_subscription_id, razorpay_signature: response.razorpay_signature, vendorId: user.uid }),
              20000,
              "Payment verification timed out. Please contact STall support if you were charged."
            );
            setError("");
          } catch (err) { setError(err?.message || "Payment succeeded, but activation could not be verified. Please contact STall support."); }
          finally { setWorking(false); }
        },
        modal: { ondismiss: () => setWorking(false) },
      });
      rzp.on("payment.failed", (response) => { setError(response?.error?.description || "Payment failed. Please try again."); setWorking(false); });
      rzp.open();
    } catch (err) { setError(err?.message || "Unable to start Premium checkout."); setWorking(false); }
  }

  async function cancelSubscription() {
    if (!premium?.subscriptionId) return;
    if (!window.confirm("Cancel Premium at the end of the current billing period?")) return;
    setError(""); setWorking(true);
    try {
      const cancel = httpsCallable(getFunctions(), "cancelSubscription");
      await cancel({ vendorId: user.uid });
    } catch (err) { setError(err?.message || "Unable to cancel Premium right now."); }
    finally { setWorking(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ ...cardStyle, background: COLORS.ink, color: "#fff", border: "none", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800, color: COLORS.marigold }}><Sparkles size={14} /> My Premium</div>
            <div className="font-display" style={{ fontSize: 24, fontWeight: 800, marginTop: 5 }}>{listing.name}</div>
            <div style={{ fontSize: 12.5, opacity: .76, marginTop: 4 }}>Store-specific growth, reputation and visibility tools.</div>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 999, background: active ? `${COLORS.teal}28` : "rgba(255,255,255,.10)", color: active ? "#9ff0d5" : "#fff", fontSize: 11, fontWeight: 900 }}>{premiumLoading ? "CHECKING…" : active ? "PREMIUM ACTIVE" : "PREMIUM NOT ACTIVE"}</div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.16)", fontSize: 11.5, opacity: .82 }}>
          <span>Plan: <strong style={{ color: "#fff" }}>{source}</strong></span>
          <span>Google Business: <strong style={{ color: "#fff" }}>{gbpConnected ? "Connected" : "Not connected"}</strong></span>
          <span>Boost: <strong style={{ color: "#fff" }}>{boostActive ? "Active" : "Not active"}</strong></span>
        </div>
      </section>

      {!active && !premiumLoading && (
        <section style={{ ...cardStyle, background: `${COLORS.marigold}18` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div className="font-display" style={{ fontSize: 20, fontWeight: 800 }}>Turn on Premium for {listing.name}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 5 }}>Automate review responses and unlock the store-growth workspace.</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.ink }}>{currency}{price.toLocaleString("en-IN")}<span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>/{billingCycle === "annual" ? "year" : "month"}</span></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 15, flexWrap: "wrap" }}>
            {["monthly", "annual"].map((cycle) => <button key={cycle} type="button" onClick={() => setBillingCycle(cycle)} style={{ flex: 1, minWidth: 140, padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${COLORS.ink}`, background: billingCycle === cycle ? COLORS.ink : "#fff", color: billingCycle === cycle ? "#fff" : COLORS.ink, fontWeight: 800, cursor: "pointer" }}>{cycle === "monthly" ? `${PRICING[region].symbol}${PRICING[region].monthly}/month` : `${PRICING[region].symbol}${PRICING[region].annual}/year · save ~17%`}</button>)}
          </div>
          <button type="button" onClick={subscribe} disabled={working} style={{ width: "100%", marginTop: 10, padding: "12px 16px", border: "none", borderRadius: 10, background: COLORS.teal, color: "#fff", fontWeight: 900, cursor: working ? "wait" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><CreditCard size={16} />{working ? "Opening secure checkout…" : `Start Premium · ${currency}${price.toLocaleString("en-IN")}`}</button>
          <div style={{ fontSize: 10.5, color: "#777", marginTop: 8 }}>Payment is processed by Razorpay. Pricing is validated again on the server from the store location.</div>
        </section>
      )}

      {active && (
        <section style={{ ...cardStyle, background: "#F7F6F2", border: "1.5px solid #ddd" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div><div className="font-display" style={{ fontSize: 17, fontWeight: 800 }}>Premium membership</div><div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{premium?.currency === "AED" ? "AED " : "₹"}{premium?.amount ? (premium.amount / 100).toLocaleString("en-IN") : "—"}/{premium?.billingCycle === "annual" ? "year" : "month"} · {cancelling ? "Cancellation scheduled" : "Active"}</div></div>
            {!adminGranted && premium?.subscriptionId && !cancelling && <button type="button" onClick={cancelSubscription} disabled={working} style={{ padding: "8px 12px", borderRadius: 9, border: "1.5px solid #E24B4A", background: "#fff", color: "#E24B4A", fontWeight: 800, cursor: "pointer" }}>{working ? "Working…" : "Cancel at period end"}</button>}
          </div>
          {premium?.nextBillingDate && <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>Next billing: {formatDate(premium.nextBillingDate)}</div>}
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <Metric icon={<Eye size={15} />} label="Views" value={stats.views} />
        <Metric icon={<Phone size={15} />} label="Calls" value={stats.calls} />
        <Metric icon={<MessageCircle size={15} />} label="WhatsApp" value={stats.whatsapp} />
        <Metric icon={<Navigation size={15} />} label="Directions" value={stats.directions} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <Module icon={<Star size={18} />} title="Reputation" status={listing.rating != null ? `${Number(listing.rating).toFixed(1)} rating` : "Needs attention"} text={listing.rating != null ? `${Number(listing.ratingsCount || 0).toLocaleString()} ratings are reflected on your listing.` : "Connect Google Business to strengthen customer trust."} />
        <Module icon={<Globe2 size={18} />} title="Google Visibility" status={gbpConnected ? "Connected" : "Action needed"} text={gbpConnected ? "Your Google connection is ready for Premium workflows." : "Connect your Google Business Profile to unlock visibility workflows."} action={!gbpConnected ? <button type="button" onClick={connectGBP} disabled={gbpWorking} style={{ marginTop: 10, padding: "9px 12px", border: "none", borderRadius: 8, background: COLORS.teal, color: "#fff", fontWeight: 800, cursor: gbpWorking ? "wait" : "pointer" }}>{gbpWorking ? "Connecting…" : "Connect with Google"}</button> : null} />
        <Module icon={<Zap size={18} />} title="Store Boost" status={boostActive ? "Boost active" : "Ready"} text={boostActive ? "Your store visibility boost is active." : "Store-specific boosting will be available here when enabled."} />
        <Module icon={<TrendingUp size={18} />} title="Growth" status={`${directActions} direct actions`} text="Calls and WhatsApp actions show whether attention is turning into enquiries." />
      </div>

      <section style={{ ...cardStyle, background: "#F7F6F2", border: "1.5px solid #ddd" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}><ShieldCheck size={17} color={COLORS.teal} /><div className="font-display" style={{ fontSize: 16, fontWeight: 800 }}>Premium health</div></div>
        <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
          <ActionRow done={active} text={active ? "Premium access is active for this store." : "Premium access is not active yet."} />
          <ActionRow done={gbpConnected} text={gbpConnected ? "Google Business connection is available." : "Google Business connection is still pending."} />
          <ActionRow done={boostActive} text={boostActive ? "Store visibility boost is active." : "No store boost is currently active."} />
          <ActionRow done={directActions > 0} text={directActions > 0 ? `${directActions} direct customer actions recorded.` : "Keep improving the listing to generate direct customer actions."} />
        </div>
      </section>

      {error && <div style={{ ...cardStyle, border: "1.5px solid #E24B4A", background: "#FEF3F2", color: "#991B1B", fontSize: 12, fontWeight: 700 }}>{error}</div>}
    </div>
  );
}

function Metric({ icon, label, value }) { return <div style={{ background: "#F7F6F2", borderRadius: 10, padding: "11px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.teal, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>{icon}{label}</div><div style={{ fontSize: 21, fontWeight: 800, color: COLORS.ink, marginTop: 3 }}>{value.toLocaleString()}</div></div>; }
function Module({ icon, title, status, text, action }) { return <section style={{ ...cardStyle, padding: 16 }}><div style={{ width: 34, height: 34, borderRadius: 9, background: COLORS.ink, color: COLORS.marigold, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div><div className="font-display" style={{ fontSize: 15, fontWeight: 800, marginTop: 10 }}>{title}</div><div style={{ fontSize: 10.5, fontWeight: 900, color: COLORS.teal, textTransform: "uppercase", marginTop: 4 }}>{status}</div><div style={{ fontSize: 11.5, color: "#666", lineHeight: 1.5, marginTop: 5 }}>{text}</div>{action}</section>; }
function ActionRow({ done, text }) { return <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.ink }}><CheckCircle2 size={15} color={done ? COLORS.teal : "#aaa"} />{text}</div>; }
function formatDate(value) { const date = value?.toDate ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-IN") : "auto-renewal"; }
