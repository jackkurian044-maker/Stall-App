import React from "react";
import { COLORS } from "./constants";

export default function PrivacyPolicy({ onBack }) {
  const section = { marginBottom: 28 };
  const h2 = { fontSize: 18, fontWeight: 700, marginBottom: 8, color: COLORS.ink };
  const p = { fontSize: 14.5, lineHeight: 1.7, color: "#444" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", color: COLORS.teal, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 24, padding: 0 }}
      >
        ← Back
      </button>
      <h1 className="font-display" style={{ fontSize: 30, marginBottom: 6 }}>Privacy Policy</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

      <div style={section}>
        <h2 style={h2}>What we collect</h2>
        <p style={p}>
          To show you vendors near you, Stall uses your device's approximate location when you allow it —
          this is only used to sort and filter listings, and is not stored against your identity beyond the
          current session unless you create an account. If you sign in, we store your email address, and
          if you list a store, we store the business details you provide (name, address, phone, photos).
        </p>
      </div>

      <div style={section}>
        <h2 style={h2}>How we use it</h2>
        <p style={p}>
          Location data powers distance sorting and "near me" search. Account data lets you manage your
          own listings, save favorites, and receive updates about vendors you follow. We do not sell your
          personal data to third parties, and we do not use your location for advertising targeting outside
          of Stall itself.
        </p>
      </div>

      <div style={section}>
        <h2 style={h2}>What vendors see</h2>
        <p style={p}>
          Vendors can see aggregate, anonymous interaction counts for their own listing (how many people
          viewed, called, or got directions) — never who specifically interacted with their listing.
          If you contact a vendor directly by phone or WhatsApp, that conversation happens outside Stall
          and is between you and the vendor.
        </p>
      </div>

      <div style={section}>
        <h2 style={h2}>Your choices</h2>
        <p style={p}>
          You can use Stall's core search without creating an account or granting location access — you'll
          just need to search by area name instead of "near me." You can delete your account and listing
          data at any time from your dashboard. You can deny location permission at any time through your
          browser or device settings.
        </p>
      </div>

      <div style={section}>
        <h2 style={h2}>Contact</h2>
        <p style={p}>
          Questions about this policy or your data can be sent through the contact details listed on the
          Stall landing page.
        </p>
      </div>
    </div>
  );
}
