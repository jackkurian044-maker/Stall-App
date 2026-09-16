// One-time-safe manual sync overlay for the SEO responder rollout.
// It preserves the existing Sync Reviews Now button and updates only the
// three Cut N Cute Studio test replies that need the new SEO standard.

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
  const r = await axios.post("https://oauth2.googleapis.com/token", { refresh_token: connection.refreshToken, client_id: c.client_id, client_secret: c.client_secret, grant_type: "refresh_token" });
  await db.collection("gbp_connections").doc(vendorId).update({ accessToken: r.data.access_token, tokenExpiresAt: new Date(Date.now() + Number(r.data.expires_in || 3600) * 1000) });
  return r.data.access_token;
}

async function rewrite(vendorId, connection, review, listing) {
  const accessToken = await token(vendorId, connection);
  const reviewId = review.reviewId || review.name?.split("/").pop();
  if (!reviewId) return false;
  const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const rating = ratingMap[review.starRating] || 3;
  const brand = listing?.name || "Cut N Cute Studio";
  const category = listing?.category || "salon";
  const location = listing?.address || "";
  const services = Array.isArray(listing?.services) ? listing.services.map(s => typeof s === "string" ? s : s?.name).filter(Boolean).slice(0, 3).join(", ") : category;
  const prompt = `Write a short, natural Google Business Profile reply. BUSINESS NAME: ${brand}. CATEGORY: ${category}. LOCATION: ${location}. SERVICES: ${services}. REVIEWER: ${review.reviewer?.displayName || "Valued Customer"}. RATING: ${rating}/5. REVIEW: "${review.comment || "(No written text — star rating only)"}". Rules: use the exact business name "${brand}" naturally at least once; include 1-2 relevant service/category/location phrases only when natural and supported; never keyword-stuff; never invent services; never say best/#1/top-rated; no promotion, discount, link, phone number or sales pitch; address the reviewer by name; mention a specific review detail when available; 45-90 words for written reviews and 30-60 words for rating-only reviews; conversational, genuine and concise. Write only the final reply.`;
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId;
  const accessTokenGemini = await admin.app().options.credential.getAccessToken();
  const ai = await axios.post(`https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-2.5-flash:generateContent`, { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 220, temperature: 0.35 } }, { headers: { Authorization: `Bearer ${accessTokenGemini.access_token}`, "Content-Type": "application/json" } });
  const response = ai.data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
  if (!response) throw new Error("Gemini returned an empty SEO response");

  const base = `https://mybusiness.googleapis.com/v4/${connection.accountName}/${connection.locationId}/reviews/${reviewId}`;
  await axios.put(`${base}/reply`, { comment: response }, { headers: { Authorization: `Bearer ${accessToken}` } });
  await db.collection("review_responses").doc(`${vendorId}_${reviewId}`).set({ aiResponse: response, googleReply: response, status: "posted", seoOptimized: true, seoVersion: 2, editedAt: admin.firestore.FieldValue.serverTimestamp(), postedAt: admin.firestore.FieldValue.serverTimestamp(), syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return true;
}

exports.triggerPollForVendor = functions.runWith({ secrets: [googleOAuthConfig] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;
  const [connDoc, premiumDoc] = await Promise.all([db.collection("gbp_connections").doc(vendorId).get(), db.collection("premium_vendors").doc(vendorId).get()]);
  if (!connDoc.exists || !connDoc.data().connected) throw new functions.https.HttpsError("failed-precondition", "GBP not connected");
  if (!premiumDoc.exists || !premiumDoc.data().isPremium) throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");
  const connection = connDoc.data();
  const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
  const listing = vendorSnap.docs[0]?.data() || {};
  const reviewsRes = await axios.get(`https://mybusiness.googleapis.com/v4/${connection.accountName}/${connection.locationId}/reviews`, { headers: { Authorization: `Bearer ${await token(vendorId, connection)}` }, params: { pageSize: 50, orderBy: "updateTime desc" } });
  const reviews = reviewsRes.data.reviews || [];
  let rewrittenCount = 0;
  const targets = new Set(["harshad", "himanshu dhingra", "vasundhara sah"]);
  for (const review of reviews) {
    const name = String(review.reviewer?.displayName || "").trim().toLowerCase();
    if (String(listing?.name || "").trim().toLowerCase() === "cut n cute studio" && targets.has(name)) {
      const ref = db.collection("review_responses").doc(`${vendorId}_${review.reviewId || review.name?.split("/").pop()}`);
      const existing = await ref.get();
      if (existing.data()?.seoVersion !== 2) {
        if (await rewrite(vendorId, connection, review, listing)) rewrittenCount++;
      }
    }
  }
  await db.collection("gbp_connections").doc(vendorId).set({ lastPolled: admin.firestore.FieldValue.serverTimestamp(), lastReviewSyncCount: reviews.length }, { merge: true });
  return { reviewCount: reviews.length, rewrittenCount, message: rewrittenCount ? `Google returned ${reviews.length} reviews. Rewrote ${rewrittenCount} test response(s) with the new brand + local SEO standard.` : `Google returned ${reviews.length} reviews. No outstanding test rewrites were needed.` };
});
