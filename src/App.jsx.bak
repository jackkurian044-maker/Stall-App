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
    if (agent && mode === "auth") setMode("agent");
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