import React, { useEffect, useState } from "react";
import {
  collection, doc, onSnapshot, orderBy, query, setDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { X, Star, Trash2, ExternalLink } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";

function StarPicker({ value, onChange, size = 22, readOnly = false }) {
  if (readOnly) {
    return (
      <div style={{ display: "flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={size} fill={n <= value ? COLORS.marigold : "none"} color={COLORS.marigold} />
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
          title={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Star size={size} fill={n <= value ? COLORS.marigold : "none"} color={COLORS.marigold} />
        </button>
      ))}
    </div>
  );
}

function timeAgo(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function ReviewsModal({ vendor, user, isAdmin, onClose, onRequestSignIn }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "vendors", vendor.id, "reviews"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [vendor.id]);

  useEffect(() => {
    if (!user) return;
    const mine = reviews.find((r) => r.id === user.uid);
    if (mine) {
      setMyRating(mine.rating);
      setMyComment(mine.comment || "");
    }
  }, [reviews, user]);

  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
    : null;

  const myExisting = user ? reviews.find((r) => r.id === user.uid) : null;

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      await setDoc(doc(db, "vendors", vendor.id, "reviews", user.uid), {
        rating: myRating,
        comment: myComment.trim(),
        authorLabel: user.email ? user.email.split("@")[0] : "Anonymous",
        createdAt: myExisting?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setJustSubmitted(true);
    } catch {
      setError("Couldn't save your review — try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteMine = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "vendors", vendor.id, "reviews", user.uid));
      setMyRating(5);
      setMyComment("");
    } catch {
      setError("Couldn't delete your review — try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAny = async (reviewId) => {
    try {
      await deleteDoc(doc(db, "vendors", vendor.id, "reviews", reviewId));
    } catch {
      // ignore
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(24,38,32,0.5)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 14, border: `2px solid ${COLORS.ink}`,
          width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", padding: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div className="font-display" style={{ fontSize: 20, fontWeight: 700 }}>{vendor.name}</div>
            <div style={{ fontSize: 12, color: "#666" }}>STALL reviews</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={COLORS.ink} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 18px" }}>
          {average != null ? (
            <>
              <StarPicker value={Math.round(average)} readOnly size={18} />
              <span className="font-mono" style={{ fontSize: 14, fontWeight: 700 }}>{average.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: "#777" }}>({reviews.length} review{reviews.length === 1 ? "" : "s"})</span>
            </>
          ) : (
            <span style={{ fontSize: 12.5, color: "#777" }}>No STALL reviews yet — be the first.</span>
          )}
        </div>

        {vendor.rating != null && (
          <div style={{ fontSize: 11.5, color: "#999", marginBottom: 18 }}>
            Separately, Google shows a {vendor.rating.toFixed(1)}★ rating
            {vendor.ratingsCount != null ? ` from ${vendor.ratingsCount} reviews` : ""} for this business.
          </div>
        )}

        {user ? (
          <form onSubmit={submitReview} style={{ background: COLORS.paper, borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              {myExisting ? "Edit your review" : "Leave a review"}
            </div>
            <StarPicker value={myRating} onChange={setMyRating} />
            <textarea
              value={myComment}
              onChange={(e) => setMyComment(e.target.value)}
              placeholder="What was your experience?"
              rows={3}
              style={{ width: "100%", marginTop: 10, padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${COLORS.ink}`, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
            {error && <div style={{ fontSize: 11.5, color: COLORS.brick, marginTop: 6 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button type="submit" disabled={saving} className="stall-btn" style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 12.5, fontWeight: 700 }}>
                {saving ? "Saving…" : myExisting ? "Update review" : "Post review"}
              </button>
              {myExisting && (
                <button type="button" onClick={deleteMine} disabled={saving} style={{ background: "none", border: "none", color: COLORS.brick, fontSize: 12.5, cursor: "pointer" }}>
                  Delete my review
                </button>
              )}
              {!justSubmitted && myExisting && vendor.placeId && (
                <a
                  href={`https://search.google.com/local/writereview?placeid=${vendor.placeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11.5, color: COLORS.teal, display: "flex", alignItems: "center", gap: 4, textDecoration: "none", marginLeft: "auto" }}
                >
                  Also post on Google <ExternalLink size={11} />
                </a>
              )}
            </div>

            {justSubmitted && vendor.placeId && (
              <div style={{ marginTop: 12, background: `${COLORS.marigold}22`, border: `1.5px solid ${COLORS.marigold}`, borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5 }}>
                  ✓ Posted on STALL. Want it on Google too?
                </span>
                <a
                  href={`https://search.google.com/local/writereview?placeid=${vendor.placeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stall-btn"
                  style={{ background: COLORS.ink, color: "#fff", borderRadius: 7, padding: "7px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                >
                  Also post on Google <ExternalLink size={12} />
                </a>
              </div>
            )}
          </form>
        ) : (
          <div style={{ background: COLORS.paper, borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 12.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span>Sign in to leave a review.</span>
            <button
              onClick={() => { onRequestSignIn?.(); onClose(); }}
              className="stall-btn"
              style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
            >
              Sign in
            </button>
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          {loading ? "Loading reviews…" : reviews.length === 0 ? "" : `All reviews (${reviews.length})`}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ borderBottom: `1px solid ${COLORS.ink}15`, paddingBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StarPicker value={r.rating} readOnly size={13} />
                  <span style={{ fontSize: 11.5, color: "#777" }}>{r.authorLabel || "Anonymous"} · {timeAgo(r.createdAt)}</span>
                </div>
                {isAdmin && r.id !== user?.uid && (
                  <button onClick={() => deleteAny(r.id)} title="Remove review (admin)" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.brick, padding: 2 }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {r.comment && <div style={{ fontSize: 13, marginTop: 4 }}>{r.comment}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
