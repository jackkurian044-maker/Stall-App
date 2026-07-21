import React from "react";
import { COLORS } from "./constants";
import stallLogo from "./stall-logo-v2.png";

export default function Footer() {
  return (
    <div
      style={{
        marginTop: 40,
        padding: "36px 24px 28px",
        background: COLORS.navy,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        textAlign: "center",
      }}
    >
      <img
        src={stallLogo}
        alt="Stall"
        style={{ height: 72, width: "auto" }}
      />
      <div style={{ fontSize: 13, color: "#c7ccd1" }}>
        © {new Date().getFullYear()} Stall App · your neighbourhood · Built for local commerce, everywhere
      </div>
    </div>
  );
}
