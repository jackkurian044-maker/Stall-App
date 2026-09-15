import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { BarChart2, Eye, MessageCircle, Navigation, Phone, Plus, Zap } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";
import VendorDashboard from "./VendorDashboard";

export default function VendorDashboardHome({ user, agent }) {
  const [listings, setListings] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "vendors"), where("ownerId", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setListings([]));
  }, [user.uid]);

  const totals = listings.reduce((acc, l) => ({
    views: acc.views + Number(l.viewCount || 0),
    calls: acc.calls + Number(l.callCount || 0),
    whatsapp: acc.whatsapp + Number(l.whatsappCount || 0),
    directions: acc.directions + Number(l.directionsCount || 0),
  }), { views: 0, calls: 0, whatsapp: 0, directions: 0 });

  const leads = totals.calls + totals.whatsapp;
  const primary = listings[0];
  const profileChecks = primary ? [
    !!primary.name,
    !!primary.description,
    !!primary.phone,
    Array.isArray(primary.photos) && primary.photos.length > 0,
    !!primary.hours,
  ] : [];
  const profileScore = profileChecks.length ? Math.round((profileChecks.filter(Boolean).length / profileChecks.length) * 100) : 0;

  const scrollToWorkspace = () => {
    document.getElementById("vendor-dashboard-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 20px 0" }}>
        <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 14, padding: 18, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, color: COLORS.teal, marginBottom: 5 }}>Vendor Command Center</div>
              <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: COLORS.ink }}>Grow your business on STall</div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                {listings.length ? "Your business is live. Here’s what customers are doing with it." : "Get your business live and start reaching customers nearby."}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, background: listings.length ? `${COLORS.teal}15` : "#f4f1ea", color: listings.length ? COLORS.teal : "#666", fontSize: 12, fontWeight: 800 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: listings.length ? COLORS.green : "#999" }} />
              {listings.length ? "LIVE ON STALL" : "NOT LIVE YET"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 18 }}>
            <SummaryTile icon={<Eye size={16} />} value={totals.views} label="Views" />
            <SummaryTile icon={<Phone size={16} />} value={totals.calls} label="Calls" />
            <SummaryTile icon={<MessageCircle size={16} />} value={totals.whatsapp} label="WhatsApp" />
            <SummaryTile icon={<Navigation size={16} />} value={totals.directions} label="Directions" />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
            <button onClick={scrollToWorkspace} className="stall-btn" style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> {listings.length ? "Manage my listing" : "Add my business"}
            </button>
            {primary && (
              <button onClick={scrollToWorkspace} className="stall-btn" style={{ background: COLORS.marigold, color: COLORS.ink, border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                <Zap size={14} /> Create an offer
              </button>
            )}
            <button onClick={scrollToWorkspace} className="stall-btn" style={{ background: "#fff", color: COLORS.ink, border: `1.5px solid ${COLORS.ink}`, borderRadius: 8, padding: "10px 14px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <BarChart2 size={14} /> View insights
            </button>
            <div style={{ marginLeft: "auto", fontSize: 11.5, color: "#666" }}>
              {listings.length ? `${leads} direct leads · ${listings.length} listing${listings.length === 1 ? "" : "s"}` : "One listing is all you need to get started."}
            </div>
          </div>

          {primary && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e5e1d8", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.ink }}>Profile strength</div>
              <div style={{ flex: "1 1 180px", maxWidth: 300, height: 7, background: "#ece8df", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${profileScore}%`, height: "100%", background: profileScore >= 80 ? COLORS.green : COLORS.marigold, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: profileScore >= 80 ? COLORS.green : "#8a6b3e" }}>{profileScore}% complete</div>
              {profileScore < 100 && <div style={{ fontSize: 11.5, color: "#666" }}>Add missing details to make your listing stronger.</div>}
            </div>
          )}
        </div>
      </div>

      <div id="vendor-dashboard-workspace" style={{ scrollMarginTop: 90 }}>
        <VendorDashboard user={user} agent={agent} />
      </div>
    </div>
  );
}

function SummaryTile({ icon, value, label }) {
  return (
    <div style={{ background: "#f7f6f2", borderRadius: 10, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ color: COLORS.teal, display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>{icon}{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: COLORS.ink, marginTop: 3 }}>{value.toLocaleString()}</div>
    </div>
  );
}
