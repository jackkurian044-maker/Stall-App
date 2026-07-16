// reviewFunctions.js
// Place this in: functions/index.js (or merge with existing functions/index.js)
// Deploy with: firebase deploy --only functions
//
// Required env vars (set with: firebase functions:config:set):
//   google.client_id, google.client_secret, google.redirect_uri
//   anthropic.api_key

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
// 1. OAUTH CALLBACK
// Called by Google after vendor grants permission
// URL: https://<region>-<project>.cloudfunctions.net/oauthCallback?code=xxx&state=vendorId
// ─────────────────────────────────────────────────────────────
exports.oauthCallback = functions.https.onRequest(async (req, res) => {
  const { code, state: vendorId } = req.query;
  if (!code || !vendorId) return res.status(400).send("Missing code or state");

  try {
    const cfg = functions.config().google;

    // Exchange auth code for tokens
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: cfg.client_id,
      client_secret: cfg.client_secret,
      redirect_uri: cfg.redirect_uri,
      grant_type: "authorization_code",
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Get the vendor's GBP account and location
    const accountsRes = await axios.get(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const account = accountsRes.data.accounts?.[0];
    if (!account) return res.status(400).send("No GBP account found");

    const locationsRes = await axios.get(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const location = locationsRes.data.locations?.[0];

    // Store tokens in Firestore
    await db.collection("gbp_connections").doc(vendorId).set({
      connected: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
      accountName: account.name,
      locationName: location?.title || "Your Business",
      locationId: location?.name || "",
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastPolled: null,
    }, { merge: true });

    // Redirect back to the Stall App with success
    res.redirect(`${cfg.redirect_uri.replace("/oauthCallback", "")}?gbp=connected`);
  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    res.status(500).send("Connection failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// 2. REFRESH ACCESS TOKEN (helper)
// ─────────────────────────────────────────────────────────────
async function refreshAccessToken(vendorId, connectionData) {
  const cfg = functions.config().google;
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

// ─────────────────────────────────────────────────────────────
// 3. GET VALID ACCESS TOKEN (helper)
// ─────────────────────────────────────────────────────────────
async function getValidToken(vendorId, connectionData) {
  const expiry = connectionData.tokenExpiresAt?.toDate?.() || new Date(0);
  const isExpired = expiry < new Date(Date.now() + 5 * 60 * 1000); // 5 min buffer
  if (isExpired) {
    return await refreshAccessToken(vendorId, connectionData);
  }
  return connectionData.accessToken;
}

// ─────────────────────────────────────────────────────────────
// 4. AI RESPONSE GENERATOR (helper)
// Uses Claude API to generate contextual review response
// ─────────────────────────────────────────────────────────────
async function generateAIResponse(review, listing, settings) {
  const apiKey = functions.config().anthropic.api_key;

  const toneMap = {
    friendly: "warm, friendly, and personable",
    professional: "professional and formal",
    casual: "casual and conversational",
    grateful: "deeply grateful and appreciative",
  };

  const tone = toneMap[settings?.tone] || "warm and friendly";
  const language = settings?.language || "english";
  const signOff = settings?.signOff || `The ${listing?.name || "Team"}`;
  const customInstructions = settings?.customInstructions || "";

  const ratingGuidance = {
    5: "This is a 5-star glowing review. Express genuine gratitude, highlight what they praised, invite them back.",
    4: "This is a 4-star positive review. Thank them warmly, acknowledge their feedback, mention you strive for 5 stars.",
    3: "This is a 3-star neutral review. Acknowledge their experience, show commitment to improvement, invite them back.",
    2: "This is a 2-star negative review. Be empathetic, apologise sincerely, offer to make it right, provide contact details.",
    1: "This is a 1-star critical review. Be empathetic, take responsibility, apologise sincerely, urgently offer resolution.",
  };

  const prompt = `You are writing a Google Business review response for a local business.

BUSINESS DETAILS:
- Name: ${listing?.name || "Our Business"}
- Category: ${listing?.category || "Local Business"}
- Location: ${listing?.address || "Bengaluru"}

REVIEW DETAILS:
- Reviewer: ${review.reviewerName || "Valued Customer"}
- Star Rating: ${review.starRating}/5
- Review Text: "${review.reviewText || "(No text provided — star rating only)"}"

RESPONSE GUIDELINES:
- Tone: ${tone}
- Language: ${language}
- Rating guidance: ${ratingGuidance[review.starRating] || ratingGuidance[3]}
- Sign off as: ${signOff}
- Keep response between 50-120 words
- Start by addressing the reviewer by name if available
- Do NOT use generic phrases like "Thank you for your review"
- Make it feel personal and specific to what they said
${customInstructions ? `- Additional instructions: ${customInstructions}` : ""}

Write ONLY the response text. No quotes, no labels, no explanation.`;

  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.content?.[0]?.text?.trim() || "";
}

// ─────────────────────────────────────────────────────────────
// 5. POLL REVIEWS — runs every 30 minutes
// Checks all connected vendors for new unanswered reviews
// ─────────────────────────────────────────────────────────────
exports.pollReviews = functions.pubsub
  .schedule("every 30 minutes")
  .onRun(async () => {
    console.log("pollReviews: starting poll");

    // Get all connected premium vendors
    const connectionsSnap = await db
      .collection("gbp_connections")
      .where("connected", "==", true)
      .get();

    if (connectionsSnap.empty) {
      console.log("No connected vendors found");
      return null;
    }

    const promises = connectionsSnap.docs.map(async (connDoc) => {
      const vendorId = connDoc.id;
      const connectionData = connDoc.data();

      try {
        // Get vendor's Stall App listing for context
        const listingSnap = await db
          .collection("listings")
          .where("ownerId", "==", vendorId)
          .limit(1)
          .get();
        const listing = listingSnap.docs[0]?.data() || {};

        // Get response settings
        const settings = connectionData.responseSettings || {};

        // Get valid access token
        const accessToken = await getValidToken(vendorId, connectionData);

        // Fetch reviews from Google My Business API
        const reviewsRes = await axios.get(
          `https://mybusiness.googleapis.com/v4/${connectionData.locationId}/reviews`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { pageSize: 50 },
          }
        );

        const reviews = reviewsRes.data.reviews || [];
        console.log(`Vendor ${vendorId}: found ${reviews.length} reviews`);

        // Process each unanswered review
        for (const review of reviews) {
          const reviewId = review.reviewId;
          const starRating = {
            ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5
          }[review.starRating] || 3;

          // Skip if we've already responded
          const existingDoc = await db
            .collection("review_responses")
            .doc(`${vendorId}_${reviewId}`)
            .get();

          if (existingDoc.exists) continue;

          // Skip if already has a reply on Google
          if (review.reviewReply) continue;

          // Check settings — should we respond to this star rating?
          if (settings[`replyTo${starRating}Star`] === false) {
            console.log(`Skipping ${starRating}★ review per settings`);
            continue;
          }

          const reviewData = {
            vendorId,
            reviewId,
            reviewerName: review.reviewer?.displayName || "Valued Customer",
            reviewText: review.comment || "",
            starRating,
            receivedAt: admin.firestore.Timestamp.fromDate(
              new Date(review.createTime)
            ),
            status: "pending",
            aiResponse: null,
            postedAt: null,
          };

          // Save review to Firestore
          await db
            .collection("review_responses")
            .doc(`${vendorId}_${reviewId}`)
            .set(reviewData);

          // Generate AI response
          const aiResponse = await generateAIResponse(
            reviewData,
            listing,
            settings
          );

          // Post response to Google
          await axios.put(
            `https://mybusiness.googleapis.com/v4/${connectionData.locationId}/reviews/${reviewId}/reply`,
            { comment: aiResponse },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          // Update Firestore with posted response
          await db
            .collection("review_responses")
            .doc(`${vendorId}_${reviewId}`)
            .update({
              aiResponse,
              status: "posted",
              postedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

          console.log(`✅ Posted response for vendor ${vendorId}, review ${reviewId}`);
        }

        // Update last polled timestamp
        await db
          .collection("gbp_connections")
          .doc(vendorId)
          .update({ lastPolled: admin.firestore.FieldValue.serverTimestamp() });

      } catch (err) {
        console.error(`Error processing vendor ${vendorId}:`, err.response?.data || err.message);

        // Mark as failed if we had a specific review being processed
        // (error handling — don't crash the whole poll for one vendor)
      }
    });

    await Promise.allSettled(promises);
    console.log("pollReviews: complete");
    return null;
  });

// ─────────────────────────────────────────────────────────────
// 6. MANUAL TRIGGER (for testing)
// POST to this endpoint to trigger a poll for a specific vendor
// ─────────────────────────────────────────────────────────────
exports.triggerPollForVendor = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");

  const vendorId = context.auth.uid;
  const connDoc = await db.collection("gbp_connections").doc(vendorId).get();

  if (!connDoc.exists || !connDoc.data().connected) {
    throw new functions.https.HttpsError("failed-precondition", "GBP not connected");
  }

  // Reuse poll logic for this vendor
  const connectionData = connDoc.data();
  const listingSnap = await db.collection("listings").where("ownerId", "==", vendorId).limit(1).get();
  const listing = listingSnap.docs[0]?.data() || {};
  const settings = connectionData.responseSettings || {};
  const accessToken = await getValidToken(vendorId, connectionData);

  const reviewsRes = await axios.get(
    `https://mybusiness.googleapis.com/v4/${connectionData.locationId}/reviews`,
    { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 10 } }
  );

  return {
    reviewCount: reviewsRes.data.reviews?.length || 0,
    message: "Poll triggered successfully",
  };
});
