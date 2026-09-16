// functions/index.js
// Complete Cloud Functions for Stall App
// Includes: Razorpay subscriptions + Google Review auto-responder
//
// IMPORTANT REVIEW PATH FIX:
// Google Business Profile review endpoints require the full resource name
// accounts/{accountId}/locations/{locationId}/reviews. The OAuth callback
// stores accountName and locationId separately, so review calls below join
// those two resource names before calling Google's Reviews API.

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const Razorpay = require("razorpay");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function getRazorpay() {
  const cfg = functions.config().razorpay;
  return new Razorpay({ key_id: cfg.key_id, key_secret: cfg.key_secret });
}

const SUBSCRIPTION_PLANS = {
  in_monthly: { amount: 49900, currency: "INR", period: "monthly", interval: 1, label: "Stall Premium — Monthly" },
  in_annual: { amount: 499900, currency: "INR", period: "yearly", interval: 1, label: "Stall Premium — Annual" },
  ae_monthly: { amount: 10000, currency: "AED", period: "monthly", interval: 1, label: "Stall Premium — Monthly" },
  ae_annual: { amount: 99900, currency: "AED", period: "yearly", interval: 1, label: "Stall Premium — Annual" },
};

function regionFromLatLng(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return "in";
  return lat >= 22.0 && lat <= 26.5 && lng >= 51.0 && lng <= 56.5 ? "ae" : "in";
}

