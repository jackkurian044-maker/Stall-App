// functions/boostCompetitiveRanking.js
// Weekly competitive ranking scan — sits alongside the existing profile-
// completeness Boost score (runBoostScan / vendors/{id}/boost/latest).
// This writes to vendors/{id}/boost/ranking as a sibling doc, so the two
// scans (on-demand health score vs weekly competitive rank) never collide.

const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");
const db = admin.firestore();
const googleOAuthConfig = defineSecret("GOOGLE_OAUTH_CONFIG");

const DEFAULT_RADIUS_METERS = 3000;
const CLUSTER_RADIUS_METERS = DEFAULT_RADIUS_METERS / 2;
const EARTH_RADIUS_KM = 6371;

function haversineKm(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function buildClusters(vendors) {
  const clusters = [];
  for (const v of vendors) {
    if (!v.category || typeof v.lat !== "number" || typeof v.lng !== "number") continue;
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
    if (nearest) nearest.vendors.push(v);
    else clusters.push({ category: v.category, centerLat: v.lat, centerLng: v.lng, vendors: [v] });
  }
  return clusters;
}

async function searchClusterCompetitors(cluster) {
  const apiKey = functions.config().google?.places_api_key;
  const res = await axios.post(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      maxResultCount: 20,
      locationRestriction: { circle: { center: { latitude: cluster.centerLat, longitude: cluster.centerLng }, radius: DEFAULT_RADIUS_METERS } },
      rankPreference: "POPULARITY",
    },
    { headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount" } }
  );
  return (res.data.places || []).map((p, index) => ({ rank: index + 1, placeId: p.id, name: p.displayName?.text, rating: p.rating ?? null, reviewCount: p.userRatingCount ?? null }));
}

function getGoogleOAuthConfig() {
  let cfg;
  try { cfg = JSON.parse(googleOAuthConfig.value()); }
  catch (err) { throw new Error("GOOGLE_OAUTH_CONFIG is missing or invalid"); }
  if (!cfg.client_id || !cfg.client_secret || !cfg.redirect_uri) {
    throw new Error("GOOGLE_OAUTH_CONFIG is missing client_id, client_secret, or redirect_uri");
  }
  return cfg;
}

async function refreshAccessToken(vendorId, connectionData) {
  const cfg = getGoogleOAuthConfig();
  const res = await axios.post("https://oauth2.googleapis.com/token", {
    refresh_token: connectionData.refreshToken,
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    grant_type: "refresh_token",
  });
  const { access_token, expires_in } = res.data;
  await db.collection("gbp_connections").doc(vendorId).update({ accessToken: access_token, tokenExpiresAt: new Date(Date.now() + expires_in * 1000) });
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
          dailyMetrics: ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "CALL_CLICKS", "BUSINESS_DIRECTION_REQUESTS", "WEBSITE_CLICKS"],
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
    return null;
  }
}

