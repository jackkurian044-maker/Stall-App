import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, addDoc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { MapPin, Locate, Search, Copy, Loader2, Target, IndianRupee, Store, Plus } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, COLORS, DEFAULT_LOC } from "./constants";
import { uid, haversineKm } from "./geo";
import { loadGoogleMaps } from "./googleMaps";
import { findExistingPlaceIds, findDuplicateVendor } from "./duplicateCheck";
import LocationSearch from "./LocationSearch";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

const TYPE_CATEGORY_MAP = [
  [["restaurant", "food", "bakery", "grocery_or_supermarket", "meal_takeaway", "meal_delivery", "cafe"], "Food & Produce"],
  [["clothing_store", "shoe_store", "jewelry_store"], "Clothing & Accessories"],
  [["hardware_store", "home_goods_store", "furniture_store"], "Home & Garden"],
  [["electrician"], "Electricians"],
  [["plumber"], "Plumbers"],
  [["hair_care", "beauty_salon", "spa"], "Salons"],
  [["car_repair"], "Mechanics"],
  [["pharmacy", "drugstore"], "Pharmacies"],
  [["school", "primary_school", "secondary_school"], "Tuition"],
  [["laundry", "locksmith", "moving_company", "roofing_contractor", "general_contractor"], "Home Services"],
  [["doctor", "dentist", "gym", "physiotherapist", "veterinary_care"], "Services"],
  [["store"], "Crafts & Goods"],
];

