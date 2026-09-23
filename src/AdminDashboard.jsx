import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, setDoc, deleteDoc, doc, serverTimestamp, query, where } from "firebase/firestore";
import { Plus, Trash2, RefreshCw, Star, Flag, Check, X as XIcon, Sparkles, Crown, Users } from "lucide-react";
import { db, auth } from "./firebase";
import { CATEGORIES, CATEGORY_COLORS, COLORS } from "./constants";
import { uid, toDateInputValue } from "./geo";
import { encodeGeohash } from "./geohash";
import { autoRefreshStale, isRatingStale, refreshVendorIfStale } from "./ratingSync";
import LocationSearch from "./LocationSearch";
import ImageUpload from "./ImageUpload";
import { findDuplicateVendor } from "./duplicateCheck";
import { resolveReport } from "./reports";
import { SalonBusinessPage } from "./BusinessTemplatePages";

const emptyForm = {
  name: "", category: CATEGORIES[0], description: "", products: "",
  address: "", phone: "", lat: "", lng: "", website: null, mapsUrl: null, placeId: null,
  rating: null, ratingsCount: null, hours: "", photos: [], preferredLink: null,
  offer: "", offerExpiresAt: "",
};

const COMMISSION_LABEL = { pending: "pending", paid: "paid", clawed_back: "clawed back" };
const COMMISSION_COLOR = { pending: COLORS.goldDark, paid: COLORS.green, clawed_back: COLORS.brick };
const COMMISSION_BG = { pending: `${COLORS.marigold}22`, paid: `${COLORS.green}22`, clawed_back: `${COLORS.brick}22` };

