import { collection, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";

// Reasons shown in the report modal — keep this list short and specific,
// vague "other" catch-alls make triage harder for admins later.
export const REPORT_REASONS = [
  "This listing looks fake",
  "This store has closed permanently",
  "Wrong address or phone number",
  "Inappropriate content or photos",
  "Duplicate of another listing",
  "Something else",
];

/**
 * Submits a report against a vendor listing for admin review.
 * Reports are NOT shown publicly and don't affect the listing until
 * an admin acts on them — this is deliberate, so a single bad-faith
 * report can't take down a real vendor's listing on its own.
 */
export async function submitReport(db, { vendorId, vendorName, reason, details, reporterUid }) {
  if (!vendorId || !reason) throw new Error("Missing vendorId or reason");
  return addDoc(collection(db, "reports"), {
    vendorId,
    vendorName: vendorName || "",
    reason,
    details: (details || "").trim(),
    reporterUid: reporterUid || null,
    status: "open", // open -> reviewed | dismissed
    createdAt: serverTimestamp(),
  });
}

export async function resolveReport(db, reportId, status) {
  if (!["reviewed", "dismissed", "open"].includes(status)) throw new Error("Invalid status");
  return updateDoc(doc(db, "reports", reportId), {
    status,
    resolvedAt: serverTimestamp(),
  });
}
