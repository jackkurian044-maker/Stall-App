/**
 * scoreProfile.js
 *
 * Pure scoring logic for the "Vendor Boost" GBP health score.
 * No network calls — feed it a `profile` object already mapped from the
 * GMB API response and it returns a score + itemized checklist.
 *
 * v2 fix: the first version compared Stall's own `category` field
 * (a broad enum: "Food & Produce", "Services", etc. — see
 * src/constants.js CATEGORIES) directly against GBP's specific
 * primaryCategory ("Hair Salon", "Coffee Shop"). Those never match by
 * design — they're different taxonomies for different purposes — so
 * that check is now "does GBP have a specific category set at all"
 * instead of a cross-comparison.
 *
 * Same fix for hours: Stall's `vendors.hours` is a free-text string
 * (see VendorDashboard.jsx — a <textarea>, not structured data), while
 * GBP's regularHours is a structured periods object. Comparing them
 * directly was never going to produce a meaningful signal, so this
 * check is now "does GBP have hours set at all," not a cross-check
 * against Stall's text field.
 *
 * Expected `profile` shape (see mapGbpResponse() at the bottom):
 * {
 *   photoCount: number,
 *   lastPhotoDaysAgo: number | null,
 *   hasSpecificCategory: boolean,   // GBP primaryCategory is set and non-generic
 *   descriptionHasKeywords: boolean,
 *   totalReviews: number,
 *   unrepliedReviews: number,
 *   avgReplyLatencyDays: number | null,
 *   hoursSetOnGoogle: boolean,      // GBP regularHours exist
 *   postsLast30Days: number,
 *   qaOpenCount: number,
 * }
 */

// Weights sum to 100. Tune these based on real ranking-correlation data
// once you have enough vendors through Boost to see what moves the needle.
const WEIGHTS = {
  photos: 20,
  category: 15,
  description: 10,
  reviewReplies: 25,
  hours: 10,
  posts: 15,
  qa: 5,
};

function scorePhotos(p) {
  let s = 0;
  if (p.photoCount >= 10) s += WEIGHTS.photos * 0.6;
  else if (p.photoCount >= 5) s += WEIGHTS.photos * 0.35;
  else if (p.photoCount >= 1) s += WEIGHTS.photos * 0.15;

  if (p.lastPhotoDaysAgo !== null && p.lastPhotoDaysAgo <= 30) {
    s += WEIGHTS.photos * 0.4;
  } else if (p.lastPhotoDaysAgo !== null && p.lastPhotoDaysAgo <= 90) {
    s += WEIGHTS.photos * 0.2;
  }
  return Math.min(s, WEIGHTS.photos);
}

function scoreCategory(p) {
  return p.hasSpecificCategory ? WEIGHTS.category : 0;
}

function scoreDescription(p) {
  return p.descriptionHasKeywords ? WEIGHTS.description : 0;
}

function scoreReviewReplies(p) {
  if (p.totalReviews === 0) return WEIGHTS.reviewReplies * 0.5; // neutral, not penalized
  const replyRate = (p.totalReviews - p.unrepliedReviews) / p.totalReviews;
  let s = WEIGHTS.reviewReplies * 0.7 * replyRate;
  if (p.avgReplyLatencyDays !== null && p.avgReplyLatencyDays <= 2) {
    s += WEIGHTS.reviewReplies * 0.3;
  } else if (p.avgReplyLatencyDays !== null && p.avgReplyLatencyDays <= 7) {
    s += WEIGHTS.reviewReplies * 0.15;
  }
  return Math.min(s, WEIGHTS.reviewReplies);
}

function scoreHours(p) {
  return p.hoursSetOnGoogle ? WEIGHTS.hours : 0;
}

function scorePosts(p) {
  if (p.postsLast30Days >= 4) return WEIGHTS.posts;
  if (p.postsLast30Days >= 2) return WEIGHTS.posts * 0.6;
  if (p.postsLast30Days >= 1) return WEIGHTS.posts * 0.3;
  return 0;
}

function scoreQa(p) {
  return p.qaOpenCount === 0 ? WEIGHTS.qa : WEIGHTS.qa * 0.4;
}

/**
 * Returns { score: 0-100, band: string, checklist: [...] }
 * checklist items are sorted worst-first so the UI can show the
 * highest-impact fix at the top.
 */
