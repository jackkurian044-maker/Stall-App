// ReviewAutoResponder.jsx
// Add this to your src/ folder
// Import it in VendorDashboard.jsx for premium vendors

import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  doc, getDoc, setDoc, collection,
  query, where, orderBy, onSnapshot, updateDoc
} from "firebase/firestore";

const STAR_COLORS = { 1: "#E24B4A", 2: "#EF9F27", 3: "#EF9F27", 4: "#1D9E75", 5: "#1D9E75" };
const STAR_LABELS = { 1: "Critical", 2: "Poor", 3: "Average", 4: "Good", 5: "Excellent" };

function StarDisplay({ rating }) {
  return (
    <span style={{ color: STAR_COLORS[rating] || "#888", fontSize: 14 }}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
      <span style={{ fontSize: 11, marginLeft: 5, color: STAR_COLORS[rating] }}>
        {STAR_LABELS[rating]}
      </span>
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    posted:  { bg: "#E1F5EE", color: "#085041", label: "✓ Posted" },
    pending: { bg: "#FAEEDA", color: "#633806", label: "⏳ Pending" },
    failed:  { bg: "#FCEBEB", color: "#791F1F", label: "✗ Failed" },
    manual:  { bg: "#E6F1FB", color: "#0C447C", label: "✎ Manual" },
  };
  const c = cfg[status] || cfg.pending;
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.color, fontWeight: 600 }}>
      {c.label}
    </span>
  );
}

