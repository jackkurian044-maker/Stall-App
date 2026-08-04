#!/usr/bin/env bash
# Sets up the Sales Agent system in your Stall-App repo.
# Run this from the ROOT of your repo (where package.json and firebase.json live).
set -euo pipefail

if [ ! -d "src" ] || [ ! -d "functions" ]; then
  echo "Run this from your repo root (couldn't find src/ and functions/ here)."
  exit 1
fi

echo "Backing up src/App.jsx -> src/App.jsx.bak"
cp src/App.jsx src/App.jsx.bak

echo "Writing functions/agentCommissions.js"
cat > functions/agentCommissions.js << 'FILE_EOF'
// functions/agentCommissions.js
//
// NEW FILE. Wire it into your existing functions/index.js with:
//   module.exports = { ...module.exports, ...require("./agentCommissions") };
// (or, if your index.js already uses named exports style like
//  `exports.createSubscription = ...`, just add at the bottom:
//   Object.assign(exports, require("./agentCommissions"));)
//
// Uses Firebase Functions v2 syntax. If your project is still on v1
// (`firebase-functions` without the `/v2` subpath), say so and I'll
// rewrite the two trigger definitions — the callable bodies work either way.

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// How long after a store converts to Premium an agent's commission for it
// can still be clawed back if the store cancels. Change this one line only.
const CLAWBACK_WINDOW_DAYS = 30;
const CLAWBACK_WINDOW_MS = CLAWBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Fires on every write to premium_vendors/{vendorUid} — this single doc is
 * where BOTH the Razorpay verifySubscription flow and the admin's manual
 * "Grant"/"Remove" toggle in AdminDashboard write, so one trigger covers
 * every path a vendor can become or stop being Premium.
 *
 * false/absent -> true   : possible commission (see grantCommission)
 * true -> false/absent   : possible clawback (see clawbackCommission)
 */
exports.onPremiumStatusChanged = onDocumentWritten("premium_vendors/{vendorUid}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const vendorUid = event.params.vendorUid;

  const wasPremium = before?.isPremium === true;
  const isPremiumNow = after?.isPremium === true;

  if (!wasPremium && isPremiumNow) {
    await grantCommissions(vendorUid);
  } else if (wasPremium && !isPremiumNow) {
    await clawbackCommissions(vendorUid);
  }
});

async function grantCommissions(vendorUid) {
  const vendorsSnap = await db.collection("vendors").where("ownerId", "==", vendorUid).get();
  if (vendorsSnap.empty) return;

  for (const vendorDoc of vendorsSnap.docs) {
    const vendor = vendorDoc.data();
    const agentId = vendor.addedByAgentId;
    if (!agentId) continue; // this listing wasn't added by an agent

    const commissionRef = db.collection("commissions").doc(vendorDoc.id); // one doc per vendor, ever
    const existing = await commissionRef.get();

    // Already has a live (non-clawed-back) commission — never double-create.
    if (existing.exists && existing.data().status !== "clawed_back") continue;

    const agentSnap = await db.collection("agents").doc(agentId).get();
    if (!agentSnap.exists) continue;
    const agent = agentSnap.data();

    // Either first time, or the store previously churned within the
    // clawback window and has now resubscribed — give it a fresh record.
    await commissionRef.set({
      agentId,
      agentName: agent.name || "",
      vendorId: vendorDoc.id,
      vendorName: vendor.name || "",
      amount: agent.commissionAmount || 0,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      paidAt: null,
      paidBy: null,
      clawedBack: false,
      clawedBackAt: null,
      priorStatusBeforeClawback: null,
    });
  }
}

