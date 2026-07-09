import React from "react";
import { Store } from "lucide-react";
import { COLORS } from "./constants";

export default function Header({ mode, setMode, user, isAdmin, onSignOut }) {
  const tabs = [
    { id: "find", label: "Find" },
    ...(user ? [{ id: "mine", label: "My Listings" }] : []),
    ...(isAdmin ? [{ id: "admin", label: "Admin" }] : []),
    ...(user ? [] : [{ id: "auth", label: "Sign in" }]),
  ];

  return (
    <div
      style={{
        borderBottom: `3px solid ${COLORS.ink}`,
        padding: "20px 24px",
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
            background: COLORS.ink,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Store size={20} color={COLORS.marigold} />
        </div>
        <div>
          <div className="font-display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
            STALL
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: COLORS.teal,
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
            background: "#fff",
            border: `2px solid ${COLORS.ink}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              style={{
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                border: "none",
                background: mode === t.id ? COLORS.ink : "transparent",
                color: mode === t.id ? COLORS.paper : COLORS.ink,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {user && (
          <button
            onClick={onSignOut}
            className="stall-btn"
            style={{
              background: "transparent",
              border: `1.5px solid ${COLORS.ink}`,
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
