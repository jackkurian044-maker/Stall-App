// subscriptionFunctions.js
// Merge this into your functions/index.js alongside reviewFunctions.js
//
// Setup:
//   firebase functions:config:set razorpay.key_id="rzp_live_xxx" razorpay.key_secret="xxx"
//   cd functions && npm install razorpay crypto

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function getRazorpay() {
  const cfg = functions.config().razorpay;
  return new Razorpay({
    key_id: cfg.key_id,
    key_secret: cfg.key_secret,
  });
}

// ─────────────────────────────────────────────────────────────
// 1. CREATE SUBSCRIPTION
// Called from PremiumGate.jsx when vendor clicks Subscribe
// ─────────────────────────────────────────────────────────────
exports.createSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const { vendorId, vendorName, vendorEmail } = data;

  // Verify the caller is who they say they are
  if (context.auth.uid !== vendorId) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  }

  // Check not already premium
  const premiumDoc = await db.collection("premium_vendors").doc(vendorId).get();
  if (premiumDoc.exists && premiumDoc.data().isPremium) {
    throw new functions.https.HttpsError("already-exists", "Already subscribed");
  }

  try {
    const razorpay = getRazorpay();
    const cfg = functions.config().razorpay;

    // Create or get plan
    // You can create the plan once in Razorpay dashboard and hardcode plan_id
    // OR create it dynamically here
    let planId = cfg.plan_id; // set this after creating plan in Razorpay dashboard

    if (!planId) {
      // Create plan if not configured (do this once)
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
      console.log("Created plan:", planId, "— save this as razorpay.plan_id in functions config");
    }

    // Create subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      quantity: 1,
      total_count: 120, // 10 years max — effectively unlimited
      addons: [],
      notes: {
        vendorId,
        vendorName: vendorName || "",
        vendorEmail: vendorEmail || "",
        source: "stall-app",
      },
    });

    // Save pending subscription to Firestore
    await db.collection("premium_vendors").doc(vendorId).set({
      isPremium: false, // becomes true after payment verified
      subscriptionId: subscription.id,
      planId,
      status: "created",
      vendorName: vendorName || "",
      vendorEmail: vendorEmail || "",
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
// 2. VERIFY SUBSCRIPTION
// Called from PremiumGate.jsx after Razorpay checkout success
// Validates HMAC signature and activates premium
// ─────────────────────────────────────────────────────────────
exports.verifySubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    vendorId,
  } = data;

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

    // Fetch payment details from Razorpay
    const razorpay = getRazorpay();
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    // Calculate next billing date (30 days from now)
    const nextBilling = new Date();
    nextBilling.setDate(nextBilling.getDate() + 30);

    // Activate premium in Firestore
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

    // Also update the vendor's listing to mark as premium
    const vendorSnap = await db
      .collection("vendors")
      .where("ownerId", "==", vendorId)
      .limit(1)
      .get();

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
// 3. CANCEL SUBSCRIPTION
// Called when vendor clicks "Cancel subscription"
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

    // Cancel on Razorpay — cancel_at_cycle_end: 1 means they keep access till period ends
    await razorpay.subscriptions.cancel(subscriptionId, { cancel_at_cycle_end: 1 });

    // Mark as cancelling in Firestore (stays premium till period ends)
    await db.collection("premium_vendors").doc(vendorId).update({
      status: "cancelling",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Subscription ${subscriptionId} cancelled for vendor ${vendorId}`);
    return { success: true };

  } catch (err) {
    console.error("cancelSubscription error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// 4. RAZORPAY WEBHOOK HANDLER
// Handles ongoing billing events automatically
// URL: https://<region>-stall-app-1aab7.cloudfunctions.net/razorpayWebhook
// Add this URL in Razorpay Dashboard → Settings → Webhooks
// ─────────────────────────────────────────────────────────────
exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
  const cfg = functions.config().razorpay;
  const webhookSecret = cfg.webhook_secret;

  // Verify webhook signature
  const receivedSig = req.headers["x-razorpay-signature"];
  const expectedSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (receivedSig !== expectedSig) {
    console.error("Webhook signature mismatch");
    return res.status(400).send("Invalid signature");
  }

  const event = req.body.event;
  const payload = req.body.payload;

  console.log(`Razorpay webhook: ${event}`);

  try {
    switch (event) {

      // ── Monthly payment success → keep premium active ──
      case "subscription.charged": {
        const subscription = payload.subscription?.entity;
        const payment = payload.payment?.entity;
        if (!subscription) break;

        // Find vendor by subscriptionId
        const snap = await db
          .collection("premium_vendors")
          .where("subscriptionId", "==", subscription.id)
          .limit(1)
          .get();

        if (snap.empty) break;

        const vendorId = snap.docs[0].id;
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);

        await db.collection("premium_vendors").doc(vendorId).update({
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

        console.log(`✅ Subscription renewed for vendor ${vendorId}`);
        break;
      }

      // ── Payment failed → deactivate premium ──
      case "subscription.payment.failed":
      case "payment.failed": {
        const subscription = payload.subscription?.entity;
        if (!subscription) break;

        const snap = await db
          .collection("premium_vendors")
          .where("subscriptionId", "==", subscription.id)
          .limit(1)
          .get();

        if (snap.empty) break;
        const vendorId = snap.docs[0].id;

        await db.collection("premium_vendors").doc(vendorId).update({
          isPremium: false,
          status: "payment_failed",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Deactivate on vendor listing too
        const vendorSnap = await db
          .collection("vendors")
          .where("ownerId", "==", vendorId)
          .limit(1)
          .get();
        if (!vendorSnap.empty) {
          await vendorSnap.docs[0].ref.update({ isPremium: false });
        }

        console.log(`⚠️ Payment failed — premium deactivated for vendor ${vendorId}`);
        break;
      }

      // ── Subscription cancelled ──
      case "subscription.cancelled":
      case "subscription.completed": {
        const subscription = payload.subscription?.entity;
        if (!subscription) break;

        const snap = await db
          .collection("premium_vendors")
          .where("subscriptionId", "==", subscription.id)
          .limit(1)
          .get();

        if (snap.empty) break;
        const vendorId = snap.docs[0].id;

        await db.collection("premium_vendors").doc(vendorId).update({
          isPremium: false,
          status: "cancelled",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const vendorSnap = await db
          .collection("vendors")
          .where("ownerId", "==", vendorId)
          .limit(1)
          .get();
        if (!vendorSnap.empty) {
          await vendorSnap.docs[0].ref.update({ isPremium: false });
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
// 5. GET SUBSCRIPTION STATUS (optional utility)
// ─────────────────────────────────────────────────────────────
exports.getSubscriptionStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }

  const vendorId = context.auth.uid;
  const doc = await db.collection("premium_vendors").doc(vendorId).get();

  if (!doc.exists) return { isPremium: false, status: "none" };

  const { isPremium, status, subscriptionId, nextBillingDate } = doc.data();
  return { isPremium, status, subscriptionId, nextBillingDate };
});
