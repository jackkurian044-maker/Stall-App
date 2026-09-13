// Keeps a listing's Google-sourced rating/phone fresh automatically —
// no manual click, anywhere in the app. The cost control isn't "don't
// call too often" as a polite convention; it's enforced by firestore.rules
// itself (see the `vendors` update rule's public refresh branch), which
// rejects a write if the listing's ratingUpdatedAt isn't actually stale
// yet. That means this is safe to call from the public Find page too —
// a burst of visitors hitting a fresh listing all no-op instead of piling
// up API calls, and even a malicious client can't force more than one
// write per listing per staleness window.

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { loadGoogleMaps } from "./googleMaps";
import { RATING_STALE_HOURS } from "./constants";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

export function isRatingStale(vendor) {
  if (!vendor.ratingUpdatedAt?.toDate) return true; // never refreshed
  const ageMs = Date.now() - vendor.ratingUpdatedAt.toDate().getTime();
  return ageMs > RATING_STALE_HOURS * 60 * 60 * 1000;
}

function getDetails(service, placeId) {
  return new Promise((resolve) => {
    service.getDetails(
      { placeId, fields: ["rating", "user_ratings_total", "formatted_phone_number"] },
      (place, status) => resolve({ place, status })
    );
  });
}

// Google can invalidate older cached Place IDs. When that happens, recover
// the current Place ID from the listing's existing name + coordinates rather
// than making the whole listing's refresh silently fail. We intentionally do
// not persist the recovered Place ID because public Firestore refreshes are
// only allowed to update rating/phone/timestamp fields.
async function findFreshPlace(service, vendor) {
  if (!vendor.name || !Number.isFinite(vendor.lat) || !Number.isFinite(vendor.lng)) return null;

  return new Promise((resolve) => {
    service.nearbySearch(
      {
        location: new window.google.maps.LatLng(vendor.lat, vendor.lng),
        radius: 500,
        keyword: vendor.name,
      },
      async (results, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.length) {
          resolve(null);
          return;
        }

        const candidate = results.find((p) => p.place_id) || null;
        if (!candidate?.place_id) {
          resolve(null);
          return;
        }

        const fresh = await getDetails(service, candidate.place_id);
        if (fresh.status !== window.google.maps.places.PlacesServiceStatus.OK || !fresh.place) {
          resolve(null);
          return;
        }
        resolve(fresh.place);
      }
    );
  });
}

export async function refreshVendorIfStale(vendor, force = false) {
  if (!vendor.placeId || !GOOGLE_API_KEY) return;
  if (!force && !isRatingStale(vendor)) return;

  try {
    await loadGoogleMaps(GOOGLE_API_KEY);
    const service = new window.google.maps.places.PlacesService(document.createElement("div"));

    let result = await getDetails(service, vendor.placeId);
    let place = result.place;

    // Recover listings whose stored Google Place ID has become invalid.
    if (result.status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
      place = await findFreshPlace(service, vendor);
    }

    if (!place) return;

    try {
      await updateDoc(doc(db, "vendors", vendor.id), {
        rating: typeof place.rating === "number" ? place.rating : null,
        ratingsCount: typeof place.user_ratings_total === "number" ? place.user_ratings_total : null,
        ...(place.formatted_phone_number ? { phone: place.formatted_phone_number } : {}),
        ratingUpdatedAt: serverTimestamp(),
      });
    } catch {
      // Most likely another visitor's browser already refreshed this
      // exact listing a moment ago and the rule's staleness check
      // now rejects ours — expected under concurrent traffic, not an error.
    }
  } catch {
    // Google Maps script failed to load (offline, ad blocker, etc.) —
    // the next visitor's session will simply try again.
  }
}

// Staggers a batch of refresh checks so a page with many listings doesn't
// fire every Places lookup at once. `seen` is a ref Set the caller keeps
// so a listing already checked this session isn't checked again — the
// updateDoc a real refresh triggers re-fires the caller's Firestore
// listener, which would otherwise loop back into checking it again.
export function autoRefreshStale(vendors, seen) {
  const due = vendors.filter((v) => v.placeId && !seen.has(v.id));
  due.forEach((v, i) => {
    seen.add(v.id);
    setTimeout(() => refreshVendorIfStale(v), i * 400);
  });
}
