import React from "react";
import { ExternalLink } from "lucide-react";
import { CATEGORY_COLORS, COLORS } from "./constants";
import { vendorLink } from "./geo";

export default function VendorTicket({ vendor, highlighted, onClick }) {
  const products = (vendor.products || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const handleClick = () => {
    onClick?.();
    window.open(vendorLink(vendor), "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="stall-card"
      onClick={handleClick}
      title="Open website / Google Business profile"
      style={{
        background: "#fff",
        border: `2px solid ${COLORS.ink}`,
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
        boxShadow: highlighted ? `4px 4px 0 ${COLORS.brick}` : "none",
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>
            {vendor.name}
          </span>
          <span
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 999,
              color: "#fff",
              background: CATEGORY_COLORS[vendor.category] || COLORS.ink,
            }}
          >
            {vendor.category}
          </span>
        </div>
        {vendor.description && (
          <div style={{ fontSize: 12.5, color: "#444", marginBottom: 6 }}>{vendor.description}</div>
        )}
        {products.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {products.slice(0, 6).map((p, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  background: `${COLORS.teal}1a`,
                  color: COLORS.teal,
                  padding: "2px 8px",
                  borderRadius: 6,
                }}
              >
                {p}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "#777" }}>{vendor.address}</div>
      </div>
      <div
        style={{
          textAlign: "right",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div
          className="font-mono"
          style={{
            background: COLORS.ink,
            color: "#fff",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {vendor.distance.toFixed(1)} km
        </div>
        <ExternalLink size={15} color="#999" style={{ marginTop: 10 }} />
      </div>
    </div>
  );
}
