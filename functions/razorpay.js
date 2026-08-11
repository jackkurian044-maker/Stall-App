/**
 * Razorpay integration for Stall-App
 * ------------------------------------------------------------
 * Covers:
 *   1. One-time payments (website build fee: Basic / Advanced)
 *   2. Recurring subscriptions (Premium: Google Profile Mgmt + Store Boosting)
 *
 * Setup required before deploying:
 *   firebase functions:secrets:set RAZORPAY_KEY_ID
 *   firebase functions:secrets:set RAZORPAY_KEY_SECRET
 *   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
 *
 * npm install razorpay --save   (inside your functions/ folder)
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const RAZORPAY_KEY_ID = defineSecret("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");

function getClient(keyId, keySecret) {
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ------------------------------------------------------------------
// Plan / price config — keep in sync with your Razorpay dashboard
// ------------------------------------------------------------------
// Fill in the real Razorpay plan_id values after creating them in
// Dashboard -> Subscriptions -> Plans.
const SUBSCRIPTION_PLANS = {
  in_monthly: { planId: "plan_XXXXXXXXXXXXX_in_monthly", currency: "INR" },
  in_annual: { planId: "plan_XXXXXXXXXXXXX_in_annual", currency: "INR" },
  ae_monthly: { planId: "plan_XXXXXXXXXXXXX_ae_monthly", currency: "AED" },
  ae_annual: { planId: "plan_XXXXXXXXXXXXX_ae_annual", currency: "AED" },
};

// One-time website build fees, in smallest currency unit (paise / fils)
const WEBSITE_BUILD_FEES = {
  in_basic: { amount: 299900, currency: "INR" }, // ₹2,999
  in_advanced: { amount: 799900, currency: "INR" }, // ₹7,999
  ae_basic: { amount: 39900, currency: "AED" }, // AED 399
  ae_advanced: { amount: 99900, currency: "AED" }, // AED 999
};

// ------------------------------------------------------------------
// 1. Create a one-time Order (website build fee)
// ------------------------------------------------------------------
exports.createOrder = onCall(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    const { vendorId, tier } = request.data; // tier: "in_basic" | "in_advanced" | "ae_basic" | "ae_advanced"
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
    if (!vendorId || !WEBSITE_BUILD_FEES[tier]) {
      throw new HttpsError("invalid-argument", "Missing vendorId or invalid tier.");
    }

    const { amount, currency } = WEBSITE_BUILD_FEES[tier];
    const client = getClient(RAZORPAY_KEY_ID.value(), RAZORPAY_KEY_SECRET.value());

    const order = await client.orders.create({
      amount,
      currency,
      receipt: `webbuild_${vendorId}_${Date.now()}`,
      notes: { vendorId, tier, type: "website_build" },
    });

    await db.collection("websiteBuildOrders").doc(order.id).set({
      vendorId,
      tier,
      amount,
      currency,
      status: "created",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { orderId: order.id, amount, currency, keyId: RAZORPAY_KEY_ID.value() };
  }
);

// ------------------------------------------------------------------
// 2. Verify a one-time payment (called from frontend after checkout success)
// ------------------------------------------------------------------
exports.verifyOrderPayment = onCall(
  { secrets: [RAZORPAY_KEY_SECRET] },
  async (request) => {
    const { orderId, paymentId, signature } = request.data;
    if (!orderId || !paymentId || !signature) {
      throw new HttpsError("invalid-argument", "Missing payment verification fields.");
    }

    const expected = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET.value())
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expected !== signature) {
      throw new HttpsError("permission-denied", "Signature mismatch — payment not verified.");
    }

    await db.collection("websiteBuildOrders").doc(orderId).set(
      {
        status: "paid",
        paymentId,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { verified: true };
  }
);

// ------------------------------------------------------------------
// 3. Create a recurring Subscription (Premium)
// ------------------------------------------------------------------
exports.createSubscription = onCall(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    const { vendorId, planKey } = request.data; // planKey: "in_monthly" | "in_annual" | "ae_monthly" | "ae_annual"
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
    if (!vendorId || !SUBSCRIPTION_PLANS[planKey]) {
      throw new HttpsError("invalid-argument", "Missing vendorId or invalid planKey.");
    }

    const { planId, currency } = SUBSCRIPTION_PLANS[planKey];
    const client = getClient(RAZORPAY_KEY_ID.value(), RAZORPAY_KEY_SECRET.value());

    const totalCount = planKey.endsWith("annual") ? 5 : 60; // 5 yrs annual, 60 months monthly — adjust as needed

    const subscription = await client.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: totalCount,
      notes: { vendorId, planKey },
    });

    await db.collection("vendors").doc(vendorId).set(
      {
        subscription: {
          id: subscription.id,
          planKey,
          currency,
          status: "created",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    return { subscriptionId: subscription.id, keyId: RAZORPAY_KEY_ID.value() };
  }
);

// ------------------------------------------------------------------
// 4. Webhook — source of truth for subscription + payment state
//    Set this URL in Razorpay Dashboard -> Settings -> Webhooks
//    Events to enable: subscription.activated, subscription.charged,
//    subscription.cancelled, subscription.halted, payment.captured
// ------------------------------------------------------------------
exports.razorpayWebhook = onRequest(
  { secrets: [RAZORPAY_WEBHOOK_SECRET] },
  async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];
    const body = req.rawBody; // requires raw body — see note below

    const expected = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET.value())
      .update(body)
      .digest("hex");

    if (expected !== signature) {
      res.status(400).send("Invalid webhook signature");
      return;
    }

    const event = req.body.event;
    const payload = req.body.payload;

    try {
      if (event === "subscription.activated" || event === "subscription.charged") {
        const sub = payload.subscription.entity;
        const vendorId = sub.notes?.vendorId;
        if (vendorId) {
          const periodDays = sub.notes?.planKey?.endsWith("annual") ? 365 : 30;
          const expiresAt = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
          await db.collection("vendors").doc(vendorId).set(
            {
              premium: true,
              premiumExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
              subscription: {
                id: sub.id,
                status: sub.status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );
        }
      }

      if (event === "subscription.cancelled" || event === "subscription.halted") {
        const sub = payload.subscription.entity;
        const vendorId = sub.notes?.vendorId;
        if (vendorId) {
          await db.collection("vendors").doc(vendorId).set(
            {
              premium: false,
              subscription: {
                id: sub.id,
                status: sub.status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            },
            { merge: true }
          );
        }
      }

      res.status(200).send("ok");
    } catch (err) {
      console.error("Webhook handling error:", err);
      res.status(500).send("Webhook processing failed");
    }
  }
);
