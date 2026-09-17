import React, { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Filter, Phone, Mail, MessageCircle, RefreshCw, UserRound } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";

const STATUS = ["new", "contacted", "qualified", "converted", "lost"];
const SOURCE_LABELS = {
  GOOGLE_ADS: "Google Ads",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  STALL_BOOST: "STall Boost",
  STALL_ORGANIC: "STall Organic",
  WEBSITE: "Website",
  MANUAL: "Manual",
  OTHER: "Other",
};

export default function LeadEnginePanel({ listings = [] }) {
  const [leadsByBusiness, setLeadsByBusiness] = useState({});
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const functions = getFunctions();

  useEffect(() => {
    const unsubs = listings.map((listing) => {
      const q = query(
        collection(db, "vendors", listing.id, "leads"),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      return onSnapshot(q, (snap) => {
        setLeadsByBusiness((prev) => ({
          ...prev,
          [listing.id]: snap.docs.map((d) => ({ id: d.id, ...d.data(), businessId: listing.id, businessName: listing.name })),
        }));
      }, () => {
        setLeadsByBusiness((prev) => ({ ...prev, [listing.id]: [] }));
      });
    });
    return () => unsubs.forEach((unsub) => unsub());
  }, [listings]);

  const leads = useMemo(() => Object.values(leadsByBusiness).flat().sort((a, b) => {
    const at = a.createdAt?.toMillis?.() || 0;
    const bt = b.createdAt?.toMillis?.() || 0;
    return bt - at;
  }), [leadsByBusiness]);

  const visible = filter === "all" ? leads : leads.filter((lead) => lead.status === filter);

  const updateStatus = async (lead, status) => {
    setBusyId(lead.id);
    try {
      const fn = httpsCallable(functions, "updateLeadStatus");
      await fn({ businessId: lead.businessId, leadId: lead.id, status });
    } catch (err) {
      window.alert(err.message || "Couldn't update this lead.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ background: COLORS.ink, color: "#fff", borderRadius: 14, padding: 20 }}>
        <div style={{ color: COLORS.marigold, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>STall Lead Engine</div>
        <div className="font-display" style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>One pipeline for every lead source</div>
        <div style={{ color: "#cfcfcf", fontSize: 12.5, marginTop: 5 }}>Google · Facebook · Instagram · WhatsApp · STall Boost · Website · Manual</div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        {[
          ["All", leads.length, "all"],
          ["New", leads.filter((l) => l.status === "new").length, "new"],
          ["Qualified", leads.filter((l) => l.status === "qualified").length, "qualified"],
          ["Converted", leads.filter((l) => l.status === "converted").length, "converted"],
        ].map(([label, value, key]) => (
          <button key={key} onClick={() => setFilter(key)} style={{ textAlign: "left", background: filter === key ? COLORS.marigold : "#fff", color: COLORS.ink, border: `2px solid ${COLORS.ink}`, borderRadius: 10, padding: 12, cursor: "pointer" }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 23, fontWeight: 800, marginTop: 2 }}>{value}</div>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div style={{ background: "#fff", border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: 32, textAlign: "center", color: "#666", fontSize: 13 }}>
          No leads in this view yet. Once a connected source sends a lead, it will appear here automatically.
        </div>
      ) : visible.map((lead) => (
        <article key={`${lead.businessId}:${lead.id}`} style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 15 }}>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                <UserRound size={15} color={COLORS.teal} />
                <strong style={{ fontSize: 15 }}>{lead.name || "New prospect"}</strong>
                <span style={{ background: `${COLORS.teal}18`, color: COLORS.teal, borderRadius: 999, padding: "3px 8px", fontSize: 10.5, fontWeight: 800 }}>{SOURCE_LABELS[lead.source] || lead.source || "Other"}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "#777", marginTop: 5 }}>{lead.businessName}</div>
            </div>
            <select value={lead.status || "new"} disabled={busyId === lead.id} onChange={(e) => updateStatus(lead, e.target.value)} style={{ border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, fontWeight: 700 }}>
              {STATUS.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {lead.phone && <a href={`tel:${lead.phone}`} style={actionStyle}><Phone size={13} /> {lead.phone}</a>}
            {lead.email && <a href={`mailto:${lead.email}`} style={actionStyle}><Mail size={13} /> {lead.email}</a>}
            {lead.phone && <a href={`https://wa.me/${String(lead.phone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={actionStyle}><MessageCircle size={13} /> WhatsApp</a>}
          </div>
          {(lead.campaignId || lead.boostCampaignId || lead.gclid) && (
            <div style={{ fontSize: 10.5, color: "#777", marginTop: 10 }}>
              {lead.campaignId && `Campaign ${lead.campaignId} · `}{lead.boostCampaignId && `Boost ${lead.boostCampaignId} · `}{lead.gclid && `GCLID captured`}
            </div>
          )}
        </article>
      ))}

      <div style={{ fontSize: 10.5, color: "#888", display: "flex", alignItems: "center", gap: 5 }}><RefreshCw size={11} /> Lead records are live from Firestore; source attribution is stored with each lead.</div>
    </div>
  );
}

const actionStyle = { display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #ddd", borderRadius: 7, padding: "6px 8px", color: COLORS.ink, textDecoration: "none", fontSize: 11.5, fontWeight: 700, background: "#fafafa" };
