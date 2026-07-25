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

function normalize(s) {
  return (s || "").trim().toLowerCase();
}

/**
 * Search for places/addresses matching `query`.
 * `bounds` (optional) = { north, south, east, west } — only *biases*
 * ranking toward that area, doesn't exclude anything outside it.
 * `state` (optional) — a state/province name (e.g. "Karnataka"). When
 * given, this is a hard filter: any result whose address.state doesn't
 * match (case-insensitive) is dropped entirely, so a search never returns
 * a result from a neighbouring state just because it ranked well.
 * Returns [{ label, lat, lng, osmId }].
 */
export async function searchPlaces(query, { bounds, state, limit = 8, countrycodes = "in" } = {}) {
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    // Ask for more than we'll show — the state filter below can drop a
    // chunk of these, so over-fetching keeps the final list from being
    // thinner than it needs to be.
    limit: String(state ? Math.max(limit * 2, 10) : limit),
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
  const targetState = normalize(state);

  return data
    .filter((p) => !targetState || normalize(p.address?.state) === targetState)
    .slice(0, limit)
    .map((p) => ({
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
