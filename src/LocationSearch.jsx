import React, { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Pencil } from "lucide-react";
import { COLORS } from "./constants";

// Free, keyless geocoding via OpenStreetMap's Nominatim service.
// Usage policy: keep to ~1 request/second and identify the app.
// https://operations.osmfoundation.org/policies/nominatim/
async function searchAddress(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=5&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error("geocoding request failed");
  return res.json();
}

/**
 * Address search box with autocomplete suggestions.
 * Calls onSelect({ address, lat, lng }) when the person picks a result.
 * Falls back to manual lat/lng entry if a business can't be found.
 */
export default function LocationSearch({ address, lat, lng, onChange }) {
  const [query, setQuery] = useState(address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    setQuery(address || "");
  }, [address]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleQueryChange = (val) => {
    setQuery(val);
    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchAddress(val.trim());
        setSuggestions(results);
        setOpen(true);
      } catch {
        setError("Couldn't reach the address lookup service — try again, or enter coordinates manually.");
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  const pick = (result) => {
    setQuery(result.display_name);
    setOpen(false);
    setSuggestions([]);
    onChange({
      address: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    });
  };

  const inputStyle = {
    width: "100%", padding: "9px 10px", borderRadius: 7,
    border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box",
  };

  if (manualMode) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Address & coordinates</label>
          <button
            type="button"
            onClick={() => setManualMode(false)}
            style={{ background: "none", border: "none", color: COLORS.teal, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
          >
            search by address instead
          </button>
        </div>
        <input
          style={{ ...inputStyle, marginBottom: 8 }}
          value={address || ""}
          onChange={(e) => onChange({ address: e.target.value, lat, lng })}
          placeholder="Street, area, city"
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="font-mono"
            style={inputStyle}
            value={lat ?? ""}
            onChange={(e) => onChange({ address, lat: e.target.value === "" ? "" : parseFloat(e.target.value), lng })}
            placeholder="Latitude"
          />
          <input
            className="font-mono"
            style={inputStyle}
            value={lng ?? ""}
            onChange={(e) => onChange({ address, lat, lng: e.target.value === "" ? "" : parseFloat(e.target.value) })}
            placeholder="Longitude"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12, position: "relative" }} ref={boxRef}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Address</label>
        <button
          type="button"
          onClick={() => setManualMode(true)}
          style={{ background: "none", border: "none", color: "#777", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          <Pencil size={11} /> enter manually
        </button>
      </div>
      <div style={{ position: "relative" }}>
        <MapPin size={15} style={{ position: "absolute", left: 10, top: 11, color: "#777" }} />
        <input
          style={{ ...inputStyle, paddingLeft: 32 }}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Start typing the business address…"
        />
        {loading && (
          <Loader2 size={15} className="spin" style={{ position: "absolute", right: 10, top: 11, color: "#777" }} />
        )}
      </div>

      {lat != null && lng != null && lat !== "" && lng !== "" && (
        <div className="font-mono" style={{ fontSize: 11, color: COLORS.teal, marginTop: 4 }}>
          ✓ location set ({Number(lat).toFixed(5)}, {Number(lng).toFixed(5)})
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: COLORS.brick, marginTop: 4 }}>{error}</div>}

      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
            background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 8,
            marginTop: 4, maxHeight: 220, overflowY: "auto",
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.place_id || i}
              onClick={() => pick(s)}
              style={{
                padding: "9px 12px", fontSize: 12.5, cursor: "pointer",
                borderBottom: i === suggestions.length - 1 ? "none" : `1px solid ${COLORS.ink}15`,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {s.display_name}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
        Address search by OpenStreetMap contributors
      </div>

      <style>{`
        .spin { animation: stall-spin 1s linear infinite; }
        @keyframes stall-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
