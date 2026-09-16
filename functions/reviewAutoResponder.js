// Secure scheduled Google Review auto-responder.
// This module intentionally overrides the legacy pollReviews export from
// index.js without changing the existing responder UI or other functions.

const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const googleOAuthConfig = defineSecret("GOOGLE_OAUTH_CONFIG");

function getGoogleOAuthConfig() {
  let cfg;
  try {
    cfg = JSON.parse(googleOAuthConfig.value());
  } catch (err) {
    throw new Error("GOOGLE_OAUTH_CONFIG is missing or invalid");
  }
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
  if (!token?.access_token) throw new Error("Google did not return a Vertex AI access token");
  return token.access_token;
}

async function generateAIResponse(review, listing, settings) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId;
  if (!projectId) throw new Error("Google Cloud project ID is not available");

  const accessToken = await getVertexAccessToken();
  const toneMap = {
    friendly: "warm, friendly, and personable",
    professional: "professional and formal",
    casual: "casual and conversational",
    grateful: "deeply grateful and appreciative",
  };
  const ratingGuidance = {
    5: "5-star glowing review. Express genuine gratitude, highlight what they praised, invite them back.",
    4: "4-star positive review. Thank them warmly, acknowledge feedback, mention you strive for 5 stars.",
    3: "3-star neutral review. Acknowledge their experience, show commitment to improvement, invite back.",
    2: "2-star negative review. Be empathetic, apologise sincerely, offer to make it right.",
    1: "1-star critical review. Be empathetic, take responsibility, apologise, urgently offer resolution.",
  };

  const prompt = `Write a Google Business review response for a local business.\n\nBUSINESS: ${listing?.name || "Our Business"} | ${listing?.category || "Local Business"} | ${listing?.address || "India"}\nREVIEWER: ${review.reviewerName || "Valued Customer"}\nRATING: ${review.starRating}/5\nREVIEW: "${review.reviewText || "(No text — star rating only)"}"\n\nRULES:\n- Tone: ${toneMap[settings?.tone] || "warm and friendly"}\n- Language: ${settings?.language || "English"}\n- ${ratingGuidance[review.starRating] || ratingGuidance[3]}\n- Sign off as: ${settings?.signOff || `The ${listing?.name || "Team"}`}\n- 50-120 words only\n- Address reviewer by name\n- Never use "Thank you for your review" as opening\n- Make it personal and specific\n${settings?.customInstructions ? `- ${settings.customInstructions}` : ""}\n\nWrite ONLY the response. No quotes, no labels.`;

  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-2.5-flash:generateContent`;
  const response = await axios.post(
    endpoint,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.4 },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
}

function reviewUrl(connectionData, reviewId) {
  return `https://mybusiness.googleapis.com/v4/${connectionData.accountName}/${connectionData.locationId}/reviews/${reviewId}`;
}

function reviewsUrl(connectionData) {
  return `https://mybusiness.googleapis.com/v4/${connectionData.accountName}/${connectionData.locationId}/reviews`;
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
  const isExpired = expiry < new Date(Date.now() + 5 * 60 * 1000);
  if (isExpired) return refreshAccessToken(vendorId, connectionData);
  if (!connectionData.accessToken) return refreshAccessToken(vendorId, connectionData);
  return connectionData.accessToken;
}

