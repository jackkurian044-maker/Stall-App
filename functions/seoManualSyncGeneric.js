// Generic manual review sync overlay.
// Keeps the existing Sync Reviews Now button and runs the same secure
// settings-aware SEO responder used by scheduled polling.

const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const googleOAuthConfig = defineSecret("GOOGLE_OAUTH_CONFIG");

const DEFAULT_SETTINGS = {
  autoReply: true,
  seoOptimization: true,
  tone: "friendly",
  language: "english",
  signOff: "",
  customInstructions: "",
  replyTo1Star: true,
  replyTo2Star: true,
  replyTo3Star: true,
  replyTo4Star: true,
  replyTo5Star: true,
  responseLength: "standard",
  serviceKeywords: [],
  locationKeywords: [],
};

function settings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  s.serviceKeywords = Array.isArray(s.serviceKeywords) ? s.serviceKeywords.filter(Boolean).slice(0, 8) : [];
  s.locationKeywords = Array.isArray(s.locationKeywords) ? s.locationKeywords.filter(Boolean).slice(0, 5) : [];
  return s;
}

function cfg() {
  const c = JSON.parse(googleOAuthConfig.value());
  if (!c.client_id || !c.client_secret) throw new Error("GOOGLE_OAUTH_CONFIG is incomplete");
  return c;
}

