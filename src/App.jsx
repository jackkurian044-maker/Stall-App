import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Header from "./Header";
import FindView from "./FindView";
import VendorAuthPage from "./VendorAuthRedirect";
import VendorEntry from "./VendorEntry";
import AdminDashboard from "./AdminDashboard";
import AdminOperationsCentre from "./AdminOperationsCentre";
import DiscoverNearby from "./DiscoverNearby";
import AgentDashboard from "./AgentDashboard";
import AdminAgents from "./AdminAgents";
import PrivacyPolicy from "./PrivacyPolicy";
import Footer from "./Footer";
import ReviewAutoResponder from "./ReviewAutoResponder";
import BusinessOwnerCTA from "./BusinessOwnerCTA";
import StoreLandingPage from "./StoreLandingPage";

const AUTH_TRACE = "[STALL-AUTH v4]";
const trace = (...args) => console.info(AUTH_TRACE, ...args);

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agent, setAgent] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState("find");
  const [landingStoreId, setLandingStoreId] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathMatch = window.location.pathname.match(/^\/business\/([^/]+)\/?$/i);
    const storeId = (params.get("store") || (pathMatch ? pathMatch[1] : "") || "").trim();
    if (storeId) {
      setLandingStoreId(storeId);
      setMode("landing");
      if (params.get("store") || pathMatch) window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (params.get("upgrade") === "1") {
      try {
        window.sessionStorage.setItem("stallPremiumIntent", "1");
        if (params.get("plan")) window.sessionStorage.setItem("stallUpgradePlan", params.get("plan"));
        if (params.get("id")) window.sessionStorage.setItem("stallUpgradeListingId", params.get("id"));
        if (params.get("claim")) window.sessionStorage.setItem("stallUpgradeClaim", params.get("claim"));
      } catch {}
      setMode("auth");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (params.get("premium") === "1") {
      try { window.sessionStorage.setItem("stallPremiumIntent", "1"); } catch {}
      setMode("auth");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (params.get("gbp") === "connected") {
      setMode("mine");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (params.get("admin") === "operations") {
      setMode("admin-operations");
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
      trace("authLoading=false", { authenticated: !!u });
    });
    return unsub;
  }, []);

  useEffect(() => {
    trace("route observer", { mode, authenticated: !!user, admin: isAdmin, agent: !!agent, authLoading });
    if (authLoading || mode === "landing") return;

    if (!user) {
      if (["mine", "admin", "admin-operations", "bulk", "agent", "agents", "reviews"].includes(mode)) setMode("find");
      return;
    }

    if (!isAdmin && ["admin", "admin-operations", "bulk", "agents"].includes(mode)) setMode("find");
    if (!agent && mode === "agent") setMode("find");
    if ((isAdmin || agent) && mode === "reviews") setMode(isAdmin ? "admin" : "agent");

    if (mode === "auth") {
      const destination = isAdmin ? "admin" : agent ? "agent" : "mine";
      trace("authenticated user leaving auth screen", { destination });
      setMode(destination);
    }
  }, [user, isAdmin, agent, mode, authLoading]);

  const handleSignOut = async () => {
    trace("sign out requested");
    await signOut(auth);
    setMode("find");
  };

  const openVendorSignup = () => {
    try { window.sessionStorage.setItem("stallVendorIntent", "signup"); } catch {}
    setMode("auth");
  };

  const openVendorClaim = () => {
    try { window.sessionStorage.setItem("stallVendorIntent", "claim"); } catch {}
    setMode("auth");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column" }}>
      <Header mode={mode} setMode={setMode} user={user} isAdmin={isAdmin} isAgent={!!agent} onSignOut={handleSignOut} />
      <div style={{ flex: 1 }}>
        {mode === "landing" ? (
          <StoreLandingPage listingId={landingStoreId} onBack={() => { setMode("find"); window.history.replaceState({}, "", "/"); }} />
        ) : authLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9c9c9c", fontSize: 14 }}>Loading…</div>
        ) : mode === "find" ? (
          <>
            <BusinessOwnerCTA onListFree={openVendorSignup} onClaim={openVendorClaim} />
            <FindView user={user} isAdmin={isAdmin} onRequestSignIn={() => setMode("auth")} />
          </>
        ) : mode === "auth" ? (
          user ? (
            isAdmin ? <AdminDashboard /> : agent ? <AgentDashboard user={user} agent={agent} /> : <VendorEntry user={user} agent={agent} />
          ) : (
            <VendorAuthPage />
          )
        ) : mode === "mine" && user ? (
          <VendorEntry user={user} agent={agent} />
        ) : mode === "reviews" && user && !isAdmin && !agent ? (
          <ReviewAutoResponder listing={null} />
        ) : mode === "admin" && isAdmin ? (
          <AdminDashboard />
        ) : mode === "admin-operations" && isAdmin ? (
          <AdminOperationsCentre />
        ) : mode === "agent" && user && agent ? (
          <AgentDashboard user={user} agent={agent} />
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