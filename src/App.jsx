import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { COLORS } from "./constants";
import Header from "./Header";
import FindView from "./FindView";
import AuthPage from "./AuthPage";
import VendorDashboard from "./VendorDashboard";
import AdminDashboard from "./AdminDashboard";
import DiscoverNearby from "./DiscoverNearby";
import Footer from "./Footer";

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState("find");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, "admins", u.uid));
          setIsAdmin(snap.exists());
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user && (mode === "mine" || mode === "admin" || mode === "bulk")) setMode("find");
    if (user && !isAdmin && (mode === "admin" || mode === "bulk")) setMode("find");
  }, [user, isAdmin, mode]);

  const handleSignOut = async () => {
    await signOut(auth);
    setMode("find");
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.paper }}>
      <Header mode={mode} setMode={setMode} user={user} isAdmin={isAdmin} onSignOut={handleSignOut} />

      {authLoading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#666", fontSize: 14 }}>Loading…</div>
      ) : mode === "find" ? (
        <FindView user={user} isAdmin={isAdmin} onRequestSignIn={() => setMode("auth")} />
      ) : mode === "auth" ? (
        <AuthPage onSignedIn={() => setMode("mine")} />
      ) : mode === "mine" && user ? (
        <VendorDashboard user={user} />
      ) : mode === "admin" && isAdmin ? (
        <AdminDashboard />
      ) : mode === "bulk" && isAdmin ? (
        <DiscoverNearby />
      ) : (
        <FindView user={user} isAdmin={isAdmin} onRequestSignIn={() => setMode("auth")} />
      )}

      <Footer />
    </div>
  );
}
