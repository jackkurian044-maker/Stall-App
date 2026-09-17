// Sync an owner's manual review-response edit from STall to Google Business Profile.
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const googleOAuthConfig = defineSecret("GOOGLE_OAUTH_CONFIG");
const STALL_BRANDING = "Powered by STall";

function ensureStallBranding(response) {
  const text = String(response || "").trim();
  if (!text) return STALL_BRANDING;
  if (/powered\s+by\s+stall\b/i.test(text)) return text;
  return `${text}\n\n${STALL_BRANDING}`;
}

function getConfig() {
  let cfg;
  try { cfg = JSON.parse(googleOAuthConfig.value()); }
  catch (err) { throw new Error("GOOGLE_OAUTH_CONFIG is missing or invalid"); }
  if (!cfg.client_id || !cfg.client_secret) throw new Error("GOOGLE_OAUTH_CONFIG is incomplete");
  return cfg;
}

function reviewUrl(connection, reviewId) {
  const account = String(connection.accountName || "").replace(/^\/+|\/+$/g, "");
  const rawLocation = String(connection.locationId || "").replace(/^\/+|\/+$/g, "");
  const location = rawLocation.includes("/locations/") ? rawLocation : `${account}/locations/${rawLocation.replace(/^locations\//, "")}`;
  return `https://mybusiness.googleapis.com/v4/${location}/reviews/${reviewId}`;
}

async function getGoogleToken(vendorId, connection) {
  const expiry = connection.tokenExpiresAt?.toDate?.() || new Date(0);
  if (connection.accessToken && expiry >= new Date(Date.now() + 5 * 60 * 1000)) return connection.accessToken;
  const cfg = getConfig();
  const result = await axios.post("https://oauth2.googleapis.com/token", {
    refresh_token: connection.refreshToken,
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    grant_type: "refresh_token",
  });
  if (!result.data.access_token) throw new Error("Google did not return a refreshed access token");
  await db.collection("gbp_connections").doc(vendorId).update({
    accessToken: result.data.access_token,
    tokenExpiresAt: new Date(Date.now() + Number(result.data.expires_in || 3600) * 1000),
  });
  return result.data.access_token;
}

exports.syncManualReviewEdit = onDocumentUpdated(
  { document: "review_responses/{responseId}", secrets: [googleOAuthConfig] },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!after || after.status !== "manual" || !after.reviewId || !after.aiResponse?.trim()) return;
    const beforeEdited = before?.editedAt?.toMillis?.() || 0;
    const afterEdited = after.editedAt?.toMillis?.() || 0;
    if (afterEdited === beforeEdited) return;

    const vendorId = after.vendorId;
    if (!vendorId) return;
    const connectionSnap = await db.collection("gbp_connections").doc(vendorId).get();
    if (!connectionSnap.exists || !connectionSnap.data().connected) throw new Error("GBP is not connected");
    const connection = connectionSnap.data();
    const accessToken = await getGoogleToken(vendorId, connection);
    const url = reviewUrl(connection, after.reviewId);
    const finalResponse = ensureStallBranding(after.aiResponse);

    await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    await axios.put(`${url}/reply`, { comment: finalResponse }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    await event.data.after.ref.set({
      aiResponse: finalResponse,
      googleReply: finalResponse,
      syncedToGoogleAt: admin.firestore.FieldValue.serverTimestamp(),
      syncError: admin.firestore.FieldValue.delete(),
    }, { merge: true });

    console.log(`Manual review response synced to Google for ${vendorId}/${after.reviewId}`);
  }
);
