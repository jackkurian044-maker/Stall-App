const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

const db = admin.firestore();

const STATUS_VALUES = new Set(["new", "contacted", "qualified", "converted", "lost"]);
const SOURCE_VALUES = new Set(["GOOGLE_ADS", "FACEBOOK", "INSTAGRAM", "WHATSAPP", "STALL_BOOST", "STALL_ORGANIC", "WEBSITE", "MANUAL", "OTHER"]);

function config() {
  try { return functions.config().leadengine || {}; } catch { return {}; }
}

function clean(value, max = 500) {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

function normalizeSource(value) {
  const raw = clean(value, 40).toUpperCase().replace(/[ -]+/g, "_");
  return SOURCE_VALUES.has(raw) ? raw : "OTHER";
}

function leadIdFor(source, sourceLeadId) {
  const safe = clean(sourceLeadId || crypto.randomUUID(), 240);
  const hash = crypto.createHash("sha256").update(`${source}:${safe}`).digest("hex").slice(0, 32);
  return `${source.toLowerCase()}_${hash}`;
}

async function getBusiness(businessId) {
  if (!businessId) throw new functions.https.HttpsError("invalid-argument", "businessId is required");
  const snap = await db.collection("vendors").doc(businessId).get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "Business listing not found");
  return { ref: snap.ref, data: snap.data() };
}

async function saveLead({ businessId, source, sourceLeadId, data, attribution = {} }) {
  const business = await getBusiness(businessId);
  const normalizedSource = normalizeSource(source);
  const leadId = leadIdFor(normalizedSource, sourceLeadId);
  const ref = db.collection("vendors").doc(businessId).collection("leads").doc(leadId);
  const existing = await ref.get();
  const payload = {
    businessId,
    businessName: clean(business.data.name, 200),
    source: normalizedSource,
    sourceLeadId: clean(sourceLeadId, 240),
    name: clean(data.name, 200),
    phone: clean(data.phone, 80),
    email: clean(data.email, 200),
    message: clean(data.message, 1000),
    city: clean(data.city, 120),
    postalCode: clean(data.postalCode, 40),
    status: existing.exists ? (existing.data().status || "new") : "new",
    assignedAgentId: business.data.addedByAgentId || null,
    campaignId: clean(attribution.campaignId, 120) || null,
    adId: clean(attribution.adId, 120) || null,
    adGroupId: clean(attribution.adGroupId, 120) || null,
    formId: clean(attribution.formId, 120) || null,
    gclid: clean(attribution.gclid, 300) || null,
    boostCampaignId: clean(attribution.boostCampaignId, 120) || null,
    sourceLabel: clean(attribution.sourceLabel, 120) || normalizedSource,
    testLead: Boolean(attribution.testLead),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!existing.exists) payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  await ref.set(payload, { merge: true });
  return { leadId, created: !existing.exists };
}

function googleColumns(payload) {
  const result = {};
  for (const row of Array.isArray(payload.user_column_data) ? payload.user_column_data : []) {
    const id = clean(row.column_id, 80).toUpperCase();
    const value = clean(row.string_value, 500);
    if (!value) continue;
    if (id === "FULL_NAME") result.name = value;
    else if (id === "FIRST_NAME") result.firstName = value;
    else if (id === "LAST_NAME") result.lastName = value;
    else if (id === "EMAIL" || id === "WORK_EMAIL") result.email = value;
    else if (id === "PHONE_NUMBER" || id === "WORK_PHONE") result.phone = value;
    else if (id === "POSTAL_CODE") result.postalCode = value;
  }
  if (!result.name) result.name = [result.firstName, result.lastName].filter(Boolean).join(" ");
  return result;
}

async function findGoogleBusiness(payload, requestedBusinessId) {
  if (requestedBusinessId) return requestedBusinessId;
  const campaignId = clean(payload.campaign_id, 80);
  if (!campaignId) return "";
  const snap = await db.collection("lead_source_mappings")
    .where("source", "==", "GOOGLE_ADS")
    .where("campaignId", "==", campaignId)
    .limit(1)
    .get();
  return snap.empty ? "" : snap.docs[0].data().businessId;
}

