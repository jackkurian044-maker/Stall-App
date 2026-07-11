import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Plus, Trash2, RefreshCw, Star } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, CATEGORY_COLORS, COLORS } from "./constants";
import { uid } from "./geo";
import LocationSearch from "./LocationSearch";
import { loadGoogleMaps } from "./googleMaps";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

const emptyForm = {
  name: "", category: CATEGORIES[0], description: "", products: "",
  address: "", phone: "", lat: "", lng: "", website: null, mapsUrl: null, placeId: null,
  rating: null, ratingsCount: null,
};

export default function AdminDashboard() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastCode, setLastCode] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);

  const refreshRating = async (v) => {
    if (!v.placeId || !GOOGLE_API_KEY) return;
    setRefreshingId(v.id);
    try {
      await loadGoogleMaps(GOOGLE_API_KEY);
      const service = new window.google.maps.places.PlacesService(document.createElement("div"));
      service.getDetails({ placeId: v.placeId, fields: ["rating", "user_ratings_total", "formatted_phone_number"] }, async (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          await updateDoc(doc(db, "vendors", v.id), {
            rating: typeof place.rating === "number" ? place.rating : null,
            ratingsCount: typeof place.user_ratings_total === "number" ? place.user_ratings_total : null,
            ...(place.formatted_phone_number ? { phone: place.formatted_phone_number } : {}),
          });
        }
        setRefreshingId(null);
      });
    } catch {
      setRefreshingId(null);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vendors"), (snap) => {
      setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

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

  const startEdit = (v) => {
    setEditingId(v.id);
    setLastCode(null);
    setError("");
    setForm({
      name: v.name, category: v.category, description: v.description || "",
      products: v.products || "", address: v.address || "", phone: v.phone || "",
      lat: String(v.lat), lng: String(v.lng),
      website: v.website || null, mapsUrl: v.mapsUrl || null, placeId: v.placeId || null,
      rating: v.rating ?? null, ratingsCount: v.ratingsCount ?? null,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
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
      };
      if (editingId) {
        await updateDoc(doc(db, "vendors", editingId), payload);
        setEditingId(null);
        setForm(emptyForm);
      } else {
        const code = uid(6);
        await addDoc(collection(db, "vendors"), {
          ...payload, ownerId: null, claimCode: code, createdAt: serverTimestamp(),
        });
        setLastCode({ name: form.name.trim(), code });
        setForm(emptyForm);
      }
    } catch (err) {
      setError(editingId ? "Couldn't save changes — please try again." : "Couldn't save — make sure your admin doc exists in Firestore.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await deleteDoc(doc(db, "vendors", id));
    if (editingId === id) cancelEdit();
  };

  return (
    <div className="stall-grid">
      <div className="stall-panel" style={{ padding: 18, alignSelf: "start" }}>
        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>
          {editingId ? "Edit listing" : "Add a vendor on their behalf"}
        </div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
          {editingId
            ? "Changes are live immediately for anyone searching nearby."
            : "You'll get a claim code afterward — share it with the vendor so they can take over editing."}
        </div>
        <form onSubmit={submit}>
          {field("Name", <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />)}
          {field("Category", (
            <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          ))}
          {field("Description", <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />)}
          {field("Products (comma separated)", <input style={inputStyle} value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })} />)}
          {field("Phone (optional)", <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />)}
          <LocationSearch
            address={form.address}
            lat={form.lat}
            lng={form.lng}
            website={form.website}
            mapsUrl={form.mapsUrl}
            placeId={form.placeId}
            rating={form.rating}
            ratingsCount={form.ratingsCount}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />

          {error && <div style={{ color: COLORS.brick, fontSize: 12, marginBottom: 10 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={saving} className="stall-btn" style={{ flex: 1, background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "10px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={15} /> {saving ? "Saving…" : editingId ? "Save changes" : "Add vendor"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "10px 14px", fontSize: 13 }}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {lastCode && (
          <div style={{ marginTop: 14, background: `${COLORS.marigold}22`, border: `1.5px solid ${COLORS.marigold}`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Claim code for "{lastCode.name}"</div>
            <div className="font-mono" style={{ fontSize: 18, letterSpacing: "0.1em" }}>{lastCode.code}</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
              Give this to the vendor — they enter it under "Claim a listing" in My Listings.
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>All listings</div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>{vendors.length} total</div>

        {loading ? (
          <div style={{ fontSize: 13, color: "#666" }}>Loading…</div>
        ) : vendors.length === 0 ? (
          <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: 30, textAlign: "center", color: "#666", fontSize: 13 }}>
            No vendors yet.
          </div>
        ) : (
          <div style={{ border: `2px solid ${COLORS.ink}`, borderRadius: 12, overflow: "hidden" }}>
            {vendors.map((v, i) => (
              <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: editingId === v.id ? `${COLORS.marigold}18` : "#fff" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{v.name}</span>
                    <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#fff", background: CATEGORY_COLORS[v.category] || COLORS.ink, padding: "2px 7px", borderRadius: 999 }}>
                      {v.category}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: v.ownerId ? COLORS.teal : COLORS.brick }}>
                      {v.ownerId ? "CLAIMED" : "UNCLAIMED"}
                    </span>
                    {v.rating != null && (
                      <span style={{ fontSize: 11, color: "#666", display: "flex", alignItems: "center", gap: 3 }}>
                        <Star size={11} fill={COLORS.marigold} color={COLORS.marigold} />
                        {v.rating.toFixed(1)}{v.ratingsCount != null ? ` (${v.ratingsCount})` : ""}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#777" }}>
                    {v.address} · <span className="font-mono">{v.lat?.toFixed?.(4)}, {v.lng?.toFixed?.(4)}</span>
                    {!v.ownerId && v.claimCode && <> · code <span className="font-mono">{v.claimCode}</span></>}
                  </div>
                  {v.phone && <div style={{ fontSize: 11.5, color: "#777" }}>{v.phone}</div>}
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                  {v.placeId && (
                    <button
                      onClick={() => refreshRating(v)}
                      disabled={refreshingId === v.id}
                      title="Refresh phone & rating from Google"
                      style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.teal, padding: 6 }}
                    >
                      <RefreshCw size={15} className={refreshingId === v.id ? "spin" : ""} />
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(v)}
                    className="stall-btn"
                    style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}
                  >
                    Edit
                  </button>
                  <button onClick={() => remove(v.id)} title="Remove vendor" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.brick, padding: 6 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