function guessCategory(types = []) {
  for (const [keys, category] of TYPE_CATEGORY_MAP) {
    if (types.some((t) => keys.includes(t))) return category;
  }
  return "Other";
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const COMMISSION_LABEL = { pending: "pending", paid: "paid", clawed_back: "clawed back" };
const COMMISSION_COLOR = { pending: COLORS.goldDark, paid: COLORS.green, clawed_back: COLORS.brick };
const COMMISSION_BG = { pending: `${COLORS.marigold}22`, paid: `${COLORS.green}22`, clawed_back: `${COLORS.brick}22` };

const emptyAgentForm = {
  name: "", category: CATEGORIES[0], phone: "",
  address: "", lat: "", lng: "", website: null, mapsUrl: null, placeId: null,
  rating: null, ratingsCount: null, hours: "",
};

export default function AgentDashboard({ user, agent }) {
  const [myVendors, setMyVendors] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [tab, setTab] = useState("overview"); // "overview" | "discover" | "add"

  // ── Discover Nearby (view-only search) ──
  const [centerLoc, setCenterLoc] = useState(null);
  const [locating, setLocating] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [radiusKm, setRadiusKm] = useState(2);
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState([]);
  const [locateError, setLocateError] = useState("");

  // ── Add a store (manual entry) ──
  const [form, setForm] = useState(emptyAgentForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [addedCode, setAddedCode] = useState(null); // { name, code }

  useEffect(() => {
    const q = query(collection(db, "vendors"), where("addedByAgentId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => setMyVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return unsub;
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, "commissions"), where("agentId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => setCommissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return unsub;
  }, [user.uid]);

  const addedThisMonth = useMemo(() => {
    const key = monthKey();
    return myVendors.filter((v) => {
      const d = v.createdAt?.toDate?.();
      return d && monthKey(d) === key;
    }).length;
  }, [myVendors]);

  const target = agent.monthlyTarget || 0;
  const progressPct = target > 0 ? Math.min(100, Math.round((addedThisMonth / target) * 100)) : 0;
  const pendingTotal = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + (c.amount || 0), 0);
  const paidTotal = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + (c.amount || 0), 0);
  const clawedBackCount = commissions.filter((c) => c.status === "clawed_back").length;
  const conversionCount = commissions.length; // every store that ever converted, including ones later clawed back

  // ── location + search (view-only — no add-from-results) ──
  const locate = () => {
    setLocating(true);
    setLocateError("");
    if (!navigator.geolocation) {
      setLocateError("Your browser doesn't support location — enter coordinates below instead.");
      setCenterLoc(DEFAULT_LOC);
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCenterLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) setLocateError("Location access was denied — enter coordinates below.");
        else if (err.code === err.TIMEOUT) setLocateError("Location took too long — try again, or enter coordinates below.");
        else setLocateError("Couldn't get your location — try again, or enter coordinates below.");
      },
      { timeout: 12000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  const useManualLoc = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) setCenterLoc({ lat, lng });
  };

  const runSearch = (svc, request) => new Promise((resolve) => {
    svc.nearbySearch(request, (res, status) => {
      resolve(status === window.google.maps.places.PlacesServiceStatus.OK && res ? res : []);
    });
  });

  const search = async () => {
    if (!GOOGLE_API_KEY) return setSearchError("Google Places API key isn't configured.");
    if (!centerLoc) return setSearchError("Set a center point first.");
    setSearching(true); setSearchError(""); setResults([]);
    try {
      await loadGoogleMaps(GOOGLE_API_KEY);
      const svc = new window.google.maps.places.PlacesService(document.createElement("div"));
      const request = {
        location: new window.google.maps.LatLng(centerLoc.lat, centerLoc.lng),
        radius: Math.round(radiusKm * 1000),
        keyword: keyword.trim() || undefined,
      };
      const res = await runSearch(svc, request);
      const existingPlaceIds = await findExistingPlaceIds(db, res.map((p) => p.place_id));
      setResults(res.map((p) => ({
        placeId: p.place_id, name: p.name, vicinity: p.vicinity || "",
        lat: p.geometry?.location?.lat(), lng: p.geometry?.location?.lng(),
        rating: typeof p.rating === "number" ? p.rating : null,
        ratingsCount: typeof p.user_ratings_total === "number" ? p.user_ratings_total : null,
        category: guessCategory(p.types), alreadyListed: existingPlaceIds.has(p.place_id),
      })));
    } catch {
      setSearchError("Search failed — try again.");
    } finally {
      setSearching(false);
    }
  };

  // ── manual add-a-store form (mirrors VendorDashboard's "Create a listing") ──
  const inputStyle = { width: "100%", padding: "9px 10px", borderRadius: 14, border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box" };
  const cardStyle = { background: "#fff", border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)", borderRadius: 20, padding: 18, marginBottom: 16 };
  const field = (label, node) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>{label}</label>
      {node}
    </div>
  );

  const submitListing = async (e) => {
    e.preventDefault();
    setFormError("");
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!form.name.trim()) return setFormError("Name is required.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return setFormError('Please select an address from the suggestions dropdown (or switch to "enter manually" and type coordinates).');
    }
    setSaving(true);
    try {
      const dup = await findDuplicateVendor(db, { placeId: form.placeId, name: form.name.trim(), lat, lng });
      if (dup) {
        setSaving(false);
        return setFormError("This business is already on Stall — check Discover Nearby instead of adding a duplicate.");
      }
      const code = uid(6);
      await addDoc(collection(db, "vendors"), {
        name: form.name.trim(), category: form.category, description: "", products: "",
        address: form.address.trim(), phone: form.phone.trim(), lat, lng,
        website: form.website || null, mapsUrl: form.mapsUrl || null, placeId: form.placeId || null,
        rating: form.rating ?? null, ratingsCount: form.ratingsCount ?? null,
        hours: form.hours.trim(), photos: [], ownerId: null, claimCode: code,
        addedByAgentId: user.uid, addedByAgentName: agent.name || "",
        createdAt: serverTimestamp(), ratingUpdatedAt: form.placeId ? serverTimestamp() : null,
      });
      setAddedCode({ name: form.name.trim(), code });
      setForm(emptyAgentForm);
    } catch (err) {
      setFormError("Couldn't add — try again.");
    } finally {
      setSaving(false);
    }
  };

  const copyCode = () => {
    if (addedCode) navigator.clipboard?.writeText(`${addedCode.name}: ${addedCode.code}`);
  };

  return (
    <div className="stall-page" style={{ maxWidth: 900 }}>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        Welcome, {agent.name || user.email}
      </div>
      <div style={{ fontSize: 12.5, color: "#666", marginBottom: 16 }}>
        Add nearby stores to Stall — you'll earn a commission whenever a store you add upgrades to Premium.
        {" "}If a store cancels within 30 days of converting, that commission is clawed back.
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {["overview", "discover", "add"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className="stall-btn" style={{
            padding: "8px 16px", borderRadius: 14, fontSize: 13, fontWeight: 600,
            border: `1.5px solid ${COLORS.ink}`,
            background: tab === t ? COLORS.ink : "#fff", color: tab === t ? "#fff" : COLORS.ink,
          }}>
            {t === "overview" ? "Overview" : t === "discover" ? "Discover Nearby" : "+ Add a store"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#666", marginBottom: 8 }}>
                <Target size={13} /> This month's target
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.ink }}>{addedThisMonth} / {target || "—"}</div>
              {target > 0 && (
                <div style={{ marginTop: 8, height: 6, borderRadius: 6, background: `${COLORS.ink}15`, overflow: "hidden" }}>
                  <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct >= 100 ? COLORS.green : COLORS.marigold }} />
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#666", marginBottom: 8 }}>
                <Store size={13} /> Total stores added
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.ink }}>{myVendors.length}</div>
              <div style={{ fontSize: 11.5, color: "#777", marginTop: 6 }}>
                {conversionCount} converted to Premium{clawedBackCount > 0 ? ` · ${clawedBackCount} clawed back` : ""}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#666", marginBottom: 8 }}>
                <IndianRupee size={13} /> Commission
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.green }}>₹{paidTotal}</div>
              <div style={{ fontSize: 11.5, color: "#777", marginTop: 6 }}>₹{pendingTotal} pending · ₹{agent.commissionAmount || 0} per conversion</div>
            </div>
          </div>

          <div className="font-display" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Stores you've added</div>
          {myVendors.length === 0 ? (
            <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: 24, textAlign: "center", color: "#666", fontSize: 13 }}>
              You haven't added any stores yet — use the "+ Add a store" tab.
            </div>
          ) : (
            <div style={{ border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)", borderRadius: 20, overflow: "hidden" }}>
              {myVendors.map((v, i) => {
                const commission = commissions.find((c) => c.vendorId === v.id);
                return (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}15` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.ink }}>{v.name}</div>
                      <div style={{ fontSize: 11.5, color: "#777" }}>{v.address}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: v.ownerId ? COLORS.teal : COLORS.brick }}>{v.ownerId ? "CLAIMED" : "UNCLAIMED"}</span>
                      {commission && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: COMMISSION_BG[commission.status], color: COMMISSION_COLOR[commission.status] }}>
                          ₹{commission.amount} {COMMISSION_LABEL[commission.status]}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "discover" && (
        <>
          <div style={cardStyle}>
            {!centerLoc ? (
              <div>
                <div style={{ fontSize: 13, marginBottom: 10 }}>Set a center point to search around.</div>
                <button onClick={locate} className="stall-btn" style={{ background: COLORS.navy, color: "#fff", border: "none", borderRadius: 999, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                  <Locate size={16} /> {locating ? "Locating…" : "Use my location"}
                </button>
                {locateError && <div style={{ fontSize: 11.5, color: COLORS.brick, marginBottom: 10 }}>{locateError}</div>}
                <div style={{ fontSize: 11, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>or enter coordinates</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input placeholder="Latitude" value={manualLat} onChange={(e) => setManualLat(e.target.value)} className="font-mono" style={{ ...inputStyle, flex: "1 1 120px" }} />
                  <input placeholder="Longitude" value={manualLng} onChange={(e) => setManualLng(e.target.value)} className="font-mono" style={{ ...inputStyle, flex: "1 1 120px" }} />
                  <button onClick={useManualLoc} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 14, padding: "0 14px", fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>Set</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: COLORS.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={14} /> CENTER SET · <span className="font-mono">{centerLoc.lat.toFixed(4)}, {centerLoc.lng.toFixed(4)}</span>
                  </div>
                  <button onClick={locate} style={{ background: "none", border: "none", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>{locating ? "…" : "re-locate"}</button>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>Search for</label>
                    <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. medical store, bakery, salon" style={{ ...inputStyle, width: "100%" }} />
                  </div>
                  <div style={{ flex: "1 1 160px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>
                      <span>Radius</span><span className="font-mono">{radiusKm} km</span>
                    </div>
                    <input type="range" min={0.5} max={10} step={0.5} value={radiusKm} onChange={(e) => setRadiusKm(parseFloat(e.target.value))} style={{ width: "100%", accentColor: COLORS.brick }} />
                  </div>
                  <button onClick={search} disabled={searching} className="stall-btn" style={{ background: COLORS.navy, color: "#fff", border: "none", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <Search size={15} /> {searching ? "Searching…" : "Search nearby"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {searchError && <div style={{ color: COLORS.brick, fontSize: 12.5, marginBottom: 12 }}>{searchError}</div>}

          {results.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, color: "#666", marginBottom: 8 }}>
                {results.length} result{results.length === 1 ? "" : "s"}
                {results.some((r) => r.alreadyListed) && ` · ${results.filter((r) => r.alreadyListed).length} already on Stall`}
                {" "}· found one worth adding? Switch to "+ Add a store" and search its address there.
              </div>
              <div style={{ border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)", borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
                {results.map((r, i) => {
                  const dist = centerLoc ? haversineKm(centerLoc, { lat: r.lat, lng: r.lng }) : null;
                  return (
                    <div key={r.placeId} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}15`, background: r.alreadyListed ? "#f5f5f5" : "#fff", opacity: r.alreadyListed ? 0.6 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.ink }}>{r.name}</span>
                          {r.alreadyListed && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 16, background: COLORS.ink, color: "#fff" }}>Already listed</span>}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 16, border: `1px solid ${COLORS.ink}55`, color: COLORS.ink }}>{r.category}</span>
                          {r.rating != null && <span style={{ fontSize: 11, color: "#666" }}>★ {r.rating.toFixed(1)}{r.ratingsCount != null ? ` (${r.ratingsCount})` : ""}</span>}
                          {dist != null && <span className="font-mono" style={{ fontSize: 11, color: "#999" }}>{dist.toFixed(1)} km</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#777" }}>{r.vicinity}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {tab === "add" && (
        <div style={cardStyle}>
          <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>
            Add a store
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
            You'll get a claim code to share with the shop owner so they can take over the listing.
          </div>
          <form onSubmit={submitListing}>
            {field("Name", <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amma's Pickle Stand" />)}
            {field("Category", (
              <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            ))}
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
              onChange={(patch) => setForm((f) => ({
                ...f,
                ...patch,
                name: f.name.trim() ? f.name : (patch.name ?? f.name),
                hours: f.hours ? f.hours : (patch.hours ?? f.hours),
              }))}
            />
            {field("Hours", <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 56, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder={"Auto-filled from Google when available, or type your own, e.g.\nMon–Sat: 9:00 AM – 8:00 PM\nSun: Closed"} />)}
            {formError && <div style={{ color: COLORS.brick, fontSize: 12, marginBottom: 10 }}>{formError}</div>}
            <button type="submit" disabled={saving} className="stall-btn" style={{ background: COLORS.brick, color: "#fff", border: "none", borderRadius: 14, padding: "10px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              {saving && <Loader2 size={14} className="spin" />}
              <Plus size={15} /> {saving ? "Adding…" : "Add store"}
            </button>
          </form>

          {addedCode && (
            <div style={{ ...cardStyle, background: `${COLORS.marigold}18`, border: `1.5px solid ${COLORS.marigold}`, marginTop: 16, marginBottom: 0 }}>
              <div className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                Added "{addedCode.name}"
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                Share this claim code with the shop owner so they can take over their listing.
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13 }}>
                <span>{addedCode.name}</span><span className="font-mono" style={{ fontWeight: 700 }}>{addedCode.code}</span>
              </div>
              <button onClick={copyCode} className="stall-btn" style={{ marginTop: 10, background: COLORS.navy, color: "#fff", border: "none", borderRadius: 999, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Copy size={13} /> Copy
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}