async function getToken(vendorId, connection) {
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

function guidance(listing, s) {
  const name = listing?.name || "Our Business";
  const category = listing?.category || "local business";
  const services = s.serviceKeywords.length ? s.serviceKeywords : (Array.isArray(listing?.services)
    ? listing.services.map(x => typeof x === "string" ? x : x?.name).filter(Boolean).slice(0, 4) : []);
  const locations = s.locationKeywords.length ? s.locationKeywords : (listing?.address ? [listing.address] : []);
  return { name, category, serviceText: services.length ? services.join(", ") : category, locationText: locations.join(", ") };
}

async function generate(review, listing, rawSettings) {
  const s = settings(rawSettings);
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId;
  const credential = admin.app().options.credential;
  if (!projectId || !credential?.getAccessToken) throw new Error("Google AI runtime credentials are unavailable");
  const access = await credential.getAccessToken();
  const token = access?.access_token;
  if (!token) throw new Error("Google did not return an Agent Platform access token");
  const g = guidance(listing, s);
  const tones = { friendly: "warm, friendly, and personable", professional: "professional and formal", casual: "casual and conversational", grateful: "grateful and appreciative" };
  const rating = { 5: "Express genuine appreciation and reference what the customer actually enjoyed.", 4: "Thank them warmly and acknowledge their positive experience.", 3: "Acknowledge their experience honestly and show commitment to improvement.", 2: "Be empathetic, apologise where appropriate, and offer a genuine path to resolve the concern.", 1: "Be calm and empathetic, acknowledge the concern, apologise where appropriate, and invite private resolution." };
  const seo = s.seoOptimization
    ? `Use the EXACT business name "${g.name}" naturally at least once. Naturally include 1–2 relevant service/category/location phrases only when genuinely supported by the review and business data. Never stuff keywords.`
    : "Do not deliberately optimize for SEO or add keywords merely for search visibility.";
  const lengths = { short: "20–45 words", standard: "45–90 words", detailed: "70–120 words" };
  const prompt = `Write a natural Google Business Profile review reply.
BUSINESS NAME: ${g.name}
CATEGORY: ${g.category}
LOCATION: ${g.locationText || "Not provided"}
SERVICES: ${g.serviceText}
REVIEWER: ${review.reviewerName || "Valued Customer"}
RATING: ${review.starRating}/5
CUSTOMER REVIEW: "${review.reviewText || "(No written text — star rating only)"}"
RULES:
- Tone: ${tones[s.tone] || tones.friendly}
- Language: ${s.language || "English"}
- ${rating[review.starRating] || rating[3]}
- ${seo}
- Never claim best, #1, top-rated, guaranteed results, or invent services.
- No promotions, discounts, phone numbers, links, or sales pitch.
- Address the reviewer by name when available and mention a specific review detail when there is one.
- Response length: ${lengths[s.responseLength] || lengths.standard}.
- ${s.signOff ? `Sign off as: ${s.signOff}` : "No separate signature unless natural."}
${s.customInstructions ? `- Owner instruction: ${s.customInstructions}` : ""}
Write ONLY the final reply.`;
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-2.5-flash:generateContent`;
  const response = await axios.post(endpoint, { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 260, temperature: 0.35 } }, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  const text = response.data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
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
  const s = settings(connection.responseSettings);
  if (!s.autoReply) return { reviewCount: 0, newReviews: 0, postedCount: 0, message: "Review responder is turned off in Response Settings." };

  const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
  const listing = vendorSnap.docs[0]?.data() || {};
  const accessToken = await getToken(vendorId, connection);
  const reviewsRes = await axios.get(`https://mybusiness.googleapis.com/v4/${connection.accountName}/${connection.locationId}/reviews`, {
    headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 50, orderBy: "updateTime desc" }
  });
  const reviews = reviewsRes.data.reviews || [];
  const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  let newReviews = 0;
  let postedCount = 0;

  for (const review of reviews) {
    const reviewId = review.reviewId || review.name?.split("/").pop();
    if (!reviewId) continue;
    const ref = db.collection("review_responses").doc(`${vendorId}_${reviewId}`);
    const existing = await ref.get();
    const existingData = existing.exists ? existing.data() : {};
    if (review.reviewReply) {
      await ref.set({ vendorId, reviewId, reviewerName: review.reviewer?.displayName || existingData.reviewerName || "Valued Customer", reviewText: review.comment || existingData.reviewText || "", starRating: ratingMap[review.starRating] || existingData.starRating || 3, status: "posted", googleReply: review.reviewReply.comment || null, aiResponse: review.reviewReply.comment || null, receivedAt: review.createTime ? admin.firestore.Timestamp.fromDate(new Date(review.createTime)) : existingData.receivedAt || admin.firestore.FieldValue.serverTimestamp(), syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      continue;
    }
    if (existingData.status === "posted" || existingData.status === "processing") continue;
    const starRating = ratingMap[review.starRating] || 3;
    if (s[`replyTo${starRating}Star`] === false) continue;
    if (!existing.exists) newReviews++;
    await ref.set({ vendorId, reviewId, reviewerName: review.reviewer?.displayName || "Valued Customer", reviewText: review.comment || "", starRating, status: "processing", processingAt: admin.firestore.FieldValue.serverTimestamp(), receivedAt: review.createTime ? admin.firestore.Timestamp.fromDate(new Date(review.createTime)) : admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    try {
      const aiResponse = await generate({ reviewerName: review.reviewer?.displayName || "Valued Customer", reviewText: review.comment || "", starRating }, listing, s);
      const latest = await axios.get(`https://mybusiness.googleapis.com/v4/${connection.accountName}/${connection.locationId}/reviews/${reviewId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (latest.data.reviewReply) {
        await ref.set({ status: "posted", aiResponse: latest.data.reviewReply.comment || null, googleReply: latest.data.reviewReply.comment || null, processingAt: admin.firestore.FieldValue.delete(), syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        continue;
      }
      await axios.put(`https://mybusiness.googleapis.com/v4/${connection.accountName}/${connection.locationId}/reviews/${reviewId}/reply`, { comment: aiResponse }, { headers: { Authorization: `Bearer ${accessToken}` } });
      await ref.set({ aiResponse, googleReply: aiResponse, status: "posted", seoOptimized: !!s.seoOptimization, seoVersion: 3, postedAt: admin.firestore.FieldValue.serverTimestamp(), processingAt: admin.firestore.FieldValue.delete(), syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      postedCount++;
    } catch (err) {
      await ref.set({ status: "error", error: err.response?.data?.error?.message || err.message, processingAt: admin.firestore.FieldValue.delete(), lastErrorAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      console.error(`Manual SEO responder failed for ${vendorId}/${reviewId}:`, err.response?.status, err.response?.data || err.message);
    }
  }

  await db.collection("gbp_connections").doc(vendorId).set({ lastPolled: admin.firestore.FieldValue.serverTimestamp(), lastReviewSyncCount: reviews.length, responderStatus: "active" }, { merge: true });
  return { reviewCount: reviews.length, newReviews, postedCount, message: `Google returned ${reviews.length} reviews. ${newReviews} new review(s) found and ${postedCount} response(s) posted.` };
});
