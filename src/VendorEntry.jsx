import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import VendorDashboard from "./VendorDashboard";
import VendorOnboarding from "./VendorOnboarding";

export default function VendorEntry({ user, agent }) {
  const [hasListings, setHasListings] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "vendors"), where("ownerId", "==", user.uid));
    return onSnapshot(q, (snap) => setHasListings(!snap.empty), () => setHasListings(false));
  }, [user.uid]);

  if (hasListings === null) {
    return <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 14 }}>Loading your business workspace…</div>;
  }

  return hasListings
    ? <VendorDashboard user={user} agent={agent} />
    : <VendorOnboarding user={user} onComplete={() => { /* Firestore ownership update causes this entry to switch automatically. */ }} />;
}
