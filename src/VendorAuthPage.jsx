import React, { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { auth } from "./firebase";
import { COLORS } from "./constants";

export default function VendorAuthPage({ initialError = "" }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const googleButtonRef = useRef(null);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  // Use Google Identity Services directly and exchange its ID token for a
  // Firebase credential. This deliberately avoids Firebase's popup/redirect
  // resolver, which is problematic on a GitHub Pages custom domain because
  // of browser cross-origin opener/storage restrictions.
  useEffect(() => {
    let cancelled = false;
    let timer;

    const setupGoogle = () => {
      if (cancelled || !googleButtonRef.current) return true;
      const google = window.google;
      const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
      if (!google?.accounts?.id || !clientId) return false;

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (cancelled) return;
          setError("");
          setGoogleBusy(true);
          try {
            const credential = GoogleAuthProvider.credential(response.credential);
            await signInWithCredential(auth, credential);
          } catch (err) {
            setError(friendlyError(err?.code));
          } finally {
            if (!cancelled) setGoogleBusy(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      googleButtonRef.current.innerHTML = "";
      google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 330,
      });
      setGoogleReady(true);
      return true;
    };

    if (!setupGoogle()) {
      timer = window.setInterval(() => {
        if (setupGoogle()) window.clearInterval(timer);
      }, 100);
    }

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Firebase auth state is the only login handoff. App.jsx watches
      // onAuthStateChanged and moves the authenticated vendor to the workspace.
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
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

        <div style={{ minHeight: 44, display: "flex", justifyContent: "center", marginBottom: 14, opacity: googleBusy ? 0.6 : 1 }}>
          <div ref={googleButtonRef} aria-label="Continue with Google" />
        </div>
        {!googleReady && <div style={{ textAlign: "center", fontSize: 11, color: "#999", marginTop: -8, marginBottom: 12 }}>Loading Google sign-in…</div>}

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
    case "auth/account-exists-with-different-credential": return "An account already exists with a different sign-in method. Try email and password instead.";
    case "auth/credential-already-in-use": return "This Google account is already linked to another account.";
    case "auth/too-many-requests": return "Too many attempts — please wait a moment and try again.";
    case "auth/network-request-failed": return "Network error during Google sign-in. Please try again.";
    default: return code ? `Sign-in failed (${code}). Please try again.` : "Something went wrong. Please try again.";
  }
}
