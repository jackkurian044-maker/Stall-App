import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { doc, getDoc, setDoc, collection, query, where, orderBy, onSnapshot, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const STAR_COLORS = { 1: "#E24B4A", 2: "#EF9F27", 3: "#EF9F27", 4: "#1D9E75", 5: "#1D9E75" };
const STAR_LABELS = { 1: "Critical", 2: "Poor", 3: "Average", 4: "Good", 5: "Excellent" };

function StarDisplay({ rating }) {
  const n = Number(rating) || 0;
  return <span style={{ color: STAR_COLORS[n] || "#888", fontSize: 14 }}>{"★".repeat(n)}{"☆".repeat(Math.max(0, 5 - n))}<span style={{ fontSize: 11, marginLeft: 5, color: STAR_COLORS[n] || "#888" }}>{STAR_LABELS[n] || ""}</span></span>;
}
function StatusBadge({ status }) {
  const cfg = {
    posted: { bg: "#E1F5EE", color: "#085041", label: "✓ Posted" },
    pending: { bg: "#FAEEDA", color: "#633806", label: "⏳ Pending" },
    processing: { bg: "#E6F1FB", color: "#0C447C", label: "⚙ Processing" },
    error: { bg: "#FCEBEB", color: "#791F1F", label: "✗ Failed" },
    failed: { bg: "#FCEBEB", color: "#791F1F", label: "✗ Failed" },
    manual: { bg: "#E6F1FB", color: "#0C447C", label: "✎ Manual" },
  };
  const c = cfg[status] || cfg.pending;
  return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.color, fontWeight: 600 }}>{c.label}</span>;
}

