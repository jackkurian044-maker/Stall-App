import React, { useState } from "react";
import { X, Zap } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { COLORS } from "./constants";
import { db } from "./firebase";

// A handful of one-tap starting points — picking one and tweaking the
// number is faster than typing a sentence from scratch, which is the
// whole point of "quick".
const QUICK_TEMPLATES = [
  "20% off today",
  "Buy 1, get 1 free",
  "Flat ₹50 off",
  "Weekend special — 15% off",
];

const EXPIRY_PRESETS = [
  { label: "Today", hours: 12 },
  { label: "This weekend", hours: 72 },
  { label: "This week", hours: 168 },
];

export default function QuickOfferModal({ listing, onClose }) {
  const [text, setText] = useState(listing.offer || "");
  const [expiryHours, setExpiryHours] = useState(24);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!text.trim()) {
      setError("Enter an offer first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
      await updateDoc(doc(db, "vendors", listing.id), {
        offer: text.trim(),
        offerExpiresAt: expiresAt,
      });
      onClose();
    } catch {
      setError("Couldn't save — try again.");
      setSaving(false);
    }
  };

  const clearOffer = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "vendors", listing.id), { offer: "", offerExpiresAt: null });
      onClose();
    } catch {
      setError("Couldn't clear — try again.");
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, padding: 24, maxWidth: 380, width: "100%", border: `2px solid ${COLORS.ink}` }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16 }}>
            <Zap size={16} color={COLORS.marigold} /> Quick offer
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>for {listing.name}</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {QUICK_TEMPLATES.map((t) => (
            <button
              key={t}
              onClick={() => setText(t)}
              style={{
                fontSize: 12, padding: "6px 11px", borderRadius: 999, cursor: "pointer",
                border: `1.5px solid ${COLORS.ink}33`, background: text === t ? COLORS.ink : "#fff",
                color: text === t ? "#fff" : COLORS.ink,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. 20% off today"
          autoFocus
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${COLORS.ink}`, fontSize: 14, marginBottom: 14 }}
        />

        <div style={{ fontSize: 11.5, color: "#666", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Runs until
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {EXPIRY_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setExpiryHours(p.hours)}
              style={{
                flex: 1, fontSize: 12.5, padding: "8px 6px", borderRadius: 8, cursor: "pointer",
                border: `1.5px solid ${COLORS.ink}33`, background: expiryHours === p.hours ? COLORS.marigold : "#fff",
                color: COLORS.ink, fontWeight: 600,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && <div style={{ color: "#c0392b", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}

        <button
          onClick={save}
          disabled={saving}
          className="stall-btn"
          style={{ width: "100%", background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, fontSize: 14, opacity: saving ? 0.6 : 1, marginBottom: 8 }}
        >
          {saving ? "Saving…" : "Post offer →"}
        </button>

        {listing.offer && (
          <button
            onClick={clearOffer}
            disabled={saving}
            style={{ width: "100%", background: "none", border: "none", color: "#999", fontSize: 12.5, cursor: "pointer", padding: 6 }}
          >
            Remove current offer
          </button>
        )}
      </div>
    </div>
  );
}