exports.weeklyBoostRankingScan = functions.runWith({ secrets: [googleOAuthConfig] }).pubsub.schedule("every monday 08:00").timeZone("Asia/Kolkata").onRun(async () => {
  console.log("weeklyBoostRankingScan: starting");
  const vendorsSnap = await db.collection("vendors").get();
  const vendors = vendorsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const clusters = buildClusters(vendors);
  let writes = 0;
  for (const cluster of clusters) {
    let competitors;
    try { competitors = await searchClusterCompetitors(cluster); }
    catch (err) { console.error("weeklyBoostRankingScan: Places search failed", err.response?.status, err.response?.data || err.message); continue; }
    const top3 = competitors.slice(0, 3);
    for (const vendor of cluster.vendors) {
      try {
        const match = competitors.find((c) => c.placeId === vendor.placeId);
        const gbpStats = vendor.ownerId ? await getGbpPerformanceStats(vendor.ownerId) : null;
        await db.collection("vendors").doc(vendor.id).collection("boost").doc("ranking").set({ category: cluster.category, vendorPlaceId: vendor.placeId || null, rank: match ? match.rank : null, totalCompetitors: competitors.length, top3, gbpStats, scannedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        writes++;
      } catch (err) { console.error(`weeklyBoostRankingScan: failed to write ranking for vendor ${vendor.id}`, err.message); }
    }
  }
  console.log(`weeklyBoostRankingScan: complete — ${writes} vendor rankings written`);
  return null;
});

exports.getGbpReputation = functions.runWith({ secrets: [googleOAuthConfig] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;
  const [connDoc, premiumDoc] = await Promise.all([
    db.collection("gbp_connections").doc(vendorId).get(),
    db.collection("premium_vendors").doc(vendorId).get(),
  ]);
  if (!connDoc.exists || !connDoc.data().connected) throw new functions.https.HttpsError("failed-precondition", "GBP not connected");
  if (!premiumDoc.exists || !premiumDoc.data().isPremium) throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");
  try {
    const connectionData = connDoc.data();
    if (!connectionData.locationId) throw new Error("Connected GBP location is missing");
    const accessToken = await getValidToken(vendorId, connectionData);
    const accountName = connectionData.accountName;
    if (!accountName) throw new Error("Connected GBP account is missing");
    const reviewsRes = await axios.get(
      `https://mybusiness.googleapis.com/v4/${accountName}/${connectionData.locationId}/reviews`,
      { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 50, orderBy: "updateTime desc" } }
    );
    const averageRating = Number(reviewsRes.data.averageRating || 0);
    const totalReviewCount = Number(reviewsRes.data.totalReviewCount || 0);
    const syncedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("gbp_connections").doc(vendorId).set({ reputation: { averageRating, totalReviewCount, syncedAt }, lastReputationSync: syncedAt }, { merge: true });
    return { averageRating, totalReviewCount, fetchedReviewCount: reviewsRes.data.reviews?.length || 0 };
  } catch (err) {
    console.error(`GBP reputation sync failed for vendor ${vendorId}:`, err.response?.status, err.response?.data || err.message);
    throw new functions.https.HttpsError("unavailable", "Google reputation data could not be loaded right now.");
  }
});

// Override the legacy trigger exported from index.js with the same callable
// name. This keeps the existing frontend contract intact while correcting
// the Google Reviews resource path required by the GBP API.
exports.triggerPollForVendor = functions.runWith({ secrets: [googleOAuthConfig] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;
  try {
    const [connDoc, premiumDoc] = await Promise.all([
      db.collection("gbp_connections").doc(vendorId).get(),
      db.collection("premium_vendors").doc(vendorId).get(),
    ]);
    if (!connDoc.exists || !connDoc.data().connected) throw new functions.https.HttpsError("failed-precondition", "GBP not connected");
    if (!premiumDoc.exists || !premiumDoc.data().isPremium) throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");
    const connectionData = connDoc.data();
    if (!connectionData.accountName || !connectionData.locationId) throw new functions.https.HttpsError("failed-precondition", "GBP account or location is missing");
    const accessToken = await getValidToken(vendorId, connectionData);
    const reviewPath = `${connectionData.accountName}/${connectionData.locationId}/reviews`;
    const reviewsRes = await axios.get(`https://mybusiness.googleapis.com/v4/${reviewPath}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { pageSize: 50, orderBy: "updateTime desc" },
    });
    const reviews = reviewsRes.data.reviews || [];
    return {
      reviewCount: reviews.length,
      totalReviewCount: Number(reviewsRes.data.totalReviewCount || reviews.length),
      message: reviews.length
        ? `Google returned ${reviews.length} reviews. The review list is ready for STall processing.`
        : "Google returned no reviews for this location.",
    };
  } catch (err) {
    console.error(`Manual review sync failed for vendor ${vendorId}:`, err.response?.status, err.response?.data || err.message);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("unavailable", "Google review sync failed. Please try again.");
  }
});
