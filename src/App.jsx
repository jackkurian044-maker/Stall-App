import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Header from "./Header";
import FindView from "./FindView";
import VendorAuthPage from "./VendorAuthRedirect";
import VendorEntry from "./VendorEntry";
import AdminDashboard from "./AdminDashboard";
import DiscoverNearby from "./DiscoverNearby";
import AgentDashboard from "./AgentDashboard";
import AdminAgents from "./AdminAgents";
import PrivacyPolicy from "./PrivacyPolicy";
import Footer from "./Footer";

const AUTH_TRACE = "[STALL-AUTH v3]";
const trace = (...args) => console.info(AUTH_TRACE, ...args);

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agent, setAgent] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState("find");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gbp") === "connected") {
      setMode("mine");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    trace("auth listener attached");
    const unsub = onAuthStateChanged(auth, async (u) => {
      trace("onAuthStateChanged", u ? { uid: u.uid, providerIds: u.providerData?.map(p => p.providerId) } : "SIGNED_OUT");
      setUser(u);
      if (u) {
        try {
          const adminSnap = await getDoc(doc(db, "admins", u.uid));
          setIsAdmin(adminSnap.exists());
          trace("admin lookup", adminSnap.exists());
        } catch (err) {
          console.warn(AUTH_TRACE, "admin lookup failed", err?.code);
          setIsAdmin(false);
        }
        try {
          const agentSnap = await getDoc(doc(db, "agents", u.uid));
          setAgent(agentSnap.exists() ? agentSnap.data() : null);
          trace("agent lookup", agentSnap.exists());
        } catch (err) {
          console.warn(AUTH_TRACE, "agent lookup failed", err?.code);
          setAgent(null);
        }
      } else {
        setIsAdmin(false);
        setAgent(null);
      }
      setAuthLoading(false);
      trace("authLoading=false", { mode, authenticated: !!u });
    });
    return unsub;
  }, []);

  useEffect(() => {
    trace("route observer", { mode, authenticated: !!user, agent: !!agent });
    if (!user) {
      if (["mine", "admin", "bulk", "agent", "agents"].includes(mode)) setMode("find");
      return;
    }

    if (!isAdmin && ["admin", "bulk", "agents"].includes(mode)) setMode("find");
    if (!agent && mode === "agent") setMode("find");

    if (mode === "auth") {
      trace("authenticated vendor leaving auth screen", { destination: agent ? "agent" : "mine" });
      setMode(agent ? "agent" : "mine");
    }
  }, [user, isAdmin, agent, mode]);

  const handleSignOut = async () => {
    trace("sign out requested");
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
          user ? (
            agent ? <AgentDashboard user={user} agent={agent} /> : <VendorEntry user={user} agent={agent} />
          ) : (
            <VendorAuthPage />
          )
        ) : mode === "mine" && user ? (
          <VendorEntry user={user} agent={agent} />
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
