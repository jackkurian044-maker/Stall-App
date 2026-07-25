import React, { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Pencil } from "lucide-react";
import { COLORS, DEFAULT_LOC } from "./constants";
import MapPicker from "./MapPicker";
import { searchPlaces, debounce } from "./nominatim";

// Bias search results toward the local area (±0.5° ~ 55km) so a nearby
// branch surfaces first — same spirit as the old Google `bounds` option.
const LOCAL_BOUNDS = {
  north: DEFAULT_LOC.lat + 0.5,
  south: DEFAULT_LOC.lat - 0.5,
  east: DEFAULT_LOC.lng + 0.5,
  west: DEFAULT_LOC.lng - 0.5,
};

/**
 * Address / business search box.
 * Uses free OpenStreetMap/Nominatim search-as-you-type so people can
 * search by business name or address without any billing account.
 * Calls onChange({ address, lat, lng, website, mapsUrl, placeId, rating,
 * ratingsCount }) once a suggestion is picked, and shows a free
 * OpenStreetMap-based draggable pin map to fine-tune the exact spot
 * afterward. Nominatim results don't carry a website, phone, hours, or
 * rating (unlike the old Google source) — those stay null/unset and can
 * still be filled in manually elsewhere in the form.
 */
export default function LocationSearch({ address, lat, lng, website, mapsUrl, placeId, rating, ratingsCount, onChange }) {
  const [manualMode, setManualMode] = useState(false);
  const [query, setQuery] = useState(address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const boxRef = useRef(null);

  const hasLocation =
    lat !== "" && lng !== "" && lat != null && lng != null &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  useEffect(() => {
    setQuery(address || "");
  }, [address]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const runSearch = useCallback(
    debounce(async (q) => {
      setSearching(true);
      setSearchFailed(false);
      try {
        const results = await searchPlaces(q, { bounds: LOCAL_BOUNDS });
        setSuggestions(results);
        setShowDropdown(true);
      } catch {
        setSearchFailed(true);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 450),
    []
  );

  const handlePinMove = useCallback(
    ({ lat: newLat, lng: newLng }) => {
      onChange({ address, lat: newLat, lng: newLng, website, mapsUrl, placeId, rating, ratingsCount });
    },
    [address, website, mapsUrl, placeId, rating, ratingsCount, onChange]
  );

  const handleTypedChange = (val) => {
    setQuery(val);
    // Typing after a location was already confirmed invalidates it —
    // clear coordinates (and any linked website/profile/rating, since
    // they belonged to the previous confirmed place) so an edited,
    // unconfirmed address can't silently keep stale data.
    if (hasLocation) {
      onChange({ address: val, lat: "", lng: "", website: null, mapsUrl: null, placeId: null, rating: null, ratingsCount: null });
    }
    if (val.trim().length >= 2) {
      runSearch(val.trim());
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = (s) => {
    setQuery(s.label);
    setShowDropdown(false);
    setSuggestions([]);
    onChange({
      address: s.label,
      lat: s.lat,
      lng: s.lng,
      website: null,
      mapsUrl: null,
      placeId: null,
      rating: null,
      ratingsCount: null,
    });
  };

  const preventFormSubmitOnEnter = (e) => {
    if (e.key === "Enter") e.preventDefault();
  };

  const inputStyle = {
    width: "100%", padding: "9px 10px", borderRadius: 14,
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
            style={{ background: "none", border: "none", color: COLORS.green, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
          >
            search by name/address instead
          </button>
        </div>
        <input
          style={{ ...inputStyle, marginBottom: 8 }}
          value={address || ""}
          onChange={(e) => onChange({ address: e.target.value, lat, lng, website, mapsUrl, placeId, rating, ratingsCount })}
          placeholder="Street, area, city"
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            className="font-mono"
            style={inputStyle}
            value={lat ?? ""}
            onChange={(e) => onChange({ address, lat: e.target.value === "" ? "" : parseFloat(e.target.value), lng, website, mapsUrl, placeId, rating, ratingsCount })}
            placeholder="Latitude"
          />
          <input
            className="font-mono"
            style={inputStyle}
            value={lng ?? ""}
            onChange={(e) => onChange({ address, lat, lng: e.target.value === "" ? "" : parseFloat(e.target.value), website, mapsUrl, placeId, rating, ratingsCount })}
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
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Business name or address</label>
        <button
          type="button"
          onClick={() => setManualMode(true)}
          style={{ background: "none", border: "none", color: "#777", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          <Pencil size={11} /> enter manually
        </button>
      </div>
      <div ref={boxRef} style={{ position: "relative" }}>
        <MapPin size={15} style={{ position: "absolute", left: 10, top: 11, color: "#777" }} />
        <input
          style={{ ...inputStyle, paddingLeft: 32 }}
          value={query}
          onChange={(e) => handleTypedChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onKeyDown={preventFormSubmitOnEnter}
          placeholder={searching ? "Searching…" : "Search business name or address…"}
        />

        {showDropdown && suggestions.length > 0 && (
          <div
            style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
              background: "#fff", border: `1.5px solid ${COLORS.ink}`, borderRadius: 14,
              marginTop: 4, maxHeight: 220, overflowY: "auto",
              boxShadow: "0 8px 24px rgba(15,26,36,0.15)",
            }}
          >
            {suggestions.map((s, i) => (
              <div
                key={s.osmId || i}
                onClick={() => handleSelect(s)}
                style={{
                  padding: "9px 12px", fontSize: 12.5, cursor: "pointer",
                  borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}12`,
                }}
                onMouseDown={(e) => e.preventDefault()} // keep input focus, avoid blur-before-click
              >
                {s.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {hasLocation ? (
        <>
          <div className="font-mono" style={{ fontSize: 11, color: COLORS.green, marginTop: 4, marginBottom: rating != null ? 2 : 8 }}>
            ✓ location set ({Number(lat).toFixed(5)}, {Number(lng).toFixed(5)})
          </div>
          {rating != null && (
            <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
              ★ {rating.toFixed(1)} rating{ratingsCount != null ? ` (${ratingsCount} reviews)` : ""} — captured previously, not live-updating
            </div>
          )}
          <MapPicker lat={Number(lat)} lng={Number(lng)} onMove={handlePinMove} />
          <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
            Drag the pin if it's not exactly on the storefront.
          </div>
        </>
      ) : searchFailed ? (
        <div style={{ fontSize: 11, color: COLORS.brick, marginTop: 4 }}>
          Address search failed — try again, or switch to "enter manually".
        </div>
      ) : query.trim().length >= 2 && !showDropdown && !searching ? (
        <div style={{ fontSize: 11, color: COLORS.brick, marginTop: 4 }}>
          No matches — try a shorter search, or switch to "enter manually".
        </div>
      ) : null}

      <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
        Business search & pin map powered by OpenStreetMap contributors
      </div>
    </div>
  );
}
