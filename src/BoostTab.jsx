// BoostTab.jsx
// Drop this in: src/BoostTab.jsx
// Import in VendorDashboard.jsx — see integration comment at bottom of this file
//
// Mirrors PremiumGate.jsx's structure on purpose: same onSnapshot pattern,
// same httpsCallable pattern, same cardStyle. Calls the runBoostScan
// Cloud Function (functions/index.js Section 4) and renders its result
// from vendors/{listing.id}/boost/latest.

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "./firebase";
import { COLORS } from "./constants";
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, Circle } from "lucide-react";

const BAND_COPY = {
  strong: { label: "Strong", bg: "#EAF3DE", fg: "#3B6D11" },
  needs_work: { label: "Needs work", bg: "#FAEEDA", fg: "#854F0B" },
  at_risk: { label: "At risk", bg: "#FCEBEB", fg: "#A32D2D" },
};

export default function BoostTab({ user, listing }) {
  const [premium, setPremium] = useState(null);
  const [gbpConnected, setGbpConnected] = useState(null);
  const [boost, setBoost] = useState(null); // undefined until first scan ever runs
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const vendorId = user?.uid; // premium_vendors + gbp_connections are keyed by auth uid
  const functions = getFunctions();

  useEffect(() => {
    if (!vendorId) return;
    const unsubPremium = onSnapshot(doc(db, "premium_vendors", vendorId), (snap) => {
      setPremium(snap.exists() ? snap.data() : { isPremium: false });
    });
    const unsubGbp = onSnapshot(doc(db, "gbp_connections", vendorId), (snap) => {
      setGbpConnected(snap.exists() && snap.data().connected);
    });
    return () => {
      unsubPremium();
      unsubGbp();
    };
  }, [vendorId]);

  // vendors/{listing.id}/boost/latest — keyed by the listing's own doc id,
  // same collection nesting pattern as vendor_digests uses l.id.
  useEffect(() => {
    if (!listing?.id) return;
    const unsub = onSnapshot(
      doc(db, "vendors", listing.id, "boost", "latest"),
      (snap) => setBoost(snap.exists() ? snap.data() : null),
      (err) => {
        console.error("Boost listener error:", err);
        setBoost(null);
      }
    );
    return unsub;
  }, [listing?.id]);

  async function handleScan() {
    setError("");
    setScanning(true);
    try {
      const runBoostScan = httpsCallable(functions, "runBoostScan");
      await runBoostScan();
      // Firestore listener above will pick up the new result automatically.
    } catch (err) {
      setError(err.message || "Scan failed — please try again.");
    } finally {
      setScanning(false);
    }
  }

  const cardStyle = {
    background: "#fff",
    border: "1px solid rgba(15,26,36,0.08)",
    boxShadow: "0 8px 24px rgba(15,26,36,0.08)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  };

  if (premium === null || gbpConnected === null) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", color: "#999", fontSize: 13 }}>
        Loading boost status...
      </div>
    );
  }

  if (!premium.isPremium) {
    return (
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <Sparkles size={22} color={COLORS.marigold} style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 14, color: "#374151", marginBottom: 4 }}>
          Boost is part of Stall Premium.
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
          Subscribe in the Premium tab to unlock your Google visibility score.
        </div>
      </div>
    );
  }

  if (!gbpConnected) {
    return (
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <AlertCircle size={22} color={COLORS.brick} style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 14, color: "#374151", marginBottom: 4 }}>
          Connect your Google Business Profile first.
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
          Head to the Premium tab's review responder section to connect it — Boost uses the same connection.
        </div>
      </div>
    );
  }

  const band = boost ? BAND_COPY[boost.band] || BAND_COPY.needs_work : null;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="font-display" style={{ fontSize: 19, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={18} /> Boost
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="stall-btn"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: scanning ? `${COLORS.ink}88` : COLORS.ink,
            color: "#fff", border: "none", borderRadius: 14,
            padding: "7px 14px", fontSize: 12.5, fontWeight: 600,
            cursor: scanning ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw size={13} className={scanning ? "spin" : ""} />
          {scanning ? "Scanning..." : "Rescan"}
        </button>
      </div>

      {!boost ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF", fontSize: 13 }}>
          No scan yet — tap Rescan to check your Google Business Profile.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.navy, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
              border: `5px solid ${COLORS.marigold}`, display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: COLORS.paper, fontSize: 18, fontWeight: 700 }}>{boost.score}</span>
            </div>
            <div>
              <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, background: band.bg, color: band.fg, fontWeight: 700 }}>
                {band.label}
              </span>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
                Last scanned {boost.scannedAt?.toDate?.()?.toLocaleDateString("en-IN") || "just now"}
              </div>
            </div>
          </div>

          {boost.checklist?.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3B6D11" }}>
              <CheckCircle2 size={16} /> Everything's in good shape — nothing to fix right now.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {boost.checklist?.map((item) => (
                <div key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#374151" }}>
                  <Circle size={14} style={{ marginTop: 2, flexShrink: 0, color: COLORS.brick }} />
                  <span>{item.message || item.label}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#E24B4A", marginTop: 10 }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
    </div>
  );
}

/*
─────────────────────────────────────────────────────────────
INTEGRATION: Add to VendorDashboard.jsx
─────────────────────────────────────────────────────────────

1. Import at top, next to the existing PremiumGate/ReviewAutoResponder imports:
   import BoostTab from "./BoostTab";

2. Reuse the same "premium" tab section (around line 431-433 where
   ReviewAutoResponder and PremiumGate already render together) —
   just add BoostTab alongside them:

   <ReviewAutoResponder listing={listings[0]} />
   <PremiumGate user={user} listing={listings[0]} />
   <BoostTab user={user} listing={listings[0]} />

   No new tab needed — Boost lives in the same "⚡ Premium" tab as the
   review responder and subscription card, since it's gated on the same
   isPremium flag for now (see the note in runBoostScan about splitting
   this into its own add-on tier later).

3. Optional: add this to your global.css for the rescan spin icon:
   .spin { animation: spin 1s linear infinite; }
   @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
─────────────────────────────────────────────────────────────
*/
