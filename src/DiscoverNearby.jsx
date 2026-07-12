import React, { useState } from "react";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { MapPin, Locate, Search, Copy, Loader2 } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, CATEGORY_COLORS, COLORS, DEFAULT_LOC } from "./constants";
import { uid, haversineKm } from "./geo";
import { loadGoogleMaps } from "./googleMaps";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

// Best-effort mapping from Google's place "types" to our own categories.
// Admins can always override per-result before adding.
const TYPE_CATEGORY_MAP = [
  [["restaurant", "food", "bakery", "grocery_or_supermarket", "meal_takeaway", "meal_delivery", "cafe"], "Food & Produce"],
  [["clothing_store", "shoe_store", "jewelry_store"], "Clothing & Accessories"],
  [["hardware_store", "home_goods_store", "furniture_store", "electrician", "plumber"], "Home & Garden"],
  [["hair_care", "beauty_salon", "spa", "laundry", "doctor", "dentist", "pharmacy", "gym", "physiotherapist", "veterinary_care"], "Services"],
  [["store"], "Crafts & Goods"],
];

function guessCategory(types = []) {
  for (const [keys, category] of TYPE_CATEGORY_MAP) {
    if (types.some((t) => keys.includes(t))) return category;
  }
  return "Other";
}

export default function DiscoverNearby() {
  const [centerLoc, setCenterLoc] = useState(null);
  const [locating, setLocating] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [radiusKm, setRadiusKm] = useState(2);
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState({}); // placeId -> bool
  const [adding, setAdding] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importError, setImportError] = useState("");

  const locate = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      setCenterLoc(DEFAULT_LOC);
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenterLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 6000 }
    );
  };

  const useManualLoc = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) setCenterLoc({ lat, lng });
  };

  const runSearch = async (svc, request) => {
    return new Promise((resolve) => {
      svc.nearbySearch(request, (res, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && res) {
          resolve(res);
        } else {
          resolve([]);
        }
      });
    });
  };

  const search = async () => {
    if (!GOOGLE_API_KEY) {
      setSearchError("Google Places API key isn't configured.");
      return;
    }
    if (!centerLoc) {
      setSearchError("Set a center point first (use your location or enter coordinates).");
      return;
    }
    setSearching(true);
    setSearchError("");
    setResults([]);
    setSelected({});
    setImportResults(null);
    try {
      await loadGoogleMaps(GOOGLE_API_KEY);
      const svc = new window.google.maps.places.PlacesService(document.createElement("div"));
      const request = {
        location: new window.google.maps.LatLng(centerLoc.lat, centerLoc.lng),
        radius: Math.round(radiusKm * 1000),
        keyword: keyword.trim() || undefined,
      };
      const res = await runSearch(svc, request);
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
      }));
      setResults(mapped);
    } catch {
      setSearchError("Search failed — try again.");
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (placeId) => {
    setSelected((s) => ({ ...s, [placeId]: !s[placeId] }));
  };

  const updateResultCategory = (placeId, category) => {
    setResults((rs) => rs.map((r) => (r.placeId === placeId ? { ...r, category } : r)));
  };

  const selectedResults = results.filter((r) => selected[r.placeId]);

  const addSelected = async () => {
    if (selectedResults.length === 0) return;
    setAdding(true);
    setImportError("");
    try {
      await loadGoogleMaps(GOOGLE_API_KEY);
      const svc = new window.google.maps.places.PlacesService(document.createElement("div"));
      const detailsFor = (placeId) =>
        new Promise((resolve) => {
          svc.getDetails({ placeId, fields: ["formatted_address", "website", "url", "opening_hours"] }, (place, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place) resolve(place);
            else resolve({});
          });
        });

      const batch = writeBatch(db);
      const created = [];
      for (const r of selectedResults) {
        const details = await detailsFor(r.placeId);
        const ref = doc(collection(db, "vendors"));
        const code = uid(6);
        batch.set(ref, {
          name: r.name,
          category: r.category,
          description: "",
          products: "",
          address: details.formatted_address || r.vicinity || "",
          phone: "",
          lat: r.lat,
          lng: r.lng,
          website: details.website || null,
          mapsUrl: details.url || null,
          placeId: r.placeId,
          rating: r.rating,
          ratingsCount: r.ratingsCount,
          hours: details.opening_hours?.weekday_text?.length ? details.opening_hours.weekday_text.join("\n") : "",
          photos: [],
          ownerId: null,
          claimCode: code,
          createdAt: serverTimestamp(),
          ratingUpdatedAt: r.placeId ? serverTimestamp() : null,
        });
        created.push({ name: r.name, code });
        await new Promise((res) => setTimeout(res, 150)); // gentle pacing
      }
      await batch.commit();
      setImportResults(created);
      setResults([]);
      setSelected({});
    } catch {
      setImportError("Import failed — check your admin doc exists and try again.");
    } finally {
      setAdding(false);
    }
  };

  const copyResults = () => {
    const text = importResults.map((r) => `${r.name}: ${r.code}`).join("\n");
    navigator.clipboard?.writeText(text);
  };

  const inputStyle = {
    padding: "9px 10px", borderRadius: 7,
    border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box",
  };

  if (importResults) {
    return (
      <div style={{ padding: 24, maxWidth: 640 }}>
        <div className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Added {importResults.length} vendor{importResults.length === 1 ? "" : "s"}
        </div>
        <div style={{ fontSize: 12.5, color: "#666", marginBottom: 14 }}>
          Share each claim code with that business — they enter it under
          "Claim a listing" in My Listings to take over editing.
        </div>
        <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
          {importResults.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex", justifyContent: "space-between", padding: "8px 0",
                borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}15`, fontSize: 13,
              }}
            >
              <span>{r.name}</span>
              <span className="font-mono" style={{ fontWeight: 700 }}>{r.code}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copyResults} className="stall-btn" style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "9px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Copy size={14} /> Copy all as text
          </button>
          <button onClick={() => setImportResults(null)} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "9px 14px", fontSize: 13, fontWeight: 600 }}>
            Search again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Discover nearby vendors</div>
      <div style={{ fontSize: 12.5, color: "#666", marginBottom: 16, lineHeight: 1.5 }}>
        Set a center point, search a category (e.g. "medical store", "bakery"),
        and pick which real nearby results to add — nothing is added until
        you select it and click Add. Shows up to ~20 nearest matches per
        search; narrow the keyword or shrink the radius for a more specific
        set if you don't see what you're after.
      </div>

      <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        {!centerLoc ? (
          <div>
            <div style={{ fontSize: 13, marginBottom: 10 }}>Set a center point to search around.</div>
            <button onClick={locate} className="stall-btn" style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
              <Locate size={16} /> {locating ? "Locating…" : "Use my location"}
            </button>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>or enter coordinates</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="Latitude" value={manualLat} onChange={(e) => setManualLat(e.target.value)} className="font-mono" style={{ ...inputStyle, flex: 1 }} />
              <input placeholder="Longitude" value={manualLng} onChange={(e) => setManualLng(e.target.value)} className="font-mono" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={useManualLoc} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "0 14px", fontSize: 12.5, fontWeight: 600 }}>Set</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: COLORS.teal, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={14} /> CENTER SET · <span className="font-mono">{centerLoc.lat.toFixed(4)}, {centerLoc.lng.toFixed(4)}</span>
              </div>
              <button onClick={locate} style={{ background: "none", border: "none", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>{locating ? "…" : "re-locate"}</button>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>Search for</label>
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. medical store, bakery, salon" style={{ ...inputStyle, width: "100%" }} />
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>
                  <span>Radius</span>
                  <span className="font-mono">{radiusKm} km</span>
                </div>
                <input type="range" min={0.5} max={10} step={0.5} value={radiusKm} onChange={(e) => setRadiusKm(parseFloat(e.target.value))} style={{ width: "100%", accentColor: COLORS.brick }} />
              </div>
              <button onClick={search} disabled={searching} className="stall-btn" style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "10px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Search size={15} /> {searching ? "Searching…" : "Search nearby"}
              </button>
            </div>
          </div>
        )}
      </div>

      {searchError && <div style={{ color: COLORS.brick, fontSize: 12.5, marginBottom: 12 }}>{searchError}</div>}
      {importError && <div style={{ color: COLORS.brick, fontSize: 12.5, marginBottom: 12 }}>{importError}</div>}

      {results.length > 0 && (
        <>
          <div style={{ fontSize: 12.5, color: "#666", marginBottom: 8 }}>
            {results.length} result{results.length === 1 ? "" : "s"} · {selectedResults.length} selected
          </div>
          <div style={{ border: `2px solid ${COLORS.ink}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            {results.map((r, i) => {
              const dist = centerLoc ? haversineKm(centerLoc, { lat: r.lat, lng: r.lng }) : null;
              return (
                <div key={r.placeId} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}15`, background: selected[r.placeId] ? `${COLORS.marigold}15` : "#fff" }}>
                  <input type="checkbox" checked={!!selected[r.placeId]} onChange={() => toggleSelect(r.placeId)} style={{ marginTop: 4, width: 16, height: 16, accentColor: COLORS.brick, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{r.name}</span>
                      {r.rating != null && (
                        <span style={{ fontSize: 11, color: "#666" }}>★ {r.rating.toFixed(1)}{r.ratingsCount != null ? ` (${r.ratingsCount})` : ""}</span>
                      )}
                      {dist != null && <span className="font-mono" style={{ fontSize: 11, color: "#999" }}>{dist.toFixed(1)} km</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#777", marginBottom: 4 }}>{r.vicinity}</div>
                    <select
                      value={r.category}
                      onChange={(e) => updateResultCategory(r.placeId, e.target.value)}
                      style={{ fontSize: 11, padding: "3px 6px", borderRadius: 6, border: `1px solid ${COLORS.ink}55`, background: "#fff" }}
                    >
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={addSelected}
            disabled={adding || selectedResults.length === 0}
            className="stall-btn"
            style={{ background: COLORS.brick, color: "#fff", border: "none", borderRadius: 7, padding: "10px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
          >
            {adding && <Loader2 size={14} className="spin" />}
            {adding ? "Adding…" : `Add ${selectedResults.length} selected`}
          </button>
        </>
      )}
    </div>
  );
}