async function clawbackCommissions(vendorUid) {
  const vendorsSnap = await db.collection("vendors").where("ownerId", "==", vendorUid).get();
  if (vendorsSnap.empty) return;

  const now = Date.now();

  for (const vendorDoc of vendorsSnap.docs) {
    const commissionRef = db.collection("commissions").doc(vendorDoc.id);
    const snap = await commissionRef.get();
    if (!snap.exists) continue;

    const commission = snap.data();
    if (commission.status === "clawed_back") continue; // already handled

    const createdMs = commission.createdAt?.toMillis?.() ?? 0;
    if (!createdMs || now - createdMs > CLAWBACK_WINDOW_MS) continue; // outside window — agent keeps it

    // Inside the window: claw it back. If it was already marked paid, the
    // admin needs to manually recover the money from the agent — we just
    // flag that clearly (priorStatusBeforeClawback) rather than pretending
    // to auto-deduct anything.
    await commissionRef.update({
      status: "clawed_back",
      clawedBack: true,
      clawedBackAt: admin.firestore.FieldValue.serverTimestamp(),
      priorStatusBeforeClawback: commission.status,
    });
  }
}

/**
 * Admin-only callable to create a new sales agent account. Creating a
 * Firebase Auth user client-side (createUserWithEmailAndPassword) would
 * sign the *admin* out and sign the new agent in instead — so this has
 * to happen server-side with the Admin SDK.
 */
exports.createAgentAccount = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in first.");

  const adminDoc = await db.collection("admins").doc(callerUid).get();
  if (!adminDoc.exists) throw new HttpsError("permission-denied", "Admins only.");

  const { name, email, password, monthlyTarget, commissionAmount } = request.data;
  if (!name || !email || !password) {
    throw new HttpsError("invalid-argument", "Name, email, and password are required.");
  }
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({ email, password, displayName: name });
  } catch (err) {
    throw new HttpsError("already-exists", err.message || "Couldn't create that account.");
  }

  await db.collection("agents").doc(userRecord.uid).set({
    name,
    email,
    monthlyTarget: Number(monthlyTarget) || 0,
    commissionAmount: Number(commissionAmount) || 0,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: callerUid,
  });

  return { uid: userRecord.uid };
});

/**
 * Admin-only callable to deactivate/reactivate an agent. Keeps their
 * history intact — just blocks further store-adding via Firestore rules,
 * which check agents/{uid}.active.
 */
exports.setAgentActive = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Sign in first.");
  const adminDoc = await db.collection("admins").doc(callerUid).get();
  if (!adminDoc.exists) throw new HttpsError("permission-denied", "Admins only.");

  const { agentId, active } = request.data;
  if (!agentId) throw new HttpsError("invalid-argument", "agentId is required.");
  await db.collection("agents").doc(agentId).update({ active: !!active });
  return { ok: true };
});
FILE_EOF

echo "Writing src/AgentDashboard.jsx"
cat > src/AgentDashboard.jsx << 'FILE_EOF'
import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where, writeBatch, serverTimestamp } from "firebase/firestore";
import { MapPin, Locate, Search, Copy, Loader2, Target, IndianRupee, Store } from "lucide-react";
import { db } from "./firebase";
import { CATEGORIES, COLORS, DEFAULT_LOC } from "./constants";
import { uid, haversineKm } from "./geo";
import { loadGoogleMaps } from "./googleMaps";
import { findExistingPlaceIds } from "./duplicateCheck";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

