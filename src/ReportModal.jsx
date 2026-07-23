import React, { useState } from "react";
import { X, Flag } from "lucide-react";
import { COLORS } from "./constants";
import { db } from "./firebase";
import { submitReport, REPORT_REASONS } from "./reports";

export default function ReportModal({ vendor, user, onClose }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.stopPropagation();
    if (!reason) {
      setError("Pick a reason first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitReport(db, {
        vendorId: vendor.id,
        vendorName: vendor.name,
        reason,
        details,
        reporterUid: user?.uid || null,
      });
      setDone(true);
    } catch {
      setError("Couldn't submit the report — try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, padding: 26, maxWidth: 380, width: "100%", border: `2px solid ${COLORS.ink}` }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16 }}>
            <Flag size={16} /> Report this listing
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div style={{ fontSize: 14, color: "#444", lineHeight: 1.6 }}>
            Thanks — an admin will take a look. This report is private and doesn't affect the listing on its own.
            <button
              onClick={onClose}
              className="stall-btn"
              style={{ marginTop: 16, width: "100%", background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 600, fontSize: 13 }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
              Reporting <strong>{vendor.name}</strong>. This is sent to admins only — it's never shown publicly.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {REPORT_REASONS.map((r) => (
                <label key={r} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
                  <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                  {r}
                </label>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything else admins should know? (optional)"
              style={{ width: "100%", minHeight: 70, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${COLORS.ink}55`, fontSize: 13, fontFamily: "inherit", marginBottom: 10 }}
            />
            {error && <div style={{ color: "#c0392b", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="stall-btn"
              style={{ width: "100%", background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 600, fontSize: 13, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "Submitting…" : "Submit report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
