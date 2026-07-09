import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Plus, Trash2 } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, CATEGORY_COLORS, COLORS } from "./constants";
import { uid } from "./geo";
import LocationSearch from "./LocationSearch";

const emptyForm = {
  name: "", category: CATEGORIES[0], description: "", products: "",
  address: "", phone: "", lat: "", lng: "",
};

export default function AdminDashboard() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastCode, setLastCode] = useState(null);

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

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!form.name.trim()) return setError("Name is required.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setError("Please select an address from the suggestions dropdown (or switch to \"enter manually\" and type coordinates).");

    setSaving(true);
    const code = uid(6);
    try {
      await addDoc(collection(db, "vendors"), {
        name: form.name.trim(), category: form.category, description: form.description.trim(),
        products: form.products.trim(), address: form.address.trim(), phone: form.phone.trim(),
        lat, lng, ownerId: null, claimCode: code, createdAt: serverTimestamp(),
      });
      setLastCode({ name: form.name.trim(), code });
      setForm(emptyForm);
    } catch (err) {
      setError("Couldn't save — make sure your admin doc exists in Firestore.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await deleteDoc(doc(db, "vendors", id));
  };

  return (
    <div className="stall-grid">
      <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 18, alignSelf: "start" }}>
        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Add a vendor on their behalf</div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
          You'll get a claim code afterward — share it with the vendor so they can take over editing.
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
            onChange={({ address, lat, lng }) => setForm((f) => ({ ...f, address, lat, lng }))}
          />

          {error && <div style={{ color: COLORS.brick, fontSize: 12, marginBottom: 10 }}>{error}</div>}

          <button type="submit" disabled={saving} className="stall-btn" style={{ width: "100%", background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "10px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={15} /> {saving ? "Adding…" : "Add vendor"}
          </button>
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
              <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: "#fff" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{v.name}</span>
                    <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#fff", background: CATEGORY_COLORS[v.category] || COLORS.ink, padding: "2px 7px", borderRadius: 999 }}>
                      {v.category}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: v.ownerId ? COLORS.teal : COLORS.brick }}>
                      {v.ownerId ? "CLAIMED" : "UNCLAIMED"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#777" }}>
                    {v.address} · <span className="font-mono">{v.lat?.toFixed?.(4)}, {v.lng?.toFixed?.(4)}</span>
                    {!v.ownerId && v.claimCode && <> · code <span className="font-mono">{v.claimCode}</span></>}
                  </div>
                </div>
                <button onClick={() => remove(v.id)} title="Remove vendor" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.brick, padding: 6, flexShrink: 0 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
