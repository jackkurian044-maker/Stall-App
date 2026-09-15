import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { BarChart2, CheckCircle2, Eye, Globe2, MessageCircle, Navigation, Phone, ShieldCheck, Sparkles, Star, TrendingUp, Zap } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";

const cardStyle = {
  background: "#fff",
  border: `2px solid ${COLORS.ink}`,
  borderRadius: 12,
  padding: 18,
};

export default function VendorPremiumWorkspace({ user, listing }) {
  const [premium, setPremium] = useState(null);
  const [gbp, setGbp] = useState(null);
  const [boost, setBoost] = useState(null);
  const [premiumLoading, setPremiumLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onSnapshot(doc(db, "premium_vendors", user.uid), (snap) => {
      setPremium(snap.exists() ? snap.data() : null);
      setPremiumLoading(false);
    }, () => {
      setPremium(null);
      setPremiumLoading(false);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const q = query(collection(db, "gbp_connections"), where("ownerId", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setGbp(snap.empty ? null : snap.docs[0].data());
    }, () => setGbp(null));
  }, [user?.uid]);

  useEffect(() => {
    if (!listing?.id) {
      setBoost(null);
      return undefined;
    }
    return onSnapshot(doc(db, "vendors", listing.id, "boost", "latest"), (snap) => {
      setBoost(snap.exists() ? snap.data() : null);
    }, () => setBoost(null));
  }, [listing?.id]);

  const stats = useMemo(() => ({
    views: Number(listing?.viewCount || 0),
    calls: Number(listing?.callCount || 0),
    whatsapp: Number(listing?.whatsappCount || 0),
    directions: Number(listing?.directionsCount || 0),
  }), [listing]);

  if (!listing) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: 34 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: COLORS.ink, color: COLORS.marigold, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={22} /></div>
        <div className="font-display" style={{ fontSize: 19, fontWeight: 800, marginTop: 12 }}>Premium starts with your business</div>
        <div style={{ fontSize: 12.5, color: "#666", marginTop: 6, maxWidth: 520, marginInline: "auto" }}>Create or claim your listing first. Once your business is connected, this workspace will show only your store's Premium activity.</div>
      </div>
    );
  }

  const active = Boolean(premium?.isPremium || listing.isPremium);
  const source = premium?.status === "admin_granted" ? "STall granted" : premium?.status === "admin_revoked" ? "Revoked" : active ? "Subscription / Premium" : "Not active";
  const boostActive = Boolean(boost?.isActive || boost?.active || boost?.status === "active");
  const gbpConnected = Boolean(gbp?.connected || gbp?.isConnected || gbp?.status === "connected" || gbp?.placeId || gbp?.locationId);
  const directActions = stats.calls + stats.whatsapp;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ ...cardStyle, background: COLORS.ink, color: "#fff", border: "none", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800, color: COLORS.marigold }}><Sparkles size={14} /> My Premium</div>
            <div className="font-display" style={{ fontSize: 24, fontWeight: 800, marginTop: 5 }}>{listing.name}</div>
            <div style={{ fontSize: 12.5, opacity: .76, marginTop: 4 }}>Your store-specific growth workspace.</div>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 999, background: active ? `${COLORS.teal}28` : "rgba(255,255,255,.10)", color: active ? "#9ff0d5" : "#fff", fontSize: 11, fontWeight: 900 }}>{premiumLoading ? "CHECKING…" : active ? "PREMIUM ACTIVE" : "PREMIUM NOT ACTIVE"}</div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.16)", fontSize: 11.5, opacity: .82 }}>
          <span>Plan status: <strong style={{ color: "#fff" }}>{source}</strong></span>
          <span>Google Business: <strong style={{ color: "#fff" }}>{gbpConnected ? "Connected" : "Not connected"}</strong></span>
          <span>Boost: <strong style={{ color: "#fff" }}>{boostActive ? "Active" : "Not active"}</strong></span>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <Metric icon={<Eye size={15} />} label="Views" value={stats.views} />
        <Metric icon={<Phone size={15} />} label="Calls" value={stats.calls} />
        <Metric icon={<MessageCircle size={15} />} label="WhatsApp" value={stats.whatsapp} />
        <Metric icon={<Navigation size={15} />} label="Directions" value={stats.directions} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <Module icon={<Star size={18} />} title="Reputation" status={listing.rating != null ? `${Number(listing.rating).toFixed(1)} rating` : "Needs attention"} text={listing.rating != null ? `${Number(listing.ratingsCount || 0).toLocaleString()} Google ratings are reflected on your listing.` : "Connect your Google Business information to strengthen customer trust."} />
        <Module icon={<Globe2 size={18} />} title="Google Visibility" status={gbpConnected ? "Connected" : "Connect Google"} text={gbpConnected ? "Your Google connection is available to the STall growth system." : "Connect your Google Business Profile to unlock visibility workflows."} />
        <Module icon={<Zap size={18} />} title="Store Boost" status={boostActive ? "Boost active" : "Ready"} text={boostActive ? "Your store currently has a visibility boost running." : "Store-specific boosting will appear here when enabled for your business."} />
        <Module icon={<TrendingUp size={18} />} title="Growth" status={`${directActions} direct actions`} text="Calls and WhatsApp actions are the clearest signals that your listing is turning attention into enquiries." />
      </div>

      <section style={{ ...cardStyle, background: "#F7F6F2", border: "1.5px solid #ddd" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}><ShieldCheck size={17} color={COLORS.teal} /><div className="font-display" style={{ fontSize: 16, fontWeight: 800 }}>What Premium is doing for your store</div></div>
        <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
          <ActionRow done={active} text={active ? "Premium access is active for this store." : "Premium access is not active yet."} />
          <ActionRow done={gbpConnected} text={gbpConnected ? "Google Business connection is available." : "Google Business connection is still pending."} />
          <ActionRow done={boostActive} text={boostActive ? "Store visibility boost is active." : "No store boost is currently active."} />
          <ActionRow done={directActions > 0} text={directActions > 0 ? `${directActions} direct customer actions recorded.` : "Keep improving your listing to generate direct customer actions."} />
        </div>
      </section>

      {!active && (
        <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", background: `${COLORS.marigold}22` }}>
          <div><div style={{ fontWeight: 800, color: COLORS.ink }}>Premium is ready for this business</div><div style={{ fontSize: 11.5, color: "#666", marginTop: 3 }}>Plan activation and payment will be connected here without changing your listing data.</div></div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#8a6b3e" }}>ACTIVATION NEXT</span>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value }) {
  return <div style={{ background: "#F7F6F2", borderRadius: 10, padding: "11px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.teal, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>{icon}{label}</div><div style={{ fontSize: 21, fontWeight: 800, color: COLORS.ink, marginTop: 3 }}>{value.toLocaleString()}</div></div>;
}

function Module({ icon, title, status, text }) {
  return <section style={{ ...cardStyle, padding: 16 }}><div style={{ width: 34, height: 34, borderRadius: 9, background: COLORS.ink, color: COLORS.marigold, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div><div className="font-display" style={{ fontSize: 15, fontWeight: 800, marginTop: 10 }}>{title}</div><div style={{ fontSize: 10.5, fontWeight: 900, color: COLORS.teal, textTransform: "uppercase", marginTop: 4 }}>{status}</div><div style={{ fontSize: 11.5, color: "#666", lineHeight: 1.5, marginTop: 5 }}>{text}</div></section>;
}

function ActionRow({ done, text }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.ink }}><CheckCircle2 size={15} color={done ? COLORS.teal : "#aaa"} />{text}</div>;
}
