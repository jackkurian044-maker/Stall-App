import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { COLORS } from "./constants";

const WELCOME_BONUS_POINTS = 99;

// Genuinely new sign-up only — full welcome bonus.
async function grantWelcomeBonus(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return;

  await setDoc(userRef, {
    pointsBalance: WELCOME_BONUS_POINTS,
    pointsHistory: [
      { type: "welcome_bonus", amount: WELCOME_BONUS_POINTS, createdAt: serverTimestamp() },
    ],
    createdAt: serverTimestamp(),
  }, { merge: true });
}

// Existing account (vendor or customer) that predates the points feature
// and has no user doc yet — backfill at 0, no bonus, so tagging works.
async function backfillPointsDocIfMissing(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return;

  await setDoc(userRef, {
    pointsBalance: 0,
    pointsHistory: [],
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export default function AuthPage({ onSignedIn, audience = "vendor" }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const isCustomer = audience === "customer";

  const inputStyle = {
    width: "100%", padding: "9px 10px", borderRadius: 14,
    border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box",
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let cred;
      if (mode === "signup") {
        cred = await createUserWithEmailAndPassword(auth, email, password);
        await grantWelcomeBonus(cred.user.uid);
      } else {
        cred = await signInWithEmailAndPassword(auth, email, password);
        await backfillPointsDocIfMissing(cred.user.uid);
      }
      onSignedIn?.();
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
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      const isNewUser = getAdditionalUserInfo(cred)?.isNewUser;
      if (isNewUser) {
        await grantWelcomeBonus(cred.user.uid);
      } else {
        await backfillPointsDocIfMissing(cred.user.uid);
      }
      onSignedIn?.();
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setError(friendlyError(err.code));
      }
    } finally {
      setGoogleBusy(false);
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
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", border: "1px solid rgba(15,26,36,0.08)", boxShadow: "0 8px 24px rgba(15,26,36,0.08)", borderRadius: 20, padding: 24 }}>
        <div className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          {isCustomer
            ? (mode === "signup" ? "Join STALL" : "Sign in")
            : (mode === "signup" ? "Create your account" : "Sign in")}
        </div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
          {isCustomer
            ? (mode === "signup"
                ? `Sign up, get ${WELCOME_BONUS_POINTS} points — on us.`
                : "Sign in to tag stores and track your points.")
            : (mode === "signup"
                ? "Vendors sign up here, then list or claim their stall."
                : "Sign in to manage your listing.")}
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={googleBusy || busy}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "#fff", color: COLORS.ink, border: `1.5px solid ${COLORS.ink}`,
            borderRadius: 999, padding: "10px", fontSize: 13, fontWeight: 700, marginBottom: 14, cursor: "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.5 29.5 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.3-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 6.5 29.5 4.5 24 4.5c-7.7 0-14.3 4.4-17.7 10.2z"/>
            <path fill="#4CAF50" d="M24 44.5c5.4 0 10.3-1.9 14-5.1l-6.5-5.5c-2.1 1.5-4.7 2.4-7.5 2.4-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.5 40 16.2 44.5 24 44.5z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.5-2.5 4.6-4.7 6.1l6.5 5.5C40.3 37 44.5 31.2 44.5 24c0-1.2-.1-2.4-.3-3.5z"/>
          </svg>
          {googleBusy ? "Please wait…" : "Continue with Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(15,26,36,0.12)" }} />
          <span style={{ fontSize: 11, color: "#999" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "rgba(15,26,36,0.12)" }} />
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
          {resetSent && <div style={{ color: COLORS.green, fontSize: 12, marginBottom: 10 }}>Password reset email sent.</div>}

          <button
            type="submit"
            disabled={busy || googleBusy}
            className="stall-btn"
            style={{ width: "100%", background: COLORS.navy, color: "#fff", border: "none", borderRadius: 999, padding: "10px", fontSize: 13, fontWeight: 700, marginBottom: 10 }}
          >
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <button
            onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
            style={{ background: "none", border: "none", color: COLORS.green, cursor: "pointer", textDecoration: "underline", padding: 0 }}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : isCustomer ? "New here? Create an account" : "New vendor? Create an account"}
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
    case "auth/popup-blocked": return "Your browser blocked the sign-in popup — please allow popups and try again.";
    default: return "Something went wrong. Please try again.";
  }
}
