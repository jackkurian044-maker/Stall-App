// STall plan catalog — single source of truth for frontend entitlements.
// Payment amounts are still validated on the server in functions/index.js.

export const STALL_PLANS = {
  free: {
    key: "free",
    name: "Free Listing",
    price: 0,
    billing: "forever",
    visibilityKm: 0.1,
    features: ["listing", "basic_profile", "location_contact"],
  },
  verified: {
    key: "verified",
    name: "STall Verified",
    price: 99,
    billing: "one-time",
    visibilityKm: 1,
    features: ["listing", "basic_profile", "verified_badge", "enhanced_visibility", "whatsapp", "insights"],
  },
  digital_growth: {
    key: "digital_growth",
    name: "Digital Growth",
    price: 499,
    billing: "monthly",
    visibilityKm: 5,
    features: [
      "listing", "basic_profile", "verified_badge", "enhanced_visibility", "whatsapp", "insights",
      "digital_audit", "google_business_review", "conversion_assessment", "growth_action_plan", "landing_page",
    ],
  },
  growth_setup: {
    key: "growth_setup",
    name: "Growth Setup",
    price: 999,
    billing: "monthly",
    visibilityKm: 25,
    features: [
      "listing", "basic_profile", "verified_badge", "enhanced_visibility", "whatsapp", "insights",
      "digital_audit", "google_business_review", "conversion_assessment", "growth_action_plan", "landing_page",
      "profile_optimization", "review_response_setup", "whatsapp_conversion", "offer_optimization",
      "cta_page", "growth_recommendations",
    ],
  },
};

export function getPlan(listing, subscription) {
  if (subscription?.isPremium && subscription?.tier === "growth_setup") return STALL_PLANS.growth_setup;
  if (subscription?.isPremium && subscription?.tier === "digital_growth") return STALL_PLANS.digital_growth;
  if (listing?.planKey === "growth_setup") return STALL_PLANS.growth_setup;
  if (listing?.planKey === "digital_growth") return STALL_PLANS.digital_growth;
  if (listing?.planKey === "verified") return STALL_PLANS.verified;
  if (listing?.isVerified) return STALL_PLANS.verified;
  return STALL_PLANS.free;
}

export function hasFeature(plan, feature) {
  return Boolean(plan?.features?.includes(feature));
}
