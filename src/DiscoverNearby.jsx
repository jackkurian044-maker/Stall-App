import React, { useEffect, useRef, useState } from "react";
import { writeBatch, doc, collection, serverTimestamp } from "firebase/firestore";
import { Search, Loader2, MapPin } from "lucide-react";
import { db } from "./firebase";
import { COLORS, CATEGORY_COLORS } from "./constants";
import { loadGoogleMaps } from "./googleMaps";
import { findExistingPlaceIds } from "./duplicateCheck";
import { uid, haversineKm } from "./geo";
import { encodeGeohash } from "./geohash";

function guessCategory(types = []) {
  const map = {
    bakery: "Food & Produce", cafe: "Food & Produce", restaurant: "Food & Produce",
    grocery_or_supermarket: "Food & Produce", food: "Food & Produce",
    clothing_store: "Clothing & Accessories", shoe_store: "Clothing & Accessories",
    hardware_store: "Home & Garden", florist: "Home & Garden", home_goods_store: "Home & Garden",
    book_store: "Crafts & Goods", jewelry_store: "Crafts & Goods", art_gallery: "Crafts & Goods",
    hair_care: "Services", beauty_salon: "Services", laundry: "Services", electrician: "Services", plumber: "Services",
  };
  for (const t of types) if (map[t]) return map[t];
  return "Other";
}

