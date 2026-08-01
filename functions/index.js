// ═══════════════════════════════════════════════════════════════
//  SECTION 4 — VENDOR BOOST (GBP health score + checklist)
//
//  PASTE THIS DIRECTLY INTO functions/index.js, after Section 3.
//  This is NOT a separate deployed function file — delete this
//  boost/index.js from your project once you've pasted its contents
//  into the root index.js. It reuses db, admin, functions, axios,
//  and getValidToken() which are already defined there.
//
//  Keep functions/boost/scoreProfile.js exactly where it is — the
//  require path below is already correct relative to the root index.js.
// ═══════════════════════════════════════════════════════════════

const { scoreProfile, mapGbpResponse } = require("./boost/scoreProfile");

// ─────────────────────────────────────────────────────────────
// 4A. FETCH GBP PROFILE DATA (location info, posts, questions)
// Reviews you already fetch in pollReviews — this adds the extra
// reads Boost needs. Same v1 Business Profile APIs, same access token.
// ─────────────────────────────────────────────────────────────
async function fetchBoostData(accessToken, connectionData) {
  const { locationId } = connectionData;

  const [locationRes, reviewsRes, postsRes, questionsRes] = await Promise.all([
    axios.get(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { readMask: "categories,profile,regularHours" },
      }
    ),
    axios.get(
      `https://mybusiness.googleapis.com/v4/${locationId}/reviews`,
      { headers: { Authorization: `Bearer ${accessToken}` }, params: { pageSize: 50 } }
    ),
    axios
      .get(`https://mybusiness.googleapis.com/v4/${locationId}/localPosts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch(() => ({ data: { localPosts: [] } })), // localPosts API is flaky/deprecated on some accounts — don't fail the whole scan
    axios
      .get(`https://mybusinessqanda.googleapis.com/v1/${locationId}/questions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch(() => ({ data: { questions: [] } })),
  ]);

  // Photos live under a separate media endpoint in v1 — fetch
  // separately since it 404s on locations with none instead of returning [].
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

// ─────────────────────────────────────────────────────────────
// 4B. TRANSLATE CHECKLIST INTO VENDOR-FACING COPY
// Same axios + Claude pattern as generateAIResponse() above —
// reuses functions.config().anthropic.api_key, no new secret.
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// 4C. RUN BOOST SCAN — callable, same auth pattern as your other
// onCall functions. Gated on premium_vendors.isPremium for now —
// see note below on splitting this into its own add-on billing tier.
// ─────────────────────────────────────────────────────────────
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

  // NOTE: reusing the same isPremium flag as the review responder for
  // now. If you go with a separate Boost add-on price (₹299–499/mo on
  // top of the ₹499 tier, per our earlier discussion), swap this check
  // for a distinct field, e.g. premiumDoc.data().boostActive, and add a
  // second Razorpay plan the same way createSubscription() does above.
  if (!premiumDoc.exists || !premiumDoc.data().isPremium) {
    throw new functions.https.HttpsError("failed-precondition", "Premium subscription required");
  }

  if (vendorSnap.empty) {
    throw new functions.https.HttpsError("not-found", "Vendor listing not found");
  }

  const vendorDoc = vendorSnap.docs[0];
  const listing = vendorDoc.data();
  const connectionData = connDoc.data();

  const accessToken = await getValidToken(vendorId, connectionData);
  const { locationData, reviews, posts, questions } = await fetchBoostData(accessToken, connectionData);

  const profile = mapGbpResponse({ locationData, reviews, posts, questions });

  const { score, band, checklist } = scoreProfile(profile);
  const vendorCopy = await writeVendorFacingCopy(checklist, listing.name);

  const result = {
    score,
    band,
    checklist: checklist.map((item) => ({
      ...item,
      ...(vendorCopy.find((c) => c.key === item.key) || {}),
    })),
    scannedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await vendorDoc.ref.collection("boost").doc("latest").set(result);

  return { ...result, scannedAt: new Date().toISOString() };
});
