import React, { useEffect, useState } from "react";
import { ExternalLink, Star, Clock, MessageSquare, Tag, Phone, MessageCircle, Navigation, Heart, Flag, Sparkles } from "lucide-react";
import { CATEGORY_COLORS, COLORS } from "./constants";
import { vendorLink } from "./geo";
import { db } from "./firebase";
import { logInteraction, getRecentViewCount, socialProofLine } from "./interactions";
import ReportModal from "./ReportModal";

const NEW_LISTING_DAYS = 7;

export default function VendorTicket({ vendor, highlighted, onClick, onOpenReviews, user, isFavorited, onToggleFavorite }) {
  const [recentViews, setRecentViews] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [viewLogged, setViewLogged] = useState(false);

  const products = (vendor.products || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // Log a "view" once per card per mount (not per render), and fetch the
  // real recent-view count for the social-proof line. Both fire once per
  // card shown in the results list — at PAGE_SIZE=10 per page (see
  // FindView.jsx) that's an acceptable read cost for an MVP; if result
  // lists grow much larger, this should move to only firing on the
  // expanded/detail view instead of every card in a list.
  useEffect(() => {
    if (!vendor.id || viewLogged) return;
    setViewLogged(true);
    logInteraction(db, vendor.id, "view");
    getRecentViewCount(db, vendor.id).then(setRecentViews);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor.id]);

  const handleClick = () => {
    onClick?.();
    window.open(vendorLink(vendor), "_blank", "noopener,noreferrer");
  };

  const handleReviewsClick = (e) => {
    e.stopPropagation();
    onOpenReviews?.();
  };

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.(e);
  };

  const handleCall = stop(() => {
    logInteraction(db, vendor.id, "call");
    window.location.href = `tel:${vendor.phone}`;
  });

  const handleWhatsapp = stop(() => {
    logInteraction(db, vendor.id, "whatsapp");
    const digits = (vendor.phone || "").replace(/[^\d]/g, "");
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
  });

  const handleDirections = stop(() => {
    logInteraction(db, vendor.id, "directions");
    const url = vendor.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${vendor.name} ${vendor.address}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  });

  const handleFavorite = stop(() => {
    if (!user) return; // caller (FindView) should route to sign-in if no user
    onToggleFavorite?.(vendor.id, isFavorited);
  });

  const handleReport = stop(() => setReportOpen(true));

  const accent = CATEGORY_COLORS[vendor.category] || COLORS.ink;
  const firstHoursLine = (vendor.hours || "").split("\n")[0];
  const thumbnail = vendor.photos?.[0];
  const offerActive = vendor.offer && (!vendor.offerExpiresAt?.toDate || vendor.offerExpiresAt.toDate() >= new Date());

  const isNewListing = (() => {
    const created = vendor.createdAt?.toDate?.();
    if (!created) return false;
    const ageMs = Date.now() - created.getTime();
    return ageMs <= NEW_LISTING_DAYS * 24 * 60 * 60 * 1000;
  })();

  // Countdown text for offers ending within the next 48 hours — this is
  // the "flash offer" urgency cue; older/undated offers just show the
  // plain end date (or nothing) instead, since urgency framing on a
  // 3-week-away expiry would just be noise.
  const offerCountdown = (() => {
    if (!offerActive || !vendor.offerExpiresAt?.toDate) return null;
    const msLeft = vendor.offerExpiresAt.toDate().getTime() - Date.now();
    const hoursLeft = msLeft / (1000 * 60 * 60);
    if (hoursLeft > 48 || hoursLeft <= 0) return null;
    if (hoursLeft < 1) return "ends within the hour";
    return `ends in ${Math.round(hoursLeft)}h`;
  })();

  const proofLine = recentViews != null ? socialProofLine(recentViews) : null;

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
        padding: "24px 26px",
        cursor: "pointer",
        boxShadow: highlighted ? `4px 4px 0 ${accent}` : "none",
        display: "flex",
        flexDirection: "column",
        position: "relative",
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
          {offerCountdown ? (
            <span style={{ fontWeight: 800, marginLeft: "auto", background: COLORS.ink, color: "#fff", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>
              {offerCountdown}
            </span>
          ) : vendor.offerExpiresAt?.toDate ? (
            <span style={{ fontWeight: 500, opacity: 0.8 }}>
              &nbsp;· ends {vendor.offerExpiresAt.toDate().toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
          ) : null}
        </div>
      )}

      {/* Favorite + report — top-right corner, above everything else */}
      <div style={{ position: "absolute", top: offerActive ? 56 : 14, right: 14, display: "flex", gap: 6, zIndex: 2 }}>
        <button
          onClick={handleFavorite}
          title={user ? (isFavorited ? "Remove from favorites" : "Save to favorites") : "Sign in to save favorites"}
          style={{
            background: "#fff", border: `1.5px solid ${COLORS.ink}22`, borderRadius: 999, width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
          }}
        >
          <Heart size={15} fill={isFavorited ? "#c0392b" : "none"} color={isFavorited ? "#c0392b" : "#999"} />
        </button>
        <button
          onClick={handleReport}
          title="Report this listing"
          style={{
            background: "#fff", border: `1.5px solid ${COLORS.ink}22`, borderRadius: 999, width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
          }}
        >
          <Flag size={13} color="#999" />
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 22 }}>
      {thumbnail && (
        <img
          src={thumbnail}
          alt=""
          style={{ width: 104, height: 104, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: `1.5px solid ${COLORS.ink}22` }}
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
          {isNewListing && (
            <span
              style={{
                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                color: "#fff", background: COLORS.teal, display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <Sparkles size={11} /> New
            </span>
          )}
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
        <div style={{ fontSize: 13.5, color: "#777" }}>{vendor.address}</div>
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
        {proofLine && (
          <div style={{ fontSize: 11.5, color: "#8a7a5a", marginTop: 6, fontStyle: "italic" }}>{proofLine}</div>
        )}

        {/* One-tap contact actions — the actual Phase 1 fix: these didn't
            exist before as distinct actions, only a generic card-open link. */}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {vendor.phone && (
            <button
              onClick={handleCall}
              className="stall-btn"
              style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              <Phone size={13} /> Call
            </button>
          )}
          {vendor.phone && (
            <button
              onClick={handleWhatsapp}
              className="stall-btn"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              <MessageCircle size={13} /> WhatsApp
            </button>
          )}
          <button
            onClick={handleDirections}
            className="stall-btn"
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: COLORS.ink, border: `1.5px solid ${COLORS.ink}`, borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
          >
            <Navigation size={13} /> Directions
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

      {reportOpen && (
        <ReportModal
          vendor={vendor}
          user={user}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
