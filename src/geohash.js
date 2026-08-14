// geohash.js
//
// Self-contained geohash encoding + proximity query helpers, with no
// external dependencies — written this way deliberately so the exact
// same logic can be used both in the React app (src/geohash.js) and in
// register.html's plain <script> (which can't import npm packages,
// since it's a standalone static page, not part of the Vite build).
//
// WHY THIS EXISTS:
// Previously, FindView.jsx (and AdminDashboard.jsx, and the weekly
// digest Cloud Function) fetched the ENTIRE "vendors" collection on
// every load, then filtered by distance client-side. That works fine
// at dozens of vendors, but breaks down completely at real scale —
// every visitor would download every vendor in every country just to
// find the ~10 near them. This file replaces "fetch everything, filter
// locally" with "ask Firestore only for what's nearby" using geohash
// range queries, which Firestore can index and filter efficiently.
//
// HOW IT WORKS (standard geohash proximity technique):
// 1. Every vendor doc stores a `geohash` string field, computed from
//    its lat/lng at write time (see encodeGeohash below).
// 2. To find vendors near a point, we don't do a single range query —
//    a geohash prefix range can miss real neighbors right across a
//    grid-cell boundary. Instead we compute the small set of geohash
//    cells that could possibly contain a point within the search
//    radius (getGeohashQueryBounds), issue one Firestore range query
//    PER cell, merge the results, then do an exact haversine distance
//    filter on that much smaller merged set (still needed, since a
//    geohash cell is a coarse square, not a precise circle).

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/**
 * Encodes a lat/lng pair into a geohash string of the given precision
 * (character length). Longer = smaller/more precise cell.
 */
export function encodeGeohash(lat, lng, precision = 9) {
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let hash = "";
  let bit = 0;
  let ch = 0;
  let evenBit = true; // alternate lng/lat bits, standard geohash interleaving

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        ch = (ch << 1) | 1;
        lngRange[0] = mid;
      } else {
        ch = ch << 1;
        lngRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latRange[0] = mid;
      } else {
        ch = ch << 1;
        latRange[1] = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

// Approximate geohash cell dimensions (width, height in km) by precision
// length — used to pick a precision where the cell is comfortably larger
// than the search radius, so a 3x3 grid of neighboring cells is
// guaranteed to fully cover the search circle.
const GEOHASH_CELL_KM = {
  1: [5009.4, 4992.6], 2: [1252.3, 624.1], 3: [156.5, 156.0],
  4: [39.1, 19.5], 5: [4.9, 4.9], 6: [1.2, 0.61],
  7: [0.153, 0.153], 8: [0.038, 0.019], 9: [0.0048, 0.0048],
};

function precisionForRadius(radiusKm) {
  for (let p = 1; p <= 9; p++) {
    const [w, h] = GEOHASH_CELL_KM[p];
    if (w / 2 < radiusKm && h / 2 < radiusKm) return Math.max(1, p - 1);
  }
  return 1;
}

/**
 * Returns the set of [startHash, endHash] range pairs to query, covering
 * every geohash cell that could contain a point within `radiusKm` of
 * (lat, lng). Pass each pair to Firestore as:
 *   where('geohash', '>=', startHash), where('geohash', '<=', endHash)
 * and merge the results of all pairs client-side before the final exact
 * distance filter.
 */
export function getGeohashQueryBounds(lat, lng, radiusKm) {
  const precision = precisionForRadius(radiusKm);
  const [cellWidthKm, cellHeightKm] = GEOHASH_CELL_KM[precision];

  const latDelta = (cellHeightKm / 111.32); // km per degree latitude, ~constant
  const lngDelta = cellWidthKm / (111.32 * Math.cos((lat * Math.PI) / 180) || 1);

  const bounds = new Set();
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLng = -1; dLng <= 1; dLng++) {
      const pointLat = Math.max(-90, Math.min(90, lat + dLat * latDelta));
      const pointLng = lng + dLng * lngDelta;
      bounds.add(encodeGeohash(pointLat, pointLng, precision));
    }
  }

  return [...bounds].sort().map((hash) => [hash, hash + "~"]); // '~' sorts after all base32 chars, closes the prefix range
}

/**
 * Precise distance in km between two {lat, lng} points (haversine).
 * Still needed after the geohash query, since a geohash cell is a
 * coarse square — this is the same exact-distance check FindView.jsx
 * already had, just now run against a pre-filtered, much smaller set.
 */
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
