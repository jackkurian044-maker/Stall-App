// Free, keyless address/business search via OpenStreetMap's Nominatim —
// replaces Google Places Autocomplete, which now requires billing to be
// enabled even for light use. No API key, no billing account needed.
//
// Trade-offs worth knowing:
//  - Nominatim's public instance asks for max ~1 request/second per user
//    and requires visible attribution (shown under the search box below).
//    Fine for Stall's current traffic. If usage grows a lot, self-hosting
//    Nominatim is the documented next step — see nominatim.org.
//  - Coverage of small local businesses is thinner than Google's —
//    landmarks, chains, and addressed buildings are usually fine; small
//    shops sometimes aren't mapped yet. "Enter manually" + drag-the-pin
//    remains the fallback for anything not found.
//  - Results have no website, phone, opening hours, or rating — those
//    fields simply come back null/unset now instead of auto-filled.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Search for places/addresses matching `query`.
 * `bounds` (optional) = { north, south, east, west } used to bias (not
 * hard-restrict) results toward a local area, same spirit as the Google
 * Autocomplete `bounds` option this replaces.
 * Returns [{ label, lat, lng, osmId }].
 */
export async function searchPlaces(query, { bounds, limit = 5, countrycodes = "in" } = {}) {
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(limit),
    countrycodes,
  });
  if (bounds) {
    // Nominatim viewbox = left,top,right,bottom (lng,lat,lng,lat)
    params.set("viewbox", `${bounds.west},${bounds.north},${bounds.east},${bounds.south}`);
    params.set("bounded", "0"); // bias only, don't hard-exclude everything outside
  }

  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Nominatim search failed");

  const data = await res.json();
  return data.map((p) => ({
    label: p.display_name,
    lat: parseFloat(p.lat),
    lng: parseFloat(p.lon),
    osmId: p.osm_type && p.osm_id ? `${p.osm_type}/${p.osm_id}` : null,
  }));
}

// Simple debounce so typing doesn't fire a request per keystroke — also
// keeps us comfortably under Nominatim's 1 req/sec guidance.
export function debounce(fn, ms) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
