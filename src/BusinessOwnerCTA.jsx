import React from "react";
import { COLORS } from "./constants";

export default function BusinessOwnerCTA({ onListFree, onClaim }) {
  return (
    <section
      aria-label="For business owners"
      style={{
        margin: "18px auto 0",
        width: "min(1100px, calc(100% - 32px))",
        boxSizing: "border-box",
        border: "1px solid rgba(240,180,41,0.35)",
        borderRadius: 20,
        padding: "22px 24px",
        background: "linear-gradient(135deg, rgba(240,180,41,0.12), rgba(255,255,255,0.04))",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 20, alignItems: "center" }}>
        <div>
          <div style={{ color: "#f0b429", fontSize: 11, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 7 }}>
            For business owners
          </div>
          <h2 style={{ margin: 0, fontSize: "clamp(20px, 3vw, 30px)", lineHeight: 1.15, color: "#fff" }}>
            Your Business Should Be on STall
          </h2>
          <p style={{ margin: "9px 0 0", color: "#bdbdbd", fontSize: 13.5, lineHeight: 1.55, maxWidth: 700 }}>
            Get discovered by local customers, showcase your business and offers, and build your presence on STall.
            Already listed? Claim your business and take control of your listing.
          </p>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onListFree}
            className="stall-btn"
            style={{ background: "#f0b429", color: "#0a0a0a", border: "none", borderRadius: 999, padding: "11px 17px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            List Your Business Free
          </button>
          <button
            type="button"
            onClick={onClaim}
            className="stall-btn"
            style={{ background: "transparent", color: "#fff", border: `1px solid rgba(255,255,255,0.25)`, borderRadius: 999, padding: "10px 17px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Already Listed? Claim Your Business
          </button>
        </div>
      </div>

      <div style={{ marginTop: 17, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8, flexWrap: "wrap", color: "#aaa", fontSize: 11.5 }}>
        <span>Get Listed</span><span>→</span><span>Get Discovered</span><span>→</span><span>Collect Reviews</span><span>→</span><span>Respond Professionally</span><span>→</span><span>Grow Your Presence</span>
      </div>
    </section>
  );
}
