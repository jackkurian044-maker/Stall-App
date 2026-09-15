import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Activity, AlertTriangle, CheckCircle2, Crown, ExternalLink, RefreshCw, Search, Store, Users, XCircle } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";

const cardStyle = {
  background: "#151515",
  border: "1px solid #2d2d2d",
  borderRadius: 12,
  padding: 16,
};

const statusTone = (status) => {
  if (status === "healthy" || status === "active") return { bg: "#15351f", color: "#8fe3a5" };
  if (status === "attention") return { bg: "#3b2d12", color: "#ffd36a" };
  return { bg: "#31191b", color: "#ff9b9f" };
};

function HealthBadge({ status, label }) {
  const tone = statusTone(status);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 11, fontWeight: 700 }}>
      {status === "healthy" || status === "active" ? <CheckCircle2 size={12} /> : status === "attention" ? <AlertTriangle size={12} /> : <XCircle size={12} />}
      {label || status}
    </span>
  );
}

function getHealth(v, premium, gbp) {
  let score = 0;
  if (v.name) score += 10;
  if (v.category) score += 10;
  if (v.description) score += 10;
  if (v.address && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng))) score += 15;
  if (v.phone) score += 10;
  if ((v.photos || []).length > 0) score += 10;
  if (v.offer) score += 5;
  if (v.ownerId) score += 15;
  if (premium?.isPremium) score += 5;
  if (gbp?.connected) score += 10;
  return Math.min(100, score);
}

