export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearingRad(a, b) {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return Math.atan2(y, x);
}

export function uid(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Formats a Firestore Timestamp (or null) as a yyyy-mm-dd string for
// <input type="date">, and back again isn't needed — Firestore accepts a
// native JS Date on write, so the form just holds the string in between.
export function toDateInputValue(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Best available external link for a vendor. Google Business Profile is
// the default for every listing — it's reliably tied to the exact place
// and vendors don't need to do anything for it to be correct. A vendor's
// own website is only used if they've explicitly opted into it from the
// dashboard (the toggle is only offered when both exist); this sidesteps
// ever needing to detect a "broken" website, since nothing defaults to
// an unverified link in the first place. Falls back to a plain Google
// Maps search only for old listings that predate mapsUrl/website entirely.
export function vendorLink(v) {
  if (v.preferredLink === "website" && v.website) return v.website;
  if (v.mapsUrl) return v.mapsUrl;
  if (v.website) return v.website;
  const q = encodeURIComponent(`${v.name || ""} ${v.address || ""}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
