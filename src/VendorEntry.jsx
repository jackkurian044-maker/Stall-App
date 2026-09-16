import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import VendorDashboardHome from "./VendorDashboardHomeV2";
import VendorOnboarding from "./VendorOnboarding";

export default function VendorEntry({ user, agent }) {
  const [hasListings, setHasListings] = useState(null);
  const [openDashboard, setOpenDashboard] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "vendors"), where("ownerId", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setHasListings(!snap.empty);
      if (!snap.empty) setOpenDashboard(true);
    }, () => setHasListings(false));
  }, [user.uid]);

  useEffect(() => {
    const handleOpenDashboard = () => setOpenDashboard(true);
    window.addEventListener("stall:open-vendor-dashboard", handleOpenDashboard);
    return () => window.removeEventListener("stall:open-vendor-dashboard", handleOpenDashboard);
  }, []);

  if (hasListings === null) {
    return <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 14 }}>Loading your business workspace…</div>;
  }

  if (hasListings || openDashboard) {
    return <VendorDashboardHome user={user} agent={agent} />;
  }

  return <VendorOnboarding user={user} onComplete={() => setOpenDashboard(true)} />;
}
