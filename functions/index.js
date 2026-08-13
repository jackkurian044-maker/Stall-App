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

// ═══════════════════════════════════════════════════════════════
//  SECTION 1 — RAZORPAY SUBSCRIPTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getRazorpay() {
  const cfg = functions.config().razorpay;
  return new Razorpay({ key_id: cfg.key_id, key_secret: cfg.key_secret });
}

// Coarse country classifier for India vs UAE, the two markets STALL
// currently operates in — used to price a vendor's subscription off
// their listing's actual location. Deliberately server-side and never
// trusted from the client, so pricing can't be spoofed by requesting
// the cheaper region. Mirrors src/geo.js's regionFromLatLng (kept as a
// separate copy since functions/ and src/ are different build targets);
// the two countries' bounding boxes don't overlap, so this is reliable
// at the current scale.
function regionFromLatLng(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return "in";
  const inUae = lat >= 22.0 && lat <= 26.5 && lng >= 51.0 && lng <= 56.5;
  return inUae ? "ae" : "in";
}

// Plan catalog — keep in sync with confirmed STALL pricing:
//   India: ₹499/month · ₹4,999/year      UAE: AED 100/month · AED 999/year
// Amounts are in the smallest currency unit (paise / fils).
// planKey = "<region>_<cycle>".
const SUBSCRIPTION_PLANS = {
  in_monthly: { amount: 49900, currency: "INR", period: "monthly", interval: 1, label: "Stall Premium — Monthly" },
  in_annual: { amount: 499900, currency: "INR", period: "yearly", interval: 1, label: "Stall Premium — Annual" },
  ae_monthly: { amount: 10000, currency: "AED", period: "monthly", interval: 1, label: "Stall Premium — Monthly" },
  ae_annual: { amount: 99900, currency: "AED", period: "yearly", interval: 1, label: "Stall Premium — Annual" },
};

