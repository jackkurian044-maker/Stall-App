import React, { useEffect, useRef, useState } from "react";
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  getDocs, serverTimestamp,
} from "firebase/firestore";
import { Plus, Trash2, KeyRound, RefreshCw, Star, Zap } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, COLORS } from "./constants";
import LocationSearch from "./LocationSearch";
import ImageUpload from "./ImageUpload";
import { autoRefreshStale, isRatingStale } from "./ratingSync";
import { uid, toDateInputValue } from "./geo";
import PremiumGate from "./PremiumGate";
import ReviewAutoResponder from "./ReviewAutoResponder";

const emptyForm = {
  name: "", category: CATEGORIES[0], description: "", products: "",
  address: "", phone: "", lat: "", lng: "", website: null, mapsUrl: null, placeId: null,
  rating: null, ratingsCount: null, hours: "", photos: [], preferredLink: null,
  offer: "", offerExpiresAt: "",
};

export default function VendorDashboard({ user }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [claimMsg, setClaimMsg] = useState("");
  const [tempId] = useState(() => uid(10));
  const [dashTab, setDashTab] = useState("listings"); // "listings" | "premium"
  const refreshedRef = useRef(new Set());

  useEffect(() => {
    const q = query(collection(db, "vendors"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user.uid]);

  useEffect(() => {
    autoRefreshStale(listings, refreshedRef.current);
  }, [listings]);

  const inputStyle = {
    width: "100%", padding: "9px 10px", borderRadius: 7,
    border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box",
  };
  const field = (label, node) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>{label}</label>
      {node}
    </div>
  );

  const startEdit = (l) => {
    setEditingId(l.id);
    setForm({
      name: l.name, category: l.category, description: l.description || "",
      products: l.products || "", address: l.address || "", phone: l.phone || "",
      lat: String(l.lat), lng: String(l.lng),
      website: l.website || null, mapsUrl: l.mapsUrl || null, placeId: l.placeId || null,
      rating: l.rating ?? null, ratingsCount: l.ratingsCount ?? null,
      hours: l.hours || "", photos: l.photos || [], preferredLink: l.preferredLink || null,
      offer: l.offer || "", offerExpiresAt: toDateInputValue(l.offerExpiresAt),
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!form.name.trim()) return setError("Name is required.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setError("Please select an address from the suggestions dropdown (or switch to \"enter manually\" and type coordinates).");

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), category: form.category, description: form.description.trim(),
        products: form.products.trim(), address: form.address.trim(), phone: form.phone.trim(),
        lat, lng, website: form.website || null, mapsUrl: form.mapsUrl || null, placeId: form.placeId || null,
        rating: form.rating ?? null, ratingsCount: form.ratingsCount ?? null,
        hours: form.hours.trim(), photos: form.photos || [], preferredLink: form.preferredLink || null,
        offer: form.offer.trim(), offerExpiresAt: form.offerExpiresAt ? new Date(`${form.offerExpiresAt}T23:59:59`) : null,
      };
      if (editingId) {
        await updateDoc(doc(db, "vendors", editingId), payload);
      } else {
        await addDoc(collection(db, "vendors"), {
          ...payload, ownerId: user.uid, claimCode: null, createdAt: serverTimestamp(),
          ratingUpdatedAt: payload.placeId ? serverTimestamp() : null,
        });
      }
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setError("Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await deleteDoc(doc(db, "vendors", id));
    if (editingId === id) { setEditingId(null); setForm(emptyForm); }
  };

  const claim = async (e) => {
    e.preventDefault();
    setClaimMsg("");
    const code = claimCode.trim().toUpperCase();
    if (!code) return;
    try {
      const q = query(collection(db, "vendors"), where("claimCode", "==", code), where("ownerId", "==", null));
      const snap = await getDocs(q);
      if (snap.empty) {
        setClaimMsg("No unclaimed listing matches that code.");
        return;
      }
      const d = snap.docs[0];
      await updateDoc(doc(db, "vendors", d.id), { ownerId: user.uid, claimCode: code });
      setClaimMsg(`Claimed "${d.data().name}" — it now appears below.`);
      setClaimCode("");
    } catch (err) {
      setClaimMsg("Couldn't claim that listing — check the code and try again.");
    }
  };

  return (
    <div className="stall-grid">
      {/* ── LEFT COLUMN — unchanged ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 18 }}>
          <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>
            {editingId ? "Edit listing" : "Create a listing"}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
            This appears live to anyone searching nearby.
          </div>
          <form onSubmit={submit}>
            {field("Name", <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amma's Pickle Stand" />)}
            {field("Category", (
              <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            ))}
            {field("Description", <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What makes this worth the walk?" />)}
            {field("Products (comma separated)", <input style={inputStyle} value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })} placeholder="mango pickle, lime pickle" />)}
            {field("Phone (optional)", <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />)}
            {field("Current offer (optional — e.g. \"20% off today\" or \"Buy 1 get 1, this month\")", (
              <input style={inputStyle} value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="e.g. Festive discount — 15% off all items" />
            ))}
            {form.offer && field("Offer ends on (optional — leave blank to show until you remove it)", (
              <input type="date" style={inputStyle} value={form.offerExpiresAt} onChange={(e) => setForm({ ...form, offerExpiresAt: e.target.value })} />
            ))}
            {form.website && form.mapsUrl && field("When someone taps this listing, open…", (
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { id: "mapsUrl", label: "Google Business profile" },
                  { id: "website", label: "Website" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm({ ...form, preferredLink: opt.id })}
                    className="stall-btn"
                    style={{
                      flex: 1, borderRadius: 7, padding: "8px 10px", fontSize: 12.5, fontWeight: 600,
                      border: `1.5px solid ${COLORS.ink}`,
                      background: (form.preferredLink || "mapsUrl") === opt.id ? COLORS.ink : "#fff",
                      color: (form.preferredLink || "mapsUrl") === opt.id ? "#fff" : COLORS.ink,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ))}
            <LocationSearch
              address={form.address}
              lat={form.lat}
              lng={form.lng}
              website={form.website}
              mapsUrl={form.mapsUrl}
              placeId={form.placeId}
              rating={form.rating}
              ratingsCount={form.ratingsCount}
              onChange={(patch) => setForm((f) => ({
                ...f,
                ...patch,
                hours: f.hours ? f.hours : (patch.hours ?? f.hours),
              }))}
            />
            {field("Hours", <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder={"Auto-filled from Google when available, or type your own, e.g.\nMon–Sat: 9:00 AM – 8:00 PM\nSun: Closed"} />)}
            <ImageUpload
              photos={form.photos}
              pathPrefix={`vendor-photos/${editingId || tempId}`}
              onChange={(photos) => setForm((f) => ({ ...f, photos }))}
            />
            {error && <div style={{ color: COLORS.brick, fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} className="stall-btn" style={{ flex: 1, background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "10px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Plus size={15} /> {saving ? "Saving…" : editingId ? "Save changes" : "Add listing"}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "10px 14px", fontSize: 13 }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 18 }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <KeyRound size={15} /> Claim a listing
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            If an admin already added your stall, enter the code they gave you to take it over.
          </div>
          <form onSubmit={claim} style={{ display: "flex", gap: 8 }}>
            <input
              className="font-mono"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              placeholder="e.g. 7K3PQR"
              style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${COLORS.ink}`, fontSize: 13 }}
            />
            <button type="submit" className="stall-btn" style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
              Claim
            </button>
          </form>
          {claimMsg && <div style={{ fontSize: 12, color: COLORS.teal, marginTop: 8 }}>{claimMsg}</div>}
        </div>
      </div>

      {/* ── RIGHT COLUMN — with Premium tab ── */}
      <div>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button
            onClick={() => setDashTab("listings")}
            className="stall-btn"
            style={{
              padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
              border: `1.5px solid ${COLORS.ink}`,
              background: dashTab === "listings" ? COLORS.ink : "#fff",
              color: dashTab === "listings" ? "#fff" : COLORS.ink,
              cursor: "pointer",
            }}
          >
            My Listings ({listings.length})
          </button>
          <button
            onClick={() => setDashTab("premium")}
            className="stall-btn"
            style={{
              padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
              border: `1.5px solid ${COLORS.ink}`,
              background: dashTab === "premium" ? COLORS.ink : "#fff",
              color: dashTab === "premium" ? "#fff" : COLORS.ink,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Zap size={13} /> Premium
          </button>
        </div>

        {/* ── LISTINGS TAB ── */}
        {dashTab === "listings" && (
          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>{listings.length} total</div>
            {loading ? (
              <div style={{ fontSize: 13, color: "#666" }}>Loading…</div>
            ) : listings.length === 0 ? (
              <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: 30, textAlign: "center", color: "#666", fontSize: 13 }}>
                Nothing yet — create your first listing on the left, or claim one an admin already added.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {listings.map((l) => (
                  <div key={l.id} style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                        {l.name}
                        {l.isPremium && (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: COLORS.ink, color: "#fff", fontWeight: 600 }}>
                            ✦ Premium
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#777" }}>{l.category} · {l.address}</div>
                      {l.phone && <div style={{ fontSize: 11.5, color: "#777" }}>{l.phone}</div>}
                      {l.rating != null && (
                        <div style={{ fontSize: 11.5, color: "#666", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                          <Star size={11} fill={COLORS.marigold} color={COLORS.marigold} />
                          {l.rating.toFixed(1)}{l.ratingsCount != null ? ` (${l.ratingsCount})` : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "flex-start" }}>
                      {l.placeId && isRatingStale(l) && (
                        <span title="Rating/phone will sync from Google automatically" style={{ color: "#bbb", padding: 6, display: "flex" }}>
                          <RefreshCw size={13} />
                        </span>
                      )}
                      <button onClick={() => startEdit(l)} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 600 }}>
                        Edit
                      </button>
                      <button onClick={() => remove(l.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.brick, padding: 6 }} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PREMIUM TAB ── */}
        {dashTab === "premium" && (
          <div>
            <PremiumGate user={user} listing={listings[0]} />
            <ReviewAutoResponder listing={listings[0]} />
          </div>
        )}
      </div>
    </div>
  );
}
