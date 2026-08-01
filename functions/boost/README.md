# Vendor Boost — scaffold (v3, verified against your actual GitHub repo)

Pulled functions/index.js, functions/package.json, src/constants.js,
src/VendorDashboard.jsx, and src/ReviewAutoResponder.jsx from
jackkurian044-maker/Stall-App to confirm this against your real code,
not assumptions.

## What changed from what's currently committed

The `functions/boost/` files already in your repo are my first draft —
they use `firebase-functions/v2/https`, the `@anthropic-ai/sdk` package
(not in your `functions/package.json`), and import a `../reviewResponder/gbpAuth`
module that doesn't exist in your project. That version will not deploy.

This replacement:
- Uses `functions.https.onCall` (v1), matching every other function in
  your `index.js`.
- Calls Claude via axios + `functions.config().anthropic.api_key`,
  matching `generateAIResponse()` in Section 2C — no new dependency.
- Reuses your existing `getValidToken()`, `gbp_connections`, and
  `premium_vendors` — no separate auth module needed.

## A real schema mismatch this version fixes

I checked `src/constants.js` and `src/VendorDashboard.jsx`:

- `vendors.category` is one of six broad Stall categories ("Food & Produce",
  "Services", etc.) — not a Google-style category like "Hair Salon". My
  first draft compared these directly, which would never match. Fixed:
  the category check is now just "does this vendor have a specific
  category set on Google," independent of Stall's own category.
- `vendors.hours` is free text from a `<textarea>` (e.g. "Mon–Sat: 9am–8pm"),
  not structured data. Comparing it against GBP's structured `regularHours`
  object was never going to produce a real signal. Fixed: the hours check
  is now just "are hours set on Google at all."

Net effect: the checklist item labels changed slightly ("Set a specific
Google Business category" / "Set your business hours on Google" instead
of the earlier cross-check phrasing) but the scoring weights are unchanged.

## What to actually do

1. Replace `functions/boost/scoreProfile.js` and `functions/boost/index.js`
   in your repo with these two files.
2. Copy the contents of `functions/boost/index.js` into your real
   `functions/index.js`, right after Section 3 (weekly digests).
3. Delete `functions/boost/index.js` afterward — it's not meant to be a
   separately deployed file, just the source you paste in.
4. `scoreProfile.js` stays as its own file under `functions/boost/` and
   gets required from the root `index.js`.

## Still worth confirming before you flip this on

- `gbp_connections/{vendorId}.locationId` — used already by `pollReviews`,
  so this should just work, unverified only in the sense that I'm trusting
  your existing code rather than re-deriving it.
- Whether you actually want Boost gated on the same `isPremium` flag as
  the review responder (bundled at ₹499) vs. a separate add-on tier — see
  the inline note in `runBoostScan`.

## Not built yet (Phase 2/3, unchanged from before)

- AI post generation + one-click publish to GBP/FB/IG
- Competitor visibility panel — your `haversineKm` helper in
  `weeklyCustomerDigest` (Section 3) is directly reusable for this
- Scheduled auto-rescans — currently only runs when a vendor taps "Rescan"
