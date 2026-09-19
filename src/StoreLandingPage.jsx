import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, CheckCircle2, Clock, Globe2, MapPin, MessageCircle, Navigation, Phone, Star } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";
import { vendorLink } from "./geo";

export default function StoreLandingPage({ listingId, onBack }) {
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getDoc(doc(db, "vendors", listingId)).then(snap => {
      if (!alive) return;
      setListing(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    }).catch(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [listingId]);

  if (loading) return <div style={page}><div style={box}>Loading business page…</div></div>;
  if (!listing) return <div style={page}><div style={box}><h2>Business not found</h2><button onClick={onBack} style={button}>Back to STall</button></div></div>;

  const paid = ["digital_growth", "growth_setup"].includes(listing.planKey);
  if (!paid) return <div style={page}><div style={box}><h2>This business page is not active</h2><p style={muted}>A STall Landing Page is included with Digital Growth and Growth Setup.</p><button onClick={onBack} style={button}>Back to STall</button></div></div>;

  const phone = String(listing.phone || "").replace(/\D/g, "");
  const wa = phone ? (phone.length === 10 ? "91" + phone : phone.startsWith("0") ? "91" + phone.slice(1) : phone) : "";
  const website = listing.website || listing.mapsUrl || vendorLink(listing);
  const isGrowth = listing.planKey === "growth_setup";
  const products = String(listing.products || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 10);
  const ratingText = listing.ratingsCount != null ? " · " + listing.ratingsCount + " Google ratings" : "";

  return (
    <div style={page}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 16px 50px" }}>
        <button onClick={onBack} style={{ background: "transparent", border: 0, padding: 0, color: "#666", cursor: "pointer", display: "flex", gap: 6, alignItems: "center", marginBottom: 18 }}><ArrowLeft size={15} /> Back to STall</button>

        <section style={{ ...box, overflow: "hidden", padding: 0 }}>
          {listing.photos?.[0] && <img src={listing.photos[0]} alt="" style={{ width: "100%", height: 280, objectFit: "cover" }} />}
          <div style={{ padding: 24 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
              <span style={pill}>{listing.category}</span>
              <span style={{ ...pill, background: COLORS.marigold, color: COLORS.ink }}><CheckCircle2 size={12} /> STall Verified</span>
              {isGrowth && <span style={{ ...pill, background: COLORS.teal, color: "#fff" }}>Growth Setup</span>}
            </div>
            <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: "12px 0 8px" }}>{listing.name}</h1>
            {listing.description && <p style={{ color: "#555", lineHeight: 1.6, margin: 0 }}>{listing.description}</p>}

            {listing.rating != null && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 13, fontWeight: 800 }}><Star size={16} fill={COLORS.marigold} color={COLORS.marigold} /> {Number(listing.rating).toFixed(1)}{ratingText}</div>}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 18 }}>
              {wa && <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer" style={button}><MessageCircle size={15} /> WhatsApp</a>}
              {phone && <a href={"tel:" + phone} style={button}><Phone size={15} /> Call</a>}
              {isGrowth && <a href={website} target="_blank" rel="noreferrer" style={{ ...button, background: COLORS.marigold, color: COLORS.ink }}><Globe2 size={15} /> Order / Book</a>}
              <a href={listing.mapsUrl || website} target="_blank" rel="noreferrer" style={{ ...button, background: "#fff", color: COLORS.ink, border: "1px solid " + COLORS.ink }}><Navigation size={15} /> Directions</a>
            </div>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 12 }}>
          <Info icon={<MapPin size={17} />} title="Location" value={listing.address || "Location available on STall"} />
          {listing.hours && <Info icon={<Clock size={17} />} title="Hours" value={listing.hours} />}
          {products.length > 0 && <Info icon={<Star size={17} />} title="Products / Services" value={products.join(" · ")} />}
        </div>

        {listing.offer && <section style={{ ...box, marginTop: 12, border: "2px solid " + COLORS.marigold }}>
          <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#8a6d1d" }}>Current offer</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 5 }}>{listing.offer}</div>
        </section>}
      </div>
    </div>
  );
}

function Info({ icon, title, value }) {
  return <div style={{ ...box, padding: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 7, color: COLORS.teal, fontWeight: 900, fontSize: 12, textTransform: "uppercase" }}>{icon}{title}</div><div style={{ color: "#444", whiteSpace: "pre-line", lineHeight: 1.5, marginTop: 7, fontSize: 13 }}>{value}</div></div>;
}

const page = { minHeight: "100vh", background: "#f7f3eb", color: COLORS.ink };
const box = { background: "#fff", border: "2px solid " + COLORS.ink, borderRadius: 16, padding: 22, boxShadow: "0 8px 25px rgba(0,0,0,.06)" };
const button = { display: "inline-flex", alignItems: "center", gap: 7, background: COLORS.ink, color: "#fff", textDecoration: "none", border: 0, borderRadius: 9, padding: "10px 14px", fontWeight: 800, fontSize: 12.5, cursor: "pointer" };
const pill = { display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, background: COLORS.ink, color: "#fff", fontSize: 10.5, fontWeight: 900 };
const muted = { color: "#666", lineHeight: 1.5 };
