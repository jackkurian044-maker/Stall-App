import React, { useEffect, useRef, useState } from "react";
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  Timestamp,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { COLORS } from "./constants";
import { distanceBetween } from "geofire-common";

const TAG_RADIUS_KM = 1;
const POINTS_PER_TAG = 25;
const DAILY_TAG_CAP = 3;

function isWithinTagRadius(userLoc, place) {
  if (!userLoc || !place?.lat || !place?.lng) return false;
  const distanceKm = distanceBetween([userLoc.lat, userLoc.lng], [place.lat, place.lng]);
  return distanceKm <= TAG_RADIUS_KM;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function TagStoreModal({ user, onClose, onTagged }) {
  const [userLoc, setUserLoc] = useState(null);
  const [locError, setLocError] = useState("");
  const [locating, setLocating] = useState(true);

  const [place, setPlace] = useState(null);
  const [distanceError, setDistanceError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError("Your browser doesn't support location — tagging needs GPS.");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("We need your location to tag a nearby store. Please allow location access and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (!userLoc || !inputRef.current || !window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["place_id", "name", "formatted_address", "geometry", "types"],
      locationBias: {
        center: { lat: userLoc.lat, lng: userLoc.lng },
        radius: TAG_RADIUS_KM * 1000,
      },
    });
    autocompleteRef.current = autocomplete;

    const listener = autocomplete.addListener("place_changed", () => {
      const p = autocomplete.getPlace();
      if (!p.geometry?.location) return;

      const picked = {
        placeId: p.place_id,
        name: p.name,
        address: p.formatted_address || "",
        lat: p.geometry.location.lat(),
        lng: p.geometry.location.lng(),
        category: (p.types || []).find((t) => t !== "point_of_interest" && t !== "establishment") || null,
      };

      setDistanceError("");
      if (!isWithinTagRadius(userLoc, picked)) {
        setPlace(null);
        setDistanceError(`That store's a bit far — you can only tag places within ${TAG_RADIUS_KM}km of you.`);
        return;
      }
      setPlace(picked);
    });

    return () => {
      if (window.google?.maps?.event) window.google.maps.event.removeListener(listener);
    };
  }, [userLoc]);

  // Submit — checks (1) has this user ever tagged this exact place before
  // (blocks repeat-tag point farming on the same store) and (2) today's
  // distinct-store cap, before writing the tag and awarding points.
  // Both checks + the writes happen in one transaction so they can't race.
  const submitTag = async () => {
    if (!place || !user) return;
    setSubmitting(true);
    setSubmitError("");

    const uid = user.uid;
    const capRef = doc(db, "users", uid, "tagCounters", todayKey());
    const userRef = doc(db, "users", uid);
    const alreadyTaggedRef = doc(db, "users", uid, "taggedPlaces", place.placeId);
    const tagRef = doc(collection(db, "store_tags"));

    try {
      await runTransaction(db, async (tx) => {
        const alreadySnap = await tx.get(alreadyTaggedRef);
        if (alreadySnap.exists()) {
          throw new Error("ALREADY_TAGGED");
        }

        const capSnap = await tx.get(capRef);
        const countToday = capSnap.exists() ? capSnap.data().count : 0;
        if (countToday >= DAILY_TAG_CAP) {
          throw new Error("DAILY_CAP_REACHED");
        }

        tx.set(tagRef, {
          taggedBy: uid,
          placeId: place.placeId,
          storeName: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          category: place.category,
          taggerLat: userLoc.lat,
          taggerLng: userLoc.lng,
          createdAt: serverTimestamp(),
        });

        tx.set(alreadyTaggedRef, { taggedAt: serverTimestamp() });
        tx.set(capRef, { count: countToday + 1 }, { merge: true });

        tx.update(userRef, {
          pointsBalance: increment(POINTS_PER_TAG),
          pointsHistory: arrayUnion({
            type: "tag_store",
            amount: POINTS_PER_TAG,
            placeId: place.placeId,
            createdAt: Timestamp.now(),
          }),
        });
      });

      setSuccess(true);
      onTagged?.();
    } catch (err) {
      if (err.message === "ALREADY_TAGGED") {
        setSubmitError("You've already tagged this store before — try a different one!");
      } else if (err.message === "DAILY_CAP_REACHED") {
        setSubmitError(`You've hit today's tagging limit (${DAILY_TAG_CAP}/day) — come back tomorrow for more points!`);
      } else {
        console.error("submitTag error:", err);
        setSubmitError("Something went wrong — please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>
            {success ? "Store tagged! 🎉" : "Tag a store"}
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">✕</button>
        </div>

        {success ? (
          <>
            <div style={{ fontSize: 13, color: "#444", marginBottom: 16 }}>
              You just earned <strong>{POINTS_PER_TAG} points</strong> for tagging <strong>{place?.name}</strong>.
              Thanks for helping us map your neighborhood!
            </div>
            <button onClick={onClose} className="stall-btn" style={primaryBtnStyle}>Done</button>
          </>
        ) : locating ? (
          <div style={{ fontSize: 13, color: "#666", padding: "20px 0" }}>Getting your location…</div>
        ) : locError ? (
          <div style={{ fontSize: 13, color: COLORS.brick, padding: "12px 0" }}>{locError}</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
              Search for the store — only places within {TAG_RADIUS_KM}km of you can be tagged.
            </div>

            <input
              ref={inputRef}
              type="text"
              placeholder="Search store name…"
              style={inputStyle}
            />

            {distanceError && (
              <div style={{ color: COLORS.brick, fontSize: 12, marginTop: 10 }}>{distanceError}</div>
            )}

            {place && (
              <div style={pickedCardStyle}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{place.name}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{place.address}</div>
              </div>
            )}

            {submitError && (
              <div style={{ color: COLORS.brick, fontSize: 12, marginTop: 10 }}>{submitError}</div>
            )}

            <button
              onClick={submitTag}
              disabled={!place || submitting}
              className="stall-btn"
              style={{ ...primaryBtnStyle, marginTop: 16, opacity: !place || submitting ? 0.5 : 1 }}
            >
              {submitting ? "Tagging…" : `Tag this store — earn ${POINTS_PER_TAG} points`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(15,26,36,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
};

const cardStyle = {
  width: "100%", maxWidth: 380, background: "#fff", borderRadius: 20,
  padding: 22, boxShadow: "0 12px 32px rgba(15,26,36,0.2)",
};

const closeBtnStyle = {
  background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#999", padding: 4,
};

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 14,
  border: `1.5px solid ${COLORS.ink}`, fontSize: 13, boxSizing: "border-box",
};

const pickedCardStyle = {
  marginTop: 12, padding: "10px 12px", borderRadius: 12,
  background: "#f6f6f4", border: "1px solid rgba(15,26,36,0.08)",
};

const primaryBtnStyle = {
  width: "100%", background: COLORS.navy, color: "#fff", border: "none",
  borderRadius: 999, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
