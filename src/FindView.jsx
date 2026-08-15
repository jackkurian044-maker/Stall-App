import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  query,
  orderBy,
  startAt,
  endAt,
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { geohashQueryBounds, distanceBetween } from "geofire-common";
import { MapPin, Search, Locate, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, COLORS, DEFAULT_LOC } from "./constants";
import { bearingRad } from "./geo";
import { autoRefreshStale } from "./ratingSync";
import VendorTicket from "./VendorTicket";
import RadarChart from "./RadarChart";
import ReviewsModal from "./ReviewsModal";
import { watchFavorites, toggleFavorite } from "./favorites";
import TagStoreModal from "./TagStoreModal";

const PAGE_SIZE = 10;

// Debounce how fast the radius slider re-triggers Firestore queries — the
// slider fires onChange continuously while dragging, and we don't want a
// query per pixel of drag.
const RADIUS_QUERY_DEBOUNCE_MS = 350;

/**
 * Runs a geohash bounding-box search against `vendors` for everything
 * within `radiusKm` of `center`, and returns only the docs that are
 * genuinely inside that radius (bounding-box ranges return a superset —
 * geohash boxes are roughly square, radius search is circular — so we
 * filter precisely by haversine distance client-side afterward, but only
 * across the small set the box query returned, not the whole collection).
 */
async function fetchVendorsNear(center, radiusKm) {
  const radiusM = radiusKm * 1000;
  const bounds = geohashQueryBounds([center.lat, center.lng], radiusM);

  const snaps = await Promise.all(
    bounds.map(([start, end]) =>
      getDocs(query(collection(db, "vendors"), orderBy("geohash"), startAt(start), endAt(end)))
    )
  );

  const byId = new Map();
  for (const snap of snaps) {
    for (const d of snap.docs) {
      const data = { id: d.id, ...d.data() };
      if (typeof data.lat !== "number" || typeof data.lng !== "number") continue;
      const distanceKm = distanceBetween([data.lat, data.lng], [center.lat, center.lng]);
      if (distanceKm * 1000 <= radiusM) {
        byId.set(d.id, { ...data, distance: distanceKm });
      }
    }
  }
  return Array.from(byId.values());
}

