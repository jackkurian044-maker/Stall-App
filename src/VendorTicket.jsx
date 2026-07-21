import React from "react";
import { ExternalLink, Star, Clock, MessageSquare, Tag } from "lucide-react";
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
  // An offer with no end date runs until the vendor removes it themselves;
  // one with an end date just stops showing on its own once it's passed —
  // nobody has to remember to come back and take it down.
  const offerActive = vendor.offer && (!vendor.offerExpiresAt?.toDate || vendor.offerExpiresAt.toDate() >= new Date());

  return (
    <div
      className="stall-card"
      onClick={handleClick}
      title="Open website / Google Business profile"
      style={{
        "--stall-shadow": accent,
        background: "#fff",
        border: "1px solid rgba(15,26,36,0.08)",
        borderRadius: 14,
        padding: "24px 26px",
        cursor: "pointer",
        boxShadow: highlighted ? `0 8px 24px ${accent}55` : "0 8px 24px rgba(15,26,36,0.08)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {offerActive && (
        <div
          style={{
            background: COLORS.marigold,
            color: COLORS.ink,
            margin: "-24px -26px 18px -26px",
            padding: "10px 26px",
            borderRadius: "11px 11px 0 0",
            fontSize: 12.5,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Tag size={13} />
          {vendor.offer}
          {vendor.offerExpiresAt?.toDate && (
            <span style={{ fontWeight: 500, opacity: 0.8 }}>
              &nbsp;· ends {vendor.offerExpiresAt.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 22 }}>
      {thumbnail && (
        <img
          src={thumbnail}
          alt=""
          style={{ width: 104, height: 104, borderRadius: 20, objectFit: "cover", flexShrink: 0, border: `1.5px solid ${COLORS.ink}22` }}
        />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5, flexWrap: "wrap" }}>
          <span className="font-display" style={{ fontSize: 22, fontWeight: 700 }}>
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
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: COLORS.ink,
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: `${COLORS.marigold}30`,
                border: `1.5px solid ${COLORS.marigold}`,
                padding: "3px 10px",
                borderRadius: 999,
              }}
            >
              <Star size={15} fill={COLORS.marigold} color={COLORS.marigold} strokeWidth={2.5} />
              <span className="font-mono">{vendor.rating.toFixed(1)}</span>
              {vendor.ratingsCount != null && (
                <span style={{ color: "#6b6255", fontWeight: 600 }}>({vendor.ratingsCount})</span>
              )}
            </span>
          )}
        </div>
        {vendor.description && (
          <div style={{ fontSize: 14.5, color: "#444", marginBottom: 10 }}>{vendor.description}</div>
        )}
        {products.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
            {products.slice(0, 6).map((p, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  background: `${COLORS.green}1a`,
                  color: COLORS.green,
                  padding: "3px 9px",
                  borderRadius: 20,
                }}
              >
                {p}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 13.5, color: "#777" }}>{vendor.address}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {firstHoursLine && (
            <span style={{ fontSize: 12, color: "#777", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} /> {firstHoursLine}
            </span>
          )}
          <button
            onClick={handleReviewsClick}
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.green, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, padding: 0 }}
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
            borderRadius: 14,
            padding: "8px 14px",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {vendor.distance.toFixed(1)} km
        </div>
        <ExternalLink size={19} color="#999" style={{ marginTop: 12 }} />
      </div>
      </div>
    </div>
  );
}
