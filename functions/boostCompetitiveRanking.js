// functions/boostCompetitiveRanking.js
// Weekly competitive ranking scan — sits alongside the existing profile-
// completeness Boost score (runBoostScan / vendors/{id}/boost/latest).
// This writes to vendors/{id}/boost/ranking as a sibling doc, so the two
// scans (on-demand health score vs weekly competitive rank) never collide.

const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");
const crypto = require("crypto");
const db = admin.firestore();
const googleOAuthConfig = defineSecret("GOOGLE_OAUTH_CONFIG");
const { processVendor, generateGeminiText } = require("./reviewAutoResponder");

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

// Keep the Google Business Profile website field pointed at the business's
// canonical STall store page. The selected pageLayout is stored on the vendor,
// so the same URL always opens the owner's current default layout.
function buildPublicStoreUrl(listing) {
  const slug = String(listing?.publicSlug || listing?.name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug ? "https://stallwale.in/store/" + slug : null;
}

exports.syncGbpWebsite = functions.runWith({ secrets: [googleOAuthConfig] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;
  const listingId = String(data?.listingId || "").trim();
  if (!listingId) throw new functions.https.HttpsError("invalid-argument", "Listing ID is required");

  try {
    const [listingSnap, connSnap] = await Promise.all([
      db.collection("vendors").doc(listingId).get(),
      db.collection("gbp_connections").doc(vendorId).get(),
    ]);
    if (!listingSnap.exists) throw new functions.https.HttpsError("not-found", "Listing not found");
    const listing = listingSnap.data();
    if (listing.ownerId !== vendorId) throw new functions.https.HttpsError("permission-denied", "You do not own this listing");
    if (!connSnap.exists || !connSnap.data().connected || !connSnap.data().locationId) {
      return { connected: false, synced: false, websiteUrl: buildPublicStoreUrl(listing) };
    }

    const websiteUrl = buildPublicStoreUrl(listing);
    if (!websiteUrl) throw new functions.https.HttpsError("failed-precondition", "Listing name is required to build the public store URL");

    const connectionData = connSnap.data();
    const accessToken = await getValidToken(vendorId, connectionData);
    const resourceName = String(connectionData.locationId).startsWith("locations/")
      ? String(connectionData.locationId)
      : "locations/" + String(connectionData.locationId);
    const url = "https://mybusinessbusinessinformation.googleapis.com/v1/" + resourceName;
    const response = await axios.patch(url, { websiteUri: websiteUrl }, {
      params: { updateMask: "websiteUri" },
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    });

    await db.collection("gbp_connections").doc(vendorId).set({
      websiteUri: websiteUrl,
      websiteUriSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      websiteUriSyncStatus: "synced",
    }, { merge: true });

    return { connected: true, synced: true, websiteUrl, googleLocation: response.data?.name || resourceName };
  } catch (err) {
    console.error("GBP website sync failed:", err.response?.status, err.response?.data || err.message);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("unavailable", "Google Business Profile website could not be updated right now.");
  }
});

// Remove/reapply the canonical store URL whenever the vendor saves changes.
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

// Secret-backed OAuth callback overrides the legacy callback in index.js.
exports.oauthCallback = functions.runWith({ secrets: [googleOAuthConfig] }).https.onRequest(async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send("Missing OAuth code or state.");

  try {
    const stateRef = db.collection("oauth_states").doc(String(state));
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) return res.status(400).send("Invalid or expired OAuth state.");
    const stateData = stateSnap.data();
    if (stateData.expiresAt?.toDate && stateData.expiresAt.toDate() < new Date()) {
      await stateRef.delete();
      return res.status(400).send("OAuth state expired. Please try again.");
    }
    const vendorId = stateData.vendorId;
    await stateRef.delete();

    const cfg = getGoogleOAuthConfig();
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      code: String(code),
      client_id: cfg.client_id,
      client_secret: cfg.client_secret,
      redirect_uri: cfg.redirect_uri,
      grant_type: "authorization_code",
    });
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    if (!access_token) throw new Error("Google did not return an access token");

    // Match the Google profile to the STall listing instead of silently taking
    // the first account/location. A manager may have several GBP accounts.
    const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
    const listing = vendorSnap.empty ? null : vendorSnap.docs[0].data();
    if (!listing) throw new Error("STall business listing not found for this account");

    const normalize = (value) => String(value || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");

    const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);
    const listingName = normalize(listing.name);
    const listingAddress = normalize(listing.address);
    const listingPhone = normalizePhone(listing.phone);
    const listingPlaceId = String(listing.placeId || "").trim();

    const accountsRes = await axios.get("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const accounts = accountsRes.data.accounts || [];
    if (!accounts.length) throw new Error("No Google Business Profile accounts were returned");

    const candidates = [];
    for (const account of accounts) {
      if (!account?.name) continue;
      const locationsRes = await axios.get(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`, {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { readMask: "name,title,storefrontAddress,websiteUri,phoneNumbers,categories,metadata" },
      });
      for (const location of locationsRes.data.locations || []) {
        const googlePlaceId = String(location.metadata?.placeId || "").trim();
        const googleAddress = [
          location.storefrontAddress?.addressLines?.join(" "),
          location.storefrontAddress?.locality,
          location.storefrontAddress?.administrativeArea,
          location.storefrontAddress?.postalCode,
          location.storefrontAddress?.regionCode,
        ].filter(Boolean).join(" ");
        const googlePhone = normalizePhone(location.phoneNumbers?.primaryPhone);
        const placeMatch = listingPlaceId && googlePlaceId && listingPlaceId === googlePlaceId;
        const nameMatch = listingName && normalize(location.title) === listingName;
        const addressMatch = listingAddress && normalize(googleAddress) === listingAddress;
        const phoneMatch = listingPhone && googlePhone && listingPhone === googlePhone;
        let score = 0;
        if (placeMatch) score += 100;
        if (nameMatch) score += 10;
        if (addressMatch) score += 5;
        if (phoneMatch) score += 5;
        candidates.push({ account, location, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0];
    const second = candidates[1];
    if (!top || top.score === 0 || (second && second.score === top.score)) {
      throw new Error("Could not uniquely match your Google Business Profile to the STall listing. Please make sure the Google business name, address, phone, or Place ID matches your STall listing.");
    }

    const account = top.account;
    const location = top.location;
    const websiteUrl = buildPublicStoreUrl(listing);
    if (!websiteUrl) throw new Error("STall listing name is required to build the public store URL");

    // As soon as the GBP connection succeeds, make the canonical STall store
    // page the Google profile website. The URL is stable; its selected
    // pageLayout controls the default presentation.
    const resourceName = String(location.name || "").startsWith("locations/")
      ? String(location.name)
      : "locations/" + String(location.name || "");
    if (!resourceName || resourceName === "locations/") throw new Error("Google Business Profile location is missing");

    await axios.patch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${resourceName}`,
      { websiteUri: websiteUrl },
      {
        params: { updateMask: "websiteUri" },
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      }
    );

    await db.collection("gbp_connections").doc(vendorId).set({
      connected: true,
      accessToken: access_token,
      refreshToken: refresh_token || null,
      tokenExpiresAt: new Date(Date.now() + Number(expires_in || 3600) * 1000),
      accountName: account.name,
      locationName: location?.title || "Your Business",
      locationId: location?.name || "",
      googlePlaceId: location.metadata?.placeId || null,
      websiteUri: websiteUrl,
      websiteUriSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      websiteUriSyncStatus: "synced",
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastPolled: null,
    }, { merge: true });

    return res.redirect("https://stallapp.stallwale.in/?gbp=connected");
  } catch (err) {
    console.error("OAuth callback error:", err.response?.status, err.response?.data || err.message);
    return res.status(500).send("Connection failed. Please try again.");
  }
});