export default function FindView({ user, isAdmin, onRequestSignIn }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [query_, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [locating, setLocating] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [reviewsVendor, setReviewsVendor] = useState(null);
  const [page, setPage] = useState(1);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [digest, setDigest] = useState(null);
  const [locateError, setLocateError] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const refreshedRef = useRef(new Set());
  const locFromUrlRef = useRef(false);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

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

  // Picks up ?q= (search box), ?lat=&lng= (the landing page's "Use Current
  // Location" button), ?city= (auto-detected nearest city, or the fallback
  // default when geolocation fails), and ?approx=1 (set only for that
  // fallback, since it's a city-center guess rather than a real GPS fix —
  // real fixes keep the tight default radius even when auto-labeled with a
  // nearby city name).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const city = params.get("city");
    const approx = params.get("approx") === "1";
    const lat = parseFloat(params.get("lat"));
    const lng = parseFloat(params.get("lng"));
    if (q) setQuery(q);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setUserLoc({ lat, lng });
      locFromUrlRef.current = true;
      if (approx) setRadiusKm(25);
    }
    if (city) setCityFilter(city);
    if (q || city || approx || (params.has("lat") && params.has("lng"))) {
      params.delete("q");
      params.delete("city");
      params.delete("approx");
      params.delete("lat");
      params.delete("lng");
      const rest = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
    }
  }, []);

  // THE ACTUAL FIX: query only vendors within radiusKm of userLoc via
  // geohash bounding-box ranges, instead of pulling the entire `vendors`
  // collection and filtering client-side. Re-runs (debounced) whenever
  // userLoc or radiusKm changes.
  useEffect(() => {
    if (!userLoc) {
      setVendors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const myRequestId = ++requestIdRef.current;
      try {
        const found = await fetchVendorsNear(userLoc, radiusKm);
        // Guard against a slower earlier request resolving after a newer
        // one (e.g. rapid radius changes) and clobbering fresher results.
        if (myRequestId === requestIdRef.current) {
          setVendors(found);
          setLoading(false);
        }
      } catch (err) {
        console.error("Vendor search failed:", err);
        if (myRequestId === requestIdRef.current) setLoading(false);
      }
    }, RADIUS_QUERY_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [userLoc, radiusKm]);

  // Keep Google-sourced ratings/phone fresh with zero manual clicks —
  // gated by staleness both here (avoid redundant checks this session)
  // and, more importantly, by the Firestore rule itself (avoid redundant
  // *writes* across every visitor's session, which is the real cost control).
  useEffect(() => {
    autoRefreshStale(vendors, refreshedRef.current);
  }, [vendors]);

  const locate = () => {
    setLocating(true);
    setLocateError("");
    setCityFilter("");
    if (!navigator.geolocation) {
      setLocateError("Your browser doesn't support location — enter coordinates below instead.");
      setUserLoc(DEFAULT_LOC);
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocateError("Location access was denied — check your browser/site settings, or enter coordinates below.");
        } else if (err.code === err.TIMEOUT) {
          setLocateError("Location took too long to find — try again, or enter coordinates below.");
        } else {
          setLocateError("Couldn't get your location — try again, or enter coordinates below.");
        }
      },
      { timeout: 12000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  // Ask for location automatically on load — no need to make people tap
  // a button first. If they deny/dismiss the browser prompt, `locate`
  // just leaves userLoc unset and the manual "Use my location" button /
  // coordinate entry below still works as a fallback. Skipped when the
  // landing page's location chips already passed lat/lng in the URL —
  // no need to prompt again for a location we already have.
  useEffect(() => {
    if (locFromUrlRef.current) return;
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useManualLoc = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setUserLoc({ lat, lng });
      setCityFilter("");
    }
  };

  // `vendors` is now already scoped to radiusKm by the query above, so this
  // is just category/text/favorites filtering + sort over a small, already
  // radius-bounded set — not a distance filter over the whole collection.
  const results = useMemo(() => {
    if (!userLoc) return [];
    return vendors
      .filter((v) => categoryFilter === "All" || v.category === categoryFilter)
      .filter((v) => !showFavoritesOnly || favoriteIds.has(v.id))
      .filter((v) => {
        if (!query_.trim()) return true;
        const q = query_.toLowerCase();
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
  }, [vendors, userLoc, categoryFilter, query_, showFavoritesOnly, favoriteIds]);

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
  }, [radiusKm, categoryFilter, query_, userLoc, showFavoritesOnly]);

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
                  width: "100%", background: "#f0b429", color: "#0a0a0a", border: "none", borderRadius: 8,
                  padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, fontWeight: 600, fontSize: 13, marginBottom: 10,
                }}
              >
                <Locate size={16} /> {locating ? "Locating…" : "Use my location"}
              </button>
              {locateError && (
                <div style={{ fontSize: 11.5, color: COLORS.brick, marginBottom: 10 }}>{locateError}</div>
              )}
              <div style={{ fontSize: 11, color: "#9c9c9c", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                or enter coordinates
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="Latitude"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="font-mono"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: `1.5px solid #2a2a2a`, fontSize: 13 }}
                />
                <input
                  placeholder="Longitude"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  className="font-mono"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: `1.5px solid #2a2a2a`, fontSize: 13 }}
                />
              </div>
              <button
                onClick={useManualLoc}
                className="stall-btn"
                style={{ marginTop: 8, width: "100%", background: "transparent", border: `1.5px solid #2a2a2a`, borderRadius: 6, padding: "7px", fontSize: 12, fontWeight: 600 }}
              >
                Set location
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#6bab9d", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={14} /> {cityFilter ? `LOCATION SET — ${cityFilter}` : "LOCATION SET"}
                </div>
                {cityFilter ? (
                  <button
                    onClick={() => { setCityFilter(""); setRadiusKm(5); locate(); }}
                    style={{ background: "none", border: "none", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}
                  >
                    use my location instead
                  </button>
                ) : (
                  <button onClick={locate} style={{ background: "none", border: "none", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>
                    {locating ? "…" : "refresh"}
                  </button>
                )}
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
            <button onClick={dismissDigest} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#6bab9d", fontWeight: 600, flexShrink: 0 }}>
              Dismiss
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px", position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#9c9c9c" }} />
            <input
              placeholder="Search vendors or products…"
              value={query_}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: "100%", padding: "9px 10px 9px 32px", borderRadius: 8, border: `1.5px solid #2a2a2a`, fontSize: 13, background: "#161616", color: "#fff" }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: "9px 10px", borderRadius: 8, border: `1.5px solid #2a2a2a`, fontSize: 13, background: "#161616", color: "#fff" }}
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
                border: `1.5px solid #2a2a2a`, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: showFavoritesOnly ? "#f0b429" : "#161616", color: showFavoritesOnly ? "#0a0a0a" : "#fff",
              }}
            >
              ♥ Favorites
            </button>
          )}
        </div>

        {!userLoc ? (
          <EmptyState text="Set your location on the left to start finding vendors nearby." />
        ) : loading ? (
          <div style={{ fontSize: 13, color: "#9c9c9c" }}>Loading vendors…</div>
        ) : results.length === 0 ? (
          <EmptyState
            text={
              showFavoritesOnly
                ? "No favorites in range yet — tap the heart on a listing to save it here."
                : vendors.length === 0 ? "No vendors listed yet." : "Nothing in range — try widening your search radius."
            }
          />
        ) : null}
        {!userLoc ? null : !loading && results.length === 0 && !showFavoritesOnly && (
          <button
            onClick={() => (user ? setShowTagModal(true) : onRequestSignIn())}
            className="stall-btn"
            style={{
              marginTop: 12, background: "#161616", color: "#fff", border: "none",
              borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Don't see it? Tag it — earn 25 points
          </button>
        )}
        {showTagModal && (
          <TagStoreModal
            user={user}
            onClose={() => setShowTagModal(false)}
            onTagged={() => setShowTagModal(false)}
          />
        )}
        {results.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: "#9c9c9c", marginBottom: 10 }}>
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
                    background: "#161616", border: `1.5px solid #2a2a2a`, borderRadius: 7, padding: "7px 10px",
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
                      background: p === currentPage ? "#f0b429" : "#161616",
                      color: p === currentPage ? "#0a0a0a" : "#fff",
                      border: `1.5px solid #2a2a2a`,
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
                    background: "#161616", border: `1.5px solid #2a2a2a`, borderRadius: 7, padding: "7px 10px",
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
    <div style={{ border: `2px dashed #6f6f6f55`, borderRadius: 12, padding: "40px 20px", textAlign: "center", background: "#16161680" }}>
      <MapPin size={28} color={COLORS.teal} style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 14, color: "#cccccc", maxWidth: 320, margin: "0 auto" }}>{text}</div>
    </div>
  );
}
