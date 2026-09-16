import React, { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Pencil } from "lucide-react";
import { COLORS, DEFAULT_LOC } from "./constants";
import MapPicker from "./MapPicker";
import { loadGoogleMaps } from "./googleMaps";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

// Map Google's place types to STall's existing vendor categories.
// This is deliberately conservative: if we cannot make a reliable match,
// keep the owner's selected category instead of guessing.
function categoryFromGoogleTypes(types = []) {
  const t = new Set(types);
  if (t.has("beauty_salon") || t.has("hair_care") || t.has("spa")) return "Salons";
  if (t.has("pharmacy") || t.has("drugstore")) return "Pharmacies";
  if (t.has("hospital") || t.has("doctor") || t.has("health") || t.has("clinic")) return "Hospital";
  if (t.has("school") || t.has("primary_school") || t.has("secondary_school")) return "School";
  if (t.has("university") || t.has("college")) return "College";
  if (t.has("gym") || t.has("fitness_center")) return "Fitness / Gym";
  if (t.has("electrician")) return "Electricians";
  if (t.has("plumber")) return "Plumbers";
  if (t.has("car_repair") || t.has("car_dealer") || t.has("car_rental")) return "Mechanics";
  if (t.has("clothing_store") || t.has("shoe_store") || t.has("jewelry_store") || t.has("boutique")) return "Clothing & Accessories";
  if (t.has("home_goods_store") || t.has("home_improvement_store") || t.has("furniture_store") || t.has("garden_center")) return "Home & Garden";
  if (t.has("restaurant") || t.has("cafe") || t.has("bakery") || t.has("food") || t.has("grocery_or_supermarket") || t.has("supermarket")) return "Food & Produce";
  if (t.has("tailor") || t.has("sewing_shop")) return "Tailors";
  return null;
}

/**
 * Address / business search box.
 * Uses Google Places Autocomplete so people can search by business name
 * (e.g. "Cut N Cute Studio, Kodihalli") and not just street address.
 * Calls onChange with the maximum useful business data available from the
 * selected Google place: name, address, coordinates, website, Google Maps
 * URL, Place ID, rating, review count, phone, hours and an inferred STall
 * category when Google provides a reliable place type.
 */
