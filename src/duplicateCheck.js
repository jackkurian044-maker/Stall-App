import { collection, query, where, getDocs } from "firebase/firestore";
import { haversineKm } from "./geo";

// Two listings within this distance, with the same name, are almost
// certainly the same physical business re-entered rather than a real
// second stall next door.
const NEARBY_METERS = 40;

function normalize(str) {
  return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Looks for an existing vendor doc that's almost certainly the same business.
 *
 * - If a Google placeId is present, an exact placeId match is decisive —
 *   Google ties that ID to one specific physical branch, so a match means
 *   this exact storefront is already listed.
 * - Otherwise (manual entry with no placeId), falls back to a name match
 *   within ~40 metres. This catches someone re-typing the same stall by
 *   hand without relying on Google data being present.
 *
 * Pass `excludeId` when checking during an edit, so a listing never flags
 * itself as a duplicate of itself.
 *
 * Returns the matching vendor doc ({ id, ...data }) or null.
 */
export async function findDuplicateVendor(db, { placeId, name, lat, lng, excludeId } = {}) {
  if (placeId) {
    const q = query(collection(db, "vendors"), where("placeId", "==", placeId));
    const snap = await getDocs(q);
    const match = snap.docs.find((d) => d.id !== excludeId);
    if (match) return { id: match.id, ...match.data() };
  }

  const normalizedName = normalize(name);
  if (!normalizedName || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // No placeId to key off, so this does a full scan + client-side filter.
  // Fine at local-directory scale (the app already loads the whole
  // "vendors" collection elsewhere, e.g. AdminDashboard's onSnapshot).
  const snap = await getDocs(collection(db, "vendors"));
  for (const d of snap.docs) {
    if (d.id === excludeId) continue;
    const v = d.data();
    if (normalize(v.name) !== normalizedName) continue;
    if (typeof v.lat !== "number" || typeof v.lng !== "number") continue;
    const distKm = haversineKm({ lat, lng }, { lat: v.lat, lng: v.lng });
    if (distKm * 1000 <= NEARBY_METERS) {
      return { id: d.id, ...v };
    }
  }
  return null;
}

/**
 * Bulk version for Discover Nearby: given a list of Google placeIds,
 * returns the subset that are already present in the vendors collection.
 * Used to grey out / block re-adding businesses already on Stall.
 */
export async function findExistingPlaceIds(db, placeIds = []) {
  const unique = [...new Set(placeIds.filter(Boolean))];
  if (unique.length === 0) return new Set();

  // Firestore "in" queries cap at 30 values per query — chunk defensively.
  const chunks = [];
  for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));

  const existing = new Set();
  for (const chunk of chunks) {
    const q = query(collection(db, "vendors"), where("placeId", "in", chunk));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const p = d.data().placeId;
      if (p) existing.add(p);
    });
  }
  return existing;
}
