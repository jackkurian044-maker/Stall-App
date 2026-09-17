// SEO-aware Google review responder overlay.
// Uses vendor Response Settings stored in gbp_connections.responseSettings.
// Existing Google/Gemini pipeline remains intact.

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

function normalizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  s.serviceKeywords = Array.isArray(s.serviceKeywords) ? s.serviceKeywords.filter(Boolean).slice(0, 8) : [];
  s.locationKeywords = Array.isArray(s.locationKeywords) ? s.locationKeywords.filter(Boolean).slice(0, 5) : [];
  return s;
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

async function getVertexAccessToken() {
  const credential = admin.app().options.credential;
  if (!credential || typeof credential.getAccessToken !== "function") {
    throw new Error("Firebase Admin credential cannot provide a Google access token");
  }
  const token = await credential.getAccessToken();
  if (!token?.access_token) throw new Error("Google did not return an Agent Platform access token");
  return token.access_token;
}

async function refreshAccessToken(vendorId, connectionData) {
  const cfg = getGoogleOAuthConfig();
  const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
    refresh_token: connectionData.refreshToken,
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    grant_type: "refresh_token",
  });
  const { access_token, expires_in } = tokenRes.data;
  if (!access_token) throw new Error("Google did not return a refreshed access token");
  await db.collection("gbp_connections").doc(vendorId).update({
    accessToken: access_token,
    tokenExpiresAt: new Date(Date.now() + Number(expires_in || 3600) * 1000),
  });
  return access_token;
}

async function getValidToken(vendorId, connectionData) {
  const expiry = connectionData.tokenExpiresAt?.toDate?.() || new Date(0);
  if (expiry < new Date(Date.now() + 5 * 60 * 1000) || !connectionData.accessToken) {
    return refreshAccessToken(vendorId, connectionData);
  }
  return connectionData.accessToken;
}

function buildSeoGuidance(listing, settings) {
  const name = listing?.name || "Our Business";
  const category = listing?.category || "local business";
  const address = listing?.address || "";
  const listingServices = Array.isArray(listing?.services)
    ? listing.services.map(s => typeof s === "string" ? s : s?.name).filter(Boolean).slice(0, 4)
    : [];
  const ownerServices = settings.serviceKeywords;
  const services = ownerServices.length ? ownerServices : listingServices;
  const locations = settings.locationKeywords.length ? settings.locationKeywords : (address ? [address] : []);
  return {
    name,
    category,
    address,
    serviceText: services.length ? services.join(", ") : category,
    locationText: locations.join(", "),
  };
}

async function generateSeoResponse(review, listing, rawSettings) {
  const settings = normalizeSettings(rawSettings);
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId;
  if (!projectId) throw new Error("Google Cloud project ID is not available");
  const accessToken = await getVertexAccessToken();
  const seo = buildSeoGuidance(listing, settings);
  const toneMap = {
    friendly: "warm, friendly, and personable",
    professional: "professional and formal",
    casual: "casual and conversational",
    grateful: "grateful and appreciative",
  };
  const ratingGuidance = {
    5: "Express genuine appreciation and reference what the customer actually enjoyed.",
    4: "Thank them warmly and acknowledge their positive experience.",
    3: "Acknowledge their experience honestly and show commitment to improvement.",
    2: "Be empathetic, apologise where appropriate, and offer a genuine path to resolve the concern.",
    1: "Be calm and empathetic, acknowledge the concern, apologise where appropriate, and invite private resolution.",
  };
  const seoRules = settings.seoOptimization
    ? `- Use the EXACT business name "${seo.name}" naturally at least once. Do not shorten, alter, or misspell it.
- Naturally include 1–2 relevant service/category/location phrases when they genuinely fit the customer's experience.
- Prefer phrases drawn from the business category/services/location above. Never invent a service or location.
- SEO wording must read like normal human conversation, never like a keyword list.
- Never stuff or repeat keywords just for SEO.`
    : `- Do not deliberately optimize for SEO or add keywords merely for search visibility.
- Keep the response natural and focused only on the customer's experience.`;
  const lengthMap = { short: "20–45 words", standard: "45–90 words", detailed: "70–120 words" };
  const prompt = `Write a natural Google Business Profile review reply for a local business.

BUSINESS NAME: ${seo.name}
BUSINESS CATEGORY: ${seo.category}
BUSINESS LOCATION: ${seo.locationText || "Not provided"}
RELEVANT SERVICES: ${seo.serviceText}
REVIEWER: ${review.reviewerName || "Valued Customer"}
RATING: ${review.starRating}/5
CUSTOMER REVIEW: "${review.reviewText || "(No written text — star rating only)"}"

RULES:
- Tone: ${toneMap[settings.tone] || "warm, friendly, and personable"}
- Language: ${settings.language || "English"}
- ${ratingGuidance[review.starRating] || ratingGuidance[3]}
${seoRules}
- Never make unsupported claims such as "best", "#1", "top-rated", or guaranteed results.
- Do not add promotions, discounts, phone numbers, links, or calls to buy.
- Address the reviewer by name when available.
- Mention a specific detail from the review when there is one.
- Response length: ${lengthMap[settings.responseLength] || lengthMap.standard}.
- Keep it genuine and conversational.
- ${settings.signOff ? `Sign off as: ${settings.signOff}` : "Do not add a separate signature unless it sounds natural."}
${settings.customInstructions ? `- Additional owner instruction: ${settings.customInstructions}` : ""}

Write ONLY the final reply. No quotes, labels, explanations, or keyword lists.`;
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-2.5-flash:generateContent`;
  const response = await axios.post(endpoint, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 260, temperature: 0.35 },
  }, { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } });
  const text = response.data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim() || "";
  if (!text) throw new Error("Gemini returned an empty SEO response");
  return text;
}

function reviewUrl(connectionData, reviewId) {
  return `https://mybusiness.googleapis.com/v4/${connectionData.accountName}/${connectionData.locationId}/reviews/${reviewId}`;
}

