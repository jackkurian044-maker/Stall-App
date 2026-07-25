// Free, keyless "search nearby businesses" via OpenStreetMap's Overpass
// API — replaces Google Places Nearby Search, which now requires billing.
// No API key, no billing account.
//
// Trade-offs worth knowing:
//  - Coverage of small local businesses is thinner than Google's — OSM
//    depends on volunteer mapping, so results vary a lot by area.
//  - No ratings data (OSM doesn't track that) — rating/ratingsCount will
//    always come back null now.
//  - Website/phone/hours come directly from OSM tags when present, so no
//    separate "get details" round-trip is needed (Google needed one).
//  - Unnamed POIs are skipped entirely — nothing useful to show an admin
//    if there's no name to display.
//  - The public Overpass instance (overpass-api.de) is shared and can be
//    slow under load or during peak hours; if it starts timing out a lot,
//    a paid/self-hosted Overpass mirror is the documented next step.

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Best-effort mapping from OSM shop/amenity/office/craft tag values to
// Stall's own categories. Admins can always override per-result before adding.
const OSM_CATEGORY_MAP = [
  [["restaurant", "cafe", "fast_food", "food_court", "bakery", "supermarket", "convenience", "greengrocer", "butcher", "marketplace", "deli"], "Food & Produce"],
  [["clothes", "shoes", "jewelry", "boutique", "bag", "fashion"], "Clothing & Accessories"],
  [["hardware", "doityourself", "furniture", "houseware", "electrical", "florist", "garden_centre", "paint"], "Home & Garden"],
  [["hairdresser", "beauty", "spa", "laundry", "doctors", "dentist", "pharmacy", "fitness_centre", "veterinary", "clinic", "hospital", "massage"], "Services"],
  [["gift", "stationery", "books", "art", "craft", "photo", "toys"], "Crafts & Goods"],
];

function guessCategory(tags) {
  const value = tags.shop || tags.amenity || tags.office || tags.craft || "";
  for (const [keys, category] of OSM_CATEGORY_MAP) {
    if (keys.includes(value)) return category;
  }
  return "Other";
}

// Loose keyword -> OSM tag-value synonyms, so searching "medical store" or
// "salon" finds the right tag even though OSM doesn't use those exact words.
const KEYWORD_SYNONYMS = {
  medical: ["pharmacy", "clinic", "doctors", "hospital"],
  chemist: ["pharmacy"],
  pharmacy: ["pharmacy"],
  salon: ["hairdresser", "beauty"],
  parlour: ["hairdresser", "beauty"],
  grocery: ["supermarket", "convenience", "greengrocer"],
  bakery: ["bakery"],
  food: ["restaurant", "cafe", "fast_food", "food_court"],
  restaurant: ["restaurant", "fast_food"],
  cafe: ["cafe"],
  clothes: ["clothes", "boutique"],
  clothing: ["clothes", "boutique"],
  hardware: ["hardware", "doityourself"],
  furniture: ["furniture"],
  electronics: ["electronics", "mobile_phone"],
  mobile: ["mobile_phone"],
  gym: ["fitness_centre"],
  vet: ["veterinary"],
  florist: ["florist"],
  flowers: ["florist"],
  stationery: ["stationery"],
  books: ["books"],
};

function buildAddress(tags) {
  const parts = [
    tags["addr:housenumber"] && tags["addr:street"]
      ? `${tags["addr:housenumber"]} ${tags["addr:street"]}`
      : tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
  ].filter(Boolean);
  return parts.join(", ");
}

function matchesKeyword(tags, name, keyword) {
  if (!keyword) return true;
  const k = keyword.trim().toLowerCase();
  if (name.toLowerCase().includes(k)) return true;
  const value = (tags.shop || tags.amenity || tags.office || tags.craft || "").toLowerCase();
  if (value.includes(k.replace(/\s+/g, "_"))) return true;
  if (KEYWORD_SYNONYMS[k]?.includes(value)) return true;
  for (const word of k.split(/\s+/)) {
    if (KEYWORD_SYNONYMS[word]?.includes(value)) return true;
  }
  return false;
}

/**
 * Search for shops/amenities/offices/crafts within `radiusKm` of
 * { lat, lng }, optionally filtered by a freeform `keyword`.
 * Returns [{ placeId, name, vicinity, lat, lng, rating, ratingsCount,
 * website, phone, hours, category }] — already usable straight into a
 * vendor doc, no separate "get details" step needed.
 */
export async function searchNearby({ lat, lng }, radiusKm, keyword = "") {
  const radiusM = Math.max(100, Math.round(radiusKm * 1000));
  const query = `
[out:json][timeout:25];
(
  nwr["shop"](around:${radiusM},${lat},${lng});
  nwr["amenity"](around:${radiusM},${lat},${lng});
  nwr["office"](around:${radiusM},${lat},${lng});
  nwr["craft"](around:${radiusM},${lat},${lng});
);
out center tags 200;
`.trim();

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error("Overpass search failed");
  const data = await res.json();

  const seen = new Set();
  const results = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    const name = tags.name;
    if (!name) continue; // skip unnamed POIs — nothing useful to list
    const osmId = `${el.type}/${el.id}`;
    if (seen.has(osmId)) continue;
    seen.add(osmId);
    if (!matchesKeyword(tags, name, keyword)) continue;

    const point = el.type === "node" ? el : el.center;
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;

    results.push({
      placeId: `osm:${osmId}`,
      name,
      vicinity: buildAddress(tags),
      lat: point.lat,
      lng: point.lon,
      rating: null,
      ratingsCount: null,
      website: tags.website || tags["contact:website"] || null,
      phone: tags.phone || tags["contact:phone"] || null,
      hours: tags.opening_hours || null,
      category: guessCategory(tags),
    });
  }
  return results;
}
