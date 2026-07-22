import React, { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { COLORS, DEFAULT_LOC } from "./constants";
import { loadGoogleMaps } from "./googleMaps";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

/**
 * Lightweight "where am I" search box for customers browsing FindView.
 * Unlike LocationSearch (used for vendor listing address entry), this
 * has no manual lat/lng mode and captures nothing beyond what's needed
 * to center the search: { address, lat, lng }. No website, rating,
 * placeId, or Maps URL — that metadata belongs to a vendor's own
 * listing, not to a customer picking a search origin.
 *
 * Calls onSelect({ address, lat, lng }) once a place is chosen from
 * the dropdown. Does not manage lat/lng as controlled props — this is
 * fire-and-forget, matching how FindView just wants a starting point.
 */
export default function CustomerLocationSearch({ onSelect, placeholder }) {
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_API_KEY) {
      setLoadError(true);
      return;
    }
    let cancelled = false;

    loadGoogleMaps(GOOGLE_API_KEY)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        // Same local-bias pattern as LocationSearch: prefer results near
        // the app's default city without hard-excluding anything else.
        const bounds = new window.google.maps.LatLngBounds(
          { lat: DEFAULT_LOC.lat - 0.5, lng: DEFAULT_LOC.lng - 0.5 },
          { lat: DEFAULT_LOC.lat + 0.5, lng: DEFAULT_LOC.lng + 0.5 }
        );
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
          bounds,
          componentRestrictions: { country: "in" },
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) return;
          const label = place.name && place.formatted_address
            ? `${place.name}, ${place.formatted_address}`
            : place.formatted_address || place.name || inputRef.current.value;
          setQuery(label);
          onSelect({
            address: label,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        });
        setReady(true);
      })
      .catch(() => setLoadError(true));

    return () => {
      cancelled = true;
    };
  }, [onSelect]);

  const preventFormSubmitOnEnter = (e) => {
    if (e.key === "Enter") e.preventDefault();
  };

  return (
    <div style={{ position: "relative" }}>
      <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#777" }} />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={preventFormSubmitOnEnter}
        disabled={loadError}
        placeholder={
          loadError
            ? "Location search unavailable"
            : ready
            ? placeholder || "Search area, locality, or landmark…"
            : "Loading location search…"
        }
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
      {loadError && (
        <div style={{ fontSize: 10, color: COLORS.brick, marginTop: 4 }}>
          Location search isn't configured (missing API key).
        </div>
      )}
    </div>
  );
}
