/**
 * Boost Cloud Function — callable trigger: runBoostScan
 *
 * Drop this folder into your existing functions/ directory alongside
 * your review-auto-responder function. Reuses the same GMB OAuth client
 * and Claude API key/secret you already have configured — no new infra,
 * just new scopes if you haven't already requested read access to
 * locations.readMask fields (photos, posts, questions).
 *
 * Flow:
 *   1. Pull vendor's linked GBP location + reviews + posts + Q&A
 *   2. Cross-check hours against the vendor's own Stall listing
 *   3. Run scoreProfile() (pure, no network calls — see scoreProfile.js)
 *   4. Ask Claude to translate the checklist into short, plain-language
 *      vendor-facing copy (reuses your existing Claude API setup)
 *   5. Write result to Firestore: vendors/{vendorId}/boost/latest
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const Anthropic = require("@anthropic-ai/sdk");

const { scoreProfile, mapGbpResponse } = require("./scoreProfile");

// Reuse whatever helper you already wrote for the review auto-responder
// to get an authenticated GMB API client per vendor. Swap this stub for
// that import.
const { getGbpClientForVendor } = require("../reviewResponder/gbpAuth");

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

async function fetchGbpData(gbpClient, gbpLocationId) {
  const [locationData, reviews, posts, questions] = await Promise.all([
    gbpClient.getLocation(gbpLocationId, {
      readMask: "primaryCategory,profile,regularHours,mediaItems",
    }),
    gbpClient.listReviews(gbpLocationId),
    gbpClient.listLocalPosts(gbpLocationId),
    gbpClient.listQuestions(gbpLocationId),
  ]);
  return { locationData, reviews, posts, questions };
}

async function writeVendorFacingCopy(checklist, vendorName) {
  if (checklist.length === 0) return [];

  const prompt = `You are writing short, encouraging checklist items for a small
business owner (${vendorName}) inside a mobile app called Stall. They are not
technical and don't know SEO jargon. For each item below, write ONE sentence
(max 15 words) explaining the fix in plain language, and one action button
label (max 3 words). Return ONLY a JSON array, no markdown fences, no preamble,
shaped like: [{"key": "...", "message": "...", "buttonLabel": "..."}]

Items:
${checklist.map((i) => `- ${i.key}: ${i.label} (impact: ${Math.round(i.max - i.points)} of ${i.max} points missing)`).join("\n")}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (err) {
    // If Claude's output doesn't parse cleanly, fall back to the raw
    // labels rather than failing the whole scan.
    console.error("Boost copy parse failed:", err, text);
    return checklist.map((i) => ({ key: i.key, message: i.label, buttonLabel: "Fix now" }));
  }
}

exports.runBoostScan = onCall({ region: "asia-south1" }, async (request) => {
  const { vendorId } = request.data;
  if (!vendorId) {
    throw new HttpsError("invalid-argument", "vendorId is required");
  }

  const db = getFirestore();
  const vendorRef = db.collection("vendors").doc(vendorId);
  const vendorSnap = await vendorRef.get();

  if (!vendorSnap.exists) {
    throw new HttpsError("not-found", "Vendor not found");
  }

  const vendor = vendorSnap.data();
  if (!vendor.boostSubscriptionActive) {
    throw new HttpsError("permission-denied", "Boost add-on is not active for this vendor");
  }
  if (!vendor.gbpLocationId) {
    throw new HttpsError("failed-precondition", "Vendor has not linked a Google Business Profile");
  }

  const gbpClient = await getGbpClientForVendor(vendorId);
  const { locationData, reviews, posts, questions } = await fetchGbpData(
    gbpClient,
    vendor.gbpLocationId
  );

  const profile = mapGbpResponse({
    locationData,
    reviews,
    posts,
    questions,
    stallListing: { vertical: vendor.vertical, hours: vendor.hours },
  });

  const { score, band, checklist } = scoreProfile(profile);
  const vendorCopy = await writeVendorFacingCopy(checklist, vendor.displayName);

  const result = {
    score,
    band,
    checklist: checklist.map((item) => ({
      ...item,
      ...(vendorCopy.find((c) => c.key === item.key) || {}),
    })),
    scannedAt: new Date().toISOString(),
  };

  await vendorRef.collection("boost").doc("latest").set(result);

  return result;
});
