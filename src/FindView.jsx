import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { MapPin, Search, Locate, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, COLORS, DEFAULT_LOC } from "./constants";
import { haversineKm, bearingRad } from "./geo";
import { autoRefreshStale } from "./ratingSync";
import VendorTicket from "./VendorTicket";
import RadarChart from "./RadarChart";
import ReviewsModal from "./ReviewsModal";
import { watchFavorites, toggleFavorite } from "./favorites";

const PAGE_SIZE = 10;

export default function FindView({ user, isAdmin, onRequestSignIn }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [reviewsVendor, setReviewsVendor] = useState(null);
  const [page, setPage] = useState(1);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [digest, setDigest] = useState(null);
  const refreshedRef = useRef(new Set());

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      setShowFavoritesOnly(false);
      setDigest(null);
      return;
    }
    const unsub = watchFavorites(db, user.uid, setFavoriteIds);
    const unsubDigest = onSnapshot(doc(db, "digests", user.uid), (d) => {
      setDigest(d.exists() ? { id: d.id, ...d.data() } : null);
    });
    return () => { unsub(); unsubDigest(); };
  }, [user]);

  const dismissDigest = () => {
    if (!user || !digest) return;
    updateDoc(doc(db, "digests", user.uid), { read: true });
    setDigest(null);
  };

  const handleToggleFavorite = (vendorId, isFavorited) => {
    if (!user) {
      onRequestSignIn?.();
      return;
    }
    toggleFavorite(db, user.uid, vendorId, isFavorited);
  };

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "vendors"),
      (snap) => {
        setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  // Keep Google-sourced ratings/phone fresh with zero manual clicks —
  // gated by staleness both here (avoid redundant checks this session)
  // and, more importantly, by the Firestore rule itself (avoid redundant
  // *writes* across every visitor's session, which is the real cost control).
  useEffect(() => {
    autoRefreshStale(vendors, refreshedRef.current);
  }, [vendors]);

  const locate = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      setUserLoc(DEFAULT_LOC);
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 6000 }
    );
  };

  const useManualLoc = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) setUserLoc({ lat, lng });
  };

  const results = useMemo(() => {
    if (!userLoc) return [];
    return vendors
      .map((v) => ({ ...v, distance: haversineKm(userLoc, { lat: v.lat, lng: v.lng }) }))
      .filter((v) => v.distance <= radiusKm)
      .filter((v) => categoryFilter === "All" || v.category === categoryFilter)
      .filter((v) => !showFavoritesOnly || favoriteIds.has(v.id))
      .filter((v) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          v.name.toLowerCase().includes(q) ||
          (v.products || "").toLowerCase().includes(q) ||
          (v.description || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const ar = typeof a.rating === "number" ? a.rating : -1;
        const br = typeof b.rating === "number" ? b.rating : -1;
        if (br !== ar) return br - ar; // higher rating first; unrated (-1) sinks to the bottom
        return a.distance - b.distance; // tie-break (including among unrated): closer first
      });
  }, [vendors, userLoc, radiusKm, categoryFilter, query, showFavoritesOnly, favoriteIds]);

  const radarData = useMemo(() => {
    if (!userLoc) return [];
    return results.map((v) => {
      const brg = bearingRad(userLoc, { lat: v.lat, lng: v.lng });
      const d = v.distance;
      return { x: d * Math.sin(brg), y: d * Math.cos(brg), name: v.name, category: v.category, distance: d, id: v.id };
    });
  }, [results, userLoc]);

  // Reset to page 1 whenever the underlying result set changes, so
  // changing radius/category/keyword never leaves you stranded on a
  // page number that no longer has any results.
  useEffect(() => {
    setPage(1);
  }, [radiusKm, categoryFilter, query, userLoc, showFavoritesOnly]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedResults = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="stall-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="stall-panel" style={{ padding: 16 }}>
          {!userLoc ? (
            <div>
              <div style={{ fontSize: 14, marginBottom: 10 }}>Set your location to see what's nearby.</div>
              <button
                onClick={locate}
                className="stall-btn"
                style={{
                  width: "100%", background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8,
                  padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, fontWeight: 600, fontSize: 13, marginBottom: 10,
                }}
              >
                <Locate size={16} /> {locating ? "Locating…" : "Use my location"}
              </button>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                or enter coordinates
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="Latitude"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="font-mono"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: `1.5px solid ${COLORS.ink}`, fontSize: 13 }}
                />
                <input
                  placeholder="Longitude"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  className="font-mono"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: `1.5px solid ${COLORS.ink}`, fontSize: 13 }}
                />
              </div>
              <button
                onClick={useManualLoc}
                className="stall-btn"
                style={{ marginTop: 8, width: "100%", background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 6, padding: "7px", fontSize: 12, fontWeight: 600 }}
              >
                Set location
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: COLORS.teal, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={14} /> LOCATION SET
                </div>
                <button onClick={locate} style={{ background: "none", border: "none", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>
                  {locating ? "…" : "refresh"}
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span>Search radius</span>
                <span className="font-mono" style={{ fontWeight: 600 }}>{radiusKm} km</span>
              </div>
              <input
                type="range" min={0.5} max={25} step={0.5} value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: COLORS.brick }}
              />
            </div>
          )}
        </div>

        {userLoc && <RadarChart radarData={radarData} radiusKm={radiusKm} onSelect={setSelected} />}
      </div>

      <div>
        {digest && !digest.read && (digest.newVendors?.length > 0 || digest.activeOffers?.length > 0) && (
          <div style={{ background: `${COLORS.teal}15`, border: `1.5px solid ${COLORS.teal}`, borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ fontSize: 13 }}>
              <strong>This week near your favorites:</strong>{" "}
              {digest.newVendors?.length > 0 && `${digest.newVendors.length} new vendor${digest.newVendors.length === 1 ? "" : "s"}`}
              {digest.newVendors?.length > 0 && digest.activeOffers?.length > 0 && " · "}
              {digest.activeOffers?.length > 0 && `${digest.activeOffers.length} active offer${digest.activeOffers.length === 1 ? "" : "s"}`}
            </div>
            <button onClick={dismissDigest} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: COLORS.teal, fontWeight: 600, flexShrink: 0 }}>
              Dismiss
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px", position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#777" }} />
            <input
              placeholder="Search vendors or products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: "100%", padding: "9px 10px 9px 32px", borderRadius: 8, border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff" }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: "9px 10px", borderRadius: 8, border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff" }}
          >
            <option>All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          {user && (
            <button
              onClick={() => setShowFavoritesOnly((s) => !s)}
              className="stall-btn"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8,
                border: `1.5px solid ${COLORS.ink}`, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: showFavoritesOnly ? COLORS.ink : "#fff", color: showFavoritesOnly ? "#fff" : COLORS.ink,
              }}
            >
              ♥ Favorites
            </button>
          )}
        </div>

        {!userLoc ? (
          <EmptyState text="Set your location on the left to start finding vendors nearby." />
        ) : loading ? (
          <div style={{ fontSize: 13, color: "#666" }}>Loading vendors…</div>
        ) : results.length === 0 ? (
          <EmptyState
            text={
              showFavoritesOnly
                ? "No favorites in range yet — tap the heart on a listing to save it here."
                : vendors.length === 0 ? "No vendors listed yet." : "Nothing in range — try widening your search radius."
            }
          />
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#777", marginBottom: 10 }}>
              {results.length} result{results.length === 1 ? "" : "s"}
              {totalPages > 1 ? ` · page ${currentPage} of ${totalPages}` : ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {pagedResults.map((v) => (
                <VendorTicket
                  key={v.id}
                  vendor={v}
                  highlighted={selected === v.id}
                  onClick={() => setSelected(v.id)}
                  onOpenReviews={() => setReviewsVendor(v)}
                  user={user}
                  isFavorited={favoriteIds.has(v.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="stall-btn"
                  style={{
                    background: "#fff", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "7px 10px",
                    display: "flex", alignItems: "center", opacity: currentPage === 1 ? 0.4 : 1,
                    cursor: currentPage === 1 ? "default" : "pointer",
                  }}
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="stall-btn"
                    style={{
                      background: p === currentPage ? COLORS.ink : "#fff",
                      color: p === currentPage ? "#fff" : COLORS.ink,
                      border: `1.5px solid ${COLORS.ink}`,
                      borderRadius: 7,
                      padding: "7px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      minWidth: 36,
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="stall-btn"
                  style={{
                    background: "#fff", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "7px 10px",
                    display: "flex", alignItems: "center", opacity: currentPage === totalPages ? 0.4 : 1,
                    cursor: currentPage === totalPages ? "default" : "pointer",
                  }}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {reviewsVendor && (
        <ReviewsModal
          vendor={reviewsVendor}
          user={user}
          isAdmin={isAdmin}
          onClose={() => setReviewsVendor(null)}
          onRequestSignIn={onRequestSignIn}
        />
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: "40px 20px", textAlign: "center", background: "#ffffff88" }}>
      <MapPin size={28} color={COLORS.teal} style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 14, color: "#444", maxWidth: 320, margin: "0 auto" }}>{text}</div>
    </div>
  );
}
