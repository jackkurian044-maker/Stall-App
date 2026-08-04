import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { UserPlus, Loader2, Check, Ban, IndianRupee, AlertTriangle } from "lucide-react";
import { db, auth } from "./firebase";
import { COLORS } from "./constants";

const emptyForm = { name: "", email: "", password: "", monthlyTarget: 20, commissionAmount: 100 };

export default function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [premiumMap, setPremiumMap] = useState({}); // ownerId -> isPremium (live, current truth)
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => setAgents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vendors"), (snap) => setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "commissions"), (snap) => setCommissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "premium_vendors"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = d.data().isPremium || false; });
      setPremiumMap(map);
    }, () => {});
    return unsub;
  }, []);

  const inputStyle = { padding: "9px 10px", borderRadius: 7, border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box", width: "100%" };
  const field = (label, node) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>{label}</label>
      {node}
    </div>
  );

  const createAgent = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.name.trim() || !form.email.trim() || !form.password) return setError("Name, email, and password are required.");
    setCreating(true);
    try {
      const functions = getFunctions();
      const createAgentAccount = httpsCallable(functions, "createAgentAccount");
      await createAgentAccount({
        name: form.name.trim(), email: form.email.trim(), password: form.password,
        monthlyTarget: Number(form.monthlyTarget), commissionAmount: Number(form.commissionAmount),
      });
      setSuccess(`Agent "${form.name}" created — share their email and password with them to log in.`);
      setForm(emptyForm);
    } catch (err) {
      setError(err.message || "Couldn't create agent.");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (agent) => {
    try {
      const functions = getFunctions();
      const setAgentActive = httpsCallable(functions, "setAgentActive");
      await setAgentActive({ agentId: agent.id, active: !agent.active });
    } catch (err) {
      alert(`Couldn't update: ${err.message}`);
    }
  };

  const markPaid = async (commission) => {
    const ok = confirm(`Mark ₹${commission.amount} to ${commission.agentName} as paid?`);
    if (!ok) return;
    try {
      await updateDoc(doc(db, "commissions", commission.id), {
        status: "paid", paidAt: serverTimestamp(), paidBy: auth.currentUser?.uid || null,
      });
    } catch (err) {
      alert(`Couldn't update: ${err.message}`);
    }
  };

  const acknowledgeClawback = async (commission) => {
    const ok = confirm(`Confirm you've recovered ₹${commission.amount} from ${commission.agentName}?`);
    if (!ok) return;
    try {
      await updateDoc(doc(db, "commissions", commission.id), { priorStatusBeforeClawback: "recovered" });
    } catch (err) {
      alert(`Couldn't update: ${err.message}`);
    }
  };

  const statsFor = (agentId) => {
    const stores = vendors.filter((v) => v.addedByAgentId === agentId);
    const agentCommissions = commissions.filter((c) => c.agentId === agentId);
    const pending = agentCommissions.filter((c) => c.status === "pending").reduce((s, c) => s + (c.amount || 0), 0);
    const paid = agentCommissions.filter((c) => c.status === "paid").reduce((s, c) => s + (c.amount || 0), 0);
    const clawedBack = agentCommissions.filter((c) => c.status === "clawed_back").length;
    // "currently premium" reads live from premium_vendors — the authoritative,
    // real-time source — not just from a commission record's status, so a
    // store that churned after the clawback window (agent keeps the money)
    // still shows correctly as no-longer-premium here.
    const currentlyPremium = stores.filter((v) => v.ownerId && premiumMap[v.ownerId]).length;
    return { storeCount: stores.length, convertedCount: agentCommissions.length, currentlyPremium, clawedBack, pending, paid };
  };

  const pendingCommissions = commissions.filter((c) => c.status === "pending");
  const recoverableClawbacks = commissions.filter((c) => c.status === "clawed_back" && c.priorStatusBeforeClawback === "paid");

  return (
    <div className="stall-grid">
      <div className="stall-panel" style={{ padding: 18, alignSelf: "start" }}>
        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Add a sales agent</div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
          Creates their login. Share the email and password with them directly.
        </div>
        <form onSubmit={createAgent}>
          {field("Name", <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />)}
          {field("Email", <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />)}
          {field("Password", <input type="text" style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 6 characters" />)}
          {field("Monthly target (stores)", <input type="number" min="0" style={inputStyle} value={form.monthlyTarget} onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} />)}
          {field("Commission per Premium conversion (₹)", <input type="number" min="0" style={inputStyle} value={form.commissionAmount} onChange={(e) => setForm({ ...form, commissionAmount: e.target.value })} />)}
          {error && <div style={{ color: COLORS.brick, fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {success && <div style={{ color: COLORS.green, fontSize: 12, marginBottom: 10 }}>{success}</div>}
          <button type="submit" disabled={creating} className="stall-btn" style={{ width: "100%", background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "10px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {creating ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />} {creating ? "Creating…" : "Create agent"}
          </button>
        </form>
      </div>

      <div>
        {recoverableClawbacks.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={17} color={COLORS.brick} /> Needs recovery
            </div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              These were already paid out, then the store cancelled Premium within 30 days — recover from the agent directly.
            </div>
            <div style={{ border: `2px solid ${COLORS.brick}`, borderRadius: 12, overflow: "hidden" }}>
              {recoverableClawbacks.map((c, i) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: "#fff" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.agentName}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{c.vendorName} cancelled within the clawback window · ₹{c.amount} already paid</div>
                  </div>
                  <button onClick={() => acknowledgeClawback(c)} className="stall-btn" style={{ background: COLORS.brick, color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                    <Check size={13} /> Recovered
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingCommissions.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <IndianRupee size={17} color={COLORS.marigold} /> Pending commissions
            </div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              {pendingCommissions.length} awaiting payout — still inside the 30-day clawback window until it clears.
            </div>
            <div style={{ border: `2px solid ${COLORS.marigold}`, borderRadius: 12, overflow: "hidden" }}>
              {pendingCommissions.map((c, i) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: "#fff" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.agentName}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{c.vendorName} went Premium · ₹{c.amount}</div>
                  </div>
                  <button onClick={() => markPaid(c)} className="stall-btn" style={{ background: COLORS.green, color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                    <Check size={13} /> Mark paid
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Agents</div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>{agents.length} total</div>

        {agents.length === 0 ? (
          <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: 30, textAlign: "center", color: "#666", fontSize: 13 }}>
            No agents yet — add one on the left.
          </div>
        ) : (
          <div style={{ border: `2px solid ${COLORS.ink}`, borderRadius: 12, overflow: "hidden" }}>
            {agents.map((a, i) => {
              const stats = statsFor(a.id);
              const progressPct = a.monthlyTarget > 0 ? Math.min(100, Math.round((stats.storeCount / a.monthlyTarget) * 100)) : 0;
              return (
                <div key={a.id} style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: a.active === false ? "#f5f5f5" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{a.name}</span>
                        {a.active === false && <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.brick }}>INACTIVE</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#777" }}>{a.email}</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
                        {stats.storeCount} stores added · {stats.convertedCount} ever converted · {stats.currentlyPremium} currently Premium
                        {stats.clawedBack > 0 && ` · ${stats.clawedBack} clawed back`}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 2 }}>
                        <span style={{ color: COLORS.green, fontWeight: 600 }}>₹{stats.paid} paid</span>
                        {stats.pending > 0 && <span style={{ color: COLORS.goldDark, fontWeight: 600, marginLeft: 8 }}>₹{stats.pending} pending</span>}
                      </div>
                      {a.monthlyTarget > 0 && (
                        <div style={{ marginTop: 6, height: 5, width: 160, borderRadius: 6, background: `${COLORS.ink}15`, overflow: "hidden" }}>
                          <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct >= 100 ? COLORS.green : COLORS.marigold }} />
                        </div>
                      )}
                    </div>
                    <button onClick={() => toggleActive(a)} title={a.active === false ? "Reactivate agent" : "Deactivate agent"} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${a.active === false ? COLORS.green : COLORS.brick}`, color: a.active === false ? COLORS.green : COLORS.brick, borderRadius: 7, padding: "5px 9px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <Ban size={12} /> {a.active === false ? "Reactivate" : "Deactivate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
