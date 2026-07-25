import React, { useState } from "react";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { MapPin, Locate, Search, Copy, Loader2 } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, COLORS, DEFAULT_LOC } from "./constants";
import { uid, haversineKm } from "./geo";
import { searchNearby } from "./overpass";
import { findExistingPlaceIds } from "./duplicateCheck";

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

  const search = async () => {
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
      const raw = await searchNearby(centerLoc, radiusKm, keyword.trim());
      const existingPlaceIds = await findExistingPlaceIds(db, raw.map((p) => p.placeId));
      const withDistance = raw.map((p) => ({
        ...p,
        alreadyListed: existingPlaceIds.has(p.placeId),
        distKm: haversineKm(centerLoc, { lat: p.lat, lng: p.lng }),
      }));
      withDistance.sort((a, b) => a.distKm - b.distKm);
      setResults(withDistance.slice(0, 40));
    } catch {
      setSearchError("Search failed — the free map data source may be busy, try again in a moment.");
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (placeId) => {
    const r = results.find((res) => res.placeId === placeId);
    if (r?.alreadyListed) return; // already on Stall — can't be re-added
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
      const batch = writeBatch(db);
      const created = [];
      for (const r of selectedResults) {
        const ref = doc(collection(db, "vendors"));
        const code = uid(6);
        batch.set(ref, {
          name: r.name,
          category: r.category,
          description: "",
          products: "",
          address: r.vicinity || "",
          phone: r.phone || "",
          lat: r.lat,
          lng: r.lng,
          website: r.website || null,
          mapsUrl: null,
          placeId: r.placeId,
          rating: r.rating,
          ratingsCount: r.ratingsCount,
          hours: r.hours || "",
          photos: [],
          ownerId: null,
          claimCode: code,
          createdAt: serverTimestamp(),
          ratingUpdatedAt: null,
        });
        created.push({ name: r.name, code });
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
    padding: "9px 10px", borderRadius: 14,
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
        <div style={{ background: "#fff", border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)", borderRadius: 20, padding: 16, marginBottom: 14 }}>
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
          <button onClick={copyResults} className="stall-btn" style={{ background: COLORS.navy, color: "#fff", border: "none", borderRadius: 999, padding: "9px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Copy size={14} /> Copy all as text
          </button>
          <button onClick={() => setImportResults(null)} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 14, padding: "9px 14px", fontSize: 13, fontWeight: 600 }}>
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
        you select it and click Add. Powered by free OpenStreetMap data, so
        coverage of small local businesses can be thinner than Google's —
        narrow the keyword or widen the radius if you don't see what you're
        after.
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)", borderRadius: 20, padding: 16, marginBottom: 16 }}>
        {!centerLoc ? (
          <div>
            <div style={{ fontSize: 13, marginBottom: 10 }}>Set a center point to search around.</div>
            <button onClick={locate} className="stall-btn" style={{ background: COLORS.navy, color: "#fff", border: "none", borderRadius: 999, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
              <Locate size={16} /> {locating ? "Locating…" : "Use my location"}
            </button>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>or enter coordinates</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="Latitude" value={manualLat} onChange={(e) => setManualLat(e.target.value)} className="font-mono" style={{ ...inputStyle, flex: 1 }} />
              <input placeholder="Longitude" value={manualLng} onChange={(e) => setManualLng(e.target.value)} className="font-mono" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={useManualLoc} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 14, padding: "0 14px", fontSize: 12.5, fontWeight: 600 }}>Set</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: COLORS.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={14} /> CENTER SET · <span className="font-mono">{centerLoc.lat.toFixed(4)}, {centerLoc.lng.toFixed(4)}</span>
              </div>
              <button onClick={locate} style={{ background: "none", border: "none", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>{locating ? "…" : "re-locate"}</button>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>Search for (optional)</label>
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. medical store, bakery, salon — leave blank for everything nearby" style={{ ...inputStyle, width: "100%" }} />
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>
                  <span>Radius</span>
                  <span className="font-mono">{radiusKm} km</span>
                </div>
                <input type="range" min={0.5} max={10} step={0.5} value={radiusKm} onChange={(e) => setRadiusKm(parseFloat(e.target.value))} style={{ width: "100%", accentColor: COLORS.brick }} />
              </div>
              <button onClick={search} disabled={searching} className="stall-btn" style={{ background: COLORS.navy, color: "#fff", border: "none", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
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
            {results.some((r) => r.alreadyListed) && ` · ${results.filter((r) => r.alreadyListed).length} already on Stall`}
          </div>
          <div style={{ border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)", borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
            {results.map((r, i) => (
              <div key={r.placeId} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}15`, background: r.alreadyListed ? "#f5f5f5" : selected[r.placeId] ? `${COLORS.marigold}15` : "#fff", opacity: r.alreadyListed ? 0.6 : 1 }}>
                <input type="checkbox" checked={!!selected[r.placeId]} disabled={r.alreadyListed} onChange={() => toggleSelect(r.placeId)} style={{ marginTop: 4, width: 16, height: 16, accentColor: COLORS.brick, flexShrink: 0, cursor: r.alreadyListed ? "not-allowed" : "pointer" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{r.name}</span>
                    {r.alreadyListed && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 16, background: COLORS.ink, color: "#fff" }}>
                        Already listed
                      </span>
                    )}
                    <span className="font-mono" style={{ fontSize: 11, color: "#999" }}>{r.distKm.toFixed(1)} km</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#777", marginBottom: 4 }}>{r.vicinity}</div>
                  <select
                    value={r.category}
                    onChange={(e) => updateResultCategory(r.placeId, e.target.value)}
                    style={{ fontSize: 11, padding: "3px 6px", borderRadius: 20, border: `1px solid ${COLORS.ink}55`, background: "#fff" }}
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addSelected}
            disabled={adding || selectedResults.length === 0}
            className="stall-btn"
            style={{ background: COLORS.brick, color: "#fff", border: "none", borderRadius: 14, padding: "10px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
          >
            {adding && <Loader2 size={14} className="spin" />}
            {adding ? "Adding…" : `Add ${selectedResults.length} selected`}
          </button>
        </>
      )}
    </div>
  );
}
