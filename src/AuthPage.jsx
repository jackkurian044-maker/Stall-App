import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./firebase";
import { COLORS } from "./constants";

export default function AuthPage({ onSignedIn }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const inputStyle = {
    width: "100%", padding: "9px 10px", borderRadius: 7,
    border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box",
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSignedIn?.();
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email) return setError("Enter your email above first, then tap reset.");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError(friendlyError(err.code));
    }
  };

  return (
    <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 24 }}>
        <div className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          {mode === "signup" ? "Create your account" : "Sign in"}
        </div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
          {mode === "signup"
            ? "Vendors sign up here, then list or claim their stall."
            : "Sign in to manage your listing."}
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>Email</label>
            <input style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>Password</label>
            <input style={inputStyle} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>

          {error && <div style={{ color: COLORS.brick, fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {resetSent && <div style={{ color: COLORS.teal, fontSize: 12, marginBottom: 10 }}>Password reset email sent.</div>}

          <button
            type="submit"
            disabled={busy}
            className="stall-btn"
            style={{ width: "100%", background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "10px", fontSize: 13, fontWeight: 700, marginBottom: 10 }}
          >
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <button
            onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
            style={{ background: "none", border: "none", color: COLORS.teal, cursor: "pointer", textDecoration: "underline", padding: 0 }}
          >
            {mode === "signup" ? "Already have an account? Sign in" : "New vendor? Create an account"}
          </button>
          {mode === "signin" && (
            <button onClick={resetPassword} style={{ background: "none", border: "none", color: "#777", cursor: "pointer", padding: 0 }}>
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function friendlyError(code) {
  switch (code) {
    case "auth/email-already-in-use": return "That email already has an account — try signing in instead.";
    case "auth/invalid-email": return "That doesn't look like a valid email address.";
    case "auth/weak-password": return "Password should be at least 6 characters.";
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Incorrect email or password.";
    case "auth/user-not-found": return "No account found with that email.";
    case "auth/too-many-requests": return "Too many attempts — please wait a moment and try again.";
    default: return "Something went wrong. Please try again.";
  }
}
