import React from "react";
import {
  ArrowLeft, CheckCircle2, Clock, Globe2, MapPin, MessageCircle,
  Navigation, Phone, Scissors, Star, Utensils,
} from "lucide-react";
import stallLogoMark from "./logo-cropped.png";
import { COLORS } from "./constants";
import { vendorLink } from "./geo";

export function RestaurantBusinessPage({ listing, onBack }) {
  return (
    <TemplateShell>
      <div style={pageWrap}>
        <Back onBack={onBack} />
        <Hero listing={listing} icon={<Utensils size={15} />} />
        <div style={specialGrid}>
          <Special title="Today's special" value={listing.todaySpecial} tone="gold" />
          <Special title="Everyday special" value={listing.everydaySpecial} tone="teal" />
        </div>
        <div style={infoGrid}>
          <Info icon={<MapPin size={17} />} title="Location" value={listing.address || "Location available on STall"} />
          {listing.hours && <Info icon={<Clock size={17} />} title="Hours" value={listing.hours} />}
          <Info icon={<Utensils size={17} />} title="Menu / Specials" value={csv(listing.products) || "Menu details coming soon"} />
        </div>
        {listing.offer && <Offer value={listing.offer} />}
      </div>
    </TemplateShell>
  );
}

export function SalonBusinessPage({ listing, onBack }) {
  return (
    <TemplateShell>
      <div style={pageWrap}>
        <Back onBack={onBack} />
        <Hero listing={listing} icon={<Scissors size={15} />} salon />
        <div style={specialGrid}>
          <Special title="Today's special" value={listing.todaySpecial} tone="gold" />
          <Special title="Everyday special" value={listing.everydaySpecial} tone="teal" />
        </div>
        <div style={infoGrid}>
          <Info icon={<Scissors size={17} />} title="Services" value={csv(listing.products) || "Services coming soon"} />
          <Info icon={<MapPin size={17} />} title="Location" value={listing.address || "Location available on STall"} />
          {listing.hours && <Info icon={<Clock size={17} />} title="Hours" value={listing.hours} />}
        </div>
        {listing.offer && <Offer value={listing.offer} />}
      </div>
    </TemplateShell>
  );
}