// Manual review sync: fetch reviews from Google and persist them into the
// existing review_responses collection so the existing responder UI can show
// the live review list. Existing records are preserved; Google replies are
// reflected as posted records without triggering a new reply.
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
    const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    let savedCount = 0;

    for (const review of reviews) {
      const reviewId = review.reviewId || review.name?.split("/").pop();
      if (!reviewId) continue;
      const ref = db.collection("review_responses").doc(`${vendorId}_${reviewId}`);
      const existing = await ref.get();
      const existingData = existing.exists ? existing.data() : {};
      const starRating = ratingMap[review.starRating] || 3;
      const googleReply = review.reviewReply?.comment || null;
      const createDate = review.createTime ? new Date(review.createTime) : null;

      const reviewData = {
        vendorId,
        reviewId,
        reviewerName: review.reviewer?.displayName || "Valued Customer",
        reviewText: review.comment || "",
        starRating,
        receivedAt: createDate && !Number.isNaN(createDate.getTime())
          ? admin.firestore.Timestamp.fromDate(createDate)
          : (existingData.receivedAt || admin.firestore.FieldValue.serverTimestamp()),
        status: existingData.status || (googleReply ? "posted" : "pending"),
        aiResponse: existingData.aiResponse || googleReply || null,
        postedAt: existingData.postedAt || null,
        googleReply: googleReply || existingData.googleReply || null,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await ref.set(reviewData, { merge: true });
      savedCount++;
    }

    await db.collection("gbp_connections").doc(vendorId).set({
      lastPolled: admin.firestore.FieldValue.serverTimestamp(),
      lastReviewSyncCount: reviews.length,
    }, { merge: true });

    // The button must do the actual responder work, not only import reviews.
    // Reuse the same secure Gemini + Google reply path used by the scheduler.
    await processVendor(vendorId, connectionData);

    return {
      reviewCount: reviews.length,
      savedCount,
      totalReviewCount: Number(reviewsRes.data.totalReviewCount || reviews.length),
      message: reviews.length
        ? `Google returned ${reviews.length} reviews and STall processed the responder queue.`
        : "Google returned no reviews for this location.",
    };
  } catch (err) {
    console.error(`Manual review sync failed for vendor ${vendorId}:`, err.response?.status, err.response?.data || err.message);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("unavailable", "Google review sync failed. Please try again.");
  }
});


