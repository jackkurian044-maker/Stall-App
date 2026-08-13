// functions/boostCompetitiveRanking.js
// Weekly competitive ranking scan — sits alongside the existing profile-
// completeness Boost score (runBoostScan / vendors/{id}/boost/latest).
// This writes to vendors/{id}/boost/ranking as a sibling doc, so the two
// scans (on-demand health score vs weekly competitive rank) never collide.
//
// Merge into index.js the same way agentCommissions.js and
// websiteBuildPayments.js already are:
//   Object.assign(exports, require("./boostCompetitiveRanking"));
//
// One-time setup (adds to the existing "google" config namespace —
// doesn't touch client_id/client_secret/redirect_uri, which stay as-is):
//   firebase functions:config:set google.places_api_key="AIza..."
//
// ⚠️ One assumption I couldn't confirm from index.js alone: vendor docs
// are assumed to carry a `placeId` field (matching the dedupe pattern
// described for duplicateCheck.js — matches by Google placeId or
// name+~40m proximity). If the actual field is named differently
// (googlePlaceId, gbp_place_id, etc.), update the two spots marked below.

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

// admin.initializeApp() already runs once in index.js before this module
// is required, so just grab the existing app's Firestore instance.
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

// Matches Discover Nearby's default radius. TODO: confirm the real
// constant in src/constants.js / DiscoverNearby.jsx and align this —
// left as a named constant so it's a one-line change once confirmed.
const DEFAULT_RADIUS_METERS = 3000;

// Two vendors within this distance, same category, share a single Places
// search rather than each costing their own API call. Set to half the
// search radius so no vendor in a cluster ends up meaningfully outside
// the circle that was actually searched around the cluster's center.
const CLUSTER_RADIUS_METERS = DEFAULT_RADIUS_METERS / 2;

const EARTH_RADIUS_KM = 6371;

