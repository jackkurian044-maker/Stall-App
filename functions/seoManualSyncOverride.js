// Manual Sync Reviews Now overlay.
// Uses the same settings-aware Google/Gemini pipeline as the scheduled responder.
// GBP aggregate rating/review count are stored separately from the small local
// queue of unanswered reviews. We do NOT import the full GBP review history.

const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");
const responder = require("./seoReviewResponder").__reviewResponder;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const googleOAuthConfig = defineSecret("GOOGLE_OAUTH_CONFIG");

function cfg() {
  let value;
  try { value = JSON.parse(googleOAuthConfig.value()); }
  catch (err) { throw new Error("GOOGLE_OAUTH_CONFIG is missing or invalid"); }
  if (!value.client_id || !value.client_secret) throw new Error("GOOGLE_OAUTH_CONFIG is incomplete");
  return value;
}

// Normalize stored GBP identifiers. Older connection records may store
// locationId as the full accounts/.../locations/... resource, while newer
// records may store only the locations/... segment.
function reviewResource(connection, reviewId) {
  const account = String(connection.accountName || "").replace(/^\/+|\/+$/g, "");
  const rawLocation = String(connection.locationId || "").replace(/^\/+|\/+$/g, "");
  const location = rawLocation.includes("/locations/")
    ? rawLocation
    : `${account}/locations/${rawLocation.replace(/^locations\//, "")}`;
  return `https://mybusiness.googleapis.com/v4/${location}/reviews/${reviewId}`;
}

async function token(vendorId, connection) {
  const expiry = connection.tokenExpiresAt?.toDate?.() || new Date(0);
  if (connection.accessToken && expiry >= new Date(Date.now() + 5 * 60 * 1000)) return connection.accessToken;
  const c = cfg();
  const r = await axios.post("https://oauth2.googleapis.com/token", {
    refresh_token: connection.refreshToken,
    client_id: c.client_id,
    client_secret: c.client_secret,
    grant_type: "refresh_token"
  });
  if (!r.data.access_token) throw new Error("Google did not return a refreshed access token");
  await db.collection("gbp_connections").doc(vendorId).update({
    accessToken: r.data.access_token,
    tokenExpiresAt: new Date(Date.now() + Number(r.data.expires_in || 3600) * 1000)
  });
  return r.data.access_token;
}

