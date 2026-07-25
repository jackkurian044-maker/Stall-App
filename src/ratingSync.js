// Google-sourced rating/phone auto-refresh — DISABLED.
//
// This used to call Google Places Details to keep a listing's rating and
// phone fresh automatically. Google requires a billing account with a
// valid card on file to use that API at all — even to stay within its
// free monthly call allowance — so it doesn't fit a no-billing setup.
// There's no free data source with equivalent ratings (OpenStreetMap,
// which Stall's address search and Discover Nearby now run on, doesn't
// track ratings at all).
//
// Rather than fail silently against a disabled API, these are now
// explicit no-ops: nothing calls out to Google, nothing gets billed, and
// a listing's rating/ratingsCount just stay whatever they were last set
// to (originally captured at add-time, or left blank — both fine, since
// VendorDashboard/AdminDashboard already let phone be edited manually,
// and Stall's own review system is the more meaningful rating source
// going forward). Kept as exported functions (rather than deleted) so
// existing imports in FindView/VendorDashboard/AdminDashboard don't need
// to change — they just do nothing now.

export function isRatingStale() {
  return false;
}

export async function refreshVendorIfStale() {
  // No-op — see file header.
}

export function autoRefreshStale() {
  // No-op — see file header.
}
