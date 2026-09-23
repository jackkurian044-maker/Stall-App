import React, { useEffect, useRef, useState } from "react";
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  getDocs, serverTimestamp,
} from "firebase/firestore";
import { Plus, Trash2, KeyRound, RefreshCw, Star, Zap, BarChart2, Eye, Phone, MessageCircle, Navigation, X, CheckCircle2, ClipboardList } from "lucide-react";
import { db } from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { CATEGORIES, COLORS } from "./constants";
import LocationSearch from "./LocationSearch";
import ImageUpload from "./ImageUpload";
import { autoRefreshStale, isRatingStale } from "./ratingSync";
import { uid, toDateInputValue } from "./geo";
import { findDuplicateVendor } from "./duplicateCheck";
import { COUNTRY_OPTIONS, normalizePhoneForCountry } from "./countryPhone";
import QuickOfferModal from "./QuickOfferModal";
import { encodeGeohash } from "./geohash";
import VendorPremiumWorkspace from "./VendorPremiumWorkspace";
import PlanCheckout from "./PlanCheckout";
import LeadEnginePanel from "./LeadEnginePanel";
import BoostCampaignPanel from "./BoostCampaignPanel";
import DirectOrdersPanel from "./DirectOrdersPanel";
import { RestaurantBusinessPage, SalonBusinessPage } from "./BusinessTemplatePages";

const isSalonCategory = (value) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  return new Set([
    "salon", "salons", "beauty", "beauty salon", "beauty salons",
    "beauty & wellness", "beauty and wellness", "hair salon",
    "hair & beauty", "salon & spa", "salon and spa", "spa & salon",
    "parlour", "parlor"
  ]).has(normalized);
};

const emptyForm = {
  name: "", category: CATEGORIES[0], description: "", products: "",
  address: "", phone: "", countryCode: "IN", lat: "", lng: "", website: null, mapsUrl: null, placeId: null,
  rating: null, ratingsCount: null, hours: "", photos: [], preferredLink: null,
  offer: "", offerExpiresAt: "", todaySpecial: "", everydaySpecial: "", todayOffer: "", weekendOffer: "", pageLayout: "classic",
};

const cardStyle = {
  background: "#fff",
  border: `2px solid ${COLORS.ink}`,
  borderRadius: 12,
  padding: 18,
};