export default function AdminOperationsCentre() {
  const [vendors, setVendors] = useState([]);
  const [premium, setPremium] = useState({});
  const [gbp, setGbp] = useState({});
  const [agents, setAgents] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vendors"), (snap) => {
      setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [refreshKey]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "premium_vendors"), (snap) => {
      const next = {};
      snap.docs.forEach((d) => { next[d.id] = d.data(); });
      setPremium(next);
    }, () => setPremium({}));
    return unsub;
  }, [refreshKey]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "gbp_connections"), (snap) => {
      const next = {};
      snap.docs.forEach((d) => { next[d.id] = d.data(); });
      setGbp(next);
    }, () => setGbp({}));
    return unsub;
  }, [refreshKey]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => setAgents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setAgents([]));
    return unsub;
  }, [refreshKey]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "commissions"), (snap) => setCommissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setCommissions([]));
    return unsub;
  }, [refreshKey]);

  const commissionByVendor = useMemo(() => {
    const map = {};
    commissions.forEach((c) => { if (c.vendorId) map[c.vendorId] = c; });
    return map;
  }, [commissions]);

  const agentById = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents]);

  const rows = useMemo(() => vendors.map((v) => {
    const p = v.ownerId ? premium[v.ownerId] : null;
    const g = v.ownerId ? gbp[v.ownerId] : null;
    const score = getHealth(v, p, g);
    const health = score >= 80 ? "healthy" : score >= 55 ? "attention" : "critical";
    return { v, p, g, score, health, commission: commissionByVendor[v.id] || null, agent: v.addedByAgentId ? agentById[v.addedByAgentId] : null };
  }), [vendors, premium, gbp, commissionByVendor, agentById]);

  const counts = useMemo(() => ({
    total: rows.length,
    claimed: rows.filter((r) => !!r.v.ownerId).length,
    premium: rows.filter((r) => !!r.p?.isPremium).length,
    healthy: rows.filter((r) => r.health === "healthy").length,
    attention: rows.filter((r) => r.health === "attention").length,
    critical: rows.filter((r) => r.health === "critical").length,
    gbp: rows.filter((r) => !!r.g?.connected).length,
  }), [rows]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "claimed" && !r.v.ownerId) return false;
      if (filter === "unclaimed" && r.v.ownerId) return false;
      if (filter === "premium" && !r.p?.isPremium) return false;
      if (filter === "attention" && r.health === "healthy") return false;
      if (filter === "gbp" && !r.g?.connected) return false;
      if (!q) return true;
      return [r.v.name, r.v.category, r.v.address, r.v.phone, r.v.claimCode].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [rows, filter, search]);

  const selected = rows.find((r) => r.v.id === selectedId) || null;

  return (
    <div style={{ maxWidth: 1440, margin: "0 auto", padding: 22, color: "#f4f4f4" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ color: COLORS.marigold, fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>STall Admin</div>
          <h1 style={{ margin: "4px 0", fontSize: 28 }}>Operations & Store Intelligence</h1>
          <div style={{ color: "#999", fontSize: 13 }}>Overall store picture, workspace health and actionable attention — based on live Firestore state.</div>
        </div>
        <button onClick={() => setRefreshKey((x) => x + 1)} className="stall-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 13px" }}>
          <RefreshCw size={14} /> Refresh listeners
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 18 }}>
        {[
          ["Stores", counts.total, Store],
          ["Claimed", counts.claimed, CheckCircle2],
          ["Premium", counts.premium, Crown],
          ["Healthy", counts.healthy, Activity],
          ["Attention", counts.attention + counts.critical, AlertTriangle],
          ["GBP connected", counts.gbp, ExternalLink],
        ].map(([label, value, Icon]) => (
          <div key={label} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}><span>{label}</span><Icon size={15} /></div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 7 }}>{loading ? "…" : value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "minmax(0,1fr) minmax(320px,420px)" : "1fr", gap: 14 }}>
        <div style={cardStyle}>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ position: "relative", flex: "1 1 240px" }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "#777" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search store, category, phone, claim ID…" style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px 9px 32px", background: "#0d0d0d", color: "#fff", border: "1px solid #333", borderRadius: 8 }} />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ minWidth: 160, padding: "9px 10px", background: "#0d0d0d", color: "#fff", border: "1px solid #333", borderRadius: 8 }}>
              <option value="all">All stores</option>
              <option value="claimed">Claimed</option>
              <option value="unclaimed">Unclaimed</option>
              <option value="premium">Premium</option>
              <option value="attention">Needs attention</option>
              <option value="gbp">GBP connected</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {visibleRows.map((r) => (
              <button key={r.v.id} onClick={() => setSelectedId(r.v.id)} style={{ textAlign: "left", width: "100%", background: selectedId === r.v.id ? "#222" : "#101010", color: "#fff", border: `1px solid ${selectedId === r.v.id ? COLORS.marigold : "#292929"}`, borderRadius: 9, padding: 12, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{r.v.name || "Unnamed store"}</div>
                    <div style={{ color: "#999", fontSize: 11, marginTop: 3 }}>{r.v.category || "—"} · {r.v.ownerId ? "Claimed" : "Unclaimed"}{r.agent ? ` · Agent: ${r.agent.name || r.v.addedByAgentId}` : ""}</div>
                  </div>
                  <HealthBadge status={r.health} label={`${r.score}/100`} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
                  <HealthBadge status={r.p?.isPremium ? "active" : "inactive"} label={r.p?.isPremium ? "Premium" : "Free"} />
                  <HealthBadge status={r.g?.connected ? "active" : "inactive"} label={r.g?.connected ? "GBP connected" : "GBP not connected"} />
                  {r.commission?.status && <HealthBadge status={r.commission.status === "paid" ? "active" : "attention"} label={`Commission: ${r.commission.status}`} />}
                </div>
              </button>
            ))}
            {!loading && visibleRows.length === 0 && <div style={{ padding: 28, textAlign: "center", color: "#888" }}>No stores match this filter.</div>}
          </div>
        </div>

        {selected && (
          <div style={{ ...cardStyle, alignSelf: "start", position: "sticky", top: 86 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ color: COLORS.marigold, fontSize: 10, textTransform: "uppercase", fontWeight: 800 }}>Workspace</div>
                <h2 style={{ margin: "4px 0 2px", fontSize: 21 }}>{selected.v.name}</h2>
                <div style={{ color: "#999", fontSize: 12 }}>{selected.v.address || "Address not recorded"}</div>
              </div>
              <button onClick={() => setSelectedId(null)} style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer" }}>×</button>
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={cardStyle}><div style={{ color: "#999", fontSize: 10 }}>HEALTH</div><strong style={{ fontSize: 22 }}>{selected.score}/100</strong></div>
              <div style={cardStyle}><div style={{ color: "#999", fontSize: 10 }}>OWNER</div><strong style={{ fontSize: 12 }}>{selected.v.ownerId ? "Claimed" : "Unclaimed"}</strong></div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <HealthBadge status={selected.p?.isPremium ? "active" : "inactive"} label={selected.p?.isPremium ? `Premium · ${selected.p.status || "active"}` : "Premium not active"} />
              <HealthBadge status={selected.g?.connected ? "active" : "attention"} label={selected.g?.connected ? "Google Business Profile connected" : "Google Business Profile needs connection"} />
              <HealthBadge status={selected.v.phone ? "active" : "attention"} label={selected.v.phone ? "Business phone recorded" : "Business phone missing"} />
              <HealthBadge status={(selected.v.photos || []).length ? "active" : "attention"} label={(selected.v.photos || []).length ? `${selected.v.photos.length} photos recorded` : "No photos recorded"} />
              <HealthBadge status={selected.v.offer ? "active" : "attention"} label={selected.v.offer ? "Offer is active" : "No current offer"} />
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #2b2b2b", display: "grid", gap: 8, fontSize: 12 }}>
              <div><span style={{ color: "#888" }}>Claim ID:</span> {selected.v.claimCode || "—"}</div>
              <div><span style={{ color: "#888" }}>Owner ID:</span> {selected.v.ownerId || "—"}</div>
              <div><span style={{ color: "#888" }}>Agent:</span> {selected.agent?.name || selected.v.addedByAgentId || "—"}</div>
              <div><span style={{ color: "#888" }}>Commission:</span> {selected.commission?.status || "—"}</div>
              <div><span style={{ color: "#888" }}>Premium updated:</span> {selected.p?.updatedAt?.toDate?.()?.toLocaleString?.() || "—"}</div>
            </div>

            <div style={{ marginTop: 15, padding: 11, background: "#0d0d0d", borderRadius: 9, border: "1px solid #292929" }}>
              <div style={{ fontSize: 10, color: COLORS.marigold, fontWeight: 800, textTransform: "uppercase", marginBottom: 5 }}>Next action</div>
              <div style={{ fontSize: 12, color: "#ddd" }}>
                {selected.health === "healthy" ? "Workspace is healthy. Continue monitoring activity and Premium value." : selected.g?.connected ? "Review the highlighted profile/engagement gaps and improve the store workspace." : "Connect Google Business Profile, then validate review and visibility workflows."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