async function rewriteOne(vendorId, connectionData, reviewId, existingReview) {
  const premiumDoc = await db.collection("premium_vendors").doc(vendorId).get();
  if (!premiumDoc.exists || !premiumDoc.data().isPremium) throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");
  if (!connectionData?.connected || !connectionData.accountName || !connectionData.locationId) throw new functions.https.HttpsError("failed-precondition", "GBP is not connected");
  const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
  const listing = vendorSnap.docs[0]?.data() || {};
  const settings = normalizeSettings(connectionData.responseSettings);
  if (!settings.autoReply) throw new functions.https.HttpsError("failed-precondition", "Automatic review responses are turned off in Response Settings");
  const accessToken = await getValidToken(vendorId, connectionData);
  const latestRes = await axios.get(reviewUrl(connectionData, reviewId), { headers: { Authorization: `Bearer ${accessToken}` } });
  const latestReview = latestRes.data;
  const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const review = {
    reviewerName: latestReview.reviewer?.displayName || existingReview?.reviewerName || "Valued Customer",
    reviewText: latestReview.comment || existingReview?.reviewText || "",
    starRating: ratingMap[latestReview.starRating] || existingReview?.starRating || 3,
  };
  const aiResponse = await generateSeoResponse(review, listing, settings);
  await axios.put(`${reviewUrl(connectionData, reviewId)}/reply`, { comment: aiResponse }, { headers: { Authorization: `Bearer ${accessToken}` } });
  const ref = db.collection("review_responses").doc(`${vendorId}_${reviewId}`);
  await ref.set({ vendorId, reviewId, reviewerName: review.reviewerName, reviewText: review.reviewText, starRating: review.starRating, aiResponse, googleReply: aiResponse, status: "posted", seoOptimized: !!settings.seoOptimization, seoVersion: 3, editedAt: admin.firestore.FieldValue.serverTimestamp(), postedAt: admin.firestore.FieldValue.serverTimestamp(), syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return aiResponse;
}

exports.rewriteReviewResponse = functions.runWith({ secrets: [googleOAuthConfig] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;
  const reviewId = String(data?.reviewId || "").trim();
  if (!reviewId) throw new functions.https.HttpsError("invalid-argument", "Review ID is required");
  try {
    const [connDoc, reviewDoc] = await Promise.all([
      db.collection("gbp_connections").doc(vendorId).get(),
      db.collection("review_responses").doc(`${vendorId}_${reviewId}`).get(),
    ]);
    if (!reviewDoc.exists) throw new functions.https.HttpsError("not-found", "Review not found");
    const response = await rewriteOne(vendorId, connDoc.data(), reviewId, reviewDoc.data());
    return { ok: true, response, message: "SEO-optimized response updated on Google." };
  } catch (err) {
    console.error(`SEO rewrite failed for vendor ${vendorId}, review ${reviewId}:`, err.response?.status, err.response?.data || err.message);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("unavailable", "Could not update the Google review response.");
  }
});

exports.pollReviews = functions.runWith({ secrets: [googleOAuthConfig] }).pubsub.schedule("every 30 minutes").timeZone("Asia/Kolkata").onRun(async () => {
  console.log("pollReviews: SEO-aware review responder starting");
  const connectionsSnap = await db.collection("gbp_connections").where("connected", "==", true).get();
  for (const connDoc of connectionsSnap.docs) {
    const vendorId = connDoc.id;
    const connectionData = connDoc.data();
    try {
      const premiumDoc = await db.collection("premium_vendors").doc(vendorId).get();
      if (!premiumDoc.exists || !premiumDoc.data().isPremium) continue;
      const settings = normalizeSettings(connectionData.responseSettings);
      if (!settings.autoReply) {
        await connDoc.ref.set({ lastPolled: admin.firestore.FieldValue.serverTimestamp(), responderStatus: "disabled" }, { merge: true });
        continue;
      }
      const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
      const listing = vendorSnap.docs[0]?.data() || {};
      const accessToken = await getValidToken(vendorId, connectionData);
      const reviewsRes = await axios.get(`https://mybusiness.googleapis.com/v4/${connectionData.accountName}/${connectionData.locationId}/reviews`, { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 50, orderBy: "updateTime desc" } });
      const reviews = reviewsRes.data.reviews || [];
      const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
      for (const review of reviews) {
        const reviewId = review.reviewId || review.name?.split("/").pop();
        if (!reviewId || review.reviewReply) continue;
        const ref = db.collection("review_responses").doc(`${vendorId}_${reviewId}`);
        const existing = await ref.get();
        const existingData = existing.exists ? existing.data() : {};
        if (existingData.status === "posted") continue;
        const starRating = ratingMap[review.starRating] || 3;
        if (settings[`replyTo${starRating}Star`] === false) continue;
        if (existingData.status === "processing") continue;
        await ref.set({ vendorId, reviewId, reviewerName: review.reviewer?.displayName || "Valued Customer", reviewText: review.comment || "", starRating, status: "processing", processingAt: admin.firestore.FieldValue.serverTimestamp(), receivedAt: review.createTime ? admin.firestore.Timestamp.fromDate(new Date(review.createTime)) : admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        try {
          const aiResponse = await generateSeoResponse({ reviewerName: review.reviewer?.displayName || "Valued Customer", reviewText: review.comment || "", starRating }, listing, settings);
          const latest = await axios.get(reviewUrl(connectionData, reviewId), { headers: { Authorization: `Bearer ${accessToken}` } });
          if (latest.data.reviewReply) {
            await ref.set({ status: "posted", aiResponse: latest.data.reviewReply.comment || null, googleReply: latest.data.reviewReply.comment || null, processingAt: admin.firestore.FieldValue.delete() }, { merge: true });
            continue;
          }
          await axios.put(`${reviewUrl(connectionData, reviewId)}/reply`, { comment: aiResponse }, { headers: { Authorization: `Bearer ${accessToken}` } });
          await ref.set({ aiResponse, googleReply: aiResponse, status: "posted", seoOptimized: !!settings.seoOptimization, seoVersion: 3, postedAt: admin.firestore.FieldValue.serverTimestamp(), processingAt: admin.firestore.FieldValue.delete(), syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } catch (err) {
          await ref.set({ status: "error", error: err.response?.data?.error?.message || err.message, processingAt: admin.firestore.FieldValue.delete(), lastErrorAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
          console.error(`SEO responder failed for ${vendorId}/${reviewId}:`, err.response?.status, err.response?.data || err.message);
        }
      }
      await db.collection("gbp_connections").doc(vendorId).set({ lastPolled: admin.firestore.FieldValue.serverTimestamp(), lastReviewSyncCount: reviews.length, responderStatus: "active" }, { merge: true });
    } catch (err) {
      console.error(`SEO poll failed for vendor ${vendorId}:`, err.response?.status, err.response?.data || err.message);
    }
  }
  return null;
});

// Shared by the manual Sync Reviews Now callable so manual sync and the scheduled
// responder use exactly the same settings-aware Google/Gemini pipeline.
exports.__reviewResponder = { normalizeSettings, getValidToken, generateSeoResponse, reviewUrl };