export default function ReviewAutoResponder({ listing }) {
  const [connection, setConnection] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [stats, setStats] = useState({ total: 0, posted: 0, avgRating: 0 });
  const [tab, setTab] = useState("reviews"); // reviews | settings

  const vendorId = auth.currentUser?.uid;

  // Load GBP connection status
  useEffect(() => {
    if (!vendorId) return;
    const ref = doc(db, "gbp_connections", vendorId);
    const unsub = onSnapshot(ref, snap => {
      setConnection(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [vendorId]);

  // Load review responses
  useEffect(() => {
    if (!vendorId) return;
    const q = query(
      collection(db, "review_responses"),
      where("vendorId", "==", vendorId),
      orderBy("receivedAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReviews(data);
      // Compute stats
      const posted = data.filter(r => r.status === "posted").length;
      const avg = data.length
        ? (data.reduce((s, r) => s + (r.starRating || 0), 0) / data.length).toFixed(1)
        : 0;
      setStats({ total: data.length, posted, avgRating: avg });
    });
    return unsub;
  }, [vendorId]);

  // Initiate Google OAuth — opens Google consent screen
  function connectGBP() {
    setLoadingConnect(true);
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
      redirect_uri: import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI,
      response_type: "code",
      scope: [
        "https://www.googleapis.com/auth/business.manage",
        "https://www.googleapis.com/auth/plus.business.manage"
      ].join(" "),
      access_type: "offline",
      prompt: "consent",
      state: vendorId, // pass vendorId so callback knows who this is
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // Disconnect GBP
  async function disconnectGBP() {
    if (!confirm("Disconnect Google Business Profile? Auto-responses will stop.")) return;
    await setDoc(doc(db, "gbp_connections", vendorId), {
      connected: false,
      disconnectedAt: new Date(),
    }, { merge: true });
  }

  // Save manual edit to a response
  async function saveEdit(reviewId) {
    setSavingEdit(true);
    await updateDoc(doc(db, "review_responses", reviewId), {
      aiResponse: editText,
      status: "manual",
      editedAt: new Date(),
    });
    setSavingEdit(false);
    setEditingId(null);
    setEditText("");
  }

  const S = {
    wrap: { fontFamily: "'Inter','Segoe UI',Arial,sans-serif", color: "#1A1A2E" },
    card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 20, padding: "1.25rem", marginBottom: "1rem" },
    heading: { fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 4 },
    sub: { fontSize: 13, color: "#6B7280", marginBottom: "1.25rem" },
    metricGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: "1.25rem" },
    metric: { background: "#F9FAFB", borderRadius: 16, padding: "1rem", textAlign: "center", border: "1px solid #E5E7EB" },
    mv: { fontSize: 26, fontWeight: 700, color: "#111" },
    ml: { fontSize: 12, color: "#6B7280", marginTop: 3 },
    btn: (color) => ({
      background: color || "#111", border: "none", borderRadius: 14,
      padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer"
    }),
    outlineBtn: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: "#374151" },
    tabBar: { display: "flex", gap: 4, marginBottom: "1.25rem", borderBottom: "1px solid #E5E7EB", paddingBottom: 0 },
    tab: (active) => ({
      padding: "8px 16px", border: "none", background: "none", fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? "#1D9E75" : "#6B7280", cursor: "pointer",
      borderBottom: active ? "2px solid #1D9E75" : "2px solid transparent", marginBottom: -1
    }),
    reviewCard: { border: "1px solid #E5E7EB", borderRadius: 16, padding: "1rem", marginBottom: "0.75rem", background: "#FAFAFA" },
    label: { fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 },
    responseBox: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "10px 12px", fontSize: 13, color: "#374151", lineHeight: 1.65 },
    textarea: { width: "100%", minHeight: 90, border: "1px solid #1D9E75", borderRadius: 14, padding: "10px 12px", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  };

  return (
    <div style={S.wrap}>

      {/* Header */}
      <div style={{ ...S.card, borderLeft: "3px solid #1D9E75" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={S.heading}>⭐ Auto Review Responder</div>
            <div style={S.sub}>
              AI automatically responds to every Google review for <strong>{listing?.name || "your business"}</strong> — instantly, 24/7.
            </div>
          </div>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#E1F5EE", color: "#085041", fontWeight: 600 }}>
            ✦ Premium Feature
          </span>
        </div>

        {/* Connect / Connected state */}
        {!connection?.connected ? (
          <div style={{ background: "#F9FAFB", borderRadius: 16, padding: "1.25rem", textAlign: "center", border: "1px dashed #D1D5DB" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔗</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 6 }}>Connect your Google Business Profile</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16, maxWidth: 380, margin: "0 auto 16px" }}>
              Grant Stall App permission to read your reviews and post responses on your behalf. You can disconnect anytime.
            </div>
            <button onClick={connectGBP} disabled={loadingConnect} style={S.btn("#1D9E75")}>
              {loadingConnect ? "Redirecting to Google..." : "🔑 Connect Google Business Profile"}
            </button>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 10 }}>
              You'll be redirected to Google to approve access. We only request permission to read reviews and post responses.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#E1F5EE", borderRadius: 16, padding: "12px 16px" }}>
            <div style={{ fontSize: 24 }}>✅</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#085041" }}>Connected to Google Business Profile</div>
              <div style={{ fontSize: 11, color: "#4B7C6A" }}>
                Location: {connection.locationName || "Verified"} · Connected {connection.connectedAt?.toDate?.()?.toLocaleDateString("en-IN") || "recently"}
              </div>
            </div>
            <button onClick={disconnectGBP} style={{ ...S.outlineBtn, fontSize: 11, color: "#E24B4A", borderColor: "#E24B4A" }}>
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {reviews.length > 0 && (
        <div style={S.metricGrid}>
          <div style={S.metric}>
            <div style={S.mv}>{stats.total}</div>
            <div style={S.ml}>Reviews received</div>
          </div>
          <div style={S.metric}>
            <div style={{ ...S.mv, color: "#1D9E75" }}>{stats.posted}</div>
            <div style={S.ml}>Auto-responded</div>
          </div>
          <div style={S.metric}>
            <div style={{ ...S.mv, color: stats.avgRating >= 4 ? "#1D9E75" : stats.avgRating >= 3 ? "#EF9F27" : "#E24B4A" }}>
              {stats.avgRating}★
            </div>
            <div style={S.ml}>Avg rating</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={S.tabBar}>
        <button style={S.tab(tab === "reviews")} onClick={() => setTab("reviews")}>Reviews & Responses</button>
        <button style={S.tab(tab === "settings")} onClick={() => setTab("settings")}>Response Settings</button>
      </div>

      {/* TAB: Reviews */}
      {tab === "reviews" && (
        <div>
          {reviews.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: "2rem", color: "#9CA3AF" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 4 }}>No reviews yet</div>
              <div style={{ fontSize: 12 }}>
                {connection?.connected
                  ? "We'll check for new reviews every 30 minutes and respond automatically."
                  : "Connect your Google Business Profile above to start."}
              </div>
            </div>
          ) : (
            reviews.map(review => (
              <div key={review.id} style={S.reviewCard}>
                {/* Review header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{review.reviewerName || "Anonymous"}</div>
                    <div style={{ marginTop: 3 }}><StarDisplay rating={review.starRating} /></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusBadge status={review.status} />
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {review.receivedAt?.toDate?.()?.toLocaleDateString("en-IN") || ""}
                    </span>
                  </div>
                </div>

                {/* Review text */}
                <div style={{ marginBottom: 12 }}>
                  <div style={S.label}>Customer review</div>
                  <div style={{ ...S.responseBox, background: "#F9FAFB", fontStyle: review.reviewText ? "normal" : "italic", color: review.reviewText ? "#374151" : "#9CA3AF" }}>
                    {review.reviewText || "(No text — star rating only)"}
                  </div>
                </div>

                {/* AI Response */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={S.label}>
                      {review.status === "manual" ? "✎ Manually edited response" : "🤖 AI generated response"}
                    </div>
                    {editingId !== review.id && (
                      <button
                        onClick={() => { setEditingId(review.id); setEditText(review.aiResponse || ""); }}
                        style={{ ...S.outlineBtn, fontSize: 11, padding: "4px 10px" }}>
                        Edit
                      </button>
                    )}
                  </div>

                  {editingId === review.id ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        style={S.textarea}
                        placeholder="Edit the response..."
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => saveEdit(review.id)} disabled={savingEdit} style={S.btn("#1D9E75")}>
                          {savingEdit ? "Saving..." : "Save & Update"}
                        </button>
                        <button onClick={() => setEditingId(null)} style={S.outlineBtn}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={S.responseBox}>{review.aiResponse || "Generating response..."}</div>
                  )}
                </div>

                {/* Posted timestamp */}
                {review.postedAt && (
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
                    Posted to Google: {review.postedAt?.toDate?.()?.toLocaleString("en-IN")}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: Settings */}
      {tab === "settings" && (
        <ResponseSettings vendorId={vendorId} listing={listing} />
      )}
    </div>
  );
}

// Settings panel — tone, language, custom instructions
function ResponseSettings({ vendorId, listing }) {
  const [settings, setSettings] = useState({
    tone: "friendly",
    language: "english",
    signOff: "",
    customInstructions: "",
    replyTo1Star: true,
    replyTo2Star: true,
    replyTo3Star: true,
    replyTo4Star: true,
    replyTo5Star: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!vendorId) return;
    getDoc(doc(db, "gbp_connections", vendorId)).then(snap => {
      if (snap.exists() && snap.data().responseSettings) {
        setSettings(s => ({ ...s, ...snap.data().responseSettings }));
      }
    });
  }, [vendorId]);

  async function saveSettings() {
    setSaving(true);
    await updateDoc(doc(db, "gbp_connections", vendorId), {
      responseSettings: settings,
      settingsUpdatedAt: new Date(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const S2 = {
    label: { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block" },
    select: { width: "100%", border: "1px solid #E5E7EB", borderRadius: 14, padding: "9px 12px", fontSize: 13, background: "#fff", outline: "none", marginBottom: 14 },
    input: { width: "100%", border: "1px solid #E5E7EB", borderRadius: 14, padding: "9px 12px", fontSize: 13, outline: "none", marginBottom: 14, boxSizing: "border-box" },
    textarea: { width: "100%", minHeight: 80, border: "1px solid #E5E7EB", borderRadius: 14, padding: "10px 12px", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 },
    checkRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "#374151" },
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 20, padding: "1.25rem" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: "1rem" }}>Response Settings</div>

      <label style={S2.label}>Response Tone</label>
      <select value={settings.tone} onChange={e => setSettings(s => ({ ...s, tone: e.target.value }))} style={S2.select}>
        <option value="friendly">Friendly & Warm</option>
        <option value="professional">Professional & Formal</option>
        <option value="casual">Casual & Conversational</option>
        <option value="grateful">Grateful & Appreciative</option>
      </select>

      <label style={S2.label}>Response Language</label>
      <select value={settings.language} onChange={e => setSettings(s => ({ ...s, language: e.target.value }))} style={S2.select}>
        <option value="english">English</option>
        <option value="hindi">Hindi</option>
        <option value="kannada">Kannada</option>
        <option value="tamil">Tamil</option>
        <option value="telugu">Telugu</option>
      </select>

      <label style={S2.label}>Sign-off name (optional)</label>
      <input
        value={settings.signOff}
        onChange={e => setSettings(s => ({ ...s, signOff: e.target.value }))}
        placeholder={`e.g. The ${listing?.name || "Stall"} Team`}
        style={S2.input}
      />

      <label style={S2.label}>Custom instructions (optional)</label>
      <textarea
        value={settings.customInstructions}
        onChange={e => setSettings(s => ({ ...s, customInstructions: e.target.value }))}
        placeholder="e.g. Always mention our weekend specials. Never mention competitor names. Keep responses under 100 words."
        style={S2.textarea}
      />

      <label style={S2.label}>Auto-respond to these star ratings</label>
      {[5, 4, 3, 2, 1].map(star => (
        <div key={star} style={S2.checkRow}>
          <input
            type="checkbox"
            id={`star-${star}`}
            checked={settings[`replyTo${star}Star`]}
            onChange={e => setSettings(s => ({ ...s, [`replyTo${star}Star`]: e.target.checked }))}
          />
          <label htmlFor={`star-${star}`}>
            <span style={{ color: STAR_COLORS[star] }}>{"★".repeat(star)}{"☆".repeat(5 - star)}</span>
            <span style={{ marginLeft: 6, color: "#6B7280" }}>{STAR_LABELS[star]} reviews</span>
          </label>
        </div>
      ))}

      <button onClick={saveSettings} disabled={saving} style={{ marginTop: 16, background: saving || saved ? "#1D9E75" : "#111", border: "none", borderRadius: 14, padding: "10px 24px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Settings"}
      </button>

      <div style={{ marginTop: "1.25rem", padding: "12px 14px", background: "#F9FAFB", borderRadius: 14, fontSize: 12, color: "#6B7280", lineHeight: 1.65 }}>
        <strong style={{ color: "#374151" }}>How AI generates responses:</strong><br />
        Uses your business name (<strong>{listing?.name}</strong>), category (<strong>{listing?.category}</strong>), and the settings above. 5★ reviews get warm thank-you responses. 3★ gets acknowledgment + improvement commitment. 1–2★ gets empathetic resolution-focused responses. All personalised with the reviewer's name.
      </div>
    </div>
  );
}
