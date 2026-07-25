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

export async function refreshVendorIfStale(vendor) {
  if (!vendor.placeId || !GOOGLE_API_KEY) return;
  if (!isRatingStale(vendor)) return;

  try {
    await loadGoogleMaps(GOOGLE_API_KEY);
    const service = new window.google.maps.places.PlacesService(document.createElement("div"));
    service.getDetails(
      { placeId: vendor.placeId, fields: ["rating", "user_ratings_total", "formatted_phone_number"] },
      async (place, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) return;
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
      }
    );
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
