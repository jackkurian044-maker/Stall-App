import React, { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Megaphone, MapPin, WalletCards, PauseCircle, CheckCircle2 } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";

const OBJECTIVES = [
  ["discovery", "More local discovery"],
  ["whatsapp", "More WhatsApp enquiries"],
  ["calls", "More calls"],
  ["offer", "Promote my offer"],
];

export default function BoostCampaignPanel({ user, listing }) {
  const [objective, setObjective] = useState("discovery");
  const [budget, setBudget] = useState("500");
  const [days, setDays] = useState("7");
  const [radius, setRadius] = useState("5");
  const [campaigns, setCampaigns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const functions = getFunctions();

  useEffect(() => {
    if (!listing?.id) return undefined;
    const q = query(collection(db, "vendors", listing.id, "boostCampaigns"), orderBy("createdAt", "desc"), limit(5));
    return onSnapshot(q, (snap) => setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [listing?.id]);

  const daily = useMemo(() => {
    const b = Number(budget);
    const d = Math.max(1, Number(days));
    return Number.isFinite(b) ? b / d : 0;
  }, [budget, days]);

  const startBoost = async () => {
    if (!listing?.id) return;
    setMessage("");
    const total = Number(budget);
    const duration = Number(days);
    const radiusKm = Number(radius);
    if (!Number.isFinite(total) || total <= 0) return setMessage("Enter a valid Boost budget.");
    if (!Number.isFinite(duration) || duration < 1) return setMessage("Enter a valid duration.");
    if (!Number.isFinite(radiusKm) || radiusKm < 1) return setMessage("Enter a valid radius.");

    setBusy(true);
    try {
      const createOrder = httpsCallable(functions, "createBoostOrder");
      const result = await createOrder({ businessId: listing.id, objective, totalBudgetRupees: total, durationDays: duration, radiusKm });
      const { campaignId, orderId, keyId, amount, currency } = result.data;
      if (!window.Razorpay) throw new Error("Razorpay Checkout is not available on this page.");

      const verify = httpsCallable(functions, "verifyBoostPayment");
      const checkout = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "STall",
        description: `Boost — ${listing.name}`,
        order_id: orderId,
        prefill: { name: user?.displayName || "", email: user?.email || "" },
        notes: { businessId: listing.id, campaignId },
        handler: async (response) => {
          try {
            await verify({ businessId: listing.id, campaignId, razorpay_payment_id: response.razorpay_payment_id, razorpay_order_id: response.razorpay_order_id, razorpay_signature: response.razorpay_signature });
            setMessage("Boost is active. STall will now give this business additional local discovery exposure.");
          } catch (err) {
            setMessage(err.message || "Payment completed but Boost activation could not be verified.");
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: "#f0b429" },
      });
      checkout.open();
    } catch (err) {
      setBusy(false);
      setMessage(err.message || "Couldn't start Boost.");
    }
  };

  const pause = async (campaignId) => {
    setBusy(true);
    setMessage("");
    try {
      const fn = httpsCallable(functions, "pauseBoostCampaign");
      await fn({ businessId: listing.id, campaignId });
      setMessage("Boost paused.");
    } catch (err) {
      setMessage(err.message || "Couldn't pause Boost.");
    } finally {
      setBusy(false);
    }
  };

  if (!listing) return null;

  return (
    <section style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <Megaphone size={17} color={COLORS.marigold} />
        <div className="font-display" style={{ fontSize: 19, fontWeight: 800 }}>Boost your business</div>
      </div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 15 }}>Boost increases relevant local exposure. Every resulting profile view, call or WhatsApp action stays in the same STall analytics and Lead Engine.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <label style={labelStyle}>Objective<select value={objective} onChange={(e) => setObjective(e.target.value)} style={inputStyle}>{OBJECTIVES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label style={labelStyle}>Total budget (₹)<input type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Duration (days)<input type="number" min="1" max="30" value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Local radius (km)<input type="number" min="1" max="50" value={radius} onChange={(e) => setRadius(e.target.value)} style={inputStyle} /></label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f7f5ef", borderRadius: 9, padding: 10, marginTop: 12, fontSize: 11.5 }}><MapPin size={14} color={COLORS.teal} /> Approx. ₹{daily.toFixed(2)}/day · targeted around this business</div>
      <button disabled={busy} onClick={startBoost} className="stall-btn" style={{ marginTop: 12, width: "100%", background: COLORS.marigold, color: COLORS.ink, border: "none", borderRadius: 8, padding: 11, fontWeight: 800, fontSize: 13, display: "flex", justifyContent: "center", alignItems: "center", gap: 7 }}><WalletCards size={15} /> {busy ? "Opening payment…" : `Pay ₹${Number(budget || 0).toLocaleString("en-IN")} & Start Boost`}</button>
      {message && <div style={{ marginTop: 9, fontSize: 11.5, color: message.toLowerCase().includes("active") ? COLORS.teal : COLORS.brick }}>{message}</div>}

      {campaigns.length > 0 && <div style={{ marginTop: 18, borderTop: "1px solid #e7e2d8", paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "#777", marginBottom: 8 }}>Recent Boost campaigns</div>
        {campaigns.map((campaign) => <div key={campaign.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid #eee", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800 }}>{OBJECTIVES.find(([v]) => v === campaign.objective)?.[1] || campaign.objective}</div>
            <div style={{ fontSize: 10.5, color: "#777", marginTop: 2 }}>₹{((campaign.totalBudgetPaise || 0) / 100).toLocaleString("en-IN")} · {campaign.durationDays} days · {campaign.radiusKm} km</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 999, background: campaign.status === "active" ? `${COLORS.teal}18` : "#f2f2f2", color: campaign.status === "active" ? COLORS.teal : "#666", fontSize: 10.5, fontWeight: 800 }}><CheckCircle2 size={11} /> {campaign.status}</span>
            {campaign.status === "active" && <button disabled={busy} onClick={() => pause(campaign.id)} style={{ border: `1px solid ${COLORS.ink}`, background: "#fff", borderRadius: 7, padding: "5px 8px", fontSize: 10.5, fontWeight: 700 }}><PauseCircle size={11} /> Pause</button>}
          </div>
        </div>)}
      </div>}
    </section>
  );
}

const labelStyle = { display: "flex", flexDirection: "column", gap: 5, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "8px 9px", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, fontSize: 12.5, background: "#fff" };
