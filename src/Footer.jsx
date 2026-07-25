import React from "react";
import stallLogo from "./stall-logo.png";
import { COLORS } from "./constants";

export default function Footer({ onNavigatePrivacy }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "36px 16px 28px",
        borderTop: `1px solid ${COLORS.navy}15`,
        marginTop: 40,
      }}
    >
      <img
        src={stallLogo}
        alt="Stall — That's All"
        style={{ height: 64, width: "auto", margin: "0 auto 14px" }}
      />
      <div style={{ fontSize: 12.5, color: "#5f6974", marginBottom: 10 }}>
        © 2026 Stall App · Built for neighbourhood commerce, everywhere
      </div>
      <button
        onClick={onNavigatePrivacy}
        style={{
          background: "none",
          border: "none",
          color: "#5f6974",
          textDecoration: "underline",
          cursor: "pointer",
          fontSize: 12.5,
          padding: 0,
        }}
      >
        Privacy Policy
      </button>
    </div>
  );
}