export default function AdminDashboard() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastCode, setLastCode] = useState(null);
  const [ownerMessageStatus, setOwnerMessageStatus] = useState("");
  const [phoneSyncingId, setPhoneSyncingId] = useState(null);
  const [phoneSyncStatus, setPhoneSyncStatus] = useState("");
  const [tempId] = useState(() => uid(10));
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [premiumMap, setPremiumMap] = useState({});
  const [gbpMap, setGbpMap] = useState({});
  const [boostMap, setBoostMap] = useState({});
  const [agents, setAgents] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [expandedAgentId, setExpandedAgentId] = useState(null);
  const [previewListing, setPreviewListing] = useState(null);
  const refreshedRef = useRef(new Set());

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vendors"), (snap) => {
      setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "reports"), where("status", "==", "open"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setReports(rows);
      setReportsLoading(false);
    }, () => setReportsLoading(false));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "premium_vendors"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = d.data().isPremium || false; });
      setPremiumMap(map);
    }, () => {});
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "gbp_connections"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = d.data().connected || false; });
      setGbpMap(map);
    }, () => {});
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => {
      console.log("agents snapshot:", snap.docs.length, "docs");
      setAgents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("agents listener error:", err.code, err.message);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "commissions"), (snap) => {
      console.log("commissions snapshot:", snap.docs.length, "docs");
      setCommissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("commissions listener error:", err.code, err.message);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const claimedIds = vendors.filter((v) => v.ownerId).map((v) => v.id);
    const unsubs = claimedIds.map((id) =>
      onSnapshot(doc(db, "vendors", id, "boost", "latest"), (snap) => {
        setBoostMap((prev) => ({ ...prev, [id]: snap.exists() ? snap.data() : null }));
      }, () => {})
    );
    return () => unsubs.forEach((u) => u());
  }, [vendors]);

  const handleResolveReport = async (reportId, status) => {
    await resolveReport(db, reportId, status);
  };

  useEffect(() => {
    autoRefreshStale(vendors, refreshedRef.current);
  }, [vendors]);

  const vendorsByAgent = useMemo(() => {
    const map = {};
    vendors.forEach((v) => {
      if (!v.addedByAgentId) return;
      (map[v.addedByAgentId] ||= []).push(v);
    });
    return map;
  }, [vendors]);

  const commissionByVendorId = useMemo(() => {
    const map = {};
    commissions.forEach((c) => { map[c.vendorId] = c; });
    return map;
  }, [commissions]);

  const activeAgentsCount = agents.filter((a) => (vendorsByAgent[a.id]?.length || 0) > 0).length;

  const agentStoresNotYetPremium = useMemo(() => {
    return vendors.filter((v) => v.addedByAgentId && v.ownerId && !premiumMap[v.ownerId]).length;
  }, [vendors, premiumMap]);

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
    setOwnerMessageStatus("");
    setPhoneSyncStatus("");
    setError("");
    setForm({
      name: v.name, category: v.category, description: v.description || "",
      products: v.products || "", address: v.address || "", phone: v.phone || "",
      lat: String(v.lat), lng: String(v.lng),
      website: v.website || null, mapsUrl: v.mapsUrl || null, placeId: v.placeId || null,
      rating: v.rating ?? null, ratingsCount: v.ratingsCount ?? null,
      hours: v.hours || "", photos: v.photos || [], preferredLink: v.preferredLink || null,
      offer: v.offer || "", offerExpiresAt: toDateInputValue(v.offerExpiresAt),
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
      if (!editingId) {
        const dup = await findDuplicateVendor(db, { placeId: form.placeId, name: form.name.trim(), lat, lng });
        if (dup) {
          setSaving(false);
          return setError(
            `"${dup.name}" is already listed${dup.claimCode ? ` — claim code ${dup.claimCode}` : ""}. Edit that listing instead of adding a duplicate.`
          );
        }
      }
      const payload = {
        name: form.name.trim(), category: form.category, description: form.description.trim(),
        products: form.products.trim(), address: form.address.trim(), phone: form.phone.trim(),
        lat, lng, geohash: encodeGeohash(lat, lng, 9), website: form.website || null, mapsUrl: form.mapsUrl || null, placeId: form.placeId || null,
        rating: form.rating ?? null, ratingsCount: form.ratingsCount ?? null,
        hours: form.hours.trim(), photos: form.photos || [], preferredLink: form.preferredLink || null,
        offer: form.offer.trim(), offerExpiresAt: form.offerExpiresAt ? new Date(`${form.offerExpiresAt}T23:59:59`) : null,
      };
      if (editingId) {
        await updateDoc(doc(db, "vendors", editingId), payload);
        setEditingId(null);
        setForm(emptyForm);
      } else {
        const code = uid(6);
        await addDoc(collection(db, "vendors"), {
          ...payload, ownerId: null, claimCode: code, createdAt: serverTimestamp(),
          ratingUpdatedAt: payload.placeId ? serverTimestamp() : null,
        });
        setLastCode({ name: form.name.trim(), code, phone: form.phone.trim() });
        setOwnerMessageStatus("");
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

  const togglePremium = async (v) => {
    if (!v.ownerId) return;
    const currentlyPremium = !!premiumMap[v.ownerId];
    if (currentlyPremium) {
      const ok = confirm(
        `Remove premium from "${v.name}"?\n\nOnly do this for admin-granted premium. If this vendor has a real Razorpay subscription, this won't cancel it — their next successful payment will silently turn premium back on.`
      );
      if (!ok) return;
    }
    try {
      await setDoc(doc(db, "premium_vendors", v.ownerId), {
        isPremium: !currentlyPremium,
        status: !currentlyPremium ? "admin_granted" : "admin_revoked",
        updatedBy: auth.currentUser?.uid || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error("togglePremium failed:", err);
      alert(
        `Couldn't update premium status for "${v.name}": ${err.message}\n\n` +
        `If this says "permission-denied," the Firestore rules allowing admin writes to premium_vendors haven't been deployed yet — run:\nfirebase deploy --only firestore:rules`
      );
    }
  };

  const fetchVendorPhone = async (v) => {
    if (!v.placeId || v.phone) return;
    setPhoneSyncingId(v.id);
    setPhoneSyncStatus("");
    try {
      await refreshVendorIfStale(v, true);
      setPhoneSyncStatus(`Phone refresh requested for “${v.name}”. If Google has a public number, it will appear in the listing shortly.`);
    } catch {
      setPhoneSyncStatus(`Couldn’t fetch the phone for “${v.name}”.`);
    } finally {
      setPhoneSyncingId(null);
    }
  };

  const normalizeWhatsAppPhone = (phone) => {
    const raw = String(phone || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    if (raw.startsWith("+")) return digits;
    if (digits.length === 10) return `91${digits}`;
    return digits;
  };

  const buildOwnerMessage = ({ name, code }) => `Hi 👋

We’re reaching out from STall — your local business discovery platform.

Good news! 🎉 We’ve already created a business listing for “${name}” on STall so customers can discover your business online.

Your STall listing can help you:
• Get discovered by local customers searching for businesses like yours
• Showcase your business information, services and offers
• Keep your business details updated
• Build your online presence on STall
• Understand how customers are discovering and interacting with your listing

Your STall Claim ID: ${code}

Your listing is already created. Now it’s your turn to claim it and take control of your business profile.

👉 To claim:
1. Open STall: https://stallapp.stallwale.in/
2. Sign in / create your business account
3. Go to My Listings
4. Select “Claim a listing”
5. Enter your Claim ID: ${code}

Once claimed, you can review and update your business information so customers see the correct details.

Welcome to STall! 🚀
STall — Find what’s around the corner.`;

  const ownerMessage = lastCode ? buildOwnerMessage(lastCode) : "";

  const copyOwnerMessage = async () => {
    if (!ownerMessage) return;
    try {
      await navigator.clipboard.writeText(ownerMessage);
      setOwnerMessageStatus("Message copied.");
    } catch {
      setOwnerMessageStatus("Couldn’t copy automatically. Please select the message and copy it.");
    }
  };

  const openSalonPreview = (v) => setPreviewListing(v);

  const openOwnerWhatsApp = (contact) => {
    if (!contact?.code || !contact?.name) {
      setOwnerMessageStatus("This listing does not have a valid claim ID.");
      return;
    }

    const phone = normalizeWhatsAppPhone(contact.phone);
    if (!phone) {
      setOwnerMessageStatus("No valid business phone number is available for WhatsApp.");
      return;
    }

    const message = buildOwnerMessage(contact);
    const encodedMessage = encodeURIComponent(message);
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const whatsappUrl = isMobile
      ? `https://wa.me/${phone}?text=${encodedMessage}`
      : `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;

    setOwnerMessageStatus("Opening WhatsApp…");
    window.location.assign(whatsappUrl);
  };

  const shareOwnerMessage = () => {
    if (!lastCode) return;
    openOwnerWhatsApp(lastCode);
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
          {field("Hours", <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder={"Auto-filled from Google when available, or type it, e.g.\nMon–Sat: 9:00 AM – 8:00 PM\nSun: Closed"} />)}
          <ImageUpload
            photos={form.photos}
            pathPrefix={`vendor-photos/${editingId || tempId}`}
            onChange={(photos) => setForm((f) => ({ ...f, photos }))}
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

        {lastCode && (
          <div style={{ marginTop: 12, background: "#fff", border: `1.5px solid ${COLORS.ink}22`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 3 }}>📣 Contact Business Owner</div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>
              Use the business phone already listed for this store. Once the owner claims the listing, you can use their account/contact details going forward.
            </div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>
              WhatsApp: {lastCode.phone || "No phone number provided"}
            </div>
            <div style={{ background: "#fafafa", border: `1px solid ${COLORS.ink}18`, borderRadius: 7, padding: 10, whiteSpace: "pre-wrap", fontSize: 11.5, lineHeight: 1.5, maxHeight: 320, overflowY: "auto" }}>
              {ownerMessage}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={copyOwnerMessage} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                📋 Copy Message
              </button>
              {normalizeWhatsAppPhone(lastCode.phone) ? (
                <button type="button" onClick={shareOwnerMessage} className="stall-btn" style={{ background: COLORS.ink, color: "#fff", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  💬 Open WhatsApp & Send
                </button>
              ) : null}
            </div>
            {ownerMessageStatus && <div style={{ fontSize: 11, color: COLORS.teal, marginTop: 8 }}>{ownerMessageStatus}</div>}
          </div>
        )}
      </div>

      <div>
        {reports.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <Flag size={17} color={COLORS.brick} /> Open reports
            </div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              {reports.length} awaiting review — private, never shown to the public
            </div>
            <div style={{ border: `2px solid ${COLORS.brick}`, borderRadius: 12, overflow: "hidden" }}>
              {reports.map((r, i) => (
                <div key={r.id} style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.vendorName || "(unnamed listing)"}</div>
                      <div style={{ fontSize: 12.5, color: COLORS.brick, fontWeight: 600, marginTop: 2 }}>{r.reason}</div>
                      {r.details && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{r.details}</div>}
                      <div style={{ fontSize: 10.5, color: "#999", marginTop: 4 }}>
                        {r.createdAt?.toDate?.()?.toLocaleString?.() || "just now"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => handleResolveReport(r.id, "dismissed")} title="Dismiss — no action needed" style={{ background: "none", border: `1.5px solid ${COLORS.ink}33`, borderRadius: 7, padding: "6px 8px", cursor: "pointer", color: "#666" }}><XIcon size={14} /></button>
                      <button onClick={() => handleResolveReport(r.id, "reviewed")} title="Mark as reviewed" style={{ background: COLORS.ink, border: "none", borderRadius: 7, padding: "6px 8px", cursor: "pointer", color: "#fff" }}><Check size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 28 }}>
          <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Users size={17} /> Agents</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{activeAgentsCount} active (added ≥1 store) of {agents.length} total</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>{agentStoresNotYetPremium} agent-added store{agentStoresNotYetPremium === 1 ? "" : "s"} claimed but not yet Premium across all agents</div>
          {agents.length === 0 ? (
            <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: 24, textAlign: "center", color: "#666", fontSize: 13 }}>No agent accounts yet.</div>
          ) : (
            <div style={{ border: `2px solid ${COLORS.ink}`, borderRadius: 12, overflow: "hidden" }}>
              {agents.map((a, i) => {
                const stores = vendorsByAgent[a.id] || [];
                const premiumCount = stores.filter((v) => v.ownerId && premiumMap[v.ownerId]).length;
                const isExpanded = expandedAgentId === a.id;
                return (
                  <div key={a.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: "#fff" }}>
                    <div onClick={() => setExpandedAgentId(isExpanded ? null : a.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{a.name || a.id}</div>
                        <div style={{ fontSize: 11.5, color: "#777" }}>{stores.length} store{stores.length === 1 ? "" : "s"} · {premiumCount} premium{stores.length - premiumCount > 0 ? ` · ${stores.length - premiumCount} not yet premium` : ""}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: stores.length > 0 ? COLORS.teal : COLORS.brick }}>{stores.length > 0 ? "ACTIVE" : "INACTIVE"}</span>
                    </div>
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${COLORS.ink}15`, background: "#fafafa" }}>
                        {stores.length === 0 ? <div style={{ padding: "10px 16px", fontSize: 12, color: "#777" }}>No stores added yet.</div> : stores.map((v) => {
                          const isPremium = !!(v.ownerId && premiumMap[v.ownerId]);
                          const commission = commissionByVendorId[v.id];
                          return (
                            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px 8px 28px", borderTop: `1px solid ${COLORS.ink}10` }}>
                              <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{v.name}</div><div style={{ fontSize: 11, color: "#777" }}>{v.ownerId ? "Claimed" : "Unclaimed"}{isPremium ? " · Premium" : v.ownerId ? " · Not yet premium" : ""}</div></div>
                              {commission ? <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: COMMISSION_BG[commission.status], color: COMMISSION_COLOR[commission.status] }}>₹{commission.amount} {commission.status}</span> : <span style={{ fontSize: 10.5, color: "#aaa" }}>—</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>All listings</div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>{vendors.length} total</div>

        {loading ? <div style={{ fontSize: 13, color: "#666" }}>Loading…</div> : vendors.length === 0 ? (
          <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: 30, textAlign: "center", color: "#666", fontSize: 13 }}>No vendors yet.</div>
        ) : (
          <div style={{ border: `2px solid ${COLORS.ink}`, borderRadius: 12, overflow: "hidden" }}>
            {vendors.map((v, i) => (
              <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: editingId === v.id ? `${COLORS.marigold}18` : "#fff" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{v.name}</span>
                    <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#fff", background: CATEGORY_COLORS[v.category] || COLORS.ink, padding: "2px 7px", borderRadius: 999 }}>{v.category}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: v.ownerId ? COLORS.teal : COLORS.brick }}>{v.ownerId ? "CLAIMED" : "UNCLAIMED"}</span>
                    {v.ownerId && (() => {
                      const isPremium = premiumMap[v.ownerId];
                      const gbpConnected = gbpMap[v.ownerId];
                      const boost = boostMap[v.id];
                      if (!isPremium) return null;
                      const bandColors = { strong: COLORS.green, needs_work: COLORS.marigold, at_risk: COLORS.brick };
                      const label = !gbpConnected ? "Boost: not connected" : !boost ? "Boost: not scanned" : `Boost: ${boost.score} (${boost.band?.replace("_", " ")})`;
                      const color = !gbpConnected || !boost ? COLORS.muted : (bandColors[boost.band] || COLORS.muted);
                      return <span style={{ fontSize: 10, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 3 }}><Sparkles size={10} /> {label}</span>;
                    })()}
                    {v.rating != null && <span style={{ fontSize: 11, color: "#666", display: "flex", alignItems: "center", gap: 3 }}><Star size={11} fill={COLORS.marigold} color={COLORS.marigold} /> {v.rating.toFixed(1)}{v.ratingsCount != null ? ` (${v.ratingsCount})` : ""}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#777" }}>{v.address} · <span className="font-mono">{v.lat?.toFixed?.(4)}, {v.lng?.toFixed?.(4)}</span>{!v.ownerId && v.claimCode && <> · code <span className="font-mono">{v.claimCode}</span></>}</div>
                  {v.phone && <div style={{ fontSize: 11.5, color: "#777" }}>{v.phone}</div>}
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                  {v.placeId && !v.phone && !v.ownerId && <button onClick={() => fetchVendorPhone(v)} disabled={phoneSyncingId === v.id} title="Fetch business phone from Google" className="stall-btn" style={{ display: "flex", alignItems: "center", gap: 4, background: phoneSyncingId === v.id ? "#f5f5f5" : "transparent", border: `1.5px solid ${COLORS.ink}`, color: phoneSyncingId === v.id ? "#999" : COLORS.ink, borderRadius: 7, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: phoneSyncingId === v.id ? "wait" : "pointer" }}><RefreshCw size={12} className={phoneSyncingId === v.id ? "spin" : ""} /> {phoneSyncingId === v.id ? "Fetching…" : "Fetch Phone"}</button>}
                  {v.placeId && isRatingStale(v) && <span title="Rating/phone will sync from Google automatically" style={{ color: "#bbb", padding: 6, display: "flex" }}><RefreshCw size={14} /></span>}
                  {String(v.category || "").trim().toLowerCase().match(/^(salon|salons|beauty|beauty salon|beauty salons|beauty & wellness|beauty and wellness|hair salon|hair & beauty|salon & spa|salon and spa|spa & salon|parlour|parlor)$/) && <button onClick={() => openSalonPreview(v)} className="stall-btn" style={{ background: "#fff", border: `1.5px solid ${COLORS.ink}`, color: COLORS.ink, borderRadius: 7, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Preview</button>}
                  {v.ownerId && <button onClick={() => togglePremium(v)} title={premiumMap[v.ownerId] ? "Remove premium access" : "Manually grant premium access"} className="stall-btn" style={{ display: "flex", alignItems: "center", gap: 4, background: premiumMap[v.ownerId] ? COLORS.marigold : "transparent", border: `1.5px solid ${COLORS.marigold}`, color: premiumMap[v.ownerId] ? COLORS.ink : COLORS.marigold, borderRadius: 7, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Crown size={12} /> {premiumMap[v.ownerId] ? "Premium" : "Grant"}</button>}
                  {!v.ownerId && v.claimCode && (
                    <button
                      onClick={() => {
                        const contact = { name: v.name, code: v.claimCode, phone: v.phone || "" };
                        setLastCode(contact);
                        setOwnerMessageStatus("");
                        openOwnerWhatsApp(contact);
                      }}
                      title={v.phone ? "Open WhatsApp with the correct claim message for this business" : "No business phone number available — click to see the status"}
                      className="stall-btn"
                      style={{
                        background: v.phone ? COLORS.ink : "transparent",
                        color: v.phone ? "#fff" : "#999",
                        border: `1.5px solid ${COLORS.ink}`,
                        borderRadius: 7,
                        padding: "5px 9px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      💬 Contact Owner
                    </button>
                  )}
                  <button onClick={() => startEdit(v)} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>Edit</button>
                  <button onClick={() => remove(v.id)} title="Remove vendor" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.brick, padding: 6 }}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {phoneSyncStatus && <div style={{ fontSize: 11, color: COLORS.teal, marginTop: 8 }}>{phoneSyncStatus}</div>}
      </div>
      {previewListing && <AdminSalonPreviewModal listing={previewListing} onClose={() => setPreviewListing(null)} />}
    </div>
  );
}


function AdminSalonPreviewModal({ listing, onClose }) {
  const previewListing = {
    ...listing,
    name: String(listing?.name || "Salon"),
    category: String(listing?.category || "Salon"),
    description: String(listing?.description || ""),
    products: String(listing?.products || ""),
    address: String(listing?.address || ""),
    phone: String(listing?.phone || ""),
    hours: String(listing?.hours || ""),
    website: typeof listing?.website === "string" ? listing.website : "",
    mapsUrl: typeof listing?.mapsUrl === "string" ? listing.mapsUrl : "",
    preferredLink: typeof listing?.preferredLink === "string" ? listing.preferredLink : null,
    offer: String(listing?.offer || ""),
    todayOffer: String(listing?.todayOffer || ""),
    weekendOffer: String(listing?.weekendOffer || ""),
    pageLayout: ["classic", "spotlight", "compact"].includes(listing?.pageLayout) ? listing.pageLayout : "classic",
    photos: Array.isArray(listing?.photos) ? listing.photos.filter((photo) => typeof photo === "string" && photo.trim()) : [],
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Salon page preview" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.72)", display: "flex", flexDirection: "column", padding: 12 }}>
      <div style={{ width: "100%", maxWidth: 1240, margin: "0 auto", background: "#fff", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #ddd", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#fff" }}>
          <div><div style={{ fontWeight: 800, color: COLORS.ink, fontSize: 13 }}>Salon page preview</div><div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Preview only — nothing is published or changed.</div></div>
          <button type="button" onClick={onClose} className="stall-btn" style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 12, fontWeight: 800 }}>Close Preview</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#f3f3f3" }}><div style={{ padding: 10 }}><SalonBusinessPage listing={previewListing} onBack={onClose} /></div></div>
      </div>
    </div>
  );
}
