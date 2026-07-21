import React from "react";
import { Store } from "lucide-react";
import { COLORS } from "./constants";

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
        background: "#fff",
        boxShadow: "0 2px 14px rgba(0,0,0,0.12)",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            background: COLORS.navy,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Store size={20} color={COLORS.marigold} />
        </div>
        <div>
          <div className="font-display" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: COLORS.navy }}>
            STALL
          </div>
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
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            background: "#f4f2ec",
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
                background: mode === t.id ? COLORS.navy : "transparent",
                color: mode === t.id ? "#fff" : COLORS.navy,
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