// Looks up (or lazily creates, once ever) the Razorpay plan_id for a
// given plan key, caching it in Firestore so repeat subscribers reuse
// the same Razorpay plan instead of creating a new one every time.
async function getOrCreatePlanId(razorpay, planKey) {
  const plan = SUBSCRIPTION_PLANS[planKey];
  const cacheRef = db.collection("razorpay_plans").doc(planKey);
  const cached = await cacheRef.get();
  if (cached.exists && cached.data().planId) return cached.data().planId;

  const created = await razorpay.plans.create({
    period: plan.period,
    interval: plan.interval,
    item: {
      name: plan.label,
      amount: plan.amount,
      currency: plan.currency,
      description: "Auto Google Review Responder",
    },
  });
  await cacheRef.set({
    planId: created.id, ...plan,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`Created Razorpay plan for ${planKey}:`, created.id);
  return created.id;
}

// ─────────────────────────────────────────────────────────────
// 1A. CREATE SUBSCRIPTION
// Called from PremiumGate.jsx when vendor clicks Subscribe
// ─────────────────────────────────────────────────────────────
exports.createSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { vendorId, vendorName, vendorEmail, billingCycle } = data;
  const cycle = billingCycle === "annual" ? "annual" : "monthly";

  if (context.auth.uid !== vendorId) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  }

  const premiumDoc = await db.collection("premium_vendors").doc(vendorId).get();
  if (premiumDoc.exists && premiumDoc.data().isPremium) {
    throw new functions.https.HttpsError("already-exists", "Already subscribed");
  }

  try {
    // Region comes from the vendor's own listing location, never from
    // the client. Falls back to "in" if they have no listing yet.
    const vendorListingSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
    const listing = vendorListingSnap.empty ? null : vendorListingSnap.docs[0].data();
    const region = regionFromLatLng(listing?.lat, listing?.lng);
    const planKey = `${region}_${cycle}`;
    const plan = SUBSCRIPTION_PLANS[planKey];

    const razorpay = getRazorpay();
    const planId = await getOrCreatePlanId(razorpay, planKey);

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      quantity: 1,
      total_count: cycle === "annual" ? 10 : 120, // ~10yr / ~10yr of cycles either way
      notes: { vendorId, vendorName: vendorName || "", vendorEmail: vendorEmail || "", source: "stall-app", planKey },
    });

    await db.collection("premium_vendors").doc(vendorId).set({
      isPremium: false,
      subscriptionId: subscription.id,
      planId,
      planKey,
      billingCycle: cycle,
      amount: plan.amount,
      currency: plan.currency,
      status: "created",
      vendorName: vendorName || "",
      vendorEmail: vendorEmail || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      activatedAt: null,
      nextBillingDate: null,
      payments: [],
    }, { merge: true });

    const cfg = functions.config().razorpay;
    return {
      subscriptionId: subscription.id,
      keyId: cfg.key_id,
      planKey,
      amount: plan.amount,
      currency: plan.currency,
    };

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

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, vendorId } = data;

  if (context.auth.uid !== vendorId) {
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

    const premiumSnap = await db.collection("premium_vendors").doc(vendorId).get();
    const billingCycle = premiumSnap.exists ? premiumSnap.data().billingCycle : "monthly";
    const nextBilling = new Date();
    nextBilling.setDate(nextBilling.getDate() + (billingCycle === "annual" ? 365 : 30));

    // Activate premium
    await db.collection("premium_vendors").doc(vendorId).set({
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

    // Mark listing as premium too
    const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
    if (!vendorSnap.empty) {
      await vendorSnap.docs[0].ref.update({ isPremium: true });
    }

    console.log(`✅ Premium activated for vendor ${vendorId}`);
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

  const vendorId = context.auth.uid;

  try {
    const premiumDoc = await db.collection("premium_vendors").doc(vendorId).get();
    if (!premiumDoc.exists || !premiumDoc.data().subscriptionId) {
      throw new functions.https.HttpsError("not-found", "No active subscription");
    }

    const { subscriptionId } = premiumDoc.data();
    const razorpay = getRazorpay();

    // cancel_at_cycle_end: 1 = keep access till billing period ends
    await razorpay.subscriptions.cancel(subscriptionId, { cancel_at_cycle_end: 1 });

    await db.collection("premium_vendors").doc(vendorId).update({
      status: "cancelling",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Cancelled subscription ${subscriptionId} for vendor ${vendorId}`);
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

        const vendorId = snap.docs[0].id;
        const existingData = snap.docs[0].data();

        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + (existingData.billingCycle === "annual" ? 365 : 30));

        await db.collection("premium_vendors").doc(vendorId).update({
          isPremium: true,
          status: "active",
          nextBillingDate: nextBilling,
          payments: admin.firestore.FieldValue.arrayUnion({
            paymentId: payment?.id || "",
            amount: payment?.amount || existingData.amount || 49900,
            paidAt: admin.firestore.Timestamp.now(),
            method: payment?.method || "auto",
          }),
        });
        console.log(`✅ Subscription renewed for vendor ${vendorId}`);

        // Agent commissions are granted exclusively by onPremiumStatusChanged
        // (functions/agentCommissions.js), a Firestore trigger on
        // premium_vendors/{vendorUid} — the update() above fires it. Do not
        // duplicate commission-creation logic here: two independent code
        // paths writing commissions for the same event is how you end up
        // with divergent payout amounts or double-created commissions.
        break;
      }

      case "subscription.payment.failed":
      case "payment.failed": {
        const subscription = payload.subscription?.entity;
        if (!subscription) break;

        const snap = await db.collection("premium_vendors")
          .where("subscriptionId", "==", subscription.id).limit(1).get();
        if (snap.empty) break;

        const vendorId = snap.docs[0].id;
        await db.collection("premium_vendors").doc(vendorId).update({
          isPremium: false,
          status: "payment_failed",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const vendorSnap = await db.collection("vendors")
          .where("ownerId", "==", vendorId).limit(1).get();
        if (!vendorSnap.empty) {
          await vendorSnap.docs[0].ref.update({ isPremium: false });
        }
        console.log(`⚠️ Payment failed — premium deactivated for vendor ${vendorId}`);
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed": {
        const subscription = payload.subscription?.entity;
        if (!subscription) break;

        const snap = await db.collection("premium_vendors")
          .where("subscriptionId", "==", subscription.id).limit(1).get();
        if (snap.empty) break;

        const vendorId = snap.docs[0].id;
        await db.collection("premium_vendors").doc(vendorId).update({
          isPremium: false,
          status: "cancelled",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const vendorSnap = await db.collection("vendors")
          .where("ownerId", "==", vendorId).limit(1).get();
        if (!vendorSnap.empty) {
          const vendorDoc = vendorSnap.docs[0];
          await vendorDoc.ref.update({ isPremium: false });

          try {
            const commissionSnap = await db.collection("commissions")
              .where("vendorId", "==", vendorDoc.id).limit(1).get();
            if (!commissionSnap.empty) {
              const commissionDoc = commissionSnap.docs[0];
              const commissionData = commissionDoc.data();
              const convertedAt = commissionData.createdAt?.toDate?.();
              const daysSinceConversion = convertedAt
                ? (Date.now() - convertedAt.getTime()) / (1000 * 60 * 60 * 24)
                : null;
              if (
                commissionData.status !== "clawed_back" &&
                daysSinceConversion !== null &&
                daysSinceConversion <= 30
              ) {
                await commissionDoc.ref.update({
                  status: "clawed_back",
                  clawedBackAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`⚠️ Commission clawed back for vendor ${vendorDoc.id} (cancelled ${daysSinceConversion.toFixed(1)} days after conversion)`);
              }
            }
          } catch (clawErr) {
            console.error("Clawback check error:", clawErr);
          }
        }
        console.log(`Subscription cancelled for vendor ${vendorId}`);
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

  const vendorId = context.auth.uid;
  const snap = await db.collection("premium_vendors").doc(vendorId).get();
  if (!snap.exists) return { isPremium: false, status: "none" };

  const { isPremium, status, subscriptionId, nextBillingDate } = snap.data();
  return { isPremium, status, subscriptionId, nextBillingDate };
});


// ═══════════════════════════════════════════════════════════════
//  SECTION 2 — GOOGLE REVIEW AUTO-RESPONDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 2A-i. BEGIN OAUTH
// ─────────────────────────────────────────────────────────────
exports.beginGbpOauth = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const vendorId = context.auth.uid;
  const state = crypto.randomBytes(24).toString("hex");

  await db.collection("oauth_states").doc(state).set({
    vendorId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  return { state };
});

// ─────────────────────────────────────────────────────────────
// 2A. OAUTH CALLBACK
// Google redirects here after vendor grants permission
// URL: https://<region>-stall-app-1aab7.cloudfunctions.net/oauthCallback
//
// FIXED: cfg now reads from functions.config().google.* (matching the
// pattern used everywhere else in this file — razorpay, anthropic)
// instead of process.env.GOOGLE_*, which was never being set.
// Run once: firebase functions:config:set google.client_id="..." google.client_secret="..." google.redirect_uri="https://us-central1-stall-app-1aab7.cloudfunctions.net/oauthCallback"
// ─────────────────────────────────────────────────────────────
exports.oauthCallback = functions.https.onRequest(async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send("Missing code or state");

  try {
    const stateRef = db.collection("oauth_states").doc(state);
    const stateDoc = await stateRef.get();
    if (!stateDoc.exists) {
      return res.status(400).send("Invalid or expired connection request. Please try connecting again.");
    }

    const { vendorId, expiresAt } = stateDoc.data();
    await stateRef.delete();

    if (!expiresAt || expiresAt.toDate() < new Date()) {
      return res.status(400).send("This connection request expired. Please try connecting again.");
    }

    // FIXED: was process.env.GOOGLE_*, now functions.config().google.*
    const cfg = {
      client_id: functions.config().google.client_id,
      client_secret: functions.config().google.client_secret,
      redirect_uri: functions.config().google.redirect_uri,
    };

    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: cfg.client_id,
      client_secret: cfg.client_secret,
      redirect_uri: cfg.redirect_uri,
      grant_type: "authorization_code",
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    const accountsRes = await axios.get(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const account = accountsRes.data.accounts?.[0];
    if (!account) return res.status(400).send("No GBP account found");

    // NOTE: Business Information API's locations.list REQUIRES a readMask
    // query param on every request — omitting it makes Google reject the
    // whole call with 400 INVALID_ARGUMENT ("Request contains an invalid
    // argument"), which is what was showing up in the logs.
    const locationsRes = await axios.get(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { readMask: "name,title,storefrontAddress,phoneNumbers,websiteUri" },
      }
    );

    const location = locationsRes.data.locations?.[0];

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

    // Redirect back to app
    res.redirect(`https://stallapp.cutncutestudio.in/?gbp=connected`);

  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    res.status(500).send("Connection failed. Please try again.");
  }
});

// ─────────────────────────────────────────────────────────────
// 2B. TOKEN HELPERS
// FIXED: same functions.config().google.* change as above
// ─────────────────────────────────────────────────────────────
async function refreshAccessToken(vendorId, connectionData) {
  const cfg = {
    client_id: functions.config().google.client_id,
    client_secret: functions.config().google.client_secret,
    redirect_uri: functions.config().google.redirect_uri,
  };
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

async function getValidToken(vendorId, connectionData) {
  const expiry = connectionData.tokenExpiresAt?.toDate?.() || new Date(0);
  const isExpired = expiry < new Date(Date.now() + 5 * 60 * 1000);
  if (isExpired) return await refreshAccessToken(vendorId, connectionData);
  return connectionData.accessToken;
}

// ─────────────────────────────────────────────────────────────
// 2C. AI RESPONSE GENERATOR
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
// ─────────────────────────────────────────────────────────────
exports.pollReviews = functions.pubsub
  .schedule("every 30 minutes")
  .onRun(async () => {
    console.log("pollReviews: starting");

    const connectionsSnap = await db.collection("gbp_connections")
      .where("connected", "==", true).get();

    if (connectionsSnap.empty) {
      console.log("No connected vendors");
      return null;
    }

    const promises = connectionsSnap.docs.map(async (connDoc) => {
      const vendorId = connDoc.id;
      const connectionData = connDoc.data();

      try {
        const premiumDoc = await db.collection("premium_vendors").doc(vendorId).get();
        if (!premiumDoc.exists || !premiumDoc.data().isPremium) {
          console.log(`Skipping vendor ${vendorId} — not premium`);
          return;
        }

        const vendorSnap = await db.collection("vendors")
          .where("ownerId", "==", vendorId).limit(1).get();
        const listing = vendorSnap.docs[0]?.data() || {};
        const settings = connectionData.responseSettings || {};

        const accessToken = await getValidToken(vendorId, connectionData);

        const reviewsRes = await axios.get(
          `https://mybusiness.googleapis.com/v4/${connectionData.locationId}/reviews`,
          { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 50 } }
        );

        const reviews = reviewsRes.data.reviews || [];
        console.log(`Vendor ${vendorId}: ${reviews.length} reviews found`);

        for (const review of reviews) {
          const reviewId = review.reviewId;
          const starRating = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[review.starRating] || 3;

          const existingDoc = await db.collection("review_responses")
            .doc(`${vendorId}_${reviewId}`).get();
          if (existingDoc.exists) continue;

          if (review.reviewReply) continue;

          if (settings[`replyTo${starRating}Star`] === false) continue;

          const reviewData = {
            vendorId,
            reviewId,
            reviewerName: review.reviewer?.displayName || "Valued Customer",
            reviewText: review.comment || "",
            starRating,
            receivedAt: admin.firestore.Timestamp.fromDate(new Date(review.createTime)),
            status: "pending",
            aiResponse: null,
            postedAt: null,
          };

          await db.collection("review_responses")
            .doc(`${vendorId}_${reviewId}`).set(reviewData);

          const aiResponse = await generateAIResponse(reviewData, listing, settings);

          await axios.put(
            `https://mybusiness.googleapis.com/v4/${connectionData.locationId}/reviews/${reviewId}/reply`,
            { comment: aiResponse },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          await db.collection("review_responses")
            .doc(`${vendorId}_${reviewId}`).update({
              aiResponse,
              status: "posted",
              postedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

          console.log(`✅ Posted response — vendor ${vendorId}, review ${reviewId}`);
        }

        await db.collection("gbp_connections").doc(vendorId)
          .update({ lastPolled: admin.firestore.FieldValue.serverTimestamp() });

      } catch (err) {
        console.error(`Error processing vendor ${vendorId}:`, err.response?.data || err.message);
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

  const vendorId = context.auth.uid;

  const [connDoc, premiumDoc] = await Promise.all([
    db.collection("gbp_connections").doc(vendorId).get(),
    db.collection("premium_vendors").doc(vendorId).get(),
  ]);

  if (!connDoc.exists || !connDoc.data().connected) {
    throw new functions.https.HttpsError("failed-precondition", "GBP not connected");
  }

  if (!premiumDoc.exists || !premiumDoc.data().isPremium) {
    throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");
  }

  const connectionData = connDoc.data();
  const accessToken = await getValidToken(vendorId, connectionData);

  const reviewsRes = await axios.get(
    `https://mybusiness.googleapis.com/v4/${connectionData.locationId}/reviews`,
    { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 10 } }
  );

  return {
    reviewCount: reviewsRes.data.reviews?.length || 0,
    message: "Poll triggered successfully — check review_responses collection",
  };
});

// ═══════════════════════════════════════════════════════════════
//  SECTION 3 — WEEKLY DIGESTS
// ═══════════════════════════════════════════════════════════════

const EARTH_RADIUS_KM = 6371;
function haversineKm(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const DIGEST_RADIUS_KM = 5;
const NEW_LISTING_DAYS = 7;

exports.weeklyCustomerDigest = functions.pubsub
  .schedule("every monday 09:00")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    console.log("weeklyCustomerDigest: starting");

    const vendorsSnap = await db.collection("vendors").get();
    const vendors = vendorsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newVendors = vendors.filter((v) => {
      const created = v.createdAt?.toDate?.();
      return created && created.getTime() >= weekAgo;
    });
    const activeOffers = vendors.filter((v) => {
      if (!v.offer) return false;
      const exp = v.offerExpiresAt?.toDate?.();
      return !exp || exp.getTime() >= Date.now();
    });

    const usersSnap = await db.collection("users").get();
    let digestsWritten = 0;

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const favSnap = await db.collection("users").doc(uid).collection("favorites").get();
      if (favSnap.empty) continue;

      const favIds = new Set(favSnap.docs.map((d) => d.id));
      const favVendors = vendors.filter((v) => favIds.has(v.id) && typeof v.lat === "number" && typeof v.lng === "number");
      if (favVendors.length === 0) continue;

      const centroid = {
        lat: favVendors.reduce((s, v) => s + v.lat, 0) / favVendors.length,
        lng: favVendors.reduce((s, v) => s + v.lng, 0) / favVendors.length,
      };

      const nearbyNew = newVendors.filter(
        (v) => typeof v.lat === "number" && typeof v.lng === "number" && haversineKm(centroid, v) <= DIGEST_RADIUS_KM
      );
      const nearbyOffers = activeOffers.filter(
        (v) => typeof v.lat === "number" && typeof v.lng === "number" && haversineKm(centroid, v) <= DIGEST_RADIUS_KM
      );

      if (nearbyNew.length === 0 && nearbyOffers.length === 0) continue;

      await db.collection("digests").doc(uid).set({
        weekOf: admin.firestore.FieldValue.serverTimestamp(),
        newVendors: nearbyNew.map((v) => ({ id: v.id, name: v.name, category: v.category })),
        activeOffers: nearbyOffers.map((v) => ({ id: v.id, name: v.name, offer: v.offer })),
        read: false,
      });
      digestsWritten++;
    }

    console.log(`weeklyCustomerDigest: wrote ${digestsWritten} digests`);
    return null;
  });

exports.weeklyVendorDigest = functions.pubsub
  .schedule("every monday 09:00")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    console.log("weeklyVendorDigest: starting");

    const vendorsSnap = await db.collection("vendors").get();
    const claimedVendors = vendorsSnap.docs.filter((d) => d.data().ownerId);
    let digestsWritten = 0;

    for (const vendorDoc of claimedVendors) {
      const v = vendorDoc.data();
      const vendorId = vendorDoc.id;

      const snapshotRef = db.collection("vendor_counter_snapshots").doc(vendorId);
      const prevSnap = await snapshotRef.get();
      const prev = prevSnap.exists ? prevSnap.data() : { viewCount: 0, callCount: 0, whatsappCount: 0, directionsCount: 0 };

      const current = {
        viewCount: v.viewCount || 0,
        callCount: v.callCount || 0,
        whatsappCount: v.whatsappCount || 0,
        directionsCount: v.directionsCount || 0,
      };

      const delta = {
        views: Math.max(0, current.viewCount - (prev.viewCount || 0)),
        calls: Math.max(0, current.callCount - (prev.callCount || 0)),
        whatsapp: Math.max(0, current.whatsappCount - (prev.whatsappCount || 0)),
        directions: Math.max(0, current.directionsCount - (prev.directionsCount || 0)),
      };

      await snapshotRef.set(current);

      if (delta.views + delta.calls + delta.whatsapp + delta.directions === 0) continue;

      await db.collection("vendor_digests").doc(vendorId).set({
        weekOf: admin.firestore.FieldValue.serverTimestamp(),
        vendorName: v.name,
        ...delta,
        read: false,
      });
      digestsWritten++;
    }

    console.log(`weeklyVendorDigest: wrote ${digestsWritten} digests`);
    return null;
  });

// ═══════════════════════════════════════════════════════════════
//  SECTION 4 — VENDOR BOOST (GBP health score + checklist)
// ═══════════════════════════════════════════════════════════════

const { scoreProfile, mapGbpResponse } = require("./boost/scoreProfile");

async function fetchBoostData(accessToken, connectionData) {
  const { locationId } = connectionData;

  // mybusiness.googleapis.com/v4 is the legacy "Google My Business API".
  // Google has locked review read/reply access behind a separate approval
  // process for most projects now, so this 404s for accounts that haven't
  // been granted that access — same as posts/questions below, this needs
  // to degrade gracefully rather than take the whole scan down with it.
  const [locationRes, reviewsRes, postsRes, questionsRes] = await Promise.all([
    axios
      .get(`https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { readMask: "categories,profile,regularHours" },
      })
      .catch((err) => {
        console.error("Boost: location fetch failed", err.response?.status, err.response?.data || err.message);
        return { data: {} };
      }),
    axios
      .get(`https://mybusiness.googleapis.com/v4/${locationId}/reviews`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { pageSize: 50 },
      })
      .catch((err) => {
        console.error("Boost: reviews fetch failed", err.response?.status, err.response?.data || err.message);
        return { data: { reviews: [] } };
      }),
    axios
      .get(`https://mybusiness.googleapis.com/v4/${locationId}/localPosts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch(() => ({ data: { localPosts: [] } })),
    axios
      .get(`https://mybusinessqanda.googleapis.com/v1/${locationId}/questions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch(() => ({ data: { questions: [] } })),
  ]);

  let mediaItems = [];
  try {
    const mediaRes = await axios.get(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}/media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    mediaItems = mediaRes.data.mediaItems || [];
  } catch (err) {
    mediaItems = [];
  }

  return {
    locationData: { ...locationRes.data, mediaItems },
    reviews: reviewsRes.data.reviews || [],
    posts: postsRes.data.localPosts || [],
    questions: questionsRes.data.questions || [],
  };
}

async function writeVendorFacingCopy(checklist, vendorName) {
  if (checklist.length === 0) return [];

  const apiKey = functions.config().anthropic.api_key;

  const prompt = `You are writing short, encouraging checklist items for a small
business owner (${vendorName}) inside a mobile app called Stall. They are not
technical and don't know SEO jargon. For each item below, write ONE sentence
(max 15 words) explaining the fix in plain language, and one action button
label (max 3 words). Return ONLY a JSON array, no markdown fences, no preamble,
shaped like: [{"key": "...", "message": "...", "buttonLabel": "..."}]

Items:
${checklist.map((i) => `- ${i.key}: ${i.label} (impact: ${Math.round(i.max - i.points)} of ${i.max} points missing)`).join("\n")}`;

  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] },
    { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } }
  );

  const text = (res.data.content?.[0]?.text || "").trim();

  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (err) {
    console.error("Boost copy parse failed:", err, text);
    return checklist.map((i) => ({ key: i.key, message: i.label, buttonLabel: "Fix now" }));
  }
}