exports.googleAdsLeadWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ message: "POST required" });
  try {
    const payload = req.body || {};
    const cfg = config();
    const businessId = await findGoogleBusiness(payload, clean(req.query.businessId, 128));
    if (!businessId) return res.status(400).json({ message: "No STall business mapping found for this Google lead form" });

    const mappingSnap = await db.collection("lead_source_mappings").doc(`google_${businessId}`).get();
    const configuredSecret = mappingSnap.exists ? clean(mappingSnap.data().googleSecret, 300) : clean(cfg.google_secret, 300);
    if (!configuredSecret || !payload.google_key || !crypto.timingSafeEqual(Buffer.from(configuredSecret), Buffer.from(clean(payload.google_key, 300)))) {
      return res.status(401).json({ message: "Google lead verification failed" });
    }

    const result = await saveLead({
      businessId,
      source: "GOOGLE_ADS",
      sourceLeadId: payload.lead_id,
      data: googleColumns(payload),
      attribution: {
        campaignId: payload.campaign_id,
        adGroupId: payload.adgroup_id,
        adId: payload.creative_id,
        formId: payload.form_id,
        gclid: payload.gcl_id,
        sourceLabel: payload.lead_source || "GOOGLE_ADS",
        testLead: payload.is_test === true,
      },
    });
    return res.status(200).json({ received: true, ...result });
  } catch (err) {
    console.error("googleAdsLeadWebhook failed:", err);
    return res.status(500).json({ message: "Temporary lead processing failure" });
  }
});

exports.leadWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ message: "POST required" });
  try {
    const cfg = config();
    const expected = clean(cfg.webhook_secret, 300);
    const supplied = clean(req.headers["x-stall-webhook-secret"], 300);
    if (!expected || !supplied || expected.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
      return res.status(401).json({ message: "Webhook authentication failed" });
    }
    const payload = req.body || {};
    const result = await saveLead({
      businessId: clean(payload.businessId, 128),
      source: payload.source,
      sourceLeadId: payload.sourceLeadId || payload.leadId,
      data: payload,
      attribution: payload.attribution || {},
    });
    return res.status(200).json({ received: true, ...result });
  } catch (err) {
    console.error("leadWebhook failed:", err);
    const code = err instanceof functions.https.HttpsError ? 400 : 500;
    return res.status(code).json({ message: err.message || "Temporary lead processing failure" });
  }
});

exports.createManualLead = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const business = await getBusiness(clean(data.businessId, 128));
  const uid = context.auth.uid;
  const isAdmin = await db.collection("admins").doc(uid).get().then((s) => s.exists);
  if (business.data.ownerId !== uid && business.data.addedByAgentId !== uid && !isAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Not allowed for this business");
  }
  return saveLead({
    businessId: clean(data.businessId, 128),
    source: "MANUAL",
    sourceLeadId: clean(data.sourceLeadId, 240) || crypto.randomUUID(),
    data,
    attribution: { sourceLabel: "MANUAL" },
  });
});

exports.updateLeadStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const businessId = clean(data.businessId, 128);
  const leadId = clean(data.leadId, 160);
  const status = clean(data.status, 30).toLowerCase();
  if (!STATUS_VALUES.has(status)) throw new functions.https.HttpsError("invalid-argument", "Invalid lead status");
  const business = await getBusiness(businessId);
  const uid = context.auth.uid;
  const isAdmin = await db.collection("admins").doc(uid).get().then((s) => s.exists);
  if (business.data.ownerId !== uid && business.data.addedByAgentId !== uid && !isAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Not allowed for this business");
  }
  const ref = db.collection("vendors").doc(businessId).collection("leads").doc(leadId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "Lead not found");
  const update = { status, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (status === "contacted") update.lastContactedAt = admin.firestore.FieldValue.serverTimestamp();
  if (status === "converted") update.convertedAt = admin.firestore.FieldValue.serverTimestamp();
  await ref.update(update);
  return { success: true };
});
