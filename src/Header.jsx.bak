import React from "react";
import stallLogoMark from "./logo-cropped.png";

export default function Header({ mode, setMode, user, isAdmin, onSignOut }) {
  const tabs = [
    { id: "find", label: "Find" },
    ...(user ? [{ id: "mine", label: "My Listings" }] : []),
    ...(isAdmin ? [{ id: "admin", label: "Admin" }] : []),
    ...(isAdmin ? [{ id: "bulk", label: "Discover Nearby" }] : []),
    ...(user ? [] : [{ id: "auth", label: "Sign in" }]),
  ];

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "#161616",
        borderBottom: "1px solid #2a2a2a",
        boxShadow: "0 2px 14px rgba(0,0,0,0.35)",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
  <img
    src={stallLogoMark}
    alt="Stall"
    style={{ width: 40, height: "auto", flexShrink: 0 }}
  />
  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
    <div style={{ fontWeight: 700, fontSize: "1.28rem", color: "#fff" }}>
      all
    </div>
    <div
      style={{
        fontSize: "0.55rem",
        letterSpacing: "0.22em",
        color: "#9c9c9c",
        fontWeight: 600,
        marginTop: 2,
      }}
    >
      THAT'S ALL
    </div>
  </div>
  <div
    style={{
      fontSize: 11,
      letterSpacing: "0.04em",
      color: "#9c9c9c",
      fontWeight: 600,
      marginLeft: 10,
    }}
  >
    what's around the corner
  </div>
</div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            background: "#111111",
            borderRadius: 999,
            padding: 4,
            gap: 2,
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={mode === t.id ? "" : "stall-tab"}
              style={{
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                transition: "background .12s ease, color .12s ease",
                background: mode === t.id ? "#f0b429" : "transparent",
                color: mode === t.id ? "#0a0a0a" : "#e0e0e0",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {user && (
          <button
            onClick={onSignOut}
            className="stall-btn stall-pill stall-pill-gold"
            style={{ padding: "9px 18px", fontSize: 13 }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