exports.runBoostScan = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const vendorId = context.auth.uid;

  const [connDoc, premiumDoc, vendorSnap] = await Promise.all([
    db.collection("gbp_connections").doc(vendorId).get(),
    db.collection("premium_vendors").doc(vendorId).get(),
    db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get(),
  ]);

  if (!connDoc.exists || !connDoc.data().connected) {
    throw new functions.https.HttpsError("failed-precondition", "GBP not connected");
  }

  if (!premiumDoc.exists || !premiumDoc.data().isPremium) {
    throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");
  }

  if (vendorSnap.empty) {
    throw new functions.https.HttpsError("not-found", "Vendor listing not found");
  }

  const vendorDoc = vendorSnap.docs[0];
  const listing = vendorDoc.data();
  const connectionData = connDoc.data();

  let result;
  try {
    const accessToken = await getValidToken(vendorId, connectionData);
    const { locationData, reviews, posts, questions } = await fetchBoostData(accessToken, connectionData);

    const profile = mapGbpResponse({ locationData, reviews, posts, questions });

    const { score, band, checklist } = scoreProfile(profile);
    const vendorCopy = await writeVendorFacingCopy(checklist, listing.name);

    result = {
      score,
      band,
      checklist: checklist.map((item) => ({
        ...item,
        ...(vendorCopy.find((c) => c.key === item.key) || {}),
      })),
      scannedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
  } catch (err) {
    console.error("runBoostScan failed:", err.response?.status, err.response?.data || err.message);
    // NOTE: code must NOT be "internal" — the callable client SDK masks
    // the custom message for that specific code and shows a bare
    // "INTERNAL" to the user regardless of what's set here. "unavailable"
    // (or anything else) passes the message through correctly.
    throw new functions.https.HttpsError(
      "unavailable",
      "Couldn't complete the scan. Please try again in a moment."
    );
  }

  await vendorDoc.ref.collection("boost").doc("latest").set(result);

  return { ...result, scannedAt: new Date().toISOString() };
});

// Sales agent commission triggers + agent account management
Object.assign(exports, require("./agentCommissions"));
Object.assign(exports, require("./websiteBuildPayments"));