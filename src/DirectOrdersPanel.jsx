import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { ClipboardList, ExternalLink, CheckCircle2, XCircle, Clock3 } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";

const statusMeta = {
  new: { label: "New", icon: <Clock3 size={13} /> },
  accepted: { label: "Accepted", icon: <CheckCircle2 size={13} /> },
  rejected: { label: "Rejected", icon: <XCircle size={13} /> },
  completed: { label: "Completed", icon: <CheckCircle2 size={13} /> },
};

const money = (value) => "₹" + Number(value || 0).toFixed(0);

export default function DirectOrdersPanel({ listings }) {
  const eligible = listings.filter((l) => l.planKey === "growth_setup" || (l.isPremium && l.subscriptionTier === "growth_setup"));
  const [selectedId, setSelectedId] = useState(eligible[0]?.id || "");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const selected = eligible.find((l) => l.id === selectedId);

  useEffect(() => {
    if (!eligible.length) {
      setSelectedId("");
      setOrders([]);
      return;
    }
    if (!eligible.some((l) => l.id === selectedId)) setSelectedId(eligible[0].id);
  }, [listings]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    const q = query(collection(db, "direct_orders"), where("vendorId", "==", selectedId));
    return onSnapshot(q, (snap) => {
      const next = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const at = a.createdAt?.toMillis?.() || 0;
          const bt = b.createdAt?.toMillis?.() || 0;
          return bt - at;
        });
      setOrders(next);
      setLoading(false);
    }, () => setLoading(false));
  }, [selectedId]);

  async function setStatus(orderId, status) {
    await updateDoc(doc(db, "direct_orders", orderId), { status, updatedAt: new Date() });
  }

  if (!eligible.length) {
    return (
      <div style={card}>
        <div style={iconTitle}><ClipboardList size={17} /> STall Direct</div>
        <h2 style={{ margin: "8px 0 5px" }}>STall Direct is not active</h2>
        <p style={muted}>An eligible Growth Setup listing is required before customers can order directly through STall.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={card}>
        <div style={iconTitle}><ClipboardList size={17} /> STall Direct</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Manage your Direct menu and incoming customer orders without leaving the STall dashboard.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {eligible.map((l) => (
            <button key={l.id} onClick={() => setSelectedId(l.id)} style={{ ...tab, background: selectedId === l.id ? COLORS.ink : "#fff", color: selectedId === l.id ? "#fff" : COLORS.ink }}>
              {l.name}
            </button>
          ))}
        </div>
        {selected && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button onClick={() => { window.location.href = "/direct-manage/" + selected.id; }} style={button}>
              Manage menu <ExternalLink size={13} />
            </button>
            <button onClick={() => { window.open("/direct/" + selected.id, "_blank", "noopener,noreferrer"); }} style={secondary}>
              Open customer page <ExternalLink size={13} />
            </button>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Incoming orders</h2>
            <div style={{ fontSize: 11.5, color: "#666", marginTop: 3 }}>{selected?.name || "Select a listing"} · {orders.length} total</div>
          </div>
        </div>

        {loading ? <p style={muted}>Loading orders…</p> : orders.length === 0 ? (
          <div style={{ border: "2px dashed #bbb", borderRadius: 10, padding: 24, textAlign: "center", color: "#666", marginTop: 14 }}>
            No STall Direct orders yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {orders.map((order) => {
              const meta = statusMeta[order.status] || statusMeta.new;
              return (
                <div key={order.id} style={{ border: "1.5px solid #ddd", borderRadius: 11, padding: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{order.customerName || "Customer"} · {money(order.total)}</div>
                      <div style={{ fontSize: 11.5, color: "#666", marginTop: 3 }}>{order.customerPhone || "No phone"} · {order.fulfillmentType || "pickup"}</div>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800 }}>{meta.icon}{meta.label}</div>
                  </div>
                  <div style={{ marginTop: 9, fontSize: 12.5, lineHeight: 1.5 }}>
                    {(order.items || []).map((item, i) => <div key={i}>{item.name} × {item.qty} — {money((Number(item.price) || 0) * (Number(item.qty) || 0))}</div>)}
                  </div>
                  {order.fulfillmentType === "delivery" && order.deliveryAddress && <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}><strong>Delivery:</strong> {order.deliveryAddress}</div>}
                  {order.notes && <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}><strong>Notes:</strong> {order.notes}</div>}
                  {order.status === "new" && (
                    <div style={{ display: "flex", gap: 7, marginTop: 11 }}>
                      <button onClick={() => setStatus(order.id, "accepted")} style={{ ...button, background: COLORS.teal }}>Accept</button>
                      <button onClick={() => setStatus(order.id, "rejected")} style={{ ...secondary, color: COLORS.brick, borderColor: COLORS.brick }}>Reject</button>
                    </div>
                  )}
                  {order.status === "accepted" && <button onClick={() => setStatus(order.id, "completed")} style={{ ...button, marginTop: 11 }}>Mark completed</button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const card = { background: "#fff", border: "2px solid " + COLORS.ink, borderRadius: 12, padding: 18 };
const iconTitle = { display: "flex", alignItems: "center", gap: 7, fontSize: 17, fontWeight: 800 };
const muted = { color: "#666", lineHeight: 1.5 };
const tab = { border: "1.5px solid " + COLORS.ink, borderRadius: 8, padding: "7px 11px", fontWeight: 700, cursor: "pointer" };
const button = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: 0, borderRadius: 8, padding: "9px 12px", background: COLORS.ink, color: "#fff", fontWeight: 800, cursor: "pointer" };
const secondary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1.5px solid " + COLORS.ink, borderRadius: 8, padding: "8px 11px", background: "#fff", color: COLORS.ink, fontWeight: 700, cursor: "pointer" };
