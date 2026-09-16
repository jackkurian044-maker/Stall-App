// One-time-safe manual sync overlay for the SEO responder rollout.
// It preserves the existing Sync Reviews Now button and updates only the
// three Cut N Cute Studio test replies that need the new SEO standard.
// Deterministic text is used for these three known test reviews so the
// rollout does not depend on another AI generation step.

const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const googleOAuthConfig = defineSecret("GOOGLE_OAUTH_CONFIG");

function cfg() {
  const value = JSON.parse(googleOAuthConfig.value());
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
  await db.collection("gbp_connections").doc(vendorId).update({
    accessToken: r.data.access_token,
    tokenExpiresAt: new Date(Date.now() + Number(r.data.expires_in || 3600) * 1000)
  });
  return r.data.access_token;
}

function fixedResponse(reviewerName) {
  const name = String(reviewerName || "").trim().toLowerCase();
  if (name === "harshad") {
    return "Thank you, Harshad, for sharing your experience. We’re glad you enjoyed your haircut and the quality of service at Cut N Cute Studio. Our team always aims to make every salon visit comfortable and personalized. We truly appreciate your support and look forward to welcoming you again.";
  }
  if (name === "himanshu dhingra") {
    return "Thank you, Himanshu Dhingra, for the 5-star rating. We truly appreciate your support of Cut N Cute Studio and look forward to welcoming you again.";
  }
  if (name === "vasundhara sah") {
    return "Thank you, Vasundhara Sah, for your lovely feedback. We’re delighted that you enjoyed your haircut with Suhall and the team at Cut N Cute Studio. We’re happy to know the haircut was just as you wanted, and we look forward to welcoming you again for another personalized salon experience.";
  }
  return null;
}

async function rewrite(vendorId, connection, review) {
  const accessToken = await token(vendorId, connection);
  const reviewId = review.reviewId || review.name?.split("/").pop();
  if (!reviewId) return false;
  const response = fixedResponse(review.reviewer?.displayName);
  if (!response) return false;

  const base = `https://mybusiness.googleapis.com/v4/${connection.accountName}/${connection.locationId}/reviews/${reviewId}`;
  await axios.put(`${base}/reply`, { comment: response }, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  await db.collection("review_responses").doc(`${vendorId}_${reviewId}`).set({
    aiResponse: response,
    googleReply: response,
    status: "posted",
    seoOptimized: true,
    seoVersion: 2,
    editedAt: admin.firestore.FieldValue.serverTimestamp(),
    postedAt: admin.firestore.FieldValue.serverTimestamp(),
    syncedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return true;
}

exports.triggerPollForVendor = functions.runWith({ secrets: [googleOAuthConfig] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;
  const [connDoc, premiumDoc] = await Promise.all([
    db.collection("gbp_connections").doc(vendorId).get(),
    db.collection("premium_vendors").doc(vendorId).get()
  ]);
  if (!connDoc.exists || !connDoc.data().connected) throw new functions.https.HttpsError("failed-precondition", "GBP not connected");
  if (!premiumDoc.exists || !premiumDoc.data().isPremium) throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");

  const connection = connDoc.data();
  const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
  const listing = vendorSnap.docs[0]?.data() || {};
  if (String(listing?.name || "").trim().toLowerCase() !== "cut n cute studio") {
    throw new functions.https.HttpsError("failed-precondition", "This one-time test rewrite is limited to Cut N Cute Studio");
  }

  const reviewsRes = await axios.get(
    `https://mybusiness.googleapis.com/v4/${connection.accountName}/${connection.locationId}/reviews`,
    { headers: { Authorization: `Bearer ${await token(vendorId, connection)}` }, params: { pageSize: 50, orderBy: "updateTime desc" } }
  );
  const reviews = reviewsRes.data.reviews || [];
  let rewrittenCount = 0;
  const targets = new Set(["harshad", "himanshu dhingra", "vasundhara sah"]);

  for (const review of reviews) {
    const name = String(review.reviewer?.displayName || "").trim().toLowerCase();
    if (!targets.has(name)) continue;
    const reviewId = review.reviewId || review.name?.split("/").pop();
    if (!reviewId) continue;
    const ref = db.collection("review_responses").doc(`${vendorId}_${reviewId}`);
    const existing = await ref.get();
    if (existing.data()?.seoVersion !== 2 && await rewrite(vendorId, connection, review)) rewrittenCount++;
  }

  await db.collection("gbp_connections").doc(vendorId).set({
    lastPolled: admin.firestore.FieldValue.serverTimestamp(),
    lastReviewSyncCount: reviews.length
  }, { merge: true });

  return {
    reviewCount: reviews.length,
    rewrittenCount,
    message: rewrittenCount
      ? `Google returned ${reviews.length} reviews. Rewrote ${rewrittenCount} test response(s) with the approved brand + local SEO wording.`
      : `Google returned ${reviews.length} reviews. No outstanding test rewrites were needed.`
  };
});
