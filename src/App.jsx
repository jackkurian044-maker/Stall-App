import React, { useEffect, useState } from "react";
import { getRedirectResult, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Header from "./Header";
import FindView from "./FindView";
import VendorAuthPage from "./VendorAuthPage";
import VendorEntry from "./VendorEntry";
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
  const [authRedirectError, setAuthRedirectError] = useState("");

  useEffect(() => {
    // Complete any pending Firebase Google redirect and surface a real
    // redirect error instead of silently returning to the sign-in screen.
    let active = true;
    getRedirectResult(auth)
      .then(() => {
        if (active) setAuthRedirectError("");
      })
      .catch((err) => {
        if (active) setAuthRedirectError(friendlyAuthError(err?.code));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // If we just landed back from the Google Business Profile OAuth
    // redirect, jump straight into the vendor dashboard and strip the
    // query param so it doesn't linger in the URL / re-trigger on refresh.
    const params = new URLSearchParams(window.location.search);
    if (params.get("gbp") === "connected") {
      setMode("mine");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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

    // Keep the route synchronized with Firebase auth. The render path below
    // also handles the authenticated+auth state directly, so there is no
    // intermediate render of the sign-in screen after a successful login.
    if (mode === "auth") {
      setMode(agent ? "agent" : "mine");
    }
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
          user ? (
            agent ? <AgentDashboard user={user} agent={agent} /> : <VendorEntry user={user} agent={agent} />
          ) : (
            <VendorAuthPage initialError={authRedirectError} />
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

function friendlyAuthError(code) {
  switch (code) {
    case "auth/unauthorized-domain": return "This website is not authorized for Google sign-in. Please contact support.";
    case "auth/account-exists-with-different-credential": return "An account already exists with a different sign-in method. Try email and password instead.";
    case "auth/popup-closed-by-user": return "Google sign-in was cancelled.";
    case "auth/web-storage-unsupported": return "Your browser blocked the sign-in session. Please enable cookies/site storage and try again.";
    case "auth/network-request-failed": return "Network error during Google sign-in. Please try again.";
    default: return `Google sign-in failed (${code || "unknown error"}). Please try again.`;
  }
}
