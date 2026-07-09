import React, { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, Pencil } from "lucide-react";
import { COLORS, DEFAULT_LOC } from "./constants";
import MapPicker from "./MapPicker";

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
  const [highlighted, setHighlighted] = useState(-1);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);
  const hasLocation = lat !== "" && lng !== "" && lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

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
    setHighlighted(-1);
    setSearched(false);
    // Editing the text after a location was already set means it's no
    // longer confirmed — clear coordinates so submitting can't silently
    // pair the old coordinates with new, unconfirmed address text.
    if (hasLocation) {
      onChange({ address: val, lat: "", lng: "" });
    }
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
        setHighlighted(-1);
        setSearched(true);
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
    setHighlighted(-1);
    setError("");
    onChange({
      address: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      // Always stop this from submitting the surrounding form — the
      // person needs to pick a suggestion first (or use manual entry).
      e.preventDefault();
      if (open && suggestions.length > 0) {
        pick(suggestions[highlighted >= 0 ? highlighted : 0]);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0) {
        setOpen(true);
        setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handlePinMove = useCallback(
    ({ lat: newLat, lng: newLng }) => {
      onChange({ address, lat: newLat, lng: newLng });
    },
    [address, onChange]
  );

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
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
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
        <MapPicker
          lat={hasLocation ? Number(lat) : DEFAULT_LOC.lat}
          lng={hasLocation ? Number(lng) : DEFAULT_LOC.lng}
          onMove={handlePinMove}
        />
        <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
          {hasLocation
            ? "Drag the pin to fine-tune the exact spot."
            : "Or just drag the pin below onto the right spot — no typing needed."}
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
          onKeyDown={handleKeyDown}
          placeholder="Start typing the business address…"
        />
        {loading && (
          <Loader2 size={15} className="spin" style={{ position: "absolute", right: 10, top: 11, color: "#777" }} />
        )}
      </div>

      {hasLocation ? (
        <>
          <div className="font-mono" style={{ fontSize: 11, color: COLORS.teal, marginTop: 4, marginBottom: 8 }}>
            ✓ location set ({Number(lat).toFixed(5)}, {Number(lng).toFixed(5)})
          </div>
          <MapPicker lat={Number(lat)} lng={Number(lng)} onMove={handlePinMove} />
          <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
            Drag the pin if it's not exactly on the storefront.
          </div>
        </>
      ) : loading ? null : searched && suggestions.length === 0 ? (
        <div style={{ fontSize: 11, color: COLORS.brick, marginTop: 4, lineHeight: 1.4 }}>
          No matches for that. Try a shorter version — just street, area, and
          city (e.g. "15th Main Road, Kodihalli, Bengaluru") tends to work
          better than a full address with floor/unit numbers — or switch to
          "enter manually" and place the pin on the map yourself.
        </div>
      ) : query.trim().length >= 3 ? (
        <div style={{ fontSize: 11, color: COLORS.brick, marginTop: 4 }}>
          Pick a suggestion below to confirm the exact location.
        </div>
      ) : null}
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
                background: highlighted === i ? `${COLORS.marigold}33` : "transparent",
                borderBottom: i === suggestions.length - 1 ? "none" : `1px solid ${COLORS.ink}15`,
              }}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlighted(i)}
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
