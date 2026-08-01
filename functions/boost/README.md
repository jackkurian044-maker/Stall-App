# Vendor Boost — scaffold

Drop `functions/boost/` into your existing Cloud Functions project, next to
your review-auto-responder function.

## What's here

- `scoreProfile.js` — pure scoring logic, no network calls. Unit test this
  directly, and tune `WEIGHTS` once you have real vendor data on what
  actually correlates with ranking improvement.
- `index.js` — the callable Cloud Function `runBoostScan`. Fetches GBP data,
  scores it, asks Claude to turn the checklist into plain-language vendor
  copy, and writes the result to `vendors/{vendorId}/boost/latest`.

## Before this deploys, wire up

1. **`../reviewResponder/gbpAuth`** — `index.js` imports
   `getGbpClientForVendor` from your existing review-responder auth module.
   Point this at whatever you already built there; no new OAuth flow needed.
2. **GMB API scopes** — confirm your existing OAuth consent covers
   `mediaItems`, `localPosts`, and `questions` reads, not just reviews. If
   not, you'll need to re-request those read scopes.
3. **Firestore fields on `vendors/{vendorId}`** — this expects
   `boostSubscriptionActive` (bool), `gbpLocationId` (string), `vertical`
   (string, e.g. "Hair Salon"), and `hours` (object matching your existing
   Stall listing hours format) to already exist on the vendor doc.
4. **`CLAUDE_API_KEY`** — same env var/secret you're already using for the
   review auto-responder; no new secret needed.

## Not built yet (intentionally, for later phases)

- AI post generation + one-click publish to GBP/FB/IG (Phase 2)
- Competitor visibility panel logic — you already have the vendor proximity
  data for this in your existing Firestore vendor collection, just needs a
  query + ranking step (Phase 3)
- Scheduled re-scans (right now this only runs when `runBoostScan` is
  called manually — wire to a Cloud Scheduler job for weekly auto-rescans
  once the manual flow is validated)