// index.js already defines this same function for Section 3's digests.
// Duplicated here rather than imported — functions/ can't reach into
// src/geo.js (different build target, same reason regionFromLatLng in
// index.js is a separate copy of src/geo.js's version, per its own
// comment), and index.js doesn't export haversineKm for other modules
// to require without a circular-require risk (index.js requires this
// file via Object.assign). If that's worth cleaning up, pulling both
// copies into a small shared functions/geo.js would remove the drift risk.
function haversineKm(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// ─────────────────────────────────────────────────────────────
// Clustering — same filter-in-JS approach as weeklyVendorDigest /
// weeklyCustomerDigest (fetch the whole vendors collection, filter after —
// fine at current scale, consistent with the rest of this codebase).
//
// Greedy distance-based grouping: walk vendors in order, join the first
// existing same-category cluster within CLUSTER_RADIUS_METERS of its
// center, else start a new cluster. This is order-dependent (a vendor
// right on the boundary between two clusters joins whichever it reaches
// first) but that's a fine trade at local-directory scale — it avoids
// the sharp, arbitrary cutoffs a rounding-grid approach would introduce
// for two vendors a few metres apart on opposite sides of a grid line.
// ─────────────────────────────────────────────────────────────

function buildClusters(vendors) {
  const clusters = [];

  for (const v of vendors) {
    if (!v.category || typeof v.lat !== "number" || typeof v.lng !== "number") continue; // skip incomplete docs

    // Nearest-match, not first-match: check every same-category cluster
    // within range and join the closest one, so a vendor sitting between
    // two cluster centers doesn't get assigned arbitrarily based on
    // array order.
    let nearest = null;
    let nearestDistKm = Infinity;
    for (const c of clusters) {
      if (c.category !== v.category) continue;
      const distKm = haversineKm({ lat: v.lat, lng: v.lng }, { lat: c.centerLat, lng: c.centerLng });
      if (distKm * 1000 <= CLUSTER_RADIUS_METERS && distKm < nearestDistKm) {
        nearest = c;
        nearestDistKm = distKm;
      }
    }

    if (nearest) {
      nearest.vendors.push(v);
    } else {
      clusters.push({ category: v.category, centerLat: v.lat, centerLng: v.lng, vendors: [v] });
    }
  }

  return clusters;
}

// ─────────────────────────────────────────────────────────────
// One Places API call per cluster, prominence-sorted results
// ─────────────────────────────────────────────────────────────

async function searchClusterCompetitors(cluster) {
  const apiKey = functions.config().google?.places_api_key;

  // Places API (New). If the project is still on the legacy Places API
  // (the one enabled per the repo README's setup step 2), swap this for:
  //   GET https://maps.googleapis.com/maps/api/place/nearbysearch/json
  //     ?location={lat},{lng}&radius={r}&keyword={category}&key={key}
  // and parse res.data.results[] (place_id, name, rating, user_ratings_total)
  // instead of the New API's places[] shape below.
  const res = await axios.post(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: cluster.centerLat, longitude: cluster.centerLng },
          radius: DEFAULT_RADIUS_METERS,
        },
      },
      rankPreference: "POPULARITY",
      // Nearby Search (New) ranks by includedTypes, not free-text keyword.
      // If STALL's categories (Restaurants, Tailors, Salons, etc.) don't
      // map cleanly to Google's place types, switch to Text Search instead:
      //   POST https://places.googleapis.com/v1/places:searchText
      //   { textQuery: `${cluster.category} near me`, locationBias: {...} }
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount",
      },
    }
  );

  return (res.data.places || []).map((p, index) => ({
    rank: index + 1,
    placeId: p.id,
    name: p.displayName?.text,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────
// GBP performance stats — reuses the existing token/connection pattern.
// Only returns data for Premium vendors who've connected GBP (the same
// gate runBoostScan already enforces); everyone else gets null here,
// which is exactly the "public ranking only" pitch gap we want for
// non-Premium prospects.
// ─────────────────────────────────────────────────────────────

// getValidToken lives in index.js, not exported from there currently.
// Simplest fix: duplicate the small refresh helper here (same shape,
// same functions.config().google.* fields it already uses for OAuth),
// OR export getValidToken from index.js and require it here instead of
// duplicating. Duplicating for now to keep this module drop-in-mergeable
// without touching index.js's existing exports — flag if you'd rather
// refactor to a shared module.
async function refreshAccessToken(vendorId, connectionData) {
  const cfg = {
    client_id: functions.config().google.client_id,
    client_secret: functions.config().google.client_secret,
    redirect_uri: functions.config().google.redirect_uri,
  };
  const res = await axios.post("https://oauth2.googleapis.com/token", {
    refresh_token: connectionData.refreshToken,
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    grant_type: "refresh_token",
  });
  const { access_token, expires_in } = res.data;
  await db.collection("gbp_connections").doc(vendorId).update({
    accessToken: access_token,
    tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
  });
  return access_token;
}

async function getValidToken(vendorId, connectionData) {
  const expiry = connectionData.tokenExpiresAt?.toDate?.() || new Date(0);
  const isExpired = expiry < new Date(Date.now() + 5 * 60 * 1000);
  if (isExpired) return await refreshAccessToken(vendorId, connectionData);
  return connectionData.accessToken;
}

async function getGbpPerformanceStats(vendorId) {
  const connDoc = await db.collection("gbp_connections").doc(vendorId).get();
  if (!connDoc.exists || !connDoc.data().connected) return null;

  const connectionData = connDoc.data();
  if (!connectionData.locationId) return null;

  try {
    const accessToken = await getValidToken(vendorId, connectionData);
    const res = await axios.get(
      `https://businessprofileperformance.googleapis.com/v1/locations/${connectionData.locationId}:fetchMultiDailyMetricsTimeSeries`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          dailyMetrics: [
            "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
            "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
            "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
            "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
            "CALL_CLICKS",
            "BUSINESS_DIRECTION_REQUESTS",
            "WEBSITE_CLICKS",
          ],
          // TODO: compute a real rolling 30-day window instead of a
          // hardcoded range once this is wired up for real.
          "dailyRange.start_date.year": 2026,
          "dailyRange.start_date.month": 7,
          "dailyRange.start_date.day": 14,
          "dailyRange.end_date.year": 2026,
          "dailyRange.end_date.month": 8,
          "dailyRange.end_date.day": 13,
        },
      }
    );
    return res.data;
  } catch (err) {
    console.error(`Boost ranking: GBP performance fetch failed for vendor ${vendorId}`, err.response?.status, err.response?.data || err.message);
    return null; // one vendor's token issue shouldn't fail the whole scan
  }
}

// ─────────────────────────────────────────────────────────────
// Orchestration — weekly, before the Monday 09:00 digests so the
// digest writers could theoretically reference fresh ranking data later
// if you ever want to fold "you dropped to #4 this week" into the vendor
// digest — not wired up yet, just leaving room for it.
// ─────────────────────────────────────────────────────────────

exports.weeklyBoostRankingScan = functions.pubsub
  .schedule("every monday 08:00")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    console.log("weeklyBoostRankingScan: starting");

    const vendorsSnap = await db.collection("vendors").get();
    const vendors = vendorsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const clusters = buildClusters(vendors);

    console.log(`weeklyBoostRankingScan: ${vendors.length} vendors in ${clusters.length} clusters`);

    let writes = 0;

    for (const cluster of clusters) {
      let competitors;
      try {
        competitors = await searchClusterCompetitors(cluster);
      } catch (err) {
        console.error(
          `weeklyBoostRankingScan: Places search failed for cluster ${cluster.category} @ ${cluster.centerLat},${cluster.centerLng}`,
          err.response?.status, err.response?.data || err.message
        );
        continue; // skip this cluster, keep scanning the rest — same resilience pattern as pollReviews
      }

      const top3 = competitors.slice(0, 3);

      for (const vendor of cluster.vendors) {
        try {
          // TODO: confirm `vendor.placeId` is the real field name (see
          // header note) — this is how a vendor's own doc is matched
          // against the competitor list to find their rank.
          const match = competitors.find((c) => c.placeId === vendor.placeId);

          // Only bother fetching GBP performance stats for claimed,
          // premium vendors — unclaimed prospects (agent pitch targets)
          // never have a gbp_connections doc, so this naturally no-ops
          // for them and the pitch view falls back to public data only.
          const gbpStats = vendor.ownerId ? await getGbpPerformanceStats(vendor.ownerId) : null;

          await db.collection("vendors").doc(vendor.id)
            .collection("boost").doc("ranking").set({
              category: cluster.category,
              vendorPlaceId: vendor.placeId || null,
              rank: match ? match.rank : null,
              totalCompetitors: competitors.length,
              top3,
              gbpStats,
              scannedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

          writes++;
        } catch (err) {
          console.error(`weeklyBoostRankingScan: failed to write ranking for vendor ${vendor.id}`, err.message);
        }
      }
    }

    console.log(`weeklyBoostRankingScan: complete — ${writes} vendor rankings written`);
    return null;
  });