async function markGoogleReply(ref, review) {
  const googleReply = review.reviewReply?.comment || null;
  await ref.set({
    status: "posted",
    aiResponse: googleReply,
    googleReply,
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function processVendor(vendorId, connectionData) {
  const premiumDoc = await db.collection("premium_vendors").doc(vendorId).get();
  if (!premiumDoc.exists || !premiumDoc.data().isPremium) {
    console.log(`Skipping vendor ${vendorId} — not premium`);
    return;
  }

  if (!connectionData.accountName || !connectionData.locationId) {
    console.error(`Skipping vendor ${vendorId} — GBP account/location missing`);
    return;
  }

  const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
  const listing = vendorSnap.docs[0]?.data() || {};
  const settings = connectionData.responseSettings || {};
  const accessToken = await getValidToken(vendorId, connectionData);

  const reviewsRes = await axios.get(reviewsUrl(connectionData), {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { pageSize: 50, orderBy: "updateTime desc" },
  });

  const reviews = reviewsRes.data.reviews || [];
  console.log(`Vendor ${vendorId}: ${reviews.length} reviews found`);

  const ratingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

  for (const review of reviews) {
    const reviewId = review.reviewId || review.name?.split("/").pop();
    if (!reviewId) continue;

    const ref = db.collection("review_responses").doc(`${vendorId}_${reviewId}`);
    const existing = await ref.get();
    const existingData = existing.exists ? existing.data() : {};

    if (review.reviewReply) {
      await markGoogleReply(ref, review);
      continue;
    }

    if (existingData.status === "posted") continue;

    const starRating = ratingMap[review.starRating] || 3;
    if (settings[`replyTo${starRating}Star`] === false) continue;

    const processingAt = existingData.processingAt?.toDate?.();
    if (existingData.status === "processing" && processingAt && Date.now() - processingAt.getTime() < 15 * 60 * 1000) {
      continue;
    }

    const reviewData = {
      vendorId,
      reviewId,
      reviewerName: review.reviewer?.displayName || "Valued Customer",
      reviewText: review.comment || "",
      starRating,
      receivedAt: review.createTime ? admin.firestore.Timestamp.fromDate(new Date(review.createTime)) : admin.firestore.FieldValue.serverTimestamp(),
      status: "processing",
      aiResponse: existingData.aiResponse || null,
      postedAt: existingData.postedAt || null,
      processingAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(reviewData, { merge: true });

    try {
      const aiResponse = await generateAIResponse(reviewData, listing, settings);
      if (!aiResponse) throw new Error("Gemini returned an empty response");

      const latestReviewRes = await axios.get(reviewUrl(connectionData, reviewId), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const latestReview = latestReviewRes.data;
      if (latestReview.reviewReply) {
        await markGoogleReply(ref, latestReview);
        continue;
      }

      await axios.put(
        `${reviewUrl(connectionData, reviewId)}/reply`,
        { comment: aiResponse },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      await ref.set({
        aiResponse,
        status: "posted",
        postedAt: admin.firestore.FieldValue.serverTimestamp(),
        processingAt: admin.firestore.FieldValue.delete(),
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      console.log(`Posted response — vendor ${vendorId}, review ${reviewId}`);
    } catch (err) {
      await ref.set({
        status: "error",
        error: err.response?.data?.error?.message || err.response?.data?.error_description || err.message,
        processingAt: admin.firestore.FieldValue.delete(),
        lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      console.error(`Review response failed — vendor ${vendorId}, review ${reviewId}:`, err.response?.status, err.response?.data || err.message);
    }
  }

  await db.collection("gbp_connections").doc(vendorId).set({
    lastPolled: admin.firestore.FieldValue.serverTimestamp(),
    lastReviewSyncCount: reviews.length,
  }, { merge: true });
}

exports.pollReviews = functions.runWith({ secrets: [googleOAuthConfig] }).pubsub.schedule("every 30 minutes").timeZone("Asia/Kolkata").onRun(async () => {
  console.log("pollReviews: starting secure review responder (Gemini/Vertex AI)");
  const connectionsSnap = await db.collection("gbp_connections").where("connected", "==", true).get();
  if (connectionsSnap.empty) {
    console.log("No connected vendors");
    return null;
  }

  const results = await Promise.allSettled(
    connectionsSnap.docs.map(async (connDoc) => {
      try {
        await processVendor(connDoc.id, connDoc.data());
      } catch (err) {
        console.error(`Error processing vendor ${connDoc.id}:`, err.response?.status, err.response?.data || err.message);
      }
    })
  );

  const failed = results.filter((result) => result.status === "rejected").length;
  console.log(`pollReviews: complete — ${connectionsSnap.size} vendors checked, ${failed} vendor tasks rejected`);
  return null;
});
