import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { MapPin, Search, Locate, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, COLORS, DEFAULT_LOC } from "./constants";
import { haversineKm, bearingRad } from "./geo";
import { autoRefreshStale } from "./ratingSync";
import VendorTicket from "./VendorTicket";
import RadarChart from "./RadarChart";
import ReviewsModal from "./ReviewsModal";
import CustomerLocationSearch from "./CustomerLocationSearch";

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
  const [reviewsVendor, setReviewsVendor] = useState(null);
  const [page, setPage] = useState(1);
  const refreshedRef = useRef(new Set());

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "vendors"),
      (snap) => {
        // Hide direct self-registrations still awaiting admin review, and
        // any that were rejected. Listings without a status field at all
        // (admin-added, or anything created before this field existed)
        // are treated as public — status is only ever set to 'pending' by
        // register.html, so its absence means "not subject to this gate".
        const visible = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((v) => v.status !== "pending" && v.status !== "rejected");
        setVendors(visible);
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
      () => {
        // Permission denied, timed out, or otherwise failed — fall back
        // to the default city rather than stranding the user on the
        // "set your location" empty state.
        setUserLoc(DEFAULT_LOC);
        setLocating(false);
      },
      { timeout: 6000 }
    );
  };

  // Auto-detect on load instead of waiting for the "Use my location" click —
  // same pattern as Swiggy/Zomato-style "near me" apps. Browsers show their
  // own permission prompt for this automatically; if it's denied, times out,
  // or geolocation isn't supported, locate() now falls back to DEFAULT_LOC
  // itself, so userLoc is always set one way or another after this runs.
  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable reference so CustomerLocationSearch's internal effect (which
  // depends on this callback) doesn't re-run its Autocomplete setup on
  // every FindView re-render — see review notes on the initial version.
  const handleLocationSelect = useCallback((loc) => {
    setUserLoc({ lat: loc.lat, lng: loc.lng });
  }, []);

  const results = useMemo(() => {
    if (!userLoc) return [];
    return vendors
      .map((v) => ({ ...v, distance: haversineKm(userLoc, { lat: v.lat, lng: v.lng }) }))
      .filter((v) => v.distance <= radiusKm)
      .filter((v) => categoryFilter === "All" || v.category === categoryFilter)
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
  }, [vendors, userLoc, radiusKm, categoryFilter, query]);

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
  }, [radiusKm, categoryFilter, query, userLoc]);

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
                  width: "100%", background: COLORS.navy, color: "#fff", border: "none", borderRadius: 999,
                  padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, fontWeight: 600, fontSize: 13, marginBottom: 10,
                }}
              >
                <Locate size={16} /> {locating ? "Locating…" : "Use my location"}
              </button>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                or search your area
              </div>
              <CustomerLocationSearch onSelect={handleLocationSelect} />
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: COLORS.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={14} /> LOCATION SET
                </div>
                <button onClick={locate} style={{ background: "none", border: "none", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>
                  {locating ? "…" : "refresh"}
                </button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <CustomerLocationSearch onSelect={handleLocationSelect} />
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

        {userLoc && isAdmin && <RadarChart radarData={radarData} radiusKm={radiusKm} onSelect={setSelected} />}
      </div>

      <div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px", position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#777" }} />
            <input
              placeholder="Search vendors or products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: "100%", padding: "9px 10px 9px 32px", borderRadius: 14, border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff" }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: "9px 10px", borderRadius: 14, border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff" }}
          >
            <option>All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {!userLoc ? (
          <EmptyState text="Set your location on the left to start finding vendors nearby." />
        ) : loading ? (
          <div style={{ fontSize: 13, color: "#666" }}>Loading vendors…</div>
        ) : results.length === 0 ? (
          <EmptyState
            text={vendors.length === 0 ? "No vendors listed yet." : "Nothing in range — try widening your search radius."}
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
                    background: "#fff", border: `1.5px solid ${COLORS.ink}`, borderRadius: 14, padding: "7px 10px",
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
                      borderRadius: 14,
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
                    background: "#fff", border: `1.5px solid ${COLORS.ink}`, borderRadius: 14, padding: "7px 10px",
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
    <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 20, padding: "40px 20px", textAlign: "center", background: "#ffffff88" }}>
      <MapPin size={28} color={COLORS.green} style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 14, color: "#444", maxWidth: 320, margin: "0 auto" }}>{text}</div>
    </div>
  );
}
