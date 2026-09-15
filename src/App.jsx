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

const AUTH_TRACE = "[STALL-AUTH v4]";
const trace = (...args) => console.info(AUTH_TRACE, ...args);

// Never allow an auxiliary Firestore role lookup to leave the whole app on
// the auth loading screen indefinitely. Firebase Auth remains the source of
// truth for whether the user is signed in.
const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((resolve) => setTimeout(() => {
    console.warn(AUTH_TRACE, `${label} lookup timed out`);
    resolve(null);
  }, ms)),
]);

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

      if (!u) {
        setIsAdmin(false);
        setAgent(null);
        setAuthLoading(false);
        trace("authLoading=false", { authenticated: false });
        return;
      }

      // Role lookups are independent. One failing/hanging lookup must not
      // block the other role or the authenticated app from rendering.
      const [adminSnap, agentSnap] = await Promise.all([
        withTimeout(getDoc(doc(db, "admins", u.uid)), 5000, "admin"),
        withTimeout(getDoc(doc(db, "agents", u.uid)), 5000, "agent"),
      ]);

      const admin = !!adminSnap?.exists();
      const agentData = agentSnap?.exists() ? agentSnap.data() : null;

      setIsAdmin(admin);
      setAgent(agentData);
      setAuthLoading(false);
      trace("role lookups complete", { admin, agent: !!agentData });
      trace("authLoading=false", { authenticated: true });
    });
    return unsub;
  }, []);

  useEffect(() => {
    trace("route observer", { mode, authenticated: !!user, admin: isAdmin, agent: !!agent });
    if (!user) {
      if (["mine", "admin", "bulk", "agent", "agents"].includes(mode)) setMode("find");
      return;
    }

    if (!isAdmin && ["admin", "bulk", "agents"].includes(mode)) setMode("find");
    if (!agent && mode === "agent") setMode("find");

    if (mode === "auth") {
      // Admin takes priority, then agent, then vendor. This fixes the
      // authenticated Admin account being sent into the vendor workspace.
      const destination = isAdmin ? "admin" : agent ? "agent" : "mine";
      trace("authenticated user leaving auth screen", { destination });
      setMode(destination);
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
            isAdmin ? <AdminDashboard /> : agent ? <AgentDashboard user={user} agent={agent} /> : <VendorEntry user={user} agent={agent} />
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
