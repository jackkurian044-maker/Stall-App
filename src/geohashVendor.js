// geohashVendor.js
//
// Tiny wrapper around geofire-common's geohash encoding. This is the
// WRITE-side half of the geospatial fix: every vendor doc needs a
// `geohash` field before FindView's bounding-box queries (see FindView.jsx)
// can find it.
//
// npm install geofire-common
//
// Wire this into wherever vendor docs actually get created/updated —
// e.g. an AdminView "add vendor" form or a VendorForm submit handler.
// That file wasn't included here, so this is provided standalone;
// drop the one line into the existing setDoc/addDoc/updateDoc call.

import { geohashForLocation } from "geofire-common";

/**
 * Returns the fields to merge into a vendor doc so it's queryable by
 * FindView's radius search. Call this any time lat/lng is set or changed.
 *
 * Example:
 *   await addDoc(collection(db, "vendors"), {
 *     ...vendorFields,
 *     ...geohashFieldsFor(lat, lng),
 *   });
 *
 *   // or on edit, whenever lat/lng might have changed:
 *   await updateDoc(doc(db, "vendors", id), {
 *     ...vendorFields,
 *     ...geohashFieldsFor(lat, lng),
 *   });
 */
export function geohashFieldsFor(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("geohashFieldsFor: lat/lng must be numbers");
  }
  return {
    lat,
    lng,
    geohash: geohashForLocation([lat, lng]),
  };
}
