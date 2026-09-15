import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "./firebase";
import { COLORS } from "./constants";

export default function VendorAuthPage() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // IMPORTANT: App.jsx/onAuthStateChanged is the only login handoff.
      // Do not manually change the route here. Firebase may resolve the
      // credential before React's auth listener has published `user`, and a
      // manual route change can race with App's unauthenticated guard.
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      // Keep this screen mounted only until Firebase publishes auth state.
      // App.jsx then switches directly to the vendor workspace.
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setError("");
    setGoogleBusy(true);
    try {
      await signInWithRedirect(auth, new GoogleAuthProvider());
    } catch (err) {
      setGoogleBusy(false);
      setError(friendlyError(err.code));
    }
  };

  const resetPassword = async () => {
    if (!email) return setError("Enter your email above first, then tap reset.");
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err) {
      setError(friendlyError(err.code));
    }
  };

  return (
    <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)", borderRadius: 20, padding: 24 }}>
        <div className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{mode === "signup" ? "Create your account" : "Sign in"}</div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
          {mode === "signup" ? "Vendors sign up here, then list or claim their stall." : "Sign in to manage your listing."}
        </div>

        <button type="button" onClick={signInWithGoogle} disabled={googleBusy || busy} style={{ width: "100%", background: "#fff", color: COLORS.ink, border: `1.5px solid ${COLORS.ink}`, borderRadius: 999, padding: "10px", fontSize: 13, fontWeight: 700, marginBottom: 14, cursor: "pointer" }}>
          {googleBusy ? "Redirecting to Google…" : "Continue with Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(15,26,36,0.12)" }} />
          <span style={{ fontSize: 11, color: "#999" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "rgba(15,26,36,0.12)" }} />
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>Email</label>
            <input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>Password</label>
            <input style={inputStyle} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>
          {error && <div style={{ color: COLORS.brick, fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {resetSent && <div style={{ color: COLORS.green, fontSize: 12, marginBottom: 10 }}>Password reset email sent.</div>}
          <button type="submit" disabled={busy || googleBusy} className="stall-btn" style={{ width: "100%", background: COLORS.navy, color: "#fff", border: "none", borderRadius: 999, padding: "10px", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            {busy ? "Signing you in…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setResetSent(false); }} style={{ background: "none", border: "none", color: COLORS.green, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            {mode === "signup" ? "Already have an account? Sign in" : "New vendor? Create an account"}
          </button>
          {mode === "signin" && <button type="button" onClick={resetPassword} style={{ background: "none", border: "none", color: "#777", cursor: "pointer", padding: 0 }}>Forgot password?</button>}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 14,
  border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box",
};

function friendlyError(code) {
  switch (code) {
    case "auth/email-already-in-use": return "That email already has an account — try signing in instead.";
    case "auth/invalid-email": return "That doesn't look like a valid email address.";
    case "auth/weak-password": return "Password should be at least 6 characters.";
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Incorrect email or password.";
    case "auth/user-not-found": return "No account found with that email.";
    case "auth/too-many-requests": return "Too many attempts — please wait a moment and try again.";
    case "auth/popup-blocked": return "Your browser blocked the sign-in popup — please allow popups and try again.";
    default: return "Something went wrong. Please try again.";
  }
}