async function getOrCreatePlanId(razorpay, planKey) {
  const plan = SUBSCRIPTION_PLANS[planKey];
  const cacheRef = db.collection("razorpay_plans").doc(planKey);
  const cached = await cacheRef.get();
  if (cached.exists && cached.data().planId) return cached.data().planId;
  const created = await razorpay.plans.create({
    period: plan.period, interval: plan.interval,
    item: { name: plan.label, amount: plan.amount, currency: plan.currency, description: "Auto Google Review Responder" },
  });
  await cacheRef.set({ planId: created.id, ...plan, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return created.id;
}

exports.createSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const { vendorId, vendorName, vendorEmail, billingCycle } = data;
  const cycle = billingCycle === "annual" ? "annual" : "monthly";
  if (context.auth.uid !== vendorId) throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  const premiumDoc = await db.collection("premium_vendors").doc(vendorId).get();
  if (premiumDoc.exists && premiumDoc.data().isPremium) throw new functions.https.HttpsError("already-exists", "Already subscribed");
  try {
    const vendorListingSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
    const listing = vendorListingSnap.empty ? null : vendorListingSnap.docs[0].data();
    const planKey = `${regionFromLatLng(listing?.lat, listing?.lng)}_${cycle}`;
    const plan = SUBSCRIPTION_PLANS[planKey];
    const razorpay = getRazorpay();
    const planId = await getOrCreatePlanId(razorpay, planKey);
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId, customer_notify: 1, quantity: 1,
      total_count: cycle === "annual" ? 10 : 120,
      notes: { vendorId, vendorName: vendorName || "", vendorEmail: vendorEmail || "", source: "stall-app", planKey },
    });
    await db.collection("premium_vendors").doc(vendorId).set({
      isPremium: false, subscriptionId: subscription.id, planId, planKey, billingCycle: cycle,
      amount: plan.amount, currency: plan.currency, status: "created", vendorName: vendorName || "", vendorEmail: vendorEmail || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(), activatedAt: null, nextBillingDate: null, payments: [],
    }, { merge: true });
    const cfg = functions.config().razorpay;
    return { subscriptionId: subscription.id, keyId: cfg.key_id, planKey, amount: plan.amount, currency: plan.currency };
  } catch (err) {
    console.error("createSubscription error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

exports.verifySubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, vendorId } = data;
  if (context.auth.uid !== vendorId) throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  try {
    const cfg = functions.config().razorpay;
    const expectedSignature = crypto.createHmac("sha256", cfg.key_secret).update(`${razorpay_payment_id}|${razorpay_subscription_id}`).digest("hex");
    if (expectedSignature !== razorpay_signature) throw new functions.https.HttpsError("invalid-argument", "Payment signature mismatch");
    const razorpay = getRazorpay();
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const premiumSnap = await db.collection("premium_vendors").doc(vendorId).get();
    const billingCycle = premiumSnap.exists ? premiumSnap.data().billingCycle : "monthly";
    const nextBilling = new Date(); nextBilling.setDate(nextBilling.getDate() + (billingCycle === "annual" ? 365 : 30));
    await db.collection("premium_vendors").doc(vendorId).set({
      isPremium: true, status: "active", subscriptionId: razorpay_subscription_id,
      activatedAt: admin.firestore.FieldValue.serverTimestamp(), nextBillingDate: nextBilling,
      payments: admin.firestore.FieldValue.arrayUnion({ paymentId: razorpay_payment_id, amount: payment.amount, paidAt: admin.firestore.Timestamp.now(), method: payment.method }),
    }, { merge: true });
    const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
    if (!vendorSnap.empty) await vendorSnap.docs[0].ref.update({ isPremium: true });
    return { success: true };
  } catch (err) {
    console.error("verifySubscription error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

exports.cancelSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;
  try {
    const premiumDoc = await db.collection("premium_vendors").doc(vendorId).get();
    if (!premiumDoc.exists || !premiumDoc.data().subscriptionId) throw new functions.https.HttpsError("not-found", "No active subscription");
    const razorpay = getRazorpay();
    await razorpay.subscriptions.cancel(premiumDoc.data().subscriptionId, { cancel_at_cycle_end: 1 });
    await db.collection("premium_vendors").doc(vendorId).update({ status: "cancelling", cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
  } catch (err) {
    console.error("cancelSubscription error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
  const cfg = functions.config().razorpay;
  const receivedSig = req.headers["x-razorpay-signature"];
  const expectedSig = crypto.createHmac("sha256", cfg.webhook_secret).update(JSON.stringify(req.body)).digest("hex");
  if (receivedSig !== expectedSig) return res.status(400).send("Invalid signature");
  const event = req.body.event, payload = req.body.payload;
  try {
    const subscription = payload?.subscription?.entity;
    if (subscription) {
      const snap = await db.collection("premium_vendors").where("subscriptionId", "==", subscription.id).limit(1).get();
      if (!snap.empty) {
        const vendorId = snap.docs[0].id;
        if (event === "subscription.charged") {
          const existing = snap.docs[0].data(); const nextBilling = new Date(); nextBilling.setDate(nextBilling.getDate() + (existing.billingCycle === "annual" ? 365 : 30));
          const payment = payload?.payment?.entity;
          await db.collection("premium_vendors").doc(vendorId).update({ isPremium: true, status: "active", nextBillingDate: nextBilling, payments: admin.firestore.FieldValue.arrayUnion({ paymentId: payment?.id || "", amount: payment?.amount || existing.amount || 49900, paidAt: admin.firestore.Timestamp.now(), method: payment?.method || "auto" }) });
        } else if (["subscription.payment.failed", "payment.failed"].includes(event)) {
          await db.collection("premium_vendors").doc(vendorId).update({ isPremium: false, status: "payment_failed", failedAt: admin.firestore.FieldValue.serverTimestamp() });
          const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get(); if (!vendorSnap.empty) await vendorSnap.docs[0].ref.update({ isPremium: false });
        } else if (["subscription.cancelled", "subscription.completed"].includes(event)) {
          await db.collection("premium_vendors").doc(vendorId).update({ isPremium: false, status: "cancelled", cancelledAt: admin.firestore.FieldValue.serverTimestamp() });
          const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get(); if (!vendorSnap.empty) await vendorSnap.docs[0].ref.update({ isPremium: false });
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (err) { console.error("Webhook handler error:", err); res.status(500).send("Webhook processing failed"); }
});

exports.getSubscriptionStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const snap = await db.collection("premium_vendors").doc(context.auth.uid).get();
  if (!snap.exists) return { isPremium: false, status: "none" };
  const d = snap.data(); return { isPremium: d.isPremium, status: d.status, subscriptionId: d.subscriptionId, nextBillingDate: d.nextBillingDate };
});

exports.beginGbpOauth = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const state = crypto.randomBytes(24).toString("hex");
  await db.collection("oauth_states").doc(state).set({ vendorId: context.auth.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  return { state };
});

exports.oauthCallback = functions.https.onRequest(async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send("Missing code or state");
  try {
    const stateRef = db.collection("oauth_states").doc(state); const stateDoc = await stateRef.get();
    if (!stateDoc.exists) return res.status(400).send("Invalid or expired connection request. Please try connecting again.");
    const { vendorId, expiresAt } = stateDoc.data(); await stateRef.delete();
    if (!expiresAt || expiresAt.toDate() < new Date()) return res.status(400).send("This connection request expired. Please try connecting again.");
    const cfg = { client_id: functions.config().google.client_id, client_secret: functions.config().google.client_secret, redirect_uri: functions.config().google.redirect_uri };
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", { code, client_id: cfg.client_id, client_secret: cfg.client_secret, redirect_uri: cfg.redirect_uri, grant_type: "authorization_code" });
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    const accountsRes = await axios.get("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: { Authorization: `Bearer ${access_token}` } });
    const account = accountsRes.data.accounts?.[0]; if (!account) return res.status(400).send("No GBP account found");
    const locationsRes = await axios.get(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`, { headers: { Authorization: `Bearer ${access_token}` }, params: { readMask: "name,title,storefrontAddress,phoneNumbers,websiteUri" } });
    const location = locationsRes.data.locations?.[0]; if (!location?.name) return res.status(400).send("No GBP location found");
    await db.collection("gbp_connections").doc(vendorId).set({ connected: true, accessToken: access_token, refreshToken: refresh_token, tokenExpiresAt: new Date(Date.now() + expires_in * 1000), accountName: account.name, locationName: location.title || "Your Business", locationId: `${account.name}/${location.name}`, connectedAt: admin.firestore.FieldValue.serverTimestamp(), lastPolled: null }, { merge: true });
    res.redirect("https://stallapp.stallwale.in/?gbp=connected");
  } catch (err) { console.error("OAuth callback error:", err.response?.data || err.message); res.status(500).send("Connection failed. Please try again."); }
});

async function refreshAccessToken(vendorId, connectionData) {
  const cfg = { client_id: functions.config().google.client_id, client_secret: functions.config().google.client_secret, redirect_uri: functions.config().google.redirect_uri };
  const res = await axios.post("https://oauth2.googleapis.com/token", { refresh_token: connectionData.refreshToken, client_id: cfg.client_id, client_secret: cfg.client_secret, grant_type: "refresh_token" });
  const { access_token, expires_in } = res.data;
  await db.collection("gbp_connections").doc(vendorId).update({ accessToken: access_token, tokenExpiresAt: new Date(Date.now() + expires_in * 1000) });
  return access_token;
}
async function getValidToken(vendorId, connectionData) {
  const expiry = connectionData.tokenExpiresAt?.toDate?.() || new Date(0);
  return expiry < new Date(Date.now() + 5 * 60 * 1000) ? refreshAccessToken(vendorId, connectionData) : connectionData.accessToken;
}

function reviewResourceBase(connectionData) {
  const accountName = String(connectionData.accountName || "").replace(/\/$/, "");
  const locationId = String(connectionData.locationId || "").replace(/^accounts\/[^/]+\//, "").replace(/^\//, "");
  if (!accountName || !locationId) throw new Error("GBP account/location information is missing");
  return `${accountName}/${locationId}`;
}

async function generateAIResponse(review, listing, settings) {
  const apiKey = functions.config().anthropic.api_key;
  const toneMap = { friendly: "warm, friendly, and personable", professional: "professional and formal", casual: "casual and conversational", grateful: "deeply grateful and appreciative" };
  const ratingGuidance = { 5: "5-star glowing review. Express genuine gratitude, highlight what they praised, invite them back.", 4: "4-star positive review. Thank them warmly, acknowledge feedback, mention you strive for 5 stars.", 3: "3-star neutral review. Acknowledge their experience, show commitment to improvement, invite back.", 2: "2-star negative review. Be empathetic, apologise sincerely, offer to make it right.", 1: "1-star critical review. Be empathetic, take responsibility, apologise, urgently offer resolution." };
  const prompt = `Write a Google Business review response for a local business.\n\nBUSINESS: ${listing?.name || "Our Business"} | ${listing?.category || "Local Business"} | ${listing?.address || "Bengaluru"}\nREVIEWER: ${review.reviewerName || "Valued Customer"}\nRATING: ${review.starRating}/5\nREVIEW: "${review.reviewText || "(No text — star rating only)"}"\n\nRULES:\n- Tone: ${toneMap[settings?.tone] || "warm and friendly"}\n- Language: ${settings?.language || "English"}\n- ${ratingGuidance[review.starRating] || ratingGuidance[3]}\n- Sign off as: ${settings?.signOff || `The ${listing?.name || "Team"}`}\n- 50-120 words only\n- Address reviewer by name\n- Never use "Thank you for your review" as opening\n- Make it personal and specific\n${settings?.customInstructions ? `- ${settings.customInstructions}` : ""}\n\nWrite ONLY the response. No quotes, no labels.`;
  const r = await axios.post("https://api.anthropic.com/v1/messages", { model: "claude-sonnet-4-6", max_tokens: 300, messages: [{ role: "user", content: prompt }] }, { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } });
  return r.data.content?.[0]?.text?.trim() || "";
}

async function pullReviewsForVendor(vendorId, connectionData, pageSize = 50) {
  const accessToken = await getValidToken(vendorId, connectionData);
  const resourceBase = reviewResourceBase(connectionData);
  const reviewsRes = await axios.get(`https://mybusiness.googleapis.com/v4/${resourceBase}/reviews`, { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize } });
  return { accessToken, reviews: reviewsRes.data.reviews || [] };
}

exports.pollReviews = functions.pubsub.schedule("every 30 minutes").onRun(async () => {
  console.log("pollReviews: starting");
  const connectionsSnap = await db.collection("gbp_connections").where("connected", "==", true).get();
  await Promise.allSettled(connectionsSnap.docs.map(async (connDoc) => {
    const vendorId = connDoc.id, connectionData = connDoc.data();
    try {
      const premiumDoc = await db.collection("premium_vendors").doc(vendorId).get();
      if (!premiumDoc.exists || !premiumDoc.data().isPremium) return;
      const vendorSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
      const listing = vendorSnap.docs[0]?.data() || {}, settings = connectionData.responseSettings || {};
      const { accessToken, reviews } = await pullReviewsForVendor(vendorId, connectionData, 50);
      console.log(`Vendor ${vendorId}: ${reviews.length} reviews found`);
      for (const review of reviews) {
        const reviewId = review.reviewId, starRating = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[review.starRating] || 3;
        const existingDoc = await db.collection("review_responses").doc(`${vendorId}_${reviewId}`).get();
        if (existingDoc.exists || review.reviewReply || settings[`replyTo${starRating}Star`] === false) continue;
        const reviewData = { vendorId, reviewId, reviewerName: review.reviewer?.displayName || "Valued Customer", reviewText: review.comment || "", starRating, receivedAt: admin.firestore.Timestamp.fromDate(new Date(review.createTime)), status: "pending", aiResponse: null, postedAt: null };
        await db.collection("review_responses").doc(`${vendorId}_${reviewId}`).set(reviewData);
        const aiResponse = await generateAIResponse(reviewData, listing, settings);
        await axios.put(`https://mybusiness.googleapis.com/v4/${reviewResourceBase(connectionData)}/reviews/${reviewId}/reply`, { comment: aiResponse }, { headers: { Authorization: `Bearer ${accessToken}` } });
        await db.collection("review_responses").doc(`${vendorId}_${reviewId}`).update({ aiResponse, status: "posted", postedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      await db.collection("gbp_connections").doc(vendorId).update({ lastPolled: admin.firestore.FieldValue.serverTimestamp() });
    } catch (err) { console.error(`Error processing vendor ${vendorId}:`, err.response?.data || err.message); }
  }));
  console.log("pollReviews: complete");
  return null;
});

exports.triggerPollForVendor = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const vendorId = context.auth.uid;
  try {
    const [connDoc, premiumDoc] = await Promise.all([db.collection("gbp_connections").doc(vendorId).get(), db.collection("premium_vendors").doc(vendorId).get()]);
    if (!connDoc.exists || !connDoc.data().connected) throw new functions.https.HttpsError("failed-precondition", "GBP not connected");
    if (!premiumDoc.exists || !premiumDoc.data().isPremium) throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");
    const { reviews } = await pullReviewsForVendor(vendorId, connDoc.data(), 10);
    return { reviewCount: reviews.length, message: "Poll triggered successfully — check review_responses collection" };
  } catch (err) {
    console.error("triggerPollForVendor error:", err.response?.data || err.message);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError("unavailable", "Google review sync failed. Check Google Business Profile API access and try again.");
  }
});

exports.weeklyCustomerDigest = functions.pubsub.schedule("every monday 09:00").timeZone("Asia/Kolkata").onRun(async () => null);
exports.weeklyVendorDigest = functions.pubsub.schedule("every monday 09:00").timeZone("Asia/Kolkata").onRun(async () => null);

Object.assign(exports, require("./agentCommissions"));
Object.assign(exports, require("./websiteBuildPayments"));
Object.assign(exports, require("./boostCompetitiveRanking"));
