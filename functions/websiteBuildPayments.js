// functions/websiteBuildPayments.js
//
// One-time Razorpay payments for the website build fee (separate from
// the recurring Premium subscription already handled in index.js).
//
// Reuses the same functions.config().razorpay config block already set
// for subscriptions (key_id / key_secret / webhook_secret) — no new
// secrets needed.
//
// Wire in from index.js with:
//   Object.assign(exports, require("./websiteBuildPayments"));

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const db = admin.firestore();

// Same classifier as createSubscription in index.js — kept as a
// separate copy since this file is designed to be a self-contained
// drop-in (see the header comment above).
function regionFromLatLng(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return "in";
  const inUae = lat >= 22.0 && lat <= 26.5 && lng >= 51.0 && lng <= 56.5;
  return inUae ? "ae" : "in";
}

function getRazorpay() {
  const cfg = functions.config().razorpay;
  return new Razorpay({ key_id: cfg.key_id, key_secret: cfg.key_secret });
}

// Keep in sync with the pricing confirmed for STALL:
//   India: Basic ₹2,999 / Advanced ₹7,999
//   UAE:   Basic AED 399 / Advanced AED 999
// Amounts are in the smallest currency unit (paise / fils).
const WEBSITE_BUILD_FEES = {
  in_basic: { amount: 299900, currency: "INR", label: "Website Build — Basic" },
  in_advanced: { amount: 799900, currency: "INR", label: "Website Build — Advanced" },
  ae_basic: { amount: 39900, currency: "AED", label: "Website Build — Basic" },
  ae_advanced: { amount: 99900, currency: "AED", label: "Website Build — Advanced" },
};

// ─────────────────────────────────────────────────────────────
// CREATE ORDER
// Called from the frontend right before opening Razorpay Checkout
// in one-time (order) mode.
// ─────────────────────────────────────────────────────────────
exports.createWebsiteBuildOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { vendorId, tier } = data; // tier: "in_basic" | "in_advanced" | "ae_basic" | "ae_advanced"

  if (context.auth.uid !== vendorId) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  }

  const fee = WEBSITE_BUILD_FEES[tier];
  if (!fee) {
    throw new functions.https.HttpsError("invalid-argument", "Unknown website build tier");
  }

  // Cross-check the requested tier's region against the vendor's own
  // listing location — stops a client requesting India pricing for a
  // UAE listing (or vice versa) by just passing a different tier string.
  const requestedRegion = tier.startsWith("ae_") ? "ae" : "in";
  const vendorListingSnap = await db.collection("vendors").where("ownerId", "==", vendorId).limit(1).get();
  const listing = vendorListingSnap.empty ? null : vendorListingSnap.docs[0].data();
  const actualRegion = regionFromLatLng(listing?.lat, listing?.lng);
  if (requestedRegion !== actualRegion) {
    throw new functions.https.HttpsError("invalid-argument", "Pricing tier doesn't match your listing's region");
  }

  try {
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: fee.amount,
      currency: fee.currency,
      receipt: `webbuild_${vendorId}_${Date.now()}`,
      notes: { vendorId, tier, type: "website_build" },
    });

    await db.collection("website_build_orders").doc(order.id).set({
      vendorId,
      tier,
      label: fee.label,
      amount: fee.amount,
      currency: fee.currency,
      status: "created",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const cfg = functions.config().razorpay;
    return { orderId: order.id, amount: fee.amount, currency: fee.currency, keyId: cfg.key_id };
  } catch (err) {
    console.error("createWebsiteBuildOrder error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// VERIFY PAYMENT
// Called from the frontend after Razorpay Checkout succeeds.
// ─────────────────────────────────────────────────────────────
exports.verifyWebsiteBuildPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = data;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new functions.https.HttpsError("invalid-argument", "Missing payment verification fields");
  }

  try {
    const cfg = functions.config().razorpay;

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", cfg.key_secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      throw new functions.https.HttpsError("invalid-argument", "Payment signature mismatch");
    }

    const orderRef = db.collection("website_build_orders").doc(razorpay_order_id);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Order not found");
    }
    if (context.auth.uid !== orderDoc.data().vendorId) {
      throw new functions.https.HttpsError("permission-denied", "Unauthorized");
    }

    await orderRef.update({
      status: "paid",
      paymentId: razorpay_payment_id,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Website build fee paid — order ${razorpay_order_id}, vendor ${orderDoc.data().vendorId}`);
    return { success: true };
  } catch (err) {
    console.error("verifyWebsiteBuildPayment error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});