const TYPE_CATEGORY_MAP = [
  [["restaurant", "food", "bakery", "grocery_or_supermarket", "meal_takeaway", "meal_delivery", "cafe"], "Food & Produce"],
  [["clothing_store", "shoe_store", "jewelry_store"], "Clothing & Accessories"],
  [["hardware_store", "home_goods_store", "furniture_store", "electrician", "plumber"], "Home & Garden"],
  [["hair_care", "beauty_salon", "spa", "laundry", "doctor", "dentist", "pharmacy", "gym", "physiotherapist", "veterinary_care"], "Services"],
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

export default function AgentDashboard({ user, agent }) {
  const [myVendors, setMyVendors] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [tab, setTab] = useState("overview"); // "overview" | "add"

  const [centerLoc, setCenterLoc] = useState(null);
  const [locating, setLocating] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [radiusKm, setRadiusKm] = useState(2);
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState({});
  const [adding, setAdding] = useState(false);
  const [addedCodes, setAddedCodes] = useState(null);
  const [importError, setImportError] = useState("");
  const [locateError, setLocateError] = useState("");

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

  // ── location + search (same behaviour as DiscoverNearby) ──
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
    setSearching(true); setSearchError(""); setResults([]); setSelected({}); setAddedCodes(null);
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

  const toggleSelect = (placeId) => {
    const r = results.find((res) => res.placeId === placeId);
    if (r?.alreadyListed) return;
    setSelected((s) => ({ ...s, [placeId]: !s[placeId] }));
  };

  const updateResultCategory = (placeId, category) => {
    setResults((rs) => rs.map((r) => (r.placeId === placeId ? { ...r, category } : r)));
  };

  const selectedResults = results.filter((r) => selected[r.placeId]);

  const addSelected = async () => {
    if (selectedResults.length === 0) return;
    setAdding(true); setImportError("");
    try {
      const batch = writeBatch(db);
      const created = [];
      for (const r of selectedResults) {
        const ref = doc(collection(db, "vendors"));
        const code = uid(6);
        batch.set(ref, {
          name: r.name, category: r.category, description: "", products: "",
          address: r.vicinity || "", phone: "", lat: r.lat, lng: r.lng,
          website: null, mapsUrl: null, placeId: r.placeId,
          rating: r.rating, ratingsCount: r.ratingsCount,
          hours: "", photos: [], ownerId: null, claimCode: code,
          addedByAgentId: user.uid, addedByAgentName: agent.name || "",
          createdAt: serverTimestamp(), ratingUpdatedAt: r.placeId ? serverTimestamp() : null,
        });
        created.push({ name: r.name, code });
      }
      await batch.commit();
      setAddedCodes(created);
      setResults([]); setSelected({});
    } catch {
      setImportError("Couldn't add — try again.");
    } finally {
      setAdding(false);
    }
  };

  const copyResults = () => {
    navigator.clipboard?.writeText(addedCodes.map((r) => `${r.name}: ${r.code}`).join("\n"));
  };

  const inputStyle = { padding: "9px 10px", borderRadius: 14, border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box" };
  const cardStyle = { background: "#fff", border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)", borderRadius: 20, padding: 18, marginBottom: 16 };

  return (
    <div className="stall-page" style={{ maxWidth: 900 }}>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        Welcome, {agent.name || user.email}
      </div>
      <div style={{ fontSize: 12.5, color: "#666", marginBottom: 16 }}>
        Add nearby stores to Stall — you'll earn a commission whenever a store you add upgrades to Premium.
        {" "}If a store cancels within 30 days of converting, that commission is clawed back.
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {["overview", "add"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className="stall-btn" style={{
            padding: "8px 16px", borderRadius: 14, fontSize: 13, fontWeight: 600,
            border: `1.5px solid ${COLORS.ink}`,
            background: tab === t ? COLORS.ink : "#fff", color: tab === t ? "#fff" : COLORS.ink,
          }}>
            {t === "overview" ? "Overview" : "+ Add a store"}
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

      {tab === "add" && (
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
          {importError && <div style={{ color: COLORS.brick, fontSize: 12.5, marginBottom: 12 }}>{importError}</div>}

          {addedCodes && (
            <div style={{ ...cardStyle, background: `${COLORS.marigold}18`, border: `1.5px solid ${COLORS.marigold}` }}>
              <div className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                Added {addedCodes.length} store{addedCodes.length === 1 ? "" : "s"}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                Share each claim code with the shop owner so they can take over their listing.
              </div>
              {addedCodes.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}15` }}>
                  <span>{r.name}</span><span className="font-mono" style={{ fontWeight: 700 }}>{r.code}</span>
                </div>
              ))}
              <button onClick={copyResults} className="stall-btn" style={{ marginTop: 10, background: COLORS.navy, color: "#fff", border: "none", borderRadius: 999, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Copy size={13} /> Copy all as text
              </button>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, color: "#666", marginBottom: 8 }}>
                {results.length} result{results.length === 1 ? "" : "s"} · {selectedResults.length} selected
                {results.some((r) => r.alreadyListed) && ` · ${results.filter((r) => r.alreadyListed).length} already on Stall`}
              </div>
              <div style={{ border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)", borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
                {results.map((r, i) => {
                  const dist = centerLoc ? haversineKm(centerLoc, { lat: r.lat, lng: r.lng }) : null;
                  return (
                    <div key={r.placeId} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}15`, background: r.alreadyListed ? "#f5f5f5" : selected[r.placeId] ? `${COLORS.marigold}15` : "#fff", opacity: r.alreadyListed ? 0.6 : 1 }}>
                      <input type="checkbox" checked={!!selected[r.placeId]} disabled={r.alreadyListed} onChange={() => toggleSelect(r.placeId)} style={{ marginTop: 4, width: 16, height: 16, accentColor: COLORS.brick, flexShrink: 0, cursor: r.alreadyListed ? "not-allowed" : "pointer" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.ink }}>{r.name}</span>
                          {r.alreadyListed && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 16, background: COLORS.ink, color: "#fff" }}>Already listed</span>}
                          {r.rating != null && <span style={{ fontSize: 11, color: "#666" }}>★ {r.rating.toFixed(1)}{r.ratingsCount != null ? ` (${r.ratingsCount})` : ""}</span>}
                          {dist != null && <span className="font-mono" style={{ fontSize: 11, color: "#999" }}>{dist.toFixed(1)} km</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#777", marginBottom: 4 }}>{r.vicinity}</div>
                        <select value={r.category} onChange={(e) => updateResultCategory(r.placeId, e.target.value)} style={{ fontSize: 11, padding: "3px 6px", borderRadius: 20, border: `1px solid ${COLORS.ink}55`, background: "#fff", color: COLORS.ink }}>
                          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={addSelected} disabled={adding || selectedResults.length === 0} className="stall-btn" style={{ background: COLORS.brick, color: "#fff", border: "none", borderRadius: 14, padding: "10px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                {adding && <Loader2 size={14} className="spin" />}
                {adding ? "Adding…" : `Add ${selectedResults.length} selected`}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
FILE_EOF

echo "Writing src/AdminAgents.jsx"
cat > src/AdminAgents.jsx << 'FILE_EOF'
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { UserPlus, Loader2, Check, Ban, IndianRupee, AlertTriangle } from "lucide-react";
import { db, auth } from "./firebase";
import { COLORS } from "./constants";

const emptyForm = { name: "", email: "", password: "", monthlyTarget: 20, commissionAmount: 100 };

export default function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [premiumMap, setPremiumMap] = useState({}); // ownerId -> isPremium (live, current truth)
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => setAgents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vendors"), (snap) => setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return unsub;
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "commissions"), (snap) => setCommissions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
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

  const inputStyle = { padding: "9px 10px", borderRadius: 7, border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box", width: "100%" };
  const field = (label, node) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>{label}</label>
      {node}
    </div>
  );

  const createAgent = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.name.trim() || !form.email.trim() || !form.password) return setError("Name, email, and password are required.");
    setCreating(true);
    try {
      const functions = getFunctions();
      const createAgentAccount = httpsCallable(functions, "createAgentAccount");
      await createAgentAccount({
        name: form.name.trim(), email: form.email.trim(), password: form.password,
        monthlyTarget: Number(form.monthlyTarget), commissionAmount: Number(form.commissionAmount),
      });
      setSuccess(`Agent "${form.name}" created — share their email and password with them to log in.`);
      setForm(emptyForm);
    } catch (err) {
      setError(err.message || "Couldn't create agent.");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (agent) => {
    try {
      const functions = getFunctions();
      const setAgentActive = httpsCallable(functions, "setAgentActive");
      await setAgentActive({ agentId: agent.id, active: !agent.active });
    } catch (err) {
      alert(`Couldn't update: ${err.message}`);
    }
  };

  const markPaid = async (commission) => {
    const ok = confirm(`Mark ₹${commission.amount} to ${commission.agentName} as paid?`);
    if (!ok) return;
    try {
      await updateDoc(doc(db, "commissions", commission.id), {
        status: "paid", paidAt: serverTimestamp(), paidBy: auth.currentUser?.uid || null,
      });
    } catch (err) {
      alert(`Couldn't update: ${err.message}`);
    }
  };

  const acknowledgeClawback = async (commission) => {
    const ok = confirm(`Confirm you've recovered ₹${commission.amount} from ${commission.agentName}?`);
    if (!ok) return;
    try {
      await updateDoc(doc(db, "commissions", commission.id), { priorStatusBeforeClawback: "recovered" });
    } catch (err) {
      alert(`Couldn't update: ${err.message}`);
    }
  };

  const statsFor = (agentId) => {
    const stores = vendors.filter((v) => v.addedByAgentId === agentId);
    const agentCommissions = commissions.filter((c) => c.agentId === agentId);
    const pending = agentCommissions.filter((c) => c.status === "pending").reduce((s, c) => s + (c.amount || 0), 0);
    const paid = agentCommissions.filter((c) => c.status === "paid").reduce((s, c) => s + (c.amount || 0), 0);
    const clawedBack = agentCommissions.filter((c) => c.status === "clawed_back").length;
    // "currently premium" reads live from premium_vendors — the authoritative,
    // real-time source — not just from a commission record's status, so a
    // store that churned after the clawback window (agent keeps the money)
    // still shows correctly as no-longer-premium here.
    const currentlyPremium = stores.filter((v) => v.ownerId && premiumMap[v.ownerId]).length;
    return { storeCount: stores.length, convertedCount: agentCommissions.length, currentlyPremium, clawedBack, pending, paid };
  };

  const pendingCommissions = commissions.filter((c) => c.status === "pending");
  const recoverableClawbacks = commissions.filter((c) => c.status === "clawed_back" && c.priorStatusBeforeClawback === "paid");

  return (
    <div className="stall-grid">
      <div className="stall-panel" style={{ padding: 18, alignSelf: "start" }}>
        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Add a sales agent</div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
          Creates their login. Share the email and password with them directly.
        </div>
        <form onSubmit={createAgent}>
          {field("Name", <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />)}
          {field("Email", <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />)}
          {field("Password", <input type="text" style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 6 characters" />)}
          {field("Monthly target (stores)", <input type="number" min="0" style={inputStyle} value={form.monthlyTarget} onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} />)}
          {field("Commission per Premium conversion (₹)", <input type="number" min="0" style={inputStyle} value={form.commissionAmount} onChange={(e) => setForm({ ...form, commissionAmount: e.target.value })} />)}
          {error && <div style={{ color: COLORS.brick, fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {success && <div style={{ color: COLORS.green, fontSize: 12, marginBottom: 10 }}>{success}</div>}
          <button type="submit" disabled={creating} className="stall-btn" style={{ width: "100%", background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "10px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {creating ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />} {creating ? "Creating…" : "Create agent"}
          </button>
        </form>
      </div>

      <div>
        {recoverableClawbacks.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={17} color={COLORS.brick} /> Needs recovery
            </div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              These were already paid out, then the store cancelled Premium within 30 days — recover from the agent directly.
            </div>
            <div style={{ border: `2px solid ${COLORS.brick}`, borderRadius: 12, overflow: "hidden" }}>
              {recoverableClawbacks.map((c, i) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: "#fff" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.agentName}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{c.vendorName} cancelled within the clawback window · ₹{c.amount} already paid</div>
                  </div>
                  <button onClick={() => acknowledgeClawback(c)} className="stall-btn" style={{ background: COLORS.brick, color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                    <Check size={13} /> Recovered
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingCommissions.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <IndianRupee size={17} color={COLORS.marigold} /> Pending commissions
            </div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              {pendingCommissions.length} awaiting payout — still inside the 30-day clawback window until it clears.
            </div>
            <div style={{ border: `2px solid ${COLORS.marigold}`, borderRadius: 12, overflow: "hidden" }}>
              {pendingCommissions.map((c, i) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: "#fff" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.agentName}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{c.vendorName} went Premium · ₹{c.amount}</div>
                  </div>
                  <button onClick={() => markPaid(c)} className="stall-btn" style={{ background: COLORS.green, color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                    <Check size={13} /> Mark paid
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Agents</div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>{agents.length} total</div>

        {agents.length === 0 ? (
          <div style={{ border: `2px dashed ${COLORS.ink}55`, borderRadius: 12, padding: 30, textAlign: "center", color: "#666", fontSize: 13 }}>
            No agents yet — add one on the left.
          </div>
        ) : (
          <div style={{ border: `2px solid ${COLORS.ink}`, borderRadius: 12, overflow: "hidden" }}>
            {agents.map((a, i) => {
              const stats = statsFor(a.id);
              const progressPct = a.monthlyTarget > 0 ? Math.min(100, Math.round((stats.storeCount / a.monthlyTarget) * 100)) : 0;
              return (
                <div key={a.id} style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${COLORS.ink}22`, background: a.active === false ? "#f5f5f5" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{a.name}</span>
                        {a.active === false && <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.brick }}>INACTIVE</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#777" }}>{a.email}</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
                        {stats.storeCount} stores added · {stats.convertedCount} ever converted · {stats.currentlyPremium} currently Premium
                        {stats.clawedBack > 0 && ` · ${stats.clawedBack} clawed back`}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 2 }}>
                        <span style={{ color: COLORS.green, fontWeight: 600 }}>₹{stats.paid} paid</span>
                        {stats.pending > 0 && <span style={{ color: COLORS.goldDark, fontWeight: 600, marginLeft: 8 }}>₹{stats.pending} pending</span>}
                      </div>
                      {a.monthlyTarget > 0 && (
                        <div style={{ marginTop: 6, height: 5, width: 160, borderRadius: 6, background: `${COLORS.ink}15`, overflow: "hidden" }}>
                          <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct >= 100 ? COLORS.green : COLORS.marigold }} />
                        </div>
                      )}
                    </div>
                    <button onClick={() => toggleActive(a)} title={a.active === false ? "Reactivate agent" : "Deactivate agent"} className="stall-btn" style={{ background: "transparent", border: `1.5px solid ${a.active === false ? COLORS.green : COLORS.brick}`, color: a.active === false ? COLORS.green : COLORS.brick, borderRadius: 7, padding: "5px 9px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <Ban size={12} /> {a.active === false ? "Reactivate" : "Deactivate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
FILE_EOF

echo "Overwriting src/App.jsx (backup saved as src/App.jsx.bak)"
cat > src/App.jsx << 'FILE_EOF'
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Header from "./Header";
import FindView from "./FindView";
import AuthPage from "./AuthPage";
import VendorDashboard from "./VendorDashboard";
import AdminDashboard from "./AdminDashboard";
import DiscoverNearby from "./DiscoverNearby";
import AgentDashboard from "./AgentDashboard";
import AdminAgents from "./AdminAgents";
import PrivacyPolicy from "./PrivacyPolicy";
import Footer from "./Footer";

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agent, setAgent] = useState(null); // agents/{uid} doc data, or null if not an agent
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState("find");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const adminSnap = await getDoc(doc(db, "admins", u.uid));
          setIsAdmin(adminSnap.exists());
        } catch {
          setIsAdmin(false);
        }
        try {
          const agentSnap = await getDoc(doc(db, "agents", u.uid));
          setAgent(agentSnap.exists() ? agentSnap.data() : null);
        } catch {
          setAgent(null);
        }
      } else {
        setIsAdmin(false);
        setAgent(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      if (["mine", "admin", "bulk", "agent", "agents"].includes(mode)) setMode("find");
      return;
    }
    if (!isAdmin && ["admin", "bulk", "agents"].includes(mode)) setMode("find");
    if (!agent && mode === "agent") setMode("find");
    // Right after sign-in, route agents straight to their dashboard instead
    // of the (likely empty) vendor "My Listings" view.
    if (agent && (mode === "auth" || mode === "mine")) setMode("agent");
  }, [user, isAdmin, agent, mode]);

  const handleSignOut = async () => {
    await signOut(auth);
    setMode("find");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
      <Header mode={mode} setMode={setMode} user={user} isAdmin={isAdmin} isAgent={!!agent} onSignOut={handleSignOut} />

      <div style={{ flex: 1 }}>
        {authLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9c9c9c", fontSize: 14 }}>Loading…</div>
        ) : mode === "find" ? (
          <FindView user={user} isAdmin={isAdmin} onRequestSignIn={() => setMode("auth")} />
        ) : mode === "auth" ? (
          <AuthPage onSignedIn={() => setMode("mine")} />
        ) : mode === "mine" && user ? (
          <VendorDashboard user={user} />
        ) : mode === "agent" && user && agent ? (
          <AgentDashboard user={user} agent={agent} />
        ) : mode === "admin" && isAdmin ? (
          <AdminDashboard />
        ) : mode === "bulk" && isAdmin ? (
          <DiscoverNearby />
        ) : mode === "agents" && isAdmin ? (
          <AdminAgents />
        ) : mode === "privacy" ? (
          <PrivacyPolicy onBack={() => setMode("find")} />
        ) : (
          <FindView user={user} isAdmin={isAdmin} onRequestSignIn={() => setMode("auth")} />
        )}
      </div>

      {mode !== "privacy" && <Footer onNavigatePrivacy={() => setMode("privacy")} />}
    </div>
  );
}
FILE_EOF


echo "Wiring agentCommissions.js into functions/index.js"
if grep -q "agentCommissions" functions/index.js 2>/dev/null; then
  echo "  functions/index.js already references agentCommissions.js — skipping."
else
  {
    echo ""
    echo "// Sales agent commission triggers + agent account management"
    echo 'Object.assign(exports, require("./agentCommissions"));'
  } >> functions/index.js
  echo "  Appended to functions/index.js"
fi

echo ""
echo "Done writing files. Two things this script CANNOT do for you safely,"
echo "since I don't have those files' current contents:"
echo ""
echo "  1) firestore.rules — merge the rules from firestore-rules-additions.txt"
echo "     into your existing firestore.rules by hand, then run:"
echo "       firebase deploy --only firestore:rules"
echo ""
echo "  2) src/Header.jsx — add an 'Agents' nav button (isAdmin) that calls"
echo "     setMode('agents'), and a 'My Dashboard' nav button (isAgent) that"
echo "     calls setMode('agent'). Pass isAgent as a prop from App.jsx (already"
echo "     wired on the App.jsx side)."
echo ""
echo "Once those two are done, deploy the functions:"
echo "  firebase deploy --only functions:onPremiumStatusChanged,functions:createAgentAccount,functions:setAgentActive"
echo ""
echo "Then review src/App.jsx against src/App.jsx.bak (git diff src/App.jsx.bak src/App.jsx)"
echo "before committing, in case you'd changed App.jsx since you last shared it."
