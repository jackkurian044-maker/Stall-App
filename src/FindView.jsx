import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { MapPin, Search, Locate } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, COLORS, DEFAULT_LOC } from "./constants";
import { haversineKm, bearingRad } from "./geo";
import VendorTicket from "./VendorTicket";
import RadarChart from "./RadarChart";

export default function FindView() {
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

  return (
    <div className="stall-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 16 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {results.map((v) => (
              <VendorTicket key={v.id} vendor={v} highlighted={selected === v.id} onClick={() => setSelected(v.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: "40px 20px", textAlign: "center" }}>
      <MapPin size={28} color={COLORS.teal} style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 14, color: "#444", maxWidth: 320, margin: "0 auto" }}>{text}</div>
    </div>
  );
}
