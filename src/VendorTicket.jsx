import React from "react";
import { ExternalLink, Star, Clock, MessageSquare } from "lucide-react";
import { CATEGORY_COLORS, COLORS } from "./constants";
import { vendorLink } from "./geo";

export default function VendorTicket({ vendor, highlighted, onClick, onOpenReviews }) {
  const products = (vendor.products || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const handleClick = () => {
    onClick?.();
    window.open(vendorLink(vendor), "_blank", "noopener,noreferrer");
  };

  const handleReviewsClick = (e) => {
    e.stopPropagation();
    onOpenReviews?.();
  };

  const accent = CATEGORY_COLORS[vendor.category] || COLORS.ink;
  const firstHoursLine = (vendor.hours || "").split("\n")[0];
  const thumbnail = vendor.photos?.[0];

  return (
    <div
      className="stall-card"
      onClick={handleClick}
      title="Open website / Google Business profile"
      style={{
        "--stall-shadow": accent,
        background: "#fff",
        border: `2px solid ${COLORS.ink}`,
        borderRadius: 14,
        padding: "20px 22px",
        cursor: "pointer",
        boxShadow: highlighted ? `4px 4px 0 ${accent}` : "none",
        display: "flex",
        justifyContent: "space-between",
        gap: 18,
      }}
    >
      {thumbnail && (
        <img
          src={thumbnail}
          alt=""
          style={{ width: 88, height: 88, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: `1.5px solid ${COLORS.ink}22` }}
        />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5, flexWrap: "wrap" }}>
          <span className="font-display" style={{ fontSize: 20, fontWeight: 700 }}>
            {vendor.name}
          </span>
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 999,
              color: "#fff",
              background: CATEGORY_COLORS[vendor.category] || COLORS.ink,
            }}
          >
            {vendor.category}
          </span>
          {vendor.rating != null && (
            <span style={{ fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 3 }}>
              <Star size={13} fill={COLORS.marigold} color={COLORS.marigold} />
              <span className="font-mono">{vendor.rating.toFixed(1)}</span>
              {vendor.ratingsCount != null && (
                <span style={{ color: "#999" }}>({vendor.ratingsCount})</span>
              )}
            </span>
          )}
        </div>
        {vendor.description && (
          <div style={{ fontSize: 13.5, color: "#444", marginBottom: 8 }}>{vendor.description}</div>
        )}
        {products.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
            {products.slice(0, 6).map((p, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  background: `${COLORS.teal}1a`,
                  color: COLORS.teal,
                  padding: "3px 9px",
                  borderRadius: 6,
                }}
              >
                {p}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 12.5, color: "#777" }}>{vendor.address}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {firstHoursLine && (
            <span style={{ fontSize: 12, color: "#777", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} /> {firstHoursLine}
            </span>
          )}
          <button
            onClick={handleReviewsClick}
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.teal, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, padding: 0 }}
          >
            <MessageSquare size={12} /> Reviews
          </button>
        </div>
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
            padding: "7px 12px",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {vendor.distance.toFixed(1)} km
        </div>
        <ExternalLink size={17} color="#999" style={{ marginTop: 10 }} />
      </div>
    </div>
  );
}