async function reworkLatestPosted(vendorId, connection, listing) {
  // Avoid a composite Firestore index: read this vendor's small local queue
  // and sort the already-stored posted responses in memory.
  const postedSnap = await db.collection("review_responses")
    .where("vendorId", "==", vendorId)
    .get();
  const posted = postedSnap.docs
    .map(d => ({ ref: d.ref, data: d.data() }))
    .filter(x => x.data.status === "posted")
    .sort((a, b) => (b.data.postedAt?.toMillis?.() || 0) - (a.data.postedAt?.toMillis?.() || 0));
  if (!posted.length) throw new functions.https.HttpsError("not-found", "No posted review is available to rework");

  const ref = posted[0].ref;
  const existing = posted[0].data;
  const reviewId = existing.reviewId;
  if (!reviewId) throw new Error("The latest posted review is missing its Google review ID");
  const accessToken = await token(vendorId, connection);
  const settings = responder.normalizeSettings(connection.responseSettings);
  const latest = await axios.get(reviewResource(connection, reviewId), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const googleReview = latest.data;
  if (!googleReview) throw new Error("Google review could not be re-read");

  const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const review = {
    reviewerName: googleReview.reviewer?.displayName || existing.reviewerName || "Valued Customer",
    reviewText: googleReview.comment || existing.reviewText || "",
    starRating: ratingMap[googleReview.starRating] || existing.starRating || 3,
  };
  const aiResponse = await responder.generateSeoResponse(review, listing, settings);
  await axios.put(`${reviewResource(connection, reviewId)}/reply`, { comment: aiResponse }, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  await ref.set({
    reviewerName: review.reviewerName,
    reviewText: review.reviewText,
    starRating: review.starRating,
    aiResponse,
    googleReply: aiResponse,
    status: "posted",
    seoOptimized: !!settings.seoOptimization,
    seoVersion: 4,
    reworkedAt: admin.firestore.FieldValue.serverTimestamp(),
    syncedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { reviewId, reviewerName: review.reviewerName, response: aiResponse };
}

exports.triggerPollForVendor = functions.runWith({ secrets: [googleOAuthConfig] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;

  try {
    const [connDoc, premiumDoc] = await Promise.all([
      db.collection("gbp_connections").doc(vendorId).get(),
      db.collection("premium_vendors").doc(vendorId).get()
    ]);
    if (!connDoc.exists || !connDoc.data().connected) throw new functions.https.HttpsError("failed-precondition", "GBP not connected");
    if (!premiumDoc.exists || !premiumDoc.data().isPremium) throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");

    const connection = connDoc.data();
    const settings = responder.normalizeSettings(connection.responseSettings);
    const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
    const listing = vendorSnap.docs[0]?.data() || {};

    if (data?.reworkLatest === true) {
      if (!settings.autoReply) throw new functions.https.HttpsError("failed-precondition", "Automatic review responses are turned off in Response Settings");
      const result = await reworkLatestPosted(vendorId, connection, listing);
      return { ...result, reworked: true, message: `Reworked the latest response for ${result.reviewerName} and updated it on Google.` };
    }

    if (!settings.autoReply) {
      await connDoc.ref.set({ lastPolled: admin.firestore.FieldValue.serverTimestamp(), responderStatus: "disabled" }, { merge: true });
      return { reviewCount: connection.totalReviewCount || 0, processedCount: 0, skippedCount: 0, message: "Automatic review responses are turned off in Response Settings." };
    }

    const accessToken = await token(vendorId, connection);
    const locationResource = String(connection.locationId || "").replace(/^\/+|\/+$/g, "");
    const accountResource = String(connection.accountName || "").replace(/^\/+|\/+$/g, "");
    const reviewParent = locationResource.includes("/locations/")
      ? locationResource
      : `${accountResource}/locations/${locationResource.replace(/^locations\//, "")}`;
    const reviewsRes = await axios.get(
      `https://mybusiness.googleapis.com/v4/${reviewParent}/reviews`,
      { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 10, orderBy: "updateTime desc" } }
    );
    const reviews = reviewsRes.data.reviews || [];
    const totalReviewCount = Number(reviewsRes.data.totalReviewCount || 0);
    const averageRating = Number(reviewsRes.data.averageRating || 0);
    const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let unansweredFound = 0;

    for (const review of reviews) {
      const reviewId = review.reviewId || review.name?.split("/").pop();
      if (!reviewId) { skippedCount++; continue; }
      if (review.reviewReply) { skippedCount++; continue; }
      unansweredFound++;
      const starRating = ratingMap[review.starRating] || 3;
      if (settings[`replyTo${starRating}Star`] === false) { skippedCount++; continue; }

      const ref = db.collection("review_responses").doc(`${vendorId}_${reviewId}`);
      const existing = await ref.get();
      const existingData = existing.exists ? existing.data() : {};
      if (existingData.status === "processing" || existingData.status === "posted") { skippedCount++; continue; }

      await ref.set({ vendorId, reviewId, reviewerName: review.reviewer?.displayName || "Valued Customer", reviewText: review.comment || "", starRating, status: "processing", processingAt: admin.firestore.FieldValue.serverTimestamp(), receivedAt: review.createTime ? admin.firestore.Timestamp.fromDate(new Date(review.createTime)) : admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      try {
        const aiResponse = await responder.generateSeoResponse({ reviewerName: review.reviewer?.displayName || "Valued Customer", reviewText: review.comment || "", starRating }, listing, settings);
        const latest = await axios.get(responder.reviewUrl(connection, reviewId), { headers: { Authorization: `Bearer ${accessToken}` } });
        if (latest.data.reviewReply) {
          await ref.delete();
          skippedCount++;
          continue;
        }
        await axios.put(`${responder.reviewUrl(connection, reviewId)}/reply`, { comment: aiResponse }, { headers: { Authorization: `Bearer ${accessToken}` } });
        await ref.set({ aiResponse, googleReply: aiResponse, status: "posted", seoOptimized: !!settings.seoOptimization, seoVersion: 3, postedAt: admin.firestore.FieldValue.serverTimestamp(), processingAt: admin.firestore.FieldValue.delete(), syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        processedCount++;
      } catch (err) {
        errorCount++;
        await ref.set({ status: "error", error: err.response?.data?.error?.message || err.message, processingAt: admin.firestore.FieldValue.delete(), lastErrorAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        console.error(`Manual review sync failed for ${vendorId}/${reviewId}:`, err.response?.status, err.response?.data || err.message);
      }
    }

    await connDoc.ref.set({ lastPolled: admin.firestore.FieldValue.serverTimestamp(), lastReviewSyncAt: admin.firestore.FieldValue.serverTimestamp(), lastReviewSyncCount: unansweredFound, totalReviewCount, averageRating, responderStatus: errorCount ? "error" : "active" }, { merge: true });
    return { reviewCount: totalReviewCount, averageRating, unansweredFound, processedCount, skippedCount, errorCount, message: `Google rating ${averageRating || "—"}★ · ${totalReviewCount || 0} total reviews. Checked the latest ${reviews.length} reviews and processed ${processedCount} unanswered review(s).` };
  } catch (err) {
    console.error(`Manual review sync failed for vendor ${vendorId}:`, err.response?.status, err.response?.data || err.message);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("unavailable", err.response?.data?.error?.message || err.message || "Could not sync Google reviews");
  }
});
