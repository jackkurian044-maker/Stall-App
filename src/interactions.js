import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

// Interaction types tracked per vendor. Kept intentionally small —
// more counters just means more noise in the vendor's dashboard later.
export const INTERACTION_TYPES = ["view", "call", "whatsapp", "directions"];

/**
 * Logs a single interaction against a vendor listing. This does two things
 * at once, cheaply:
 *  1. Increments a per-type counter directly on the vendor doc (e.g. viewCount,
 *     callCount) — this is what powers the vendor's own analytics dashboard
 *     and needs to be fast/cheap to read (no aggregation query needed).
 *  2. Writes a lightweight event row to a subcollection with a truncated
 *     day-bucketed date, so "X people viewed this nearby recently" type
 *     proximity social proof can be computed over an actual real time
 *     window rather than a misleading all-time count.
 *
 * This is deliberately NOT tied to a specific signed-in user — customers
 * browsing Stall shouldn't need an account, so this can't require auth.
 */
export async function logInteraction(db, vendorId, type) {
  if (!INTERACTION_TYPES.includes(type)) return;
  const field = `${type}Count`;
  try {
    await updateDoc(doc(db, "vendors", vendorId), { [field]: increment(1) });
  } catch {
    // Non-fatal — analytics should never block the user's actual action
    // (e.g. don't stop someone from calling a vendor because a counter failed).
  }
  try {
    await addDoc(collection(db, "vendors", vendorId, "events"), {
      type,
      createdAt: serverTimestamp(),
      // bucketed to the day for cheap "this week / this month" queries later
      dayBucket: new Date().toISOString().slice(0, 10),
    });
  } catch {
    // same — non-fatal
  }
}

/**
 * Returns the count of "view" events for a vendor within the last N days
 * (default 30), by querying the actual dated events subcollection rather
 * than a lifetime counter — so "X people viewed this recently" is a real,
 * accurate claim instead of an all-time number dressed up as recent.
 *
 * Note: this issues one Firestore read per vendor card shown, so it's used
 * sparingly (e.g. only on the expanded/detail view, not the full list) —
 * see the note in FindView.jsx where this is called.
 */
export async function getRecentViewCount(db, vendorId, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffBucket = cutoff.toISOString().slice(0, 10);
  try {
    const q = query(
      collection(db, "vendors", vendorId, "events"),
      where("type", "==", "view"),
      where("dayBucket", ">=", cutoffBucket)
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch {
    return 0;
  }
}

/**
 * Formats a recent-view count into the proximity social-proof line shown
 * to customers, e.g. "6 people checked this out recently." Deliberately
 * uses "recently" rather than a specific window in the copy — the exact
 * day count matters for the query, not for what the customer reads.
 */
export function socialProofLine(recentViews) {
  if (recentViews < 3) return null; // don't show a proof line for brand-new / low-traffic listings
  return `${recentViews} ${recentViews === 1 ? "person" : "people"} checked this out recently`;
}