export default function DiscoverNearby() {
  const [query, setQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState(3);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState({});
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [userLoc, setUserLoc] = useState(null);
  const svcRef = useRef(null);
  const mapDivRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  const runSearch = (svc, request) =>
    new Promise((resolve, reject) => {
      svc.nearbySearch(request, (res, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) resolve(res || []);
        else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) resolve([]);
        else reject(new Error(status));
      });
    });

  const search = async () => {
    if (!userLoc) {
      setError("Waiting for your location — allow location access and try again.");
      return;
    }
    setSearching(true);
    setError("");
    setSelected({});
    try {
      await loadGoogleMaps();
      if (!mapDivRef.current) mapDivRef.current = document.createElement("div");
      const map = new window.google.maps.Map(mapDivRef.current);
      const svc = new window.google.maps.places.PlacesService(map);
      svcRef.current = svc;

      const request = {
        location: new window.google.maps.LatLng(userLoc.lat, userLoc.lng),
        radius: radiusKm * 1000,
        keyword: query.trim() || undefined,
      };

      const res = await runSearch(svc, request);
      const existingPlaceIds = await findExistingPlaceIds(db, res.map((p) => p.place_id));
      const mapped = res.map((p) => ({
        placeId: p.place_id,
        name: p.name,
        vicinity: p.vicinity || "",
        lat: p.geometry?.location?.lat(),
        lng: p.geometry?.location?.lng(),
        rating: typeof p.rating === "number" ? p.rating : null,
        ratingsCount: typeof p.user_ratings_total === "number" ? p.user_ratings_total : null,
        types: p.types || [],
        category: guessCategory(p.types),
        alreadyListed: existingPlaceIds.has(p.place_id),
      }));
      setResults(mapped);
    } catch (err) {
      setError("Search failed — try again in a moment.");
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (placeId) => {
    const r = results.find((res) => res.placeId === placeId);
    if (r?.alreadyListed) return; // already on Stall — can't be re-added
    setSelected((s) => ({ ...s, [placeId]: !s[placeId] }));
  };

  const setResultCategory = (placeId, category) => {
    setResults((rs) => rs.map((r) => (r.placeId === placeId ? { ...r, category } : r)));
  };

  const selectedResults = results.filter((r) => selected[r.placeId]);

  const addSelected = async () => {
    if (selectedResults.length === 0) return;
    setAdding(true);
    try {
      const batch = writeBatch(db);
      for (const r of selectedResults) {
        const ref = doc(collection(db, "vendors"));
        const code = uid(6);
        batch.set(ref, {
          name: r.name,
          category: r.category,
          description: "",
          products: "",
          address: r.vicinity,
          phone: "",
          lat: r.lat,
          lng: r.lng,
          // Same reasoning as VendorDashboard.jsx: without this, a
          // bulk-added listing would be invisible to FindView.jsx's
          // proximity search regardless of how close it actually is.
          geohash: encodeGeohash(r.lat, r.lng, 9),
          website: null,
          mapsUrl: `https://www.google.com/maps/place/?q=place_id:${r.placeId}`,
          placeId: r.placeId,
          rating: r.rating,
          ratingsCount: r.ratingsCount,
          hours: "",
          photos: [],
          preferredLink: null,
          offer: "",
          offerExpiresAt: null,
          ownerId: null,
          addedByAgentId: null,
          claimCode: code,
          createdAt: serverTimestamp(),
          ratingUpdatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setAddedCount((c) => c + selectedResults.length);
      setResults((rs) => rs.map((r) => (selected[r.placeId] ? { ...r, alreadyListed: true } : r)));
      setSelected({});
    } catch (err) {
      setError("Couldn't add listings — try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Discover Nearby</div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
        Search Google Places around your current location and bulk-add real businesses to Stall.
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="e.g. bakery, tailor, hardware…"
          style={{ flex: "1 1 220px", padding: "9px 10px", borderRadius: 8, border: `1.5px solid ${COLORS.ink}`, fontSize: 13 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
          <span>{radiusKm} km</span>
          <input type="range" min={0.5} max={10} step={0.5} value={radiusKm} onChange={(e) => setRadiusKm(parseFloat(e.target.value))} />
        </div>
        <button
          onClick={search}
          disabled={searching}
          className="stall-btn"
          style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
        >
          {searching ? <Loader2 size={14} className="spin" /> : <Search size={14} />} Search nearby
        </button>
      </div>
      {!userLoc && <div style={{ fontSize: 11.5, color: "#999", marginBottom: 10 }}>Waiting for your location…</div>}
      {error && <div style={{ fontSize: 12, color: COLORS.brick, marginBottom: 10 }}>{error}</div>}

      {results.length > 0 && (
        <>
          <div style={{ fontSize: 12.5, color: "#666", marginBottom: 8 }}>
            {results.length} result{results.length === 1 ? "" : "s"} · {selectedResults.length} selected
            {results.some((r) => r.alreadyListed) && ` · ${results.filter((r) => r.alreadyListed).length} already on Stall`}
          </div>
          <div style={{ border: `1.5px solid ${COLORS.ink}33`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
            {results.map((r, i) => {
              const dist = userLoc ? haversineKm(userLoc, { lat: r.lat, lng: r.lng }) : null;
              return (
                <div key={r.placeId} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}15`, background: r.alreadyListed ? "#f5f5f5" : selected[r.placeId] ? `${COLORS.marigold}15` : "#fff", opacity: r.alreadyListed ? 0.6 : 1 }}>
                  <input type="checkbox" checked={!!selected[r.placeId]} disabled={r.alreadyListed} onChange={() => toggleSelect(r.placeId)} style={{ marginTop: 4, width: 16, height: 16, accentColor: COLORS.brick, flexShrink: 0, cursor: r.alreadyListed ? "not-allowed" : "pointer" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{r.name}</span>
                      {r.alreadyListed && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: COLORS.ink, color: "#fff" }}>
                          Already listed
                        </span>
                      )}
                      {r.rating != null && (
                        <span style={{ fontSize: 11, color: "#666" }}>★ {r.rating.toFixed(1)}{r.ratingsCount != null ? ` (${r.ratingsCount})` : ""}</span>
                      )}
                      {dist != null && <span className="font-mono" style={{ fontSize: 11, color: "#999" }}>{dist.toFixed(1)} km</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{r.vicinity}</div>
                    <select
                      value={r.category}
                      disabled={r.alreadyListed}
                      onChange={(e) => setResultCategory(r.placeId, e.target.value)}
                      style={{ marginTop: 6, fontSize: 11.5, padding: "3px 8px", borderRadius: 6, border: `1px solid ${COLORS.ink}33`, color: CATEGORY_COLORS[r.category] || COLORS.ink }}
                    >
                      {Object.keys(CATEGORY_COLORS).map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={addSelected}
            disabled={selectedResults.length === 0 || adding}
            className="stall-btn"
            style={{
              width: "100%", background: selectedResults.length ? COLORS.ink : "#ccc", color: "#fff", border: "none",
              borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8, cursor: selectedResults.length ? "pointer" : "default",
            }}
          >
            <MapPin size={15} /> {adding ? "Adding…" : `Add ${selectedResults.length || ""} to Stall`}
          </button>
          {addedCount > 0 && (
            <div style={{ fontSize: 12, color: COLORS.teal, marginTop: 8, textAlign: "center" }}>
              {addedCount} listing{addedCount === 1 ? "" : "s"} added this session.
            </div>
          )}
        </>
      )}
    </div>
  );
}
