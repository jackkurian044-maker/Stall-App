import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { BarChart2, Eye, MessageCircle, Navigation, Phone, Plus, Zap, CheckCircle2, AlertCircle, Crown } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";
import VendorDashboard from "./VendorDashboard";

export default function VendorDashboardHomeV2({ user, agent }) {
  const [listings, setListings] = useState([]);
  const [premium, setPremium] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "vendors"), where("ownerId", "==", user.uid));
    return onSnapshot(q, (snap) => setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [user.uid]);

  useEffect(() => {
    return onSnapshot(doc(db, "premium_vendors", user.uid), (snap) => setPremium(snap.exists() ? snap.data() : null), () => setPremium(null));
  }, [user.uid]);

  const totals = listings.reduce((acc, l) => ({
    views: acc.views + Number(l.viewCount || 0),
    calls: acc.calls + Number(l.callCount || 0),
    whatsapp: acc.whatsapp + Number(l.whatsappCount || 0),
    directions: acc.directions + Number(l.directionsCount || 0),
  }), { views: 0, calls: 0, whatsapp: 0, directions: 0 });

  const leads = totals.calls + totals.whatsapp;
  const primary = listings[0];
  const profileChecks = primary ? [!!primary.name, !!primary.description, !!primary.phone, Array.isArray(primary.photos) && primary.photos.length > 0, !!primary.hours] : [];
  const profileScore = profileChecks.length ? Math.round((profileChecks.filter(Boolean).length / profileChecks.length) * 100) : 0;
  const attention = primary ? [
    !primary.description && "Add a business description",
    !primary.phone && "Add a phone number",
    !(Array.isArray(primary.photos) && primary.photos.length) && "Add business photos",
    !primary.hours && "Add business hours",
    !primary.offer && "Create a current offer",
  ].filter(Boolean) : [];

  const scrollToWorkspace = () => document.getElementById("vendor-dashboard-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div style={{ width: "100%", background: COLORS.paper, minHeight: "100%" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 20px 8px" }}>
        <section style={{ background: COLORS.ink, color: "#fff", borderRadius: 16, padding: "22px", boxShadow: "0 10px 30px rgba(0,0,0,.14)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 800, color: COLORS.marigold }}>My Dashboard</div>
              <div className="font-display" style={{ fontSize: "clamp(24px,4vw,32px)", fontWeight: 800, marginTop: 4 }}>Grow your business on STall</div>
              <div style={{ color: "#d6dde2", fontSize: 13, marginTop: 5 }}>{primary?.name ? `${primary.name} is your active business workspace.` : "Set up your business and start reaching customers nearby."}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, background: listings.length ? "rgba(47,158,68,.18)" : "rgba(255,255,255,.1)", color: listings.length ? "#8fe3a0" : "#d6dde2", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: listings.length ? COLORS.green : "#9aa4ad" }} />
              {listings.length ? "LIVE ON STALL" : "NOT LIVE YET"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 10, marginTop: 20 }}>
            <Metric icon={<Eye size={16} />} value={totals.views} label="Views" />
            <Metric icon={<Phone size={16} />} value={totals.calls} label="Calls" />
            <Metric icon={<MessageCircle size={16} />} value={totals.whatsapp} label="WhatsApp" />
            <Metric icon={<Navigation size={16} />} value={totals.directions} label="Directions" />
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginTop: 12 }}>
          <section style={panel}>
            <div style={sectionTitle}><span>Business health</span><strong>{profileScore}%</strong></div>
            <div style={progressTrack}><div style={{ ...progressFill, width: `${profileScore}%`, background: profileScore >= 80 ? COLORS.green : COLORS.marigold }} /></div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>{profileScore >= 100 ? "Your core business profile is complete." : "Complete the basics so customers have more reasons to contact you."}</div>
          </section>

          <section style={{ ...panel, border: `2px solid ${premium?.isPremium ? COLORS.marigold : COLORS.ink}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Crown size={18} color={premium?.isPremium ? COLORS.marigold : COLORS.ink} /><div><div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "#666" }}>STall Premium</div><div style={{ fontSize: 17, fontWeight: 800, color: COLORS.ink, marginTop: 2 }}>{premium?.isPremium ? "Premium is active" : "Unlock your growth workspace"}</div></div></div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>{premium?.isPremium ? "Your Premium tools will be focused on this business." : "Reviews, visibility, boosting and performance will live here."}</div>
            <button onClick={scrollToWorkspace} className="stall-btn" style={{ marginTop: 10, background: premium?.isPremium ? COLORS.ink : COLORS.marigold, color: premium?.isPremium ? "#fff" : COLORS.ink, border: "none", borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 800 }}><Zap size={14} /> Open Premium</button>
          </section>
        </div>

        {primary && attention.length > 0 && (
          <section style={{ ...panel, marginTop: 12 }}>
            <div style={sectionTitle}><span>What needs attention?</span><span style={{ fontSize: 11, color: "#777", fontWeight: 600 }}>{attention.length} action{attention.length === 1 ? "" : "s"}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8, marginTop: 10 }}>
              {attention.map((item) => <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: "#faf7ef", borderRadius: 8, fontSize: 12, color: COLORS.ink }}><AlertCircle size={15} color={COLORS.marigold} />{item}</div>)}
            </div>
          </section>
        )}

        {primary && attention.length === 0 && (
          <div style={{ marginTop: 12, padding: "11px 13px", background: "#fff", border: "1px solid #ddd7ca", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.green, fontWeight: 700 }}><CheckCircle2 size={16} /> Your core listing details are in good shape.</div>
        )}

        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 12 }}>
          <Action onClick={scrollToWorkspace} dark icon={<Plus size={14} />} text={listings.length ? "Manage my listing" : "Add my business"} />
          {primary && <Action onClick={scrollToWorkspace} icon={<Zap size={14} />} text="Create an offer" />}
          <Action onClick={scrollToWorkspace} outline icon={<BarChart2 size={14} />} text="View insights" />
          <div style={{ marginLeft: "auto", alignSelf: "center", fontSize: 11.5, color: "#666" }}>{listings.length ? `${leads} direct leads · ${listings.length} listing${listings.length === 1 ? "" : "s"}` : "One listing is all you need to get started."}</div>
        </div>
      </div>

      <div id="vendor-dashboard-workspace" style={{ scrollMarginTop: 90 }}><VendorDashboard user={user} agent={agent} /></div>
    </div>
  );
}

const panel = { background: "#fff", border: "2px solid #17222c", borderRadius: 13, padding: 15 };
const progressTrack = { height: 8, background: "#ece8df", borderRadius: 99, overflow: "hidden", marginTop: 10 };
const progressFill = { height: "100%", borderRadius: 99 };
const sectionTitle = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 800, color: COLORS.ink };

function Metric({ icon, value, label }) { return <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 10, padding: "11px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 6, color: "#d8e0e5", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>{icon}{label}</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 3 }}>{value.toLocaleString()}</div></div>; }
function Action({ onClick, icon, text, dark, outline }) { return <button onClick={onClick} className="stall-btn" style={{ background: dark ? COLORS.ink : outline ? "#fff" : COLORS.marigold, color: dark ? "#fff" : COLORS.ink, border: outline ? `1.5px solid ${COLORS.ink}` : "none", borderRadius: 8, padding: "10px 13px", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>{icon}{text}</button>; }