export default function ReviewAutoResponder({ listing }) {
  const [connection, setConnection] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [syncingReviews, setSyncingReviews] = useState(false);
  const [reworkingLatest, setReworkingLatest] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [showSteps, setShowSteps] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [stats, setStats] = useState({ posted: 0 });
  const [tab, setTab] = useState("reviews");
  const vendorId = auth.currentUser?.uid;

  useEffect(() => {
    if (!vendorId) return;
    return onSnapshot(doc(db, "gbp_connections", vendorId), snap => setConnection(snap.exists() ? snap.data() : null));
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    const q = query(collection(db, "review_responses"), where("vendorId", "==", vendorId), orderBy("receivedAt", "desc"));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const queue = all.filter(r => r.status !== "posted" && r.status !== "manual");
      const recent = all.filter(r => r.status === "posted" || r.status === "manual").slice(0, 5);
      setReviews(queue);
      setRecentReviews(recent);
      setStats({ posted: all.filter(r => r.status === "posted").length });
    });
  }, [vendorId]);

  async function connectGBP() {
    setLoadingConnect(true);
    try {
      const beginGbpOauth = httpsCallable(getFunctions(), "beginGbpOauth");
      const { data } = await beginGbpOauth();
      const params = new URLSearchParams({ client_id: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID, redirect_uri: import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI, response_type: "code", scope: "https://www.googleapis.com/auth/business.manage", access_type: "offline", prompt: "consent", state: data.state });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } catch (err) { console.error("Failed to start GBP connection:", err); setLoadingConnect(false); }
  }

  async function syncReviewsNow() {
    if (!connection?.connected || syncingReviews || reworkingLatest) return;
    setSyncingReviews(true); setSyncMessage("");
    try {
      const { data } = await httpsCallable(getFunctions(), "triggerPollForVendor")();
      setSyncMessage(data?.message || `Google returned ${data?.reviewCount || 0} reviews.`);
    } catch (err) { console.error("Manual review sync failed:", err); setSyncMessage(err?.message || "Review sync failed."); }
    finally { setSyncingReviews(false); }
  }

  async function reworkLatestResponse() {
    if (!connection?.connected || syncingReviews || reworkingLatest) return;
    setReworkingLatest(true); setSyncMessage("");
    try {
      const { data } = await httpsCallable(getFunctions(), "triggerPollForVendor")({ reworkLatest: true });
      setSyncMessage(data?.message || "Latest response reworked and updated on Google.");
    } catch (err) { console.error("Latest review rework failed:", err); setSyncMessage(err?.message || "Could not rework the latest response."); }
    finally { setReworkingLatest(false); }
  }

  async function disconnectGBP() {
    if (!confirm("Disconnect Google Business Profile? Auto-responses will stop.")) return;
    await setDoc(doc(db, "gbp_connections", vendorId), { connected: false, disconnectedAt: new Date() }, { merge: true });
  }

  async function saveEdit(reviewId) {
    setSavingEdit(true);
    await updateDoc(doc(db, "review_responses", reviewId), { aiResponse: editText, status: "manual", editedAt: new Date() });
    setSavingEdit(false); setEditingId(null); setEditText("");
  }

  const S = {
    wrap: { fontFamily: "'Inter','Segoe UI',Arial,sans-serif", color: "#1A1A2E" },
    card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "1.25rem", marginBottom: "1rem" },
    heading: { fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 4 }, sub: { fontSize: 13, color: "#6B7280", marginBottom: "1.25rem" },
    metric: { background: "#F9FAFB", borderRadius: 10, padding: "1rem", textAlign: "center", border: "1px solid #E5E7EB" }, mv: { fontSize: 26, fontWeight: 700, color: "#111" }, ml: { fontSize: 12, color: "#6B7280", marginTop: 3 },
    btn: color => ({ background: color || "#111", border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
    outlineBtn: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: "#374151" },
    tabBar: { display: "flex", gap: 4, marginBottom: "1.25rem", borderBottom: "1px solid #E5E7EB" },
    tab: active => ({ padding: "8px 16px", border: "none", background: "none", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "#1D9E75" : "#6B7280", cursor: "pointer", borderBottom: active ? "2px solid #1D9E75" : "2px solid transparent", marginBottom: -1 }),
    reviewCard: { border: "1px solid #E5E7EB", borderRadius: 10, padding: "1rem", marginBottom: "0.75rem", background: "#FAFAFA" },
    label: { fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 },
    responseBox: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#374151", lineHeight: 1.65 },
    textarea: { width: "100%", minHeight: 90, border: "1px solid #1D9E75", borderRadius: 8, padding: "10px 12px", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  };

  const aggregateCount = Number(connection?.totalReviewCount || 0);
  const aggregateRating = Number(connection?.averageRating || 0);

  function ReviewCard({ review, recent = false }) {
    return <div style={S.reviewCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <div><div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{review.reviewerName || "Anonymous"}</div><div style={{ marginTop: 3 }}><StarDisplay rating={review.starRating} /></div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><StatusBadge status={review.status} /><span style={{ fontSize: 11, color: "#9CA3AF" }}>{review.receivedAt?.toDate?.()?.toLocaleDateString("en-IN") || ""}</span></div>
      </div>
      <div style={{ marginBottom: 12 }}><div style={S.label}>Customer review</div><div style={{ ...S.responseBox, background: "#F9FAFB", fontStyle: review.reviewText ? "normal" : "italic", color: review.reviewText ? "#374151" : "#9CA3AF" }}>{review.reviewText || "(No text — star rating only)"}</div></div>
      <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}><div style={S.label}>{review.status === "manual" ? "✎ Manually edited response" : "🤖 STall response"}</div>{editingId !== review.id && <button onClick={() => { setEditingId(review.id); setEditText(review.aiResponse || ""); }} style={{ ...S.outlineBtn, fontSize: 11, padding: "4px 10px" }}>Edit</button>}</div>
        {editingId === review.id ? <div><textarea value={editText} onChange={e => setEditText(e.target.value)} style={S.textarea} placeholder="Edit the response..."/><div style={{ display: "flex", gap: 8, marginTop: 8 }}><button onClick={() => saveEdit(review.id)} disabled={savingEdit} style={S.btn("#1D9E75")}>{savingEdit ? "Saving..." : "Save & Update"}</button><button onClick={() => setEditingId(null)} style={S.outlineBtn}>Cancel</button></div></div> : <div style={S.responseBox}>{review.aiResponse || "No response recorded"}</div>}
      </div>
      {review.postedAt && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>Posted to Google: {review.postedAt?.toDate?.()?.toLocaleString("en-IN")}</div>}
    </div>;
  }

  return <div style={S.wrap}>
    <div style={{ ...S.card, borderLeft: "3px solid #1D9E75" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div><div style={S.heading}>⭐ Auto Review Responder</div><div style={S.sub}>AI automatically responds to Google reviews for <strong>{listing?.name || "your business"}</strong> — instantly, 24/7.</div></div>
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#E1F5EE", color: "#085041", fontWeight: 600 }}>✦ Premium Feature</span>
      </div>
      {!connection?.connected ? <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "1.25rem", textAlign: "center", border: "1px dashed #D1D5DB" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🔗</div><div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 6 }}>Let Stall reply to your Google reviews automatically</div>
        <button onClick={connectGBP} disabled={loadingConnect} style={S.btn("#1D9E75")}>{loadingConnect ? "Redirecting to Google..." : "🔑 Connect with Google"}</button>
        <div style={{ marginTop: 12 }}><button onClick={() => setShowSteps(s => !s)} style={{ background: "none", border: "none", color: "#1D9E75", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{showSteps ? "Hide what happens ▲" : "See what happens, step by step ▼"}</button></div>
        {showSteps && <div style={{ textAlign: "left", maxWidth: 500, margin: "12px auto 0", fontSize: 12, color: "#374151", lineHeight: 1.6 }}>Google handles sign-in and consent. Stall receives permission to read reviews and post replies; your Google password never passes through Stall.</div>}
      </div> : <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#E1F5EE", borderRadius: 10, padding: "12px 16px", flexWrap: "wrap" }}>
        <div style={{ fontSize: 24 }}>✅</div><div style={{ flex: 1, minWidth: 180 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#085041" }}>Connected to Google Business Profile</div><div style={{ fontSize: 11, color: "#4B7C6A" }}>Location: {connection.locationName || "Verified"} · Connected {connection.connectedAt?.toDate?.()?.toLocaleDateString("en-IN") || "recently"}</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><button onClick={syncReviewsNow} disabled={syncingReviews || reworkingLatest} style={{ ...S.btn("#1D9E75"), padding: "8px 14px", fontSize: 11 }}>{syncingReviews ? "Syncing..." : "↻ Sync Reviews Now"}</button><button onClick={reworkLatestResponse} disabled={syncingReviews || reworkingLatest} style={{ ...S.btn("#111"), padding: "8px 14px", fontSize: 11 }}>{reworkingLatest ? "Reworking..." : "↻ Recheck & Rework Latest"}</button><button onClick={disconnectGBP} style={{ ...S.outlineBtn, fontSize: 11, color: "#E24B4A", borderColor: "#E24B4A" }}>Disconnect</button></div>
      </div>}
      {syncMessage && <div style={{ marginTop: 8, fontSize: 12, color: "#4B5563", background: "#F9FAFB", borderRadius: 8, padding: "8px 12px" }}>{syncMessage}</div>}
    </div>

    {connection?.connected && <div className="stall-metric-grid">
      <div style={S.metric}><div style={S.mv}>{aggregateCount || "—"}</div><div style={S.ml}>Total Google reviews</div></div>
      <div style={S.metric}><div style={{ ...S.mv, color: "#1D9E75" }}>{stats.posted}</div><div style={S.ml}>Auto-responded by Stall</div></div>
      <div style={S.metric}><div style={{ ...S.mv, color: aggregateRating >= 4 ? "#1D9E75" : aggregateRating >= 3 ? "#EF9F27" : "#E24B4A" }}>{aggregateRating ? `${aggregateRating.toFixed(1)}★` : "—"}</div><div style={S.ml}>Google average rating</div></div>
    </div>}

    <div style={S.tabBar}><button style={S.tab(tab === "reviews")} onClick={() => setTab("reviews")}>Reviews & Responses</button><button style={S.tab(tab === "settings")} onClick={() => setTab("settings")}>Response Settings</button></div>

    {tab === "reviews" && <div>
      {reviews.length > 0 && <div style={{ ...S.card, marginBottom: "1rem" }}><div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4 }}>New Reviews & Responses</div><div style={{ fontSize: 12, color: "#6B7280" }}>Only unanswered reviews appear here. Once Stall responds, they move into the Recent 5 history below.</div></div>}
      {reviews.length === 0 ? <div style={{ ...S.card, textAlign: "center", padding: "2rem", color: "#9CA3AF" }}><div style={{ fontSize: 28, marginBottom: 8 }}>✅</div><div style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 4 }}>No unanswered reviews</div><div style={{ fontSize: 12 }}>{connection?.connected ? "You're up to date. Stall checks the newest Google reviews every 30 minutes." : "Connect your Google Business Profile above to start."}</div></div> : reviews.map(review => <ReviewCard key={review.id} review={review} />)}

      {recentReviews.length > 0 && <div style={{ ...S.card, marginTop: "1.25rem" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 4 }}>Recent 5 Reviews</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14 }}>Latest reviews already responded to by Stall. This confirms the Google → Stall → response pipeline is working.</div>
        {recentReviews.map(review => <ReviewCard key={review.id} review={review} recent />)}
      </div>}
    </div>}

    {tab === "settings" && <ResponseSettings vendorId={vendorId} listing={listing} />}
  </div>;
}

