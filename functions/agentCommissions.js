// functions/agentCommissions.js
//
// NEW FILE. Wire it into your existing functions/index.js with:
//   module.exports = { ...module.exports, ...require("./agentCommissions") };
// (or, if your index.js already uses named exports style like
//  `exports.createSubscription = ...`, just add at the bottom:
//   Object.assign(exports, require("./agentCommissions"));)
//
// Uses Firebase Functions v2 syntax. If your project is still on v1
// (`firebase-functions` without the `/v2` subpath), say so and I'll
// rewrite the two trigger definitions — the callable bodies work either way.

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// How long after a store converts to Premium an agent's commission for it
// can still be clawed back if the store cancels. Change this one line only.
const CLAWBACK_WINDOW_DAYS = 30;
const CLAWBACK_WINDOW_MS = CLAWBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Fires on every write to premium_vendors/{vendorUid} — this single doc is
 * where BOTH the Razorpay verifySubscription flow and the admin's manual
 * "Grant"/"Remove" toggle in AdminDashboard write, so one trigger covers
 * every path a vendor can become or stop being Premium.
 *
 * false/absent -> true   : possible commission (see grantCommission)
 * true -> false/absent   : possible clawback (see clawbackCommission)
 */
exports.onPremiumStatusChanged = onDocumentWritten("premium_vendors/{vendorUid}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const vendorUid = event.params.vendorUid;

  const wasPremium = before?.isPremium === true;
  const isPremiumNow = after?.isPremium === true;

  if (!wasPremium && isPremiumNow) {
    await grantCommissions(vendorUid);
  } else if (wasPremium && !isPremiumNow) {
    await clawbackCommissions(vendorUid);
  }
});

async function grantCommissions(vendorUid) {
  const vendorsSnap = await db.collection("vendors").where("ownerId", "==", vendorUid).get();
  if (vendorsSnap.empty) return;

  for (const vendorDoc of vendorsSnap.docs) {
    const vendor = vendorDoc.data();
    const agentId = vendor.addedByAgentId;
    if (!agentId) continue; // this listing wasn't added by an agent

    const commissionRef = db.collection("commissions").doc(vendorDoc.id); // one doc per vendor, ever
    const existing = await commissionRef.get();

    // Already has a live (non-clawed-back) commission — never double-create.
    if (existing.exists && existing.data().status !== "clawed_back") continue;

    const agentSnap = await db.collection("agents").doc(agentId).get();
    if (!agentSnap.exists) continue;
    const agent = agentSnap.data();

    // Either first time, or the store previously churned within the
    // clawback window and has now resubscribed — give it a fresh record.
    await commissionRef.set({
      agentId,
      agentName: agent.name || "",
      vendorId: vendorDoc.id,
      vendorName: vendor.name || "",
      amount: agent.commissionAmount || 0,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      paidAt: null,
      paidBy: null,
      clawedBack: false,
      clawedBackAt: null,
      priorStatusBeforeClawback: null,
    });
  }
}

async function clawbackCommissions(vendorUid) {
  const vendorsSnap = await db.collection("vendors").where("ownerId", "==", vendorUid).get();
  if (vendorsSnap.empty) return;

  const now = Date.now();

  for (const vendorDoc of vendorsSnap.docs) {
    const commissionRef = db.collection("commissions").doc(vendorDoc.id);
    const snap = await commissionRef.get();
    if (!snap.exists) continue;

    const commission = snap.data();
    if (commission.status === "clawed_back") continue; // already handled

    const createdMs = commission.createdAt?.toMillis?.() ?? 0;
    if (!createdMs || now - createdMs > CLAWBACK_WINDOW_MS) continue; // outside window — agent keeps it

    // Inside the window: claw it back. If it was already marked paid, the
    // admin needs to manually recover the money from the agent — we just
    // flag that clearly (priorStatusBeforeClawback) rather than pretending
    // to auto-deduct anything.
    await commissionRef.update({
      status: "clawed_back",
      clawedBack: true,
      clawedBackAt: admin.firestore.FieldValue.serverTimestamp(),
      priorStatusBeforeClawback: commission.status,
    });
  }
}

/**
 * Admin-only callable to create a new sales agent account. Creating a
 * Firebase Auth user client-side (createUserWithEmailAndPassword) would
 * sign the *admin* out and sign the new agent in instead — so this has
 * to happen server-side with the Admin SDK.
 */
exports.createAgentAccount = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in first.");

  const adminDoc = await db.collection("admins").doc(callerUid).get();
  if (!adminDoc.exists) throw new HttpsError("permission-denied", "Admins only.");

  const { name, email, password, monthlyTarget, commissionAmount } = request.data;
  if (!name || !email || !password) {
    throw new HttpsError("invalid-argument", "Name, email, and password are required.");
  }
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({ email, password, displayName: name });
  } catch (err) {
    throw new HttpsError("already-exists", err.message || "Couldn't create that account.");
  }

  await db.collection("agents").doc(userRecord.uid).set({
    name,
    email,
    monthlyTarget: Number(monthlyTarget) || 0,
    commissionAmount: Number(commissionAmount) || 0,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: callerUid,
  });

  return { uid: userRecord.uid };
});

/**
 * Admin-only callable to deactivate/reactivate an agent. Keeps their
 * history intact — just blocks further store-adding via Firestore rules,
 * which check agents/{uid}.active.
 */
exports.setAgentActive = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in first.");
  const adminDoc = await db.collection("admins").doc(callerUid).get();
  if (!adminDoc.exists) throw new HttpsError("permission-denied", "Admins only.");

  const { agentId, active } = request.data;
  if (!agentId) throw new HttpsError("invalid-argument", "agentId is required.");
  await db.collection("agents").doc(agentId).update({ active: !!active });
  return { ok: true };
});