function scoreProfile(profile) {
  const items = [
    {
      key: "photos",
      label: "Add more recent photos",
      points: scorePhotos(profile),
      max: WEIGHTS.photos,
      done: profile.photoCount >= 10 && profile.lastPhotoDaysAgo <= 30,
      cta: "add_photos",
    },
    {
      key: "category",
      label: "Set a specific Google Business category",
      points: scoreCategory(profile),
      max: WEIGHTS.category,
      done: profile.hasSpecificCategory,
      cta: "fix_category",
    },
    {
      key: "description",
      label: "Add keywords customers actually search for",
      points: scoreDescription(profile),
      max: WEIGHTS.description,
      done: profile.descriptionHasKeywords,
      cta: "edit_description",
    },
    {
      key: "reviewReplies",
      label: "Reply to unanswered reviews",
      points: scoreReviewReplies(profile),
      max: WEIGHTS.reviewReplies,
      done: profile.unrepliedReviews === 0,
      cta: "reply_reviews",
      count: profile.unrepliedReviews,
    },
    {
      key: "hours",
      label: "Set your business hours on Google",
      points: scoreHours(profile),
      max: WEIGHTS.hours,
      done: profile.hoursSetOnGoogle,
      cta: "fix_hours",
    },
    {
      key: "posts",
      label: "Post an update or offer",
      points: scorePosts(profile),
      max: WEIGHTS.posts,
      done: profile.postsLast30Days >= 4,
      cta: "create_post",
    },
    {
      key: "qa",
      label: "Answer open customer questions",
      points: scoreQa(profile),
      max: WEIGHTS.qa,
      done: profile.qaOpenCount === 0,
      cta: "answer_qa",
      count: profile.qaOpenCount,
    },
  ];

  const score = Math.round(items.reduce((sum, i) => sum + i.points, 0));

  let band;
  if (score >= 80) band = "strong";
  else if (score >= 55) band = "needs_work";
  else band = "at_risk";

  const checklist = items
    .filter((i) => !i.done)
    .sort((a, b) => (b.max - b.points) - (a.max - a.points));

  return { score, band, checklist };
}

/**
 * Maps a raw Google Business Profile API response into the flat
 * `profile` shape scoreProfile() expects.
 *
 * `stallListing` is only used for display context now (vendor name for
 * the Claude copy prompt) — it's no longer cross-checked against GBP
 * fields, since Stall's category/hours aren't in a comparable shape to
 * GBP's (see notes at the top of this file).
 */
function mapGbpResponse({ locationData, reviews, posts, questions }) {
  const unreplied = reviews.filter((r) => !r.reviewReply).length;
  const repliedReviews = reviews.filter((r) => r.reviewReply);
  const avgReplyLatencyDays = repliedReviews.length
    ? repliedReviews.reduce((sum, r) => {
        const created = new Date(r.createTime);
        const replied = new Date(r.reviewReply.updateTime);
        return sum + (replied - created) / (1000 * 60 * 60 * 24);
      }, 0) / repliedReviews.length
    : null;

  const photos = locationData.mediaItems || [];
  const lastPhoto = photos.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))[0];

  // GBP returns categories as { primaryCategory: { displayName, categoryId } }.
  // "specific" here just means something is actually set — Google itself
  // treats an unset/default category as a ranking gap, independent of
  // whatever broad category Stall's own listing uses.
  const hasSpecificCategory = Boolean(locationData.categories?.primaryCategory?.displayName);

  const periods = locationData.regularHours?.periods || [];

  return {
    photoCount: photos.length,
    lastPhotoDaysAgo: lastPhoto
      ? Math.round((Date.now() - new Date(lastPhoto.createTime)) / (1000 * 60 * 60 * 24))
      : null,
    hasSpecificCategory,
    descriptionHasKeywords: (locationData.profile?.description || "").length > 50,
    totalReviews: reviews.length,
    unrepliedReviews: unreplied,
    avgReplyLatencyDays,
    hoursSetOnGoogle: periods.length > 0,
    postsLast30Days: posts.filter(
      (p) => (Date.now() - new Date(p.createTime)) / (1000 * 60 * 60 * 24) <= 30
    ).length,
    qaOpenCount: questions.filter((q) => !q.topAnswer).length,
  };
}

module.exports = { scoreProfile, mapGbpResponse, WEIGHTS };