export default function LocationSearch({ address, lat, lng, website, mapsUrl, placeId, rating, ratingsCount, onChange }) {
  const [manualMode, setManualMode] = useState(false);
  const [query, setQuery] = useState(address || "");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const inputRef = useRef(null);

  const hasLocation =
    lat !== "" && lng !== "" && lat != null && lng != null &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  useEffect(() => {
    setQuery(address || "");
  }, [address]);

  useEffect(() => {
    if (manualMode) return;
    if (!GOOGLE_API_KEY) {
      setLoadError(true);
      return;
    }
    let cancelled = false;

    loadGoogleMaps(GOOGLE_API_KEY)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        // No fixed Bengaluru bounds — STall operates in India and UAE.
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: [
            "formatted_address", "geometry", "name", "website", "url", "place_id",
            "rating", "user_ratings_total", "formatted_phone_number", "opening_hours", "types",
          ],
          componentRestrictions: { country: ["in", "ae"] },
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) return;
          const label = place.name && place.formatted_address
            ? `${place.name}, ${place.formatted_address}`
            : place.formatted_address || place.name || inputRef.current.value;
          setQuery(label);

          const category = categoryFromGoogleTypes(place.types);
          onChange({
            address: label,
            name: place.name || null,
            category: category || undefined,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            website: place.website || null,
            mapsUrl: place.url || null,
            placeId: place.place_id || null,
            rating: typeof place.rating === "number" ? place.rating : null,
            ratingsCount: typeof place.user_ratings_total === "number" ? place.user_ratings_total : null,
            ...(place.formatted_phone_number ? { phone: place.formatted_phone_number } : {}),
            hours: place.opening_hours?.weekday_text?.length ? place.opening_hours.weekday_text.join("\n") : null,
          });
        });
        setReady(true);
      })
      .catch(() => setLoadError(true));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMode]);

  const handlePinMove = useCallback(
    ({ lat: newLat, lng: newLng }) => {
      onChange({ address, lat: newLat, lng: newLng, website, mapsUrl, placeId, rating, ratingsCount });
    },
    [address, website, mapsUrl, placeId, rating, ratingsCount, onChange]
  );

  const handleTypedChange = (val) => {
    setQuery(val);
    // Typing after a location was already confirmed invalidates it —
    // clear coordinates and linked Google data so stale place data cannot persist.
    if (hasLocation) {
      onChange({ address: val, lat: "", lng: "", website: null, mapsUrl: null, placeId: null, rating: null, ratingsCount: null });
    }
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
          <button type="button" onClick={() => setManualMode(false)} style={{ background: "none", border: "none", color: COLORS.green, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
            search by name/address instead
          </button>
        </div>
        <input style={{ ...inputStyle, marginBottom: 8 }} value={address || ""} onChange={(e) => onChange({ address: e.target.value, lat, lng, website, mapsUrl, placeId, rating, ratingsCount })} placeholder="Street, area, city" />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input className="font-mono" style={inputStyle} value={lat ?? ""} onChange={(e) => onChange({ address, lat: e.target.value === "" ? "" : parseFloat(e.target.value), lng, website, mapsUrl, placeId, rating, ratingsCount })} placeholder="Latitude" />
          <input className="font-mono" style={inputStyle} value={lng ?? ""} onChange={(e) => onChange({ address, lat, lng: e.target.value === "" ? "" : parseFloat(e.target.value), website, mapsUrl, placeId, rating, ratingsCount })} placeholder="Longitude" />
        </div>
        <MapPicker lat={hasLocation ? Number(lat) : DEFAULT_LOC.lat} lng={hasLocation ? Number(lng) : DEFAULT_LOC.lng} onMove={handlePinMove} />
        <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>{hasLocation ? "Drag the pin to fine-tune the exact spot." : "Or just drag the pin below onto the right spot — no typing needed."}</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Business name or address</label>
        <button type="button" onClick={() => setManualMode(true)} style={{ background: "none", border: "none", color: "#777", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Pencil size={11} /> enter manually</button>
      </div>
      <div style={{ position: "relative" }}>
        <MapPin size={15} style={{ position: "absolute", left: 10, top: 11, color: "#777" }} />
        <input ref={inputRef} style={{ ...inputStyle, paddingLeft: 32 }} value={query} onChange={(e) => handleTypedChange(e.target.value)} onKeyDown={preventFormSubmitOnEnter} placeholder={loadError ? "Address search unavailable" : ready ? "Search business name or address…" : "Loading address search…"} disabled={loadError} />
      </div>

      {hasLocation ? (
        <>
          <div className="font-mono" style={{ fontSize: 11, color: COLORS.green, marginTop: 4, marginBottom: rating != null ? 2 : 8 }}>✓ location set ({Number(lat).toFixed(5)}, {Number(lng).toFixed(5)})</div>
          {rating != null && <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>★ {rating.toFixed(1)} Google rating{ratingsCount != null ? ` (${ratingsCount} reviews)` : ""} — captured now, not live-updating</div>}
          <MapPicker lat={Number(lat)} lng={Number(lng)} onMove={handlePinMove} />
          <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>Drag the pin if it's not exactly on the storefront.</div>
        </>
      ) : loadError ? (
        <div style={{ fontSize: 11, color: COLORS.brick, marginTop: 4 }}>Address search isn't configured (missing API key) — switch to "enter manually" for now.</div>
      ) : query.trim().length >= 2 ? (
        <div style={{ fontSize: 11, color: COLORS.brick, marginTop: 4 }}>Pick a suggestion from the dropdown to confirm the exact location.</div>
      ) : null}

      <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>Business search powered by Google · pin map by OpenStreetMap contributors</div>
    </div>
  );
}
