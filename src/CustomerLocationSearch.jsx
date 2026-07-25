import React, { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { COLORS, DEFAULT_LOC } from "./constants";
import { searchPlaces, debounce } from "./nominatim";

const LOCAL_BOUNDS = {
  north: DEFAULT_LOC.lat + 0.5,
  south: DEFAULT_LOC.lat - 0.5,
  east: DEFAULT_LOC.lng + 0.5,
  west: DEFAULT_LOC.lng - 0.5,
};

/**
 * Lightweight "where am I" search box for customers browsing FindView.
 * Uses free OpenStreetMap/Nominatim search-as-you-type — no billing
 * account needed. Unlike LocationSearch (used for vendor listing address
 * entry), this captures nothing beyond what's needed to center the
 * search: { address, lat, lng }.
 *
 * Calls onSelect({ address, lat, lng }) once a suggestion is chosen from
 * the dropdown.
 */
export default function CustomerLocationSearch({ onSelect, placeholder }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const runSearch = useRef(
    debounce(async (q, setSuggestions, setShowDropdown, setSearching, setSearchFailed) => {
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
    }, 450)
  ).current;

  const handleTypedChange = (val) => {
    setQuery(val);
    if (val.trim().length >= 2) {
      runSearch(val.trim(), setSuggestions, setShowDropdown, setSearching, setSearchFailed);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const handleSelect = (s) => {
    setQuery(s.label);
    setShowDropdown(false);
    setSuggestions([]);
    onSelect({ address: s.label, lat: s.lat, lng: s.lng });
  };

  const preventFormSubmitOnEnter = (e) => {
    if (e.key === "Enter") e.preventDefault();
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#777" }} />
      <input
        value={query}
        onChange={(e) => handleTypedChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        onKeyDown={preventFormSubmitOnEnter}
        placeholder={searching ? "Searching…" : placeholder || "Search area, locality, or landmark…"}
        style={{
          width: "100%",
          padding: "9px 10px 9px 32px",
          borderRadius: 14,
          border: `1.5px solid ${COLORS.ink}`,
          fontSize: 13,
          background: "#fff",
          boxSizing: "border-box",
        }}
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
              onMouseDown={(e) => e.preventDefault()}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}

      {searchFailed && (
        <div style={{ fontSize: 10, color: COLORS.brick, marginTop: 4 }}>
          Location search failed — try again.
        </div>
      )}
    </div>
  );
}
