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
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setListing(data);
      setLoading(false);

      if (data) {
        const description = data.description || `${data.name} on STall.`;
        document.title = `${data.name} | STall`;
        const setMeta = (name, content) => {
          let el = document.querySelector(`meta[name="${name}"]`);
          if (!el) {
            el = document.createElement("meta");
            el.setAttribute("name", name);
            document.head.appendChild(el);
          }
          el.setAttribute("content", content);
        };
        setMeta("description", description);
        setMeta("robots", "index,follow");
      }
    }).catch(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [listingId]);

  useEffect(() => {
    if (!listing) return;
    const canonical = document.querySelector('link[rel="canonical"]') || document.head.appendChild(document.createElement("link"));
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", window.location.href);
    return () => {
      document.title = "STall";
    };
  }, [listing]);

  if (loading) return <div style={page}><div style={box}>Loading business page…</div></div>;
  if (!listing) return <div style={page}><div style={box}><h2>Business not found</h2><button onClick={onBack} style={button}>Back to STall</button></div></div>;

  const activePagePlan = ["verified", "digital_growth", "growth_setup"].includes(listing.planKey);
  if (!activePagePlan) return <div style={page}><div style={box}><h2>This business page is not active</h2><p style={muted}>A STall public business page is available for active STall Verified and Growth listings.</p><button onClick={onBack} style={button}>Back to STall</button></div></div>;

  const phone = String(listing.phone || "").replace(/\D/g, "");
  const wa = (() => {
    const digits = phone;
    if (!digits) return "";
    if (digits.startsWith("00971")) return digits.slice(2);
    if (digits.startsWith("971")) return digits;
    if (/^05\d{8}$/.test(digits)) return "971" + digits.slice(1);
    if (/^04\d{7}$/.test(digits)) return "971" + digits.slice(1);
    if (digits.length === 10) return "91" + digits;
    if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
    if (digits.length === 12 && digits.startsWith("91")) return digits;
    if (digits.length === 14 && digits.startsWith("0091")) return digits.slice(2);
    return digits;
  })();
  const website = listing.website || listing.mapsUrl || vendorLink(listing);
  const directUrl = "/direct/" + listing.id;
  const isGrowth = ["digital_growth", "growth_setup"].includes(listing.planKey);
  const isGrowthSetup = listing.planKey === "growth_setup";
  const products = String(listing.products || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 10);
  const ratingText = listing.ratingsCount != null ? " · " + listing.ratingsCount + " Google ratings" : "";

  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: listing.name,
    description: listing.description || undefined,
    telephone: listing.phone || undefined,
    address: listing.address ? { "@type": "PostalAddress", streetAddress: listing.address } : undefined,
    url: window.location.href,
    aggregateRating: listing.rating != null && listing.ratingsCount ? {
      "@type": "AggregateRating",
      ratingValue: Number(listing.rating),
      reviewCount: Number(listing.ratingsCount),
    } : undefined,
  };
  const schemaJson = JSON.stringify(schema);

  return (
    <div style={page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaJson }} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 16px 50px" }}>
        <button onClick={onBack} style={{ background: "transparent", border: 0, padding: 0, color: "#666", cursor: "pointer", display: "flex", gap: 6, alignItems: "center", marginBottom: 18 }}><ArrowLeft size={15} /> Back to STall</button>

        <section style={{ ...box, overflow: "hidden", padding: 0 }}>
          {listing.photos?.[0] && <img src={listing.photos[0]} alt={listing.name} style={{ width: "100%", height: 280, objectFit: "cover" }} />}
          <div style={{ padding: 24 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
              <span style={pill}>{listing.category}</span>
              {listing.isVerified || listing.planKey === "verified" ? <span style={{ ...pill, background: COLORS.marigold, color: COLORS.ink }}><CheckCircle2 size={12} /> STall Verified</span> : null}
              {isGrowthSetup && <span style={{ ...pill, background: COLORS.teal, color: "#fff" }}>Growth Setup</span>}
            </div>
            <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: "12px 0 8px" }}>{listing.name}</h1>
            {listing.description && <p style={{ color: "#555", lineHeight: 1.6, margin: 0 }}>{listing.description}</p>}

            {listing.rating != null && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 13, fontWeight: 800 }}><Star size={16} fill={COLORS.marigold} color={COLORS.marigold} /> {Number(listing.rating).toFixed(1)}{ratingText}</div>}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 18 }}>
              {wa && <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer" style={button}><MessageCircle size={15} /> WhatsApp</a>}
              {phone && <a href={"tel:" + phone} style={button}><Phone size={15} /> Call</a>}
              {isGrowth && <a href={directUrl} style={{ ...button, background: COLORS.marigold, color: COLORS.ink }}><Globe2 size={15} /> Order / Book</a>}
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
