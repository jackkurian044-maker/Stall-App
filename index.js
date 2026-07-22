// functions/index.js
// Complete Cloud Functions for Stall App
// Includes: Razorpay subscriptions + Google Review auto-responder
//
// Setup commands (run once):
//   firebase functions:config:set razorpay.key_id="rzp_xxx" razorpay.key_secret="xxx" razorpay.webhook_secret="xxx"
//   firebase functions:config:set google.client_id="xxx" google.client_secret="xxx" google.redirect_uri="https://<region>-stall-app-1aab7.cloudfunctions.net/oauthCallback"
//   firebase functions:config:set anthropic.api_key="sk-ant-xxx"
//
// Install dependencies:
//   cd functions && npm install axios razorpay crypto firebase-admin firebase-functions
//
// Deploy:
//   firebase deploy --only functions

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const Razorpay = require("razorpay");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// True if uid is an admin, or is the claimed owner of vendors/{listingId}.
// Used to authorize Premium + Google-connection actions on a per-listing
// basis, since a listing can be managed by an admin (including unclaimed
// listings) or by the vendor who claimed it.
async function isAuthorizedForListing(uid, listingId) {
  const [adminDoc, listingDoc] = await Promise.all([
    db.collection("admins").doc(uid).get(),
    db.collection("vendors").doc(listingId).get(),
  ]);
  if (adminDoc.exists) return true;
  if (listingDoc.exists && listingDoc.data().ownerId === uid) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 1 — RAZORPAY SUBSCRIPTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getRazorpay() {
  const cfg = functions.config().razorpay;
  return new Razorpay({ key_id: cfg.key_id, key_secret: cfg.key_secret });
}

// ─────────────────────────────────────────────────────────────
// 1A. CREATE SUBSCRIPTION
// Called from PremiumGate.jsx when vendor clicks Subscribe
// ─────────────────────────────────────────────────────────────
exports.createSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { listingId, vendorName, vendorEmail } = data;

  if (!(await isAuthorizedForListing(context.auth.uid, listingId))) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  }

  const premiumDoc = await db.collection("premium_vendors").doc(listingId).get();
  if (premiumDoc.exists && premiumDoc.data().isPremium) {
    throw new functions.https.HttpsError("already-exists", "Already subscribed");
  }

  try {
    const razorpay = getRazorpay();
    const cfg = functions.config().razorpay;
    let planId = cfg.plan_id;

    // Create plan if not yet configured
    if (!planId) {
      const plan = await razorpay.plans.create({
        period: "monthly",
        interval: 1,
        item: {
          name: "Stall Premium",
          amount: 49900, // ₹499 in paise
          currency: "INR",
          description: "Auto Google Review Responder — Monthly",
        },
      });
      planId = plan.id;
      console.log("Created Razorpay plan:", planId, "— save as razorpay.plan_id in functions config");
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      quantity: 1,
      total_count: 120,
      notes: { listingId, initiatedBy: context.auth.uid, vendorName: vendorName || "", vendorEmail: vendorEmail || "", source: "stall-app" },
    });

    await db.collection("premium_vendors").doc(listingId).set({
      isPremium: false,
      subscriptionId: subscription.id,
      planId,
      status: "created",
      vendorName: vendorName || "",
      vendorEmail: vendorEmail || "",
      initiatedBy: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      activatedAt: null,
      nextBillingDate: null,
      payments: [],
    }, { merge: true });

    return { subscriptionId: subscription.id };

  } catch (err) {
    console.error("createSubscription error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// 1B. VERIFY SUBSCRIPTION
// Called from PremiumGate.jsx after Razorpay checkout success
// ─────────────────────────────────────────────────────────────
exports.verifySubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, listingId } = data;

  if (!(await isAuthorizedForListing(context.auth.uid, listingId))) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  }

  try {
    const cfg = functions.config().razorpay;

    // Verify HMAC signature
    const body = `${razorpay_payment_id}|${razorpay_subscription_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", cfg.key_secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      throw new functions.https.HttpsError("invalid-argument", "Payment signature mismatch");
    }

    const razorpay = getRazorpay();
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    const nextBilling = new Date();
    nextBilling.setDate(nextBilling.getDate() + 30);

    // Activate premium
    await db.collection("premium_vendors").doc(listingId).set({
      isPremium: true,
      status: "active",
      subscriptionId: razorpay_subscription_id,
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      nextBillingDate: nextBilling,
      payments: admin.firestore.FieldValue.arrayUnion({
        paymentId: razorpay_payment_id,
        amount: payment.amount,
        paidAt: admin.firestore.Timestamp.now(),
        method: payment.method,
      }),
    }, { merge: true });

    // Mark listing as premium too — direct doc reference now that
    // premium status is keyed by listingId rather than owner UID.
    await db.collection("vendors").doc(listingId).update({ isPremium: true });

    console.log(`✅ Premium activated for listing ${listingId}`);
    return { success: true };

  } catch (err) {
    console.error("verifySubscription error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// 1C. CANCEL SUBSCRIPTION
// ─────────────────────────────────────────────────────────────
exports.cancelSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { listingId } = data;

  if (!(await isAuthorizedForListing(context.auth.uid, listingId))) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  }

  try {
    const premiumDoc = await db.collection("premium_vendors").doc(listingId).get();
    if (!premiumDoc.exists || !premiumDoc.data().subscriptionId) {
      throw new functions.https.HttpsError("not-found", "No active subscription");
    }

    const { subscriptionId } = premiumDoc.data();
    const razorpay = getRazorpay();

    // cancel_at_cycle_end: 1 = keep access till billing period ends
    await razorpay.subscriptions.cancel(subscriptionId, { cancel_at_cycle_end: 1 });

    await db.collection("premium_vendors").doc(listingId).update({
      status: "cancelling",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Cancelled subscription ${subscriptionId} for listing ${listingId}`);
    return { success: true };

  } catch (err) {
    console.error("cancelSubscription error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// 1D. RAZORPAY WEBHOOK HANDLER
// Add URL in Razorpay Dashboard → Settings → Webhooks:
// https://<region>-stall-app-1aab7.cloudfunctions.net/razorpayWebhook
// Events: subscription.charged, subscription.payment.failed, subscription.cancelled
// ─────────────────────────────────────────────────────────────
exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
  const cfg = functions.config().razorpay;

  // Verify webhook signature
  const receivedSig = req.headers["x-razorpay-signature"];
  const expectedSig = crypto
    .createHmac("sha256", cfg.webhook_secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (receivedSig !== expectedSig) {
    console.error("Webhook signature mismatch");
    return res.status(400).send("Invalid signature");
  }

  const event = req.body.event;
  const payload = req.body.payload;
  console.log(`Razorpay webhook received: ${event}`);

  try {
    switch (event) {

      case "subscription.charged": {
        const subscription = payload.subscription?.entity;
        const payment = payload.payment?.entity;
        if (!subscription) break;

        const snap = await db.collection("premium_vendors")
          .where("subscriptionId", "==", subscription.id).limit(1).get();
        if (snap.empty) break;

        const listingId = snap.docs[0].id;
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);

        await db.collection("premium_vendors").doc(listingId).update({
          isPremium: true,
          status: "active",
          nextBillingDate: nextBilling,
          payments: admin.firestore.FieldValue.arrayUnion({
            paymentId: payment?.id || "",
            amount: payment?.amount || 49900,
            paidAt: admin.firestore.Timestamp.now(),
            method: payment?.method || "auto",
          }),
        });
        console.log(`✅ Subscription renewed for listing ${listingId}`);
        break;
      }

      case "subscription.payment.failed":
      case "payment.failed": {
        const subscription = payload.subscription?.entity;
        if (!subscription) break;

        const snap = await db.collection("premium_vendors")
          .where("subscriptionId", "==", subscription.id).limit(1).get();
        if (snap.empty) break;

        const listingId = snap.docs[0].id;
        await db.collection("premium_vendors").doc(listingId).update({
          isPremium: false,
          status: "payment_failed",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await db.collection("vendors").doc(listingId).update({ isPremium: false });
        console.log(`⚠️ Payment failed — premium deactivated for listing ${listingId}`);
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed": {
        const subscription = payload.subscription?.entity;
        if (!subscription) break;

        const snap = await db.collection("premium_vendors")
          .where("subscriptionId", "==", subscription.id).limit(1).get();
        if (snap.empty) break;

        const listingId = snap.docs[0].id;
        await db.collection("premium_vendors").doc(listingId).update({
          isPremium: false,
          status: "cancelled",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await db.collection("vendors").doc(listingId).update({ isPremium: false });
        console.log(`Subscription cancelled for listing ${listingId}`);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).send("Webhook processing failed");
  }
});

// ─────────────────────────────────────────────────────────────
// 1E. GET SUBSCRIPTION STATUS (utility)
// ─────────────────────────────────────────────────────────────
exports.getSubscriptionStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { listingId } = data;
  if (!(await isAuthorizedForListing(context.auth.uid, listingId))) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  }

  const snap = await db.collection("premium_vendors").doc(listingId).get();
  if (!snap.exists) return { isPremium: false, status: "none" };

  const { isPremium, status, subscriptionId, nextBillingDate } = snap.data();
  return { isPremium, status, subscriptionId, nextBillingDate };
});


// ═══════════════════════════════════════════════════════════════
//  SECTION 2 — GOOGLE REVIEW AUTO-RESPONDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 2A. OAUTH CALLBACK
// Google redirects here after vendor grants permission
// URL: https://<region>-stall-app-1aab7.cloudfunctions.net/oauthCallback
// ─────────────────────────────────────────────────────────────
exports.oauthCallback = functions.https.onRequest(async (req, res) => {
  const { code, state: listingId } = req.query;
  if (!code || !listingId) return res.status(400).send("Missing code or state");

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

    // Get the connected Google account's GBP account
    const accountsRes = await axios.get(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const account = accountsRes.data.accounts?.[0];
    if (!account) return res.status(400).send("No GBP account found");

    // Get location
    const locationsRes = await axios.get(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const location = locationsRes.data.locations?.[0];

    // Store in Firestore, keyed by listingId
    await db.collection("gbp_connections").doc(listingId).set({
      connected: true,
      listingId,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
      accountName: account.name,
      locationName: location?.title || "Your Business",
      locationId: location?.name || "",
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastPolled: null,
    }, { merge: true });

    // Redirect back to app
    const appUrl = cfg.redirect_uri.replace("/oauthCallback", "");
    res.redirect(`${appUrl}?gbp=connected&listingId=${listingId}`);

  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    res.status(500).send("Connection failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// 2B. TOKEN HELPERS
// ─────────────────────────────────────────────────────────────
async function refreshAccessToken(listingId, connectionData) {
  const cfg = functions.config().google;
  const res = await axios.post("https://oauth2.googleapis.com/token", {
    refresh_token: connectionData.refreshToken,
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    grant_type: "refresh_token",
  });
  const { access_token, expires_in } = res.data;
  await db.collection("gbp_connections").doc(listingId).update({
    accessToken: access_token,
    tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
  });
  return access_token;
}

async function getValidToken(listingId, connectionData) {
  const expiry = connectionData.tokenExpiresAt?.toDate?.() || new Date(0);
  const isExpired = expiry < new Date(Date.now() + 5 * 60 * 1000);
  if (isExpired) return await refreshAccessToken(listingId, connectionData);
  return connectionData.accessToken;
}

// ─────────────────────────────────────────────────────────────
// 2C. AI RESPONSE GENERATOR
// Uses Claude to write personalised review responses
// ─────────────────────────────────────────────────────────────
async function generateAIResponse(review, listing, settings) {
  const apiKey = functions.config().anthropic.api_key;

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

  const prompt = `Write a Google Business review response for a local business.

BUSINESS: ${listing?.name || "Our Business"} | ${listing?.category || "Local Business"} | ${listing?.address || "Bengaluru"}
REVIEWER: ${review.reviewerName || "Valued Customer"}
RATING: ${review.starRating}/5
REVIEW: "${review.reviewText || "(No text — star rating only)"}"

RULES:
- Tone: ${toneMap[settings?.tone] || "warm and friendly"}
- Language: ${settings?.language || "English"}
- ${ratingGuidance[review.starRating] || ratingGuidance[3]}
- Sign off as: ${settings?.signOff || `The ${listing?.name || "Team"}`}
- 50-120 words only
- Address reviewer by name
- Never use "Thank you for your review" as opening
- Make it personal and specific
${settings?.customInstructions ? `- ${settings.customInstructions}` : ""}

Write ONLY the response. No quotes, no labels.`;

  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    { model: "claude-sonnet-4-6", max_tokens: 300, messages: [{ role: "user", content: prompt }] },
    { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } }
  );

  return res.data.content?.[0]?.text?.trim() || "";
}

// ─────────────────────────────────────────────────────────────
// 2D. POLL REVIEWS — runs every 30 minutes
// Only processes vendors who are BOTH connected AND premium
// ─────────────────────────────────────────────────────────────
exports.pollReviews = functions.pubsub
  .schedule("every 30 minutes")
  .onRun(async () => {
    console.log("pollReviews: starting");

    // Get all connected GBP listings
    const connectionsSnap = await db.collection("gbp_connections")
      .where("connected", "==", true).get();

    if (connectionsSnap.empty) {
      console.log("No connected listings");
      return null;
    }

    const promises = connectionsSnap.docs.map(async (connDoc) => {
      const listingId = connDoc.id;
      const connectionData = connDoc.data();

      try {
        // ── PREMIUM GATE: only process premium listings ──
        const premiumDoc = await db.collection("premium_vendors").doc(listingId).get();
        if (!premiumDoc.exists || !premiumDoc.data().isPremium) {
          console.log(`Skipping listing ${listingId} — not premium`);
          return;
        }

        // Get the listing itself for AI response context. Fetched directly
        // by ID now — works for claimed AND unclaimed listings, unlike the
        // old ownerId lookup which silently skipped unclaimed ones.
        const listingSnap = await db.collection("vendors").doc(listingId).get();
        const listing = listingSnap.exists ? listingSnap.data() : {};
        const settings = connectionData.responseSettings || {};

        // Get valid token
        const accessToken = await getValidToken(listingId, connectionData);

        // Fetch reviews from Google
        const reviewsRes = await axios.get(
          `https://mybusiness.googleapis.com/v4/${connectionData.locationId}/reviews`,
          { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 50 } }
        );

        const reviews = reviewsRes.data.reviews || [];
        console.log(`Listing ${listingId}: ${reviews.length} reviews found`);

        for (const review of reviews) {
          const reviewId = review.reviewId;
          const starRating = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[review.starRating] || 3;

          // Skip if already responded in Firestore
          const existingDoc = await db.collection("review_responses")
            .doc(`${listingId}_${reviewId}`).get();
          if (existingDoc.exists) continue;

          // Skip if already has reply on Google
          if (review.reviewReply) continue;

          // Skip per listing settings
          if (settings[`replyTo${starRating}Star`] === false) continue;

          const reviewData = {
            listingId,
            reviewId,
            reviewerName: review.reviewer?.displayName || "Valued Customer",
            reviewText: review.comment || "",
            starRating,
            receivedAt: admin.firestore.Timestamp.fromDate(new Date(review.createTime)),
            status: "pending",
            aiResponse: null,
            postedAt: null,
          };

          // Save to Firestore
          await db.collection("review_responses")
            .doc(`${listingId}_${reviewId}`).set(reviewData);

          // Generate AI response
          const aiResponse = await generateAIResponse(reviewData, listing, settings);

          // Post to Google
          await axios.put(
            `https://mybusiness.googleapis.com/v4/${connectionData.locationId}/reviews/${reviewId}/reply`,
            { comment: aiResponse },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          // Update Firestore
          await db.collection("review_responses")
            .doc(`${listingId}_${reviewId}`).update({
              aiResponse,
              status: "posted",
              postedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

          console.log(`✅ Posted response — listing ${listingId}, review ${reviewId}`);
        }

        // Update last polled
        await db.collection("gbp_connections").doc(listingId)
          .update({ lastPolled: admin.firestore.FieldValue.serverTimestamp() });

      } catch (err) {
        console.error(`Error processing listing ${listingId}:`, err.response?.data || err.message);
      }
    });

    await Promise.allSettled(promises);
    console.log("pollReviews: complete");
    return null;
  });

// ─────────────────────────────────────────────────────────────
// 2E. MANUAL TRIGGER (for testing)
// ─────────────────────────────────────────────────────────────
exports.triggerPollForVendor = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { listingId } = data;
  if (!(await isAuthorizedForListing(context.auth.uid, listingId))) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  }

  const [connDoc, premiumDoc] = await Promise.all([
    db.collection("gbp_connections").doc(listingId).get(),
    db.collection("premium_vendors").doc(listingId).get(),
  ]);

  if (!connDoc.exists || !connDoc.data().connected) {
    throw new functions.https.HttpsError("failed-precondition", "GBP not connected");
  }

  if (!premiumDoc.exists || !premiumDoc.data().isPremium) {
    throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");
  }

  const connectionData = connDoc.data();
  const accessToken = await getValidToken(listingId, connectionData);

  const reviewsRes = await axios.get(
    `https://mybusiness.googleapis.com/v4/${connectionData.locationId}/reviews`,
    { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 10 } }
  );

  return {
    reviewCount: reviewsRes.data.reviews?.length || 0,
    message: "Poll triggered successfully — check review_responses collection",
  };
});