function ResponseSettings({ vendorId, listing }) {
  const [settings, setSettings] = useState({ autoReply: true, seoOptimization: true, tone: "friendly", language: "english", signOff: "", customInstructions: "", responseLength: "standard", serviceKeywords: [], locationKeywords: [], replyTo1Star: true, replyTo2Star: true, replyTo3Star: true, replyTo4Star: true, replyTo5Star: true });
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  useEffect(() => { if (!vendorId) return; getDoc(doc(db, "gbp_connections", vendorId)).then(snap => { if (snap.exists() && snap.data().responseSettings) setSettings(s => ({ ...s, ...snap.data().responseSettings })); }); }, [vendorId]);
  async function saveSettings() { setSaving(true); try { await updateDoc(doc(db, "gbp_connections", vendorId), { responseSettings: settings, settingsUpdatedAt: new Date() }); setSaved(true); setTimeout(() => setSaved(false), 2000); } finally { setSaving(false); } }
  const field = { width: "100%", border: "1px solid #E5E7EB", borderRadius: 8, padding: "9px 12px", fontSize: 13, background: "#fff", marginBottom: 14, boxSizing: "border-box" };
  return <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "1.25rem" }}>
    <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: "1rem" }}>Response Settings</div>
    <label style={{ fontSize: 12, fontWeight: 600 }}>Automatic Replies</label><div style={{ margin: "6px 0 14px" }}><label style={{ fontSize: 13 }}><input type="checkbox" checked={settings.autoReply} onChange={e => setSettings(s => ({ ...s, autoReply: e.target.checked }))}/> Enable automatic replies</label></div>
    <label style={{ fontSize: 12, fontWeight: 600 }}>SEO Optimization</label><div style={{ margin: "6px 0 14px" }}><label style={{ fontSize: 13 }}><input type="checkbox" checked={settings.seoOptimization} onChange={e => setSettings(s => ({ ...s, seoOptimization: e.target.checked }))}/> Naturally optimize responses for local search</label></div>
    <label style={{ fontSize: 12, fontWeight: 600 }}>Response Tone</label><select value={settings.tone} onChange={e => setSettings(s => ({ ...s, tone: e.target.value }))} style={field}><option value="friendly">Friendly & Warm</option><option value="professional">Professional & Formal</option><option value="casual">Casual & Conversational</option><option value="grateful">Grateful & Appreciative</option></select>
    <label style={{ fontSize: 12, fontWeight: 600 }}>Response Language</label><select value={settings.language} onChange={e => setSettings(s => ({ ...s, language: e.target.value }))} style={field}><option value="english">English</option><option value="hindi">Hindi</option><option value="kannada">Kannada</option><option value="tamil">Tamil</option><option value="telugu">Telugu</option></select>
    <label style={{ fontSize: 12, fontWeight: 600 }}>Response Length</label><select value={settings.responseLength} onChange={e => setSettings(s => ({ ...s, responseLength: e.target.value }))} style={field}><option value="short">Short</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select>
    <label style={{ fontSize: 12, fontWeight: 600 }}>Service keywords (comma separated)</label><input value={settings.serviceKeywords.join(", ")} onChange={e => setSettings(s => ({ ...s, serviceKeywords: e.target.value.split(",").map(x => x.trim()).filter(Boolean) }))} placeholder="Haircut, Hair Styling, Hair Colour" style={field}/>
    <label style={{ fontSize: 12, fontWeight: 600 }}>Location keywords (comma separated)</label><input value={settings.locationKeywords.join(", ")} onChange={e => setSettings(s => ({ ...s, locationKeywords: e.target.value.split(",").map(x => x.trim()).filter(Boolean) }))} placeholder="Bengaluru, Domlur" style={field}/>
    <label style={{ fontSize: 12, fontWeight: 600 }}>Sign-off name (optional)</label><input value={settings.signOff} onChange={e => setSettings(s => ({ ...s, signOff: e.target.value }))} placeholder={`e.g. The ${listing?.name || "Stall"} Team`} style={field}/>
    <label style={{ fontSize: 12, fontWeight: 600 }}>Custom instructions (optional)</label><textarea value={settings.customInstructions} onChange={e => setSettings(s => ({ ...s, customInstructions: e.target.value }))} placeholder="Keep responses genuine. Never mention competitor names." style={{ ...field, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}/>
    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Auto-respond to these star ratings</div>
    {[5, 4, 3, 2, 1].map(star => <label key={star} style={{ display: "block", marginBottom: 8, fontSize: 13 }}><input type="checkbox" checked={settings[`replyTo${star}Star`]} onChange={e => setSettings(s => ({ ...s, [`replyTo${star}Star`]: e.target.checked }))}/> <span style={{ color: STAR_COLORS[star] }}>{"★".repeat(star)}{"☆".repeat(5 - star)}</span><span style={{ marginLeft: 6, color: "#6B7280" }}>{STAR_LABELS[star]} reviews</span></label>)}
    <button onClick={saveSettings} disabled={saving} style={{ marginTop: 10, background: saved ? "#1D9E75" : "#111", border: "none", borderRadius: 8, padding: "10px 24px", color: "#fff", fontSize: 13, fontWeight: 600 }}>{saved ? "✓ Saved!" : saving ? "Saving..." : "Save Settings"}</button>
    <div style={{ marginTop: "1.25rem", padding: "12px 14px", background: "#F9FAFB", borderRadius: 8, fontSize: 12, color: "#6B7280", lineHeight: 1.65 }}><strong style={{ color: "#374151" }}>How AI generates responses:</strong><br/>Uses your business name (<strong>{listing?.name}</strong>), category (<strong>{listing?.category}</strong>), settings, the customer's rating and actual review text. Replies remain natural and avoid keyword stuffing.</div>
  </div>;
}
