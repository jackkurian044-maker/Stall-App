import React from "react";
import stallLogo from "./stall-logo.png";

export default function Footer() {
  return (
    <div
      style={{
        marginTop: 40,
        padding: "28px 24px",
        background: "#fff",
        borderTop: "1px solid #eee",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        textAlign: "center",
      }}
    >
      <img
        src={stallLogo}
        alt="Stall"
        style={{ height: 48, width: "auto" }}
      />
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.04em",
          color: "#6b7580",
          fontWeight: 600,
        }}
      >
        what's around the corner
      </div>
      <div style={{ fontSize: 12, color: "#9aa1a8", marginTop: 6 }}>
        © {new Date().getFullYear()} Stall App · your neighbourhood · Built for local commerce, everywhere
      </div>
    </div>
  );
}