export default function VendorDashboard({ user, agent }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [claimMsg, setClaimMsg] = useState("");
  const [tempId] = useState(() => uid(10));
  const [dashTab, setDashTab] = useState(() => {
    try {
      const intent = window.sessionStorage.getItem("stallPremiumIntent");
      if (intent === "1") {
        window.sessionStorage.removeItem("stallPremiumIntent");
        return "premium";
      }
    } catch {}
    return "listings";
  });
  const [quickOfferListing, setQuickOfferListing] = useState(null);
  const [vendorDigests, setVendorDigests] = useState({});
  const [previewListing, setPreviewListing] = useState(null);
  const refreshedRef = useRef(new Set());

  useEffect(() => {
    if (listings.length === 0) return;
    const unsubs = listings.map((l) => onSnapshot(doc(db, "vendor_digests", l.id), (d) => {
      setVendorDigests((prev) => ({ ...prev, [l.id]: d.exists() ? d.data() : null }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [listings]);

  const dismissVendorDigest = (vendorId) => {
    updateDoc(doc(db, "vendor_digests", vendorId), { read: true });
    setVendorDigests((prev) => ({ ...prev, [vendorId]: null }));
  };

  useEffect(() => {
    const q = query(collection(db, "vendors"), where("ownerId", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [user.uid]);

  useEffect(() => { autoRefreshStale(listings, refreshedRef.current); }, [listings]);

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
      name: l.name, category: isSalonCategory(l.category) ? "Salons" : l.category, description: l.description || "",
      products: l.products || "", address: l.address || "", phone: l.phone || "", countryCode: l.countryCode || "IN",
      lat: String(l.lat), lng: String(l.lng), website: l.website || null, mapsUrl: l.mapsUrl || null,
      placeId: l.placeId || null, rating: l.rating ?? null, ratingsCount: l.ratingsCount ?? null,
      hours: l.hours || "", photos: l.photos || [], preferredLink: l.preferredLink || null,
      offer: l.offer || "", offerExpiresAt: toDateInputValue(l.offerExpiresAt), todaySpecial: l.todaySpecial || "", everydaySpecial: l.everydaySpecial || "", todayOffer: l.todayOffer || "", weekendOffer: l.weekendOffer || "", pageLayout: l.pageLayout || "classic",
    });
  };

  const buildPreviewListing = () => {
    const current = editingId ? listings.find((l) => l.id === editingId) : null;
    return {
      ...(current || {}),
      id: editingId || "preview",
      name: form.name.trim(),
      category: isSalonCategory(form.category) ? "Salons" : form.category,
      description: form.description.trim(),
      products: form.products.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      website: form.website || null,
      mapsUrl: form.mapsUrl || null,
      placeId: form.placeId || null,
      rating: form.rating ?? null,
      ratingsCount: form.ratingsCount ?? null,
      hours: form.hours.trim(),
      photos: form.photos || [],
      preferredLink: form.preferredLink || null,
      offer: form.offer.trim(),
      todaySpecial: form.todaySpecial.trim(),
      everydaySpecial: form.everydaySpecial.trim(),
      todayOffer: form.todayOffer.trim(),
      weekendOffer: form.weekendOffer.trim(),
      pageLayout: form.pageLayout || "classic",
    };
  };

  const openPreview = () => {
    setError("");
    const lat = parseFloat(form.lat), lng = parseFloat(form.lng);
    if (!form.name.trim()) return setError("Name is required before previewing.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setError("Please select an address from the suggestions dropdown (or switch to \"enter manually\" and type coordinates).");
    setPreviewListing(buildPreviewListing());
  };

  const saveDraft = async (layoutOverride = null) => {
    setError("");
    const lat = parseFloat(form.lat), lng = parseFloat(form.lng);
    if (!form.name.trim()) return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    setSaving(true);
    try {
      if (!editingId) {
        const dup = await findDuplicateVendor(db, { placeId: form.placeId, name: form.name.trim(), lat, lng });
        if (dup) {
          setSaving(false);
          return setError('This business already has a listing on Stall. If it\'s yours, use "Claim a listing" below with its claim code instead of creating a new one.');
        }
      }
      const payload = {
        name: form.name.trim(), publicSlug: slugify(form.name), category: isSalonCategory(form.category) ? "Salons" : form.category, pageLayout: layoutOverride || form.pageLayout || "classic", description: form.description.trim(), products: form.products.trim(),
        address: form.address.trim(), phone: form.phone.trim(), lat, lng, geohash: encodeGeohash(lat, lng, 9),
        website: form.website || null, mapsUrl: form.mapsUrl || null, placeId: form.placeId || null,
        rating: form.rating ?? null, ratingsCount: form.ratingsCount ?? null, hours: form.hours.trim(), photos: form.photos || [],
        preferredLink: form.preferredLink || null, todaySpecial: form.todaySpecial.trim(), everydaySpecial: form.everydaySpecial.trim(), todayOffer: form.todayOffer.trim(), weekendOffer: form.weekendOffer.trim(), offer: form.offer.trim(),
        offerExpiresAt: form.offerExpiresAt ? new Date(`${form.offerExpiresAt}T23:59:59`) : null,
      };
      let savedListingId = editingId;
      if (editingId) {
        await updateDoc(doc(db, "vendors", editingId), payload);
      } else {
        const created = await addDoc(collection(db, "vendors"), { ...payload, ownerId: user.uid, addedByAgentId: agent ? user.uid : null, claimCode: null, createdAt: serverTimestamp(), ratingUpdatedAt: payload.placeId ? serverTimestamp() : null });
        savedListingId = created.id;
      }
      // When a Google Business Profile is connected, make the canonical STall
      // store page the profile website. This uses the saved pageLayout as the
      // default presentation without changing the public URL.
      if (savedListingId) {
        try {
          await httpsCallable(getFunctions(), "syncGbpWebsite")({ listingId: savedListingId });
        } catch (syncErr) {
          console.warn("STall GBP website sync skipped/failed:", syncErr?.message || syncErr);
        }
      }
      setForm(emptyForm);
      setEditingId(null);
      return true;
    } catch { setError("Couldn't save — please try again."); return false; }
    finally { setSaving(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    openPreview();
  };

  const publishPreview = async () => {
    if (!previewListing) return;
    const ok = await saveDraft();
    if (ok) setPreviewListing(null);
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
      const snap = await getDocs(query(collection(db, "vendors"), where("claimCode", "==", code), where("ownerId", "==", null)));
      if (snap.empty) return setClaimMsg("No unclaimed listing matches that code.");
      const d = snap.docs[0];
      await updateDoc(doc(db, "vendors", d.id), { ownerId: user.uid, claimCode: code });
      setClaimMsg(`Claimed "${d.data().name}" — it now appears below.`);
      setClaimCode("");
    } catch { setClaimMsg("Couldn't claim that listing — check the code and try again."); }
  };

  let premiumListing = listings[0];
  try {
    const requestedListingId = window.sessionStorage.getItem("stallUpgradeListingId") || "";
    if (requestedListingId) premiumListing = listings.find((l) => l.id === requestedListingId) || listings[0];
  } catch {}

  return (
    <div className="stall-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={cardStyle}>
          <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>{editingId ? "Edit listing" : "Create a listing"}</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>Build your page here. <strong>Nothing goes live until you preview and confirm.</strong></div>
          <form onSubmit={submit}>
            {field("Name", <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amma's Pickle Stand" />)}
            {field("Category", <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>)}
            {field("Store page layout", <select style={inputStyle} value={form.pageLayout || "classic"} onChange={(e) => setForm({ ...form, pageLayout: e.target.value })}>
              <option value="classic">Classic Premium — elegant storefront</option>
              <option value="spotlight">Spotlight Premium — visual showcase</option>
              <option value="compact">Compact Premium — polished mobile-first</option>
            </select>)}
            {field("Description", <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What makes this worth the walk?" />)}
            {field("Products (comma separated)", <input style={inputStyle} value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })} placeholder="mango pickle, lime pickle" />)}
            {field("Country", <select style={inputStyle} value={form.countryCode || "IN"} onChange={(e) => setForm({ ...form, countryCode: e.target.value })}>{COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name} (+{c.dialCode})</option>)}</select>)}
            {field("Phone (optional)", <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Local number or full international number" />)}
            {isSalonCategory(form.category) ? <>
              {field("Today’s offer", <input style={inputStyle} value={form.todayOffer} onChange={(e) => setForm({ ...form, todayOffer: e.target.value })} placeholder="e.g. Hair spa + blow dry — ₹999 today" />)}
              {field("Weekend offer", <input style={inputStyle} value={form.weekendOffer} onChange={(e) => setForm({ ...form, weekendOffer: e.target.value })} placeholder="e.g. Saturday & Sunday — 20% off hair services" />)}
            </> : <>
              {field("Today’s special", <input style={inputStyle} value={form.todaySpecial} onChange={(e) => setForm({ ...form, todaySpecial: e.target.value })} placeholder="e.g. Kerala parotta + chicken curry — ₹199 today" />)}
              {field("Everyday special", <input style={inputStyle} value={form.everydaySpecial} onChange={(e) => setForm({ ...form, everydaySpecial: e.target.value })} placeholder="e.g. Appam + stew — available every day" />)}
            </>}
            {field("Current offer (optional — e.g. \"20% off today\" or \"Buy 1 get 1, this month\")", <input style={inputStyle} value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="e.g. Festive discount — 15% off all items" />)}
            {form.offer && field("Offer ends on (optional — leave blank to show until you remove it)", <input type="date" style={inputStyle} value={form.offerExpiresAt} onChange={(e) => setForm({ ...form, offerExpiresAt: e.target.value })} />)}
            {form.website && form.mapsUrl && field("When someone taps this listing, open…", <div style={{ display: "flex", gap: 8 }}>{[{ id: "mapsUrl", label: "Google Business profile" }, { id: "website", label: "Website" }].map((opt) => <button key={opt.id} type="button" onClick={() => setForm({ ...form, preferredLink: opt.id })} className="stall-btn" style={{ flex: 1, borderRadius: 7, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, border: `1.5px solid ${COLORS.ink}`, background: (form.preferredLink || "mapsUrl") === opt.id ? COLORS.ink : "#fff", color: (form.preferredLink || "mapsUrl") === opt.id ? "#fff" : COLORS.ink }}>{opt.label}</button>)}</div>)}
            <LocationSearch countryCode={form.countryCode} address={form.address} lat={form.lat} lng={form.lng} website={form.website} mapsUrl={form.mapsUrl} placeId={form.placeId} rating={form.rating} ratingsCount={form.ratingsCount} onChange={(patch) => setForm((f) => ({ ...f, ...patch, name: f.name.trim() ? f.name : (patch.name ?? f.name), hours: f.hours ? f.hours : (patch.hours ?? f.hours) }))} />
            {field("Hours", <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder={'Auto-filled from Google when available, or type your own, e.g.\nMon–Sat: 9:00 AM – 8:00 PM\nSun: Closed'} />)}
            <ImageUpload photos={form.photos} pathPrefix={`vendor-photos/${editingId || tempId}`} onChange={(photos) => setForm((f) => ({ ...f, photos }))} />
            {error && <div style={{ color: COLORS.brick, fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} className="stall-btn" style={{ flex: 1, background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: 10, fontSize: 13, fontWeight: 700 }}><Eye size={15} /> Preview before publish</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); setError(""); }} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "10px 14px", fontSize: 13 }}>Cancel</button>}
            </div>
          </form>
        </div>
        <div style={cardStyle}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><KeyRound size={15} /> Claim a listing</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>If an admin already added your stall, enter the code they gave you to take it over.</div>
          <form onSubmit={claim} style={{ display: "flex", gap: 8 }}><input className="font-mono" value={claimCode} onChange={(e) => setClaimCode(e.target.value)} placeholder="e.g. 7K3PQR" style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: `1.5px solid ${COLORS.ink}`, fontSize: 13 }} /><button type="submit" className="stall-btn" style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>Claim</button></form>
          {claimMsg && <div style={{ fontSize: 12, color: COLORS.teal, marginTop: 8 }}>{claimMsg}</div>}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          <TabButton active={dashTab === "listings"} onClick={() => setDashTab("listings")}>My Listings ({listings.length})</TabButton>
          <TabButton active={dashTab === "insights"} onClick={() => setDashTab("insights")} icon={<BarChart2 size={13} />}>Insights</TabButton>
          <TabButton active={dashTab === "leads"} onClick={() => setDashTab("leads")} icon={<MessageCircle size={13} />}>Leads</TabButton>
          <TabButton active={dashTab === "premium"} onClick={() => setDashTab("premium")} icon={<Zap size={13} />}>Premium</TabButton>\n          <TabButton active={dashTab === "direct"} onClick={() => setDashTab("direct")} icon={<ClipboardList size={13} />}>STall Direct</TabButton>
        </div>

        {dashTab === "listings" && (
          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>{listings.length} total</div>
            {loading ? <div style={{ fontSize: 13, color: "#666" }}>Loading…</div> : listings.length === 0 ? <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: 30, textAlign: "center", color: "#666", fontSize: 13 }}>Nothing yet — create your first listing on the left, or claim one an admin already added.</div> : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{listings.map((l) => <div key={l.id} style={{ ...cardStyle, padding: 14, display: "flex", justifyContent: "space-between", gap: 12 }}><div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6, color: COLORS.ink }}>{l.name}{l.isPremium && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: COLORS.ink, color: "#fff", fontWeight: 600 }}>✦ Premium</span>}</div><div style={{ fontSize: 11.5, color: "#777" }}>{l.category} · {l.address}</div>{l.phone && <div style={{ fontSize: 11.5, color: "#777" }}>{l.phone}</div>}{l.rating != null && <div style={{ fontSize: 11.5, color: "#666", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><Star size={11} fill={COLORS.marigold} color={COLORS.marigold} />{l.rating.toFixed(1)}{l.ratingsCount != null ? ` (${l.ratingsCount})` : ""}</div>}</div><div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "flex-start" }}>{l.placeId && isRatingStale(l) && <span title="Rating/phone will sync from Google automatically" style={{ color: "#bbb", padding: 6, display: "flex" }}><RefreshCw size={13} /></span>}<button onClick={() => setQuickOfferListing(l)} className="stall-btn" title="Post a quick offer" style={{ background: COLORS.marigold, border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, color: COLORS.ink }}><Zap size={12} /> Offer</button><button onClick={() => setPreviewListing({ ...l, category: isSalonCategory(l.category) ? "Salons" : l.category, pageLayout: l.pageLayout || "classic" })} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>Preview</button><button onClick={() => startEdit(l)} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 600 }}>Edit</button><button onClick={() => remove(l.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.brick, padding: 6 }} title="Delete"><Trash2 size={16} /></button></div></div>)}</div>}
          </div>
        )}

        {dashTab === "insights" && (
          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>Real numbers, not vague reach — this is what customers actually did with your listing.</div>
            {listings.length === 0 ? <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: 30, textAlign: "center", color: "#666", fontSize: 13 }}>Create a listing first to start seeing insights.</div> : <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{listings.map((l) => <div key={l.id} style={cardStyle}><div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12, color: COLORS.ink }}>{l.name}</div>{vendorDigests[l.id] && !vendorDigests[l.id].read && <div style={{ background: `${COLORS.teal}15`, border: `1.5px solid ${COLORS.teal}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}><div style={{ fontSize: 12.5, color: COLORS.ink }}><strong>This week:</strong> {vendorDigests[l.id].views || 0} views, {vendorDigests[l.id].calls || 0} calls, {vendorDigests[l.id].whatsapp || 0} WhatsApp, {vendorDigests[l.id].directions || 0} directions</div><button onClick={() => dismissVendorDigest(l.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: COLORS.teal, fontWeight: 600 }}>Dismiss</button></div>}<div className="stall-insights-grid"><InsightTile icon={<Eye size={15} />} value={l.viewCount || 0} label="Views" color={COLORS.teal} /><InsightTile icon={<Phone size={15} />} value={l.callCount || 0} label="Calls" color={COLORS.ink} /><InsightTile icon={<MessageCircle size={15} />} value={l.whatsappCount || 0} label="WhatsApp" color="#25D366" /><InsightTile icon={<Navigation size={15} />} value={l.directionsCount || 0} label="Directions" color={COLORS.brick} /></div>{(l.callCount || 0) + (l.whatsappCount || 0) === 0 && (l.viewCount || 0) > 5 && <div style={{ fontSize: 11.5, color: "#8a6b3e", marginTop: 12, background: "#FEF3E2", padding: "8px 10px", borderRadius: 8 }}>You're getting views but no calls yet — try adding a current offer or a clearer photo to encourage people to reach out.</div>}</div>)}</div>}
          </div>
        )}

        {dashTab === "leads" && (
          <LeadEnginePanel listings={listings} />
        )}

        {dashTab === "direct" && (\n          <DirectOrdersPanel listings={listings} />\n        )}\n\n        {dashTab === "premium" && (
          <div>
            <PlanCheckout user={user} listing={premiumListing} />
            <VendorPremiumWorkspace user={user} listing={premiumListing} hideCheckout />
            <BoostCampaignPanel user={user} listing={premiumListing} />
          </div>
        )}
      </div>

      {previewListing && <StorePagePreviewModal
        listing={previewListing}
        saving={saving}
        onClose={() => setPreviewListing(null)}
        onPublish={publishPreview}
      />}
      {quickOfferListing && <QuickOfferModal listing={quickOfferListing} onClose={() => setQuickOfferListing(null)} />}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return <button onClick={onClick} className="stall-btn" style={{ padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, border: `1.5px solid ${COLORS.ink}`, background: active ? COLORS.ink : "#fff", color: active ? "#fff" : COLORS.ink, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>{icon}{children}</button>;
}

function InsightTile({ icon, value, label, color }) {
  return <div style={{ textAlign: "center", padding: "10px 6px", background: "#F7F6F2", borderRadius: 10 }}><div style={{ color, display: "flex", justifyContent: "center", marginBottom: 4 }}>{icon}</div><div style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink }}>{value}</div><div style={{ fontSize: 10.5, color: "#555", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div></div>;
}


function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}


function StorePagePreviewModal({ listing, saving, onClose, onPublish }) {
  const liveSlug = slugify(listing.name);
  const isRestaurant = listing.category === "Food & Produce";
  const isSalon = isSalonCategory(listing.category);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview store page"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,.72)",
        display: "flex",
        flexDirection: "column",
        padding: 12,
      }}
    >
      <div style={{
        width: "100%",
        maxWidth: 1240,
        margin: "0 auto",
        background: "#fff",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: 1,
      }}>
        <div style={{
          padding: "10px 12px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          background: "#fff",
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: COLORS.ink, fontSize: 13 }}>Store page preview — not live yet</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 2, overflowWrap: "anywhere" }}>
              After confirmation: https://stallwale.in/store/{liveSlug}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="stall-btn"
              style={{ background: "#fff", color: COLORS.ink, border: `1.5px solid ${COLORS.ink}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <X size={14} /> Back to edit
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={saving}
              className="stall-btn"
              style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <CheckCircle2 size={14} /> {saving ? "Publishing…" : "Confirm & publish"}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#f3f3f3" }}>
          <div style={{ padding: 10 }}>
            {isRestaurant ? (
              <RestaurantBusinessPage listing={listing} onBack={onClose} />
            ) : isSalon ? (
              <SalonBusinessPage listing={listing} onBack={onClose} />
            ) : (
              <div style={{ maxWidth: 760, margin: "30px auto", background: "#fff", border: "1px solid #ddd", borderRadius: 14, padding: 24 }}>
                <h2 style={{ marginTop: 0 }}>Preview unavailable for this category</h2>
                <p style={{ color: "#666" }}>The saved public page template will be used after publishing.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
