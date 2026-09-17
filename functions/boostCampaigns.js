const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const db = admin.firestore();
const OBJECTIVES = new Set(["discovery", "whatsapp", "calls", "offer"]);

function getRazorpay() {
  const cfg = functions.config().razorpay;
  return new Razorpay({ key_id: cfg.key_id, key_secret: cfg.key_secret });
}

async function getOwnedListing(uid, businessId) {
  const ref = db.collection("vendors").doc(businessId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "Business listing not found");
  if (snap.data().ownerId !== uid) throw new functions.https.HttpsError("permission-denied", "You do not own this listing");
  return { ref, data: snap.data() };
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

exports.createBoostOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const uid = context.auth.uid;
  const businessId = String(data.businessId || "").trim();
  const objective = String(data.objective || "discovery").trim();
  const totalBudgetRupees = number(data.totalBudgetRupees);
  const durationDays = Math.max(1, Math.min(30, Math.floor(number(data.durationDays, 7))));
  const radiusKm = Math.max(1, Math.min(50, number(data.radiusKm, 5)));
  if (!OBJECTIVES.has(objective)) throw new functions.https.HttpsError("invalid-argument", "Invalid Boost objective");
  if (totalBudgetRupees <= 0) throw new functions.https.HttpsError("invalid-argument", "Boost budget must be greater than zero");

  const listing = await getOwnedListing(uid, businessId);
  const premiumSnap = await db.collection("premium_vendors").doc(uid).get();
  if (!premiumSnap.exists || !premiumSnap.data().isPremium) {
    throw new functions.https.HttpsError("failed-precondition", "Boost is available to Premium businesses");
  }
  if (!Number.isFinite(listing.data.lat) || !Number.isFinite(listing.data.lng)) {
    throw new functions.https.HttpsError("failed-precondition", "Business location is required before Boost can start");
  }

  const amount = Math.round(totalBudgetRupees * 100);
  const razorpay = getRazorpay();
  const campaignRef = db.collection("vendors").doc(businessId).collection("boostCampaigns").doc();
  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: `boost_${campaignRef.id}`.slice(0, 40),
    notes: { businessId, campaignId: campaignRef.id, ownerId: uid, objective },
  });

  const now = admin.firestore.Timestamp.now();
  const end = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  await campaignRef.set({
    businessId,
    ownerId: uid,
    businessName: listing.data.name || "",
    objective,
    radiusKm,
    targetLat: listing.data.lat,
    targetLng: listing.data.lng,
    totalBudgetPaise: amount,
    dailyBudgetPaise: Math.round(amount / durationDays),
    durationDays,
    status: "payment_pending",
    orderId: order.id,
    createdAt: now,
    startAt: null,
    endAt: admin.firestore.Timestamp.fromDate(end),
    paymentId: null,
  });

  return { campaignId: campaignRef.id, orderId: order.id, keyId: functions.config().razorpay.key_id, amount, currency: "INR" };
});

exports.verifyBoostPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const uid = context.auth.uid;
  const businessId = String(data.businessId || "").trim();
  const campaignId = String(data.campaignId || "").trim();
  const paymentId = String(data.razorpay_payment_id || "").trim();
  const returnedOrderId = String(data.razorpay_order_id || "").trim();
  const signature = String(data.razorpay_signature || "").trim();
  const campaignRef = db.collection("vendors").doc(businessId).collection("boostCampaigns").doc(campaignId);
  const campaignSnap = await campaignRef.get();
  if (!campaignSnap.exists) throw new functions.https.HttpsError("not-found", "Boost campaign not found");
  const campaign = campaignSnap.data();
  if (campaign.ownerId !== uid) throw new functions.https.HttpsError("permission-denied", "Not allowed");
  if (campaign.orderId !== returnedOrderId) throw new functions.https.HttpsError("invalid-argument", "Order mismatch");

  const cfg = functions.config().razorpay;
  const expected = crypto.createHmac("sha256", cfg.key_secret).update(`${campaign.orderId}|${paymentId}`).digest("hex");
  if (expected !== signature) throw new functions.https.HttpsError("invalid-argument", "Payment signature mismatch");

  const razorpay = getRazorpay();
  const payment = await razorpay.payments.fetch(paymentId);
  if (payment.status !== "captured") throw new functions.https.HttpsError("failed-precondition", "Payment is not captured yet");
  if (Number(payment.amount) !== Number(campaign.totalBudgetPaise)) throw new functions.https.HttpsError("failed-precondition", "Payment amount mismatch");

  const activeSnap = await db.collection("vendors").doc(businessId).collection("boostCampaigns")
    .where("status", "==", "active").get();
  const batch = db.batch();
  activeSnap.docs.forEach((d) => batch.update(d.ref, { status: "superseded", supersededAt: admin.firestore.FieldValue.serverTimestamp() }));

  const startAt = admin.firestore.Timestamp.now();
  const endAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + campaign.durationDays * 24 * 60 * 60 * 1000));
  batch.update(campaignRef, {
    status: "active",
    paymentId,
    startAt,
    endAt,
    activatedAt: startAt,
  });
  batch.update(db.collection("vendors").doc(businessId), {
    boostActive: true,
    boostCampaignId: campaignId,
    boostObjective: campaign.objective,
    boostTargetLat: campaign.targetLat,
    boostTargetLng: campaign.targetLng,
    boostRadiusKm: campaign.radiusKm,
    boostEndsAt: endAt,
  });
  await batch.commit();
  return { success: true, campaignId, status: "active", endAt };
});

exports.pauseBoostCampaign = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const uid = context.auth.uid;
  const businessId = String(data.businessId || "").trim();
  const campaignId = String(data.campaignId || "").trim();
  await getOwnedListing(uid, businessId);
  const campaignRef = db.collection("vendors").doc(businessId).collection("boostCampaigns").doc(campaignId);
  const snap = await campaignRef.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "Boost campaign not found");
  if (snap.data().ownerId !== uid) throw new functions.https.HttpsError("permission-denied", "Not allowed");
  await campaignRef.update({ status: "paused", pausedAt: admin.firestore.FieldValue.serverTimestamp() });
  await db.collection("vendors").doc(businessId).update({
    boostActive: false,
    boostCampaignId: null,
    boostEndsAt: null,
  });
  return { success: true };
});