function Hero({ listing, icon, salon = false }) {
  const phone = String(listing.phone || "").replace(/\D/g, "");
  const wa = phone ? (phone.length === 10 ? "91" + phone : phone.startsWith("0") ? "91" + phone.slice(1) : phone) : "";
  const website = listing.website || listing.mapsUrl || vendorLink(listing);
  const isGrowth = ["digital_growth", "growth_setup"].includes(listing.planKey);
  const ratingText = listing.ratingsCount != null ? " · " + listing.ratingsCount + " Google ratings" : "";
  return (
    <section style={{ ...box, padding: 0, overflow: "hidden" }}>
      {listing.photos?.[0] && <img src={listing.photos[0]} alt={listing.name} style={{ width: "100%", height: 280, objectFit: "cover" }} />}
      <div style={{ padding: 24 }}>
        <div style={rowWrap}>
          <span style={pill}>{listing.category}</span>
          {(listing.isVerified || listing.planKey === "verified") && <span style={{ ...pill, background: COLORS.marigold, color: COLORS.ink }}><CheckCircle2 size={12} /> STall Verified</span>}
        </div>
        <h1 style={title}>{listing.name}</h1>
        {listing.description && <p style={description}>{listing.description}</p>}
        {listing.rating != null && <div style={rating}><Star size={16} fill={COLORS.marigold} color={COLORS.marigold} /> {Number(listing.rating).toFixed(1)}{ratingText}</div>}
        <div style={actions}>
          {wa && <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer" style={button}><MessageCircle size={15} /> WhatsApp</a>}
          {phone && <a href={"tel:" + phone} style={button}><Phone size={15} /> Call</a>}
          {isGrowth && <a href={website} target="_blank" rel="noreferrer" style={{ ...button, background: COLORS.marigold, color: COLORS.ink }}><Globe2 size={15} /> {salon ? "Book Now" : "Order / Book"}</a>}
          <a href={listing.mapsUrl || website} target="_blank" rel="noreferrer" style={outlineButton}><Navigation size={15} /> Directions</a>
        </div>
      </div>
    </section>
  );
}

function Special({ title, value, tone }) {
  if (!String(value || "").trim()) return null;
  const gold = tone === "gold";
  return (
    <section style={{ ...box, border: "2px solid " + (gold ? COLORS.marigold : COLORS.teal), background: gold ? "#fffaf0" : "#f5fbf9" }}>
      <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: gold ? "#8a6d1d" : COLORS.teal }}>{title}</div>
      <div style={{ fontSize: 21, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>{value}</div>
    </section>
  );
}

function Offer({ value }) {
  return <section style={{ ...box, marginTop: 12, border: "2px solid " + COLORS.marigold }}>
    <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#8a6d1d" }}>Current offer</div>
    <div style={{ fontSize: 22, fontWeight: 900, marginTop: 5 }}>{value}</div>
  </section>;
}

function Info({ icon, title, value }) {
  return <div style={{ ...box, padding: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 7, color: COLORS.teal, fontWeight: 900, fontSize: 12, textTransform: "uppercase" }}>{icon}{title}</div>
    <div style={{ color: "#444", whiteSpace: "pre-line", lineHeight: 1.5, marginTop: 7, fontSize: 13 }}>{value}</div>
  </div>;
}

function Back({ onBack }) {
  return <button onClick={onBack} style={backLink}><ArrowLeft size={15} /> Back to STall</button>;
}

function TemplateShell({ children }) {
  return <div style={{ minHeight: "100vh", background: "#f7f3eb", color: COLORS.ink }}>
    <header style={{ background: "#161616", borderBottom: "1px solid #2a2a2a", boxShadow: "0 2px 14px rgba(0,0,0,.35)", padding: "14px 24px", display: "flex", alignItems: "center" }}>
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#fff" }}>
        <img src={stallLogoMark} alt="STall" style={{ width: 40, height: "auto" }} />
        <span style={{ fontWeight: 700, fontSize: "1.28rem" }}>all</span>
        <span style={{ fontSize: 11, letterSpacing: ".04em", color: "#9c9c9c", fontWeight: 600 }}>what's around the corner</span>
      </a>
    </header>
    {children}
  </div>;
}

const csv = (value) => String(value || "").split(",").map(x => x.trim()).filter(Boolean).join(" · ");
const pageWrap = { maxWidth: 900, margin: "0 auto", padding: "18px 16px 50px" };
const box = { background: "#fff", border: "2px solid " + COLORS.ink, borderRadius: 16, padding: 22, boxShadow: "0 8px 25px rgba(0,0,0,.06)" };
const rowWrap = { display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" };
const title = { fontSize: 34, lineHeight: 1.1, margin: "12px 0 8px" };
const description = { color: "#555", lineHeight: 1.6, margin: 0 };
const rating = { display: "flex", alignItems: "center", gap: 6, marginTop: 13, fontWeight: 800 };
const actions = { display: "flex", flexWrap: "wrap", gap: 9, marginTop: 18 };
const specialGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 12 };
const infoGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 12 };
const button = { display: "inline-flex", alignItems: "center", gap: 7, background: COLORS.ink, color: "#fff", textDecoration: "none", border: 0, borderRadius: 9, padding: "10px 14px", fontWeight: 800, fontSize: 12.5 };
const outlineButton = { ...button, background: "#fff", color: COLORS.ink, border: "1px solid " + COLORS.ink };
const backLink = { background: "transparent", border: 0, padding: 0, color: "#666", cursor: "pointer", display: "flex", gap: 6, alignItems: "center", marginBottom: 18 };
const pill = { display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, background: COLORS.ink, color: "#fff", fontSize: 10.5, fontWeight: 900 };
