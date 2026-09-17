// Manual Sync Reviews Now overlay.
// Uses the same settings-aware Google/Gemini pipeline as the scheduled responder.
// This replaces the temporary three-review-only test behavior.

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
    if (!settings.autoReply) {
      await connDoc.ref.set({ lastPolled: admin.firestore.FieldValue.serverTimestamp(), responderStatus: "disabled" }, { merge: true });
      return { reviewCount: 0, processedCount: 0, skippedCount: 0, message: "Automatic review responses are turned off in Response Settings." };
    }

    const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
    const listing = vendorSnap.docs[0]?.data() || {};
    const accessToken = await token(vendorId, connection);
    const reviewsRes = await axios.get(
      `https://mybusiness.googleapis.com/v4/${connection.accountName}/${connection.locationId}/reviews`,
      { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 50, orderBy: "updateTime desc" } }
    );
    const reviews = reviewsRes.data.reviews || [];
    const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const review of reviews) {
      const reviewId = review.reviewId || review.name?.split("/").pop();
      if (!reviewId) { skippedCount++; continue; }
      if (review.reviewReply) {
        const existingReplyRef = db.collection("review_responses").doc(`${vendorId}_${reviewId}`);
        await existingReplyRef.set({
          vendorId,
          reviewId,
          reviewerName: review.reviewer?.displayName || "Valued Customer",
          reviewText: review.comment || "",
          starRating: ratingMap[review.starRating] || 3,
          googleReply: review.reviewReply.comment || null,
          aiResponse: review.reviewReply.comment || null,
          status: "posted",
          syncedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        skippedCount++;
        continue;
      }

      const starRating = ratingMap[review.starRating] || 3;
      if (settings[`replyTo${starRating}Star`] === false) { skippedCount++; continue; }

      const ref = db.collection("review_responses").doc(`${vendorId}_${reviewId}`);
      const existing = await ref.get();
      const existingData = existing.exists ? existing.data() : {};
      if (existingData.status === "processing") { skippedCount++; continue; }

      await ref.set({
        vendorId,
        reviewId,
        reviewerName: review.reviewer?.displayName || "Valued Customer",
        reviewText: review.comment || "",
        starRating,
        status: "processing",
        processingAt: admin.firestore.FieldValue.serverTimestamp(),
        receivedAt: review.createTime ? admin.firestore.Timestamp.fromDate(new Date(review.createTime)) : admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      try {
        const aiResponse = await responder.generateSeoResponse({
          reviewerName: review.reviewer?.displayName || "Valued Customer",
          reviewText: review.comment || "",
          starRating,
        }, listing, settings);

        const latest = await axios.get(responder.reviewUrl(connection, reviewId), {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (latest.data.reviewReply) {
          await ref.set({
            status: "posted",
            aiResponse: latest.data.reviewReply.comment || null,
            googleReply: latest.data.reviewReply.comment || null,
            processingAt: admin.firestore.FieldValue.delete(),
            syncedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          skippedCount++;
          continue;
        }

        await axios.put(`${responder.reviewUrl(connection, reviewId)}/reply`, { comment: aiResponse }, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        await ref.set({
          aiResponse,
          googleReply: aiResponse,
          status: "posted",
          seoOptimized: !!settings.seoOptimization,
          seoVersion: 3,
          postedAt: admin.firestore.FieldValue.serverTimestamp(),
          processingAt: admin.firestore.FieldValue.delete(),
          syncedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        processedCount++;
      } catch (err) {
        errorCount++;
        await ref.set({
          status: "error",
          error: err.response?.data?.error?.message || err.message,
          processingAt: admin.firestore.FieldValue.delete(),
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.error(`Manual review sync failed for ${vendorId}/${reviewId}:`, err.response?.status, err.response?.data || err.message);
      }
    }

    await connDoc.ref.set({
      lastPolled: admin.firestore.FieldValue.serverTimestamp(),
      lastReviewSyncCount: reviews.length,
      lastManualSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      responderStatus: errorCount ? "error" : "active"
    }, { merge: true });

    return {
      reviewCount: reviews.length,
      processedCount,
      skippedCount,
      errorCount,
      message: `Google returned ${reviews.length} reviews. Processed ${processedCount} new review(s). Skipped ${skippedCount}. Errors ${errorCount}.`
    };
  } catch (err) {
    console.error(`Manual review sync failed for vendor ${vendorId}:`, err.response?.status, err.response?.data || err.message);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("unavailable", err.response?.data?.error?.message || err.message || "Could not sync Google reviews");
  }
});