// === STALL OWNER-APPROVED IMPROVEMENT ENGINE ===
// STall prepares the missing work for the owner, then pushes only approved,
// Google-supported changes. Keywords are stored for auditability and used
// naturally in the approved description/post; Google does not expose a
// generic "SEO keywords" field on a Business Profile.
async function generateImprovementCopy(listing) {
  // Use the same Gemini 2.5 Flash / Vertex AI path already powering STall's
  // Google review automation. No separate Claude credential is required.
  const name = String(listing.name || "Local business").trim();
  const category = String(listing.category || "local business").trim();
  const address = String(listing.address || "").trim();
  const services = String(listing.products || "").trim();
  const offer = String(listing.offer || listing.todayOffer || listing.todaySpecial || "").trim();

  const prompt = `Create a practical Google Business Profile improvement package for this local business.
BUSINESS: ${name}
CATEGORY: ${category}
ADDRESS: ${address}
DESCRIPTION: ${listing.description || ""}
PRODUCTS/SERVICES: ${services}
OFFER: ${offer}

Return ONLY valid JSON:
{
  "keywords": ["5-8 natural customer search phrases"],
  "description": "A truthful 300-500 character business description using some phrases naturally, without keyword stuffing",
  "post": "A short Google Business update/offer post under 300 characters"
}
Do not invent awards, prices, locations, services, opening hours, guarantees, or claims not present in the supplied business data.`;

  try {
    const raw = (await generateGeminiText(prompt, { maxOutputTokens: 900, temperature: 0.3 }))
      .replace(/\`\`\`json|\`\`\`/g, "").trim();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.keywords) || !parsed.description || !parsed.post) {
      throw new Error("Gemini returned an incomplete improvement package");
    }
    return {
      keywords: parsed.keywords.slice(0, 8).map(String),
      description: String(parsed.description).slice(0, 750),
      post: String(parsed.post).slice(0, 1500),
    };
  } catch (err) {
    console.warn("prepareGbpImprovement: Gemini enhancement failed; using listing-based copy", err.response?.status, err.response?.data || err.message);
    const fallbackKeywords = [
      name,
      category,
      services ? `${category} ${services}` : category,
      address ? `${category} near ${address}` : `${category} near me`,
      offer ? `${name} offers` : `${category} in ${address || "your area"}`,
    ].filter(Boolean).slice(0, 5);
    const fallbackDescription = [
      name,
      category,
      services ? `offers ${services}` : "serves local customers",
      address ? `in ${address}` : "",
      offer ? `Current offer: ${offer}.` : "",
    ].filter(Boolean).join(" ").slice(0, 500);
    const fallbackPost = offer
      ? `${name}: ${offer}. Visit the business to discover more.`.slice(0, 280)
      : `${name} — ${category}. Visit our STall store to discover more.`.slice(0, 280);
    return { keywords: fallbackKeywords, description: fallbackDescription, post: fallbackPost };
  }
}

function escapeXml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Creates a simple, business-specific promotional creative from verified listing
// data. This is deliberately not a fake storefront photo; it is clearly a
// promotional graphic and can be reviewed before publishing.
function buildImprovementSvg(listing, copy) {
  const title = escapeXml(String(listing.name || "Your Business").slice(0, 42));
  const category = escapeXml(String(listing.category || "Local Business").slice(0, 48));
  const offer = escapeXml(String(listing.offer || listing.todayOffer || listing.todaySpecial || "Discover what we offer").slice(0, 70));
  const keyword = escapeXml(String(copy.keywords?.[0] || "").slice(0, 48));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <rect width="1200" height="900" rx="48" fill="#182620"/>
  <rect x="55" y="55" width="1090" height="790" rx="38" fill="#fffdf7"/>
  <text x="90" y="135" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#168b78">STall</text>
  <text x="90" y="230" font-family="Arial,sans-serif" font-size="62" font-weight="800" fill="#182620">${title}</text>
  <text x="90" y="285" font-family="Arial,sans-serif" font-size="28" fill="#555">${category}</text>
  <rect x="90" y="350" width="1020" height="190" rx="28" fill="#f1e4bd"/>
  <text x="130" y="430" font-family="Arial,sans-serif" font-size="38" font-weight="700" fill="#182620">${offer}</text>
  <text x="130" y="495" font-family="Arial,sans-serif" font-size="22" fill="#555">${keyword}</text>
  <text x="90" y="690" font-family="Arial,sans-serif" font-size="24" fill="#555">Visit our STall store to discover more.</text>
  <text x="90" y="750" font-family="Arial,sans-serif" font-size="20" fill="#888">Promotional creative prepared by STall • Owner approval required</text>
</svg>`;
}

exports.prepareGbpImprovement = functions.runWith({ secrets: [googleOAuthConfig] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;
  const listingId = String(data?.listingId || "").trim();
  if (!listingId) throw new functions.https.HttpsError("invalid-argument", "Listing ID is required");

  try {
    const [listingSnap, connSnap] = await Promise.all([
      db.collection("vendors").doc(listingId).get(),
      db.collection("gbp_connections").doc(vendorId).get(),
    ]);
    if (!listingSnap.exists) throw new functions.https.HttpsError("not-found", "Listing not found");
    const listing = listingSnap.data();
    if (listing.ownerId !== vendorId) throw new functions.https.HttpsError("permission-denied", "You do not own this listing");
    if (!connSnap.exists || !connSnap.data().connected || !connSnap.data().locationId) {
      throw new functions.https.HttpsError("failed-precondition", "Connect Google Business Profile first");
    }

    const copy = await generateImprovementCopy(listing);
    const svg = buildImprovementSvg(listing, copy);
    const bucket = admin.storage().bucket();
    const path = `stall-improvements/${vendorId}/${listingId}-${Date.now()}.png`;
    const file = bucket.file(path);
    const pngBuffer = await require("sharp")(Buffer.from(svg, "utf8")).png().toBuffer();
    await file.save(pngBuffer, { metadata: { contentType: "image/png", cacheControl: "public,max-age=31536000" } });
    const [imageUrl] = await file.getSignedUrl({ action: "read", expires: "03-01-2035" });

    const improvement = {
      listingId,
      vendorId,
      status: "draft",
      keywords: copy.keywords,
      description: copy.description,
      post: copy.post,
      imageUrl,
      imagePath: path,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection("gbp_improvements").doc(vendorId).set(improvement);
    return { ...improvement, createdAt: new Date().toISOString() };
  } catch (err) {
    console.error("prepareGbpImprovement failed:", err.response?.data || err.message);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("unavailable", "STall could not prepare the improvement package right now.");
  }
});

exports.approveGbpImprovement = functions.runWith({ secrets: [googleOAuthConfig] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;
  try {
    const improvementSnap = await db.collection("gbp_improvements").doc(vendorId).get();
    if (!improvementSnap.exists) throw new functions.https.HttpsError("not-found", "No improvement package is ready for approval");
    const improvement = improvementSnap.data();
    if (improvement.status !== "draft") throw new functions.https.HttpsError("failed-precondition", "This improvement package has already been processed");
    const [listingSnap, connSnap] = await Promise.all([
      db.collection("vendors").doc(improvement.listingId).get(),
      db.collection("gbp_connections").doc(vendorId).get(),
    ]);
    if (!listingSnap.exists || listingSnap.data().ownerId !== vendorId) throw new functions.https.HttpsError("permission-denied", "You do not own this listing");
    if (!connSnap.exists || !connSnap.data().connected) throw new functions.https.HttpsError("failed-precondition", "Google Business Profile is not connected");

    const connectionData = connSnap.data();
    const accessToken = await getValidToken(vendorId, connectionData);
    const resourceName = String(connectionData.locationId).startsWith("locations/")
      ? String(connectionData.locationId)
      : "locations/" + String(connectionData.locationId);

    // 1) Update the merchant-provided Google description.
    await axios.patch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${resourceName}`,
      { profile: { description: improvement.description } },
      {
        params: { updateMask: "profile.description" },
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      }
    );

    // 2) Publish the owner-approved promotional creative to the Google profile.
    const mediaRes = await axios.post(
      `https://mybusiness.googleapis.com/v4/${connectionData.accountName}/${connectionData.locationId}/media`,
      { mediaFormat: "PHOTO", locationAssociation: { category: "ADDITIONAL" }, sourceUrl: improvement.imageUrl },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );

    // 3) Publish the owner-approved update using the generated copy.
    const postRes = await axios.post(
      `https://mybusiness.googleapis.com/v4/${connectionData.accountName}/${connectionData.locationId}/localPosts`,
      {
        languageCode: "en-IN",
        summary: improvement.post,
        media: [{ mediaFormat: "PHOTO", sourceUrl: improvement.imageUrl }],
        topicType: "STANDARD",
      },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );

    // 4) Verify the Google location reflects the approved description.
    const verifyRes = await axios.get(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${resourceName}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, params: { readMask: "profile,websiteUri" } }
    );
    const googleDescription = String(verifyRes.data?.profile?.description || "");
    const verified = googleDescription === improvement.description;

    await db.collection("gbp_improvements").doc(vendorId).set({
      status: verified ? "synced" : "partially_synced",
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      mediaName: mediaRes.data?.name || null,
      postName: postRes.data?.name || null,
      googleDescriptionVerified: verified,
      googleDescription,
      syncMessage: verified ? "Google Business Profile updated and verified." : "Google accepted the update request, but verification did not yet show the exact description.",
    }, { merge: true });

    return {
      success: true,
      status: verified ? "synced" : "partially_synced",
      mediaUploaded: Boolean(mediaRes.data?.name),
      postPublished: Boolean(postRes.data?.name),
      googleDescriptionVerified: verified,
      message: verified ? "Google Business Profile updated and verified." : "Google accepted the update; verification is still catching up.",
    };
  } catch (err) {
    console.error("approveGbpImprovement failed:", err.response?.status, err.response?.data || err.message);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("unavailable", "Google could not complete the approved update right now. Nothing was marked as complete.");
  }
});
