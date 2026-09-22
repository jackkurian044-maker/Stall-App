import React from "react";
import {
  ArrowLeft, CheckCircle2, Clock, Globe2, MapPin, MessageCircle,
  Navigation, Phone, Scissors, Star, Utensils, Share2, Crown, Menu as MenuIcon,
} from "lucide-react";
import stallLogoMark from "./logo-cropped.png";
import { COLORS } from "./constants";
import { vendorLink } from "./geo";

export function RestaurantBusinessPage({ listing, onBack }) {
  const layout = listing.pageLayout || "classic";
  if (layout === "spotlight") return <RestaurantSpotlightPage listing={listing} onBack={onBack} />;
  if (layout === "compact") return <RestaurantCompactPage listing={listing} onBack={onBack} />;
  return <RestaurantClassicPage listing={listing} onBack={onBack} />;
}

export function SalonBusinessPage({ listing, onBack }) {
  const layout = listing.pageLayout || "classic";
  if (layout === "spotlight") return <SalonSpotlightPage listing={listing} onBack={onBack} />;
  if (layout === "compact") return <SalonCompactPage listing={listing} onBack={onBack} />;
  return <SalonClassicPage listing={listing} onBack={onBack} />;
}

function ActionBar({ listing, salon = false, compact = false }) {
  const phone = String(listing.phone || "").replace(/\D/g, "");
  const wa = phone ? (phone.length === 10 ? "91" + phone : phone.startsWith("0") ? "91" + phone.slice(1) : phone) : "";
  const maps = listing.mapsUrl || vendorLink(listing);
  const website = listing.website || listing.mapsUrl || maps;
  const isGrowth = ["digital_growth", "growth_setup"].includes(listing.planKey);
  return <div style={{ ...actions, marginTop: compact ? 12 : 18 }}>
    {wa && <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer" style={button}><MessageCircle size={15} /> WhatsApp</a>}
    {phone && <a href={"tel:" + phone} style={button}><Phone size={15} /> Call</a>}
    {isGrowth && <a href={website} target="_blank" rel="noreferrer" style={{ ...button, background: "var(--accent)", color: "var(--ink)" }}><Globe2 size={15} /> {salon ? "Book Now" : "Order / Book"}</a>}
    <a href={maps} target="_blank" rel="noreferrer" style={outlineButton}><Navigation size={15} /> Directions</a>
    <button onClick={() => navigator.share?.({ title: listing.name, url: window.location.href })} style={outlineButton}><Share2 size={15} /> Share</button>
  </div>;
}

function PublicIdentity({ listing }) {
  return <div>
    <div style={rowWrap}>
      <span style={pill}>{listing.category}</span>
      {(listing.isVerified || listing.planKey === "verified") && <span style={{ ...pill, background: "var(--accent)", color: "var(--ink)" }}><CheckCircle2 size={12} /> STall Verified</span>}
    </div>
    <h1 style={title}>{listing.name}</h1>
    {listing.description && <p style={description}>{listing.description}</p>}
    {listing.rating != null && <div style={rating}><Star size={16} fill={"var(--accent)"} color={"var(--accent)"} /> {Number(listing.rating).toFixed(1)}{listing.ratingsCount != null ? " · " + listing.ratingsCount + " Google ratings" : ""}</div>}
  </div>;
}

function RestaurantSpotlightPage({ listing, onBack }) {
  const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
  return <TemplateShell listing={listing}>
    <div style={pageWrap}>
      <Back onBack={onBack} />
      <section style={{ ...spotlightBox, overflow: "hidden" }}>
        {photos[0] && <img src={photos[0]} alt={listing.name} style={spotlightPhoto} />}
        <div style={{ padding: 24 }}>
          <PublicIdentity listing={listing} />
          <ActionBar listing={listing} />
        </div>
      </section>
      <div style={specialGrid}>
        <Special title="Today’s Special" value={listing.todaySpecial} tone="gold" />
        <Special title="Everyday Special" value={listing.everydaySpecial} tone="teal" />
      </div>
      <div style={infoGrid}>
        <Info icon={<Utensils size={17} />} title="Menu / Specials" value={csv(listing.products) || "Menu details coming soon"} />
        <Info icon={<MapPin size={17} />} title="Location" value={listing.address || "Location available on STall"} />
        {listing.hours && <Info icon={<Clock size={17} />} title="Hours" value={listing.hours} />}
      </div>
      {listing.offer && <Offer value={listing.offer} />}
      {photos.length > 1 && <PhotoStrip photos={photos} name={listing.name} />}
    </div>
  </TemplateShell>;
}

function RestaurantCompactPage({ listing, onBack }) {
  const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
  return <TemplateShell listing={listing}>
    <div style={pageWrap}>
      <Back onBack={onBack} />
      <section style={{ ...compactBox, gridTemplateColumns: photos[0] ? "110px minmax(0,1fr)" : "1fr" }}>
        {photos[0] && <img src={photos[0]} alt={listing.name} style={compactPhoto} />}
        <div>
          <PublicIdentity listing={listing} />
          <ActionBar listing={listing} compact />
        </div>
      </section>
      <div style={compactInfoGrid}>
        <Info icon={<Utensils size={17} />} title="Menu / Specials" value={csv(listing.products) || "Menu details coming soon"} />
        <Info icon={<MapPin size={17} />} title="Location" value={listing.address || "Location available on STall"} />
        {listing.hours && <Info icon={<Clock size={17} />} title="Hours" value={listing.hours} />}
      </div>
      <div style={specialGrid}>
        <Special title="Today’s Special" value={listing.todaySpecial} tone="gold" />
        <Special title="Everyday Special" value={listing.everydaySpecial} tone="teal" />
      </div>
      {listing.offer && <Offer value={listing.offer} />}
      {photos.length > 1 && <PhotoStrip photos={photos} name={listing.name} />}
    </div>
  </TemplateShell>;
}

function SalonSpotlightPage({ listing, onBack }) {
  const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
  return <TemplateShell listing={listing}>
    <div style={pageWrap}>
      <Back onBack={onBack} />
      <section style={{ ...spotlightBox, overflow: "hidden" }}>
        {photos[0] && <img src={photos[0]} alt={listing.name} style={spotlightPhoto} />}
        <div style={{ padding: 24 }}>
          <PublicIdentity listing={listing} />
          <ActionBar listing={listing} salon />
        </div>
      </section>
      <div style={specialGrid}>
        <Special title="Today’s Offer" value={listing.todayOffer} tone="gold" />
        <Special title="Weekend Offer" value={listing.weekendOffer} tone="teal" />
      </div>
      <div style={infoGrid}>
        <Info icon={<Scissors size={17} />} title="Services" value={csv(listing.products) || "Services coming soon"} />
        <Info icon={<MapPin size={17} />} title="Location" value={listing.address || "Location available on STall"} />
        {listing.hours && <Info icon={<Clock size={17} />} title="Hours" value={listing.hours} />}
      </div>
      {listing.offer && <Offer value={listing.offer} />}
    </div>
  </TemplateShell>;
}

function SalonCompactPage({ listing, onBack }) {
  const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
  return <TemplateShell listing={listing}>
    <div style={pageWrap}>
      <Back onBack={onBack} />
      <section style={{ ...compactBox, gridTemplateColumns: photos[0] ? "110px minmax(0,1fr)" : "1fr" }}>
        {photos[0] && <img src={photos[0]} alt={listing.name} style={compactPhoto} />}
        <div>
          <PublicIdentity listing={listing} />
          <ActionBar listing={listing} salon compact />
        </div>
      </section>
      <div style={compactInfoGrid}>
        <Info icon={<Scissors size={17} />} title="Services" value={csv(listing.products) || "Services coming soon"} />
        <Info icon={<MapPin size={17} />} title="Location" value={listing.address || "Location available on STall"} />
        {listing.hours && <Info icon={<Clock size={17} />} title="Hours" value={listing.hours} />}
      </div>
      <div style={specialGrid}>
        <Special title="Today’s Offer" value={listing.todayOffer} tone="gold" />
        <Special title="Weekend Offer" value={listing.weekendOffer} tone="teal" />
      </div>
      {listing.offer && <Offer value={listing.offer} />}
    </div>
  </TemplateShell>;
}

function RestaurantClassicPage({ listing, onBack }) {
  const phone = String(listing.phone || "").replace(/\D/g, "");
  const wa = phone ? (phone.length === 10 ? "91" + phone : phone.startsWith("0") ? "91" + phone.slice(1) : phone) : "";
  const maps = listing.mapsUrl || vendorLink(listing);
  const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
  return (
    <TemplateShell listing={listing}>
      <div style={pageWrap}>
        <Back onBack={onBack} />
        <section style={{ ...restaurantHero, gridTemplateColumns: photos[0] ? "210px minmax(0,1fr)" : "1fr" }}>
          {photos[0] && <img src={photos[0]} alt={listing.name} style={heroPhoto} />}
          <div style={heroContent}>
            <div style={rowWrap}>
              <span style={pill}>{listing.category}</span>
              {(listing.isVerified || listing.planKey === "verified") && <span style={{ ...pill, background: "var(--accent)", color: "var(--ink)" }}><CheckCircle2 size={12} /> STall Verified</span>}
            </div>
            <h1 style={title}>{listing.name}</h1>
            {listing.description && <p style={description}>{listing.description}</p>}
            {listing.rating != null && <div style={rating}><Star size={16} fill={"var(--accent)"} color={"var(--accent)"} /> {Number(listing.rating).toFixed(1)}{listing.ratingsCount != null ? " · " + listing.ratingsCount + " Google ratings" : ""}</div>}
            <div style={actions}>
              {wa && <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer" style={{ ...button, background: "#25D366" }}><MessageCircle size={15} /> WhatsApp</a>}
              {phone && <a href={"tel:" + phone} style={button}><Phone size={15} /> Call</a>}
              <a href={maps} target="_blank" rel="noreferrer" style={outlineButton}><Navigation size={15} /> Directions</a>
              <button onClick={() => navigator.share?.({ title: listing.name, url: window.location.href })} style={outlineButton}><Share2 size={15} /> Share</button>
            </div>
          </div>
        </section>

        <div style={infoGrid}>
          <Info icon={<MapPin size={17} />} title="Location" value={listing.address || "Location available on STall"} action={maps} actionLabel="View on Google Maps" />
          {listing.hours && <Info icon={<Clock size={17} />} title="Hours" value={listing.hours} />}
          <Info icon={<Utensils size={17} />} title="Menu / Specials" value={csv(listing.products) || "Menu details coming soon"} action={wa ? "https://wa.me/" + wa : null} actionLabel={wa ? "Ask on WhatsApp" : null} />
        </div>

        <div style={specialGrid}>
          <Special title="Today's Special" value={listing.todaySpecial} tone="gold" />
          <Special title="Everyday Special" value={listing.everydaySpecial} tone="teal" />
        </div>

        {listing.offer && <Offer value={listing.offer} />}
        {photos.length > 1 && <PhotoStrip photos={photos} name={listing.name} />}
      </div>
    </TemplateShell>
  );
}

function SalonClassicPage({ listing, onBack }) {
  return (
    <TemplateShell listing={listing}>
      <div style={pageWrap}>
        <Back onBack={onBack} />
        <Hero listing={listing} icon={<Scissors size={15} />} salon />
        <div style={specialGrid}>
          <Special title="Today’s Offer" value={listing.todayOffer} tone="gold" />
          <Special title="Weekend Offer" value={listing.weekendOffer} tone="teal" />
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
          {(listing.isVerified || listing.planKey === "verified") && <span style={{ ...pill, background: "var(--accent)", color: "var(--ink)" }}><CheckCircle2 size={12} /> STall Verified</span>}
        </div>
        <h1 style={title}>{listing.name}</h1>
        {listing.description && <p style={description}>{listing.description}</p>}
        {listing.rating != null && <div style={rating}><Star size={16} fill={"var(--accent)"} color={"var(--accent)"} /> {Number(listing.rating).toFixed(1)}{ratingText}</div>}
        <div style={actions}>
          {wa && <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer" style={button}><MessageCircle size={15} /> WhatsApp</a>}
          {phone && <a href={"tel:" + phone} style={button}><Phone size={15} /> Call</a>}
          {isGrowth && <a href={website} target="_blank" rel="noreferrer" style={{ ...button, background: "var(--accent)", color: "var(--ink)" }}><Globe2 size={15} /> {salon ? "Book Now" : "Order / Book"}</a>}
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
    <section style={{ ...box, border: "2px solid " + (gold ? "var(--accent)" : "var(--teal)"), background: gold ? "#fffaf0" : "#f5fbf9" }}>
      <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: gold ? "#8a6d1d" : "var(--teal)" }}>{title}</div>
      <div style={{ fontSize: 21, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>{value}</div>
    </section>
  );
}

function Offer({ value }) {
  return <section style={{ ...box, marginTop: 12, border: "2px solid " + "var(--accent)" }}>
    <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "#8a6d1d" }}>Current offer</div>
    <div style={{ fontSize: 22, fontWeight: 900, marginTop: 5 }}>{value}</div>
  </section>;
}

function Info({ icon, title, value }) {
  return <div style={{ ...box, padding: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--teal)", fontWeight: 900, fontSize: 12, textTransform: "uppercase" }}>{icon}{title}</div>
    <div style={{ color: "#444", whiteSpace: "pre-line", lineHeight: 1.5, marginTop: 7, fontSize: 13 }}>{value}</div>
  </div>;
}

function Back({ onBack }) {
  return <button onClick={onBack} style={backLink}><ArrowLeft size={15} /> Back to STall</button>;
}

function PhotoStrip({ photos, name }) {
  return <section style={{ ...box, marginTop: 12 }}>
    <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: "var(--teal)", marginBottom: 10 }}>More photos</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
      {photos.slice(1).map((photo, index) => <img key={photo + index} src={photo} alt={name + " photo " + (index + 2)} style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 12 }} />)}
    </div>
  </section>;
}

function TemplateShell({ children, listing }) {
  const theme = getPageTheme(listing?.pageTheme || listing?.pageLayout);
  return <div style={{ minHeight: "100vh", background: theme.bg, color: "var(--ink)", "--ink": theme.ink, "--accent": theme.accent, "--teal": theme.teal, "--surface": theme.surface, "--soft": theme.soft }}>
    {children}
    <footer style={footer}>
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none", color: "#777" }}>
        <img src={stallLogoMark} alt="STall" style={{ width: 24, height: "auto" }} />
        <span style={{ fontSize: 11, fontWeight: 700 }}>Powered by STall</span>
      </a>
    </footer>
  </div>;
}

const csv = (value) => String(value || "").split(",").map(x => x.trim()).filter(Boolean).join(" · ");
const pageWrap = { maxWidth: 1120, margin: "0 auto", padding: "18px 16px 50px" };
const box = { background: "var(--surface)", border: "1px solid rgba(22,22,22,.08)", borderRadius: 20, padding: 22, boxShadow: "0 14px 40px rgba(22,22,22,.08)" };
const restaurantHero = { ...box, display: "grid", gap: 28, padding: 16, alignItems: "stretch", background: "linear-gradient(145deg,var(--surface),var(--soft))" };
const heroPhoto = { width: "100%", height: 260, objectFit: "cover", borderRadius: 16, boxShadow: "0 12px 30px rgba(0,0,0,.12)" };
const heroContent = { padding: "4px 8px 4px 0" };
const infoAction = { display: "flex", justifyContent: "center", alignItems: "center", marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "#eef9f3", color: "var(--teal)", textDecoration: "none", fontWeight: 800, fontSize: 12 };

const spotlightBox = { ...box, padding: 0, borderRadius: 24, overflow: "hidden", boxShadow: "0 20px 55px rgba(16,42,67,.14)" };
const spotlightPhoto = { width: "100%", height: 390, objectFit: "cover", display: "block", filter: "saturate(1.05)" };
const compactBox = { ...box, display: "grid", gap: 18, alignItems: "center", padding: 16 };
const compactPhoto = { width: "110px", height: "110px", objectFit: "cover", borderRadius: 12 };
const compactInfoGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginTop: 10 };
const rowWrap = { display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" };
const title = { fontSize: "clamp(30px, 4.5vw, 46px)", lineHeight: 1.04, letterSpacing: "-.035em", fontWeight: 950, margin: "14px 0 9px", overflowWrap: "anywhere" };
const description = { color: "#555", lineHeight: 1.6, margin: 0 };
const rating = { display: "flex", alignItems: "center", gap: 6, marginTop: 13, fontWeight: 800 };
const actions = { display: "flex", flexWrap: "wrap", gap: 9, marginTop: 18 };
const specialGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 14 };
const infoGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginTop: 14 };
const button = { display: "inline-flex", alignItems: "center", gap: 7, background: "var(--ink)", color: "#fff", textDecoration: "none", border: 0, borderRadius: 12, padding: "11px 15px", fontWeight: 850, fontSize: 12.5, boxShadow: "0 7px 18px rgba(0,0,0,.12)" };
const outlineButton = { ...button, background: "rgba(255,255,255,.82)", color: "var(--ink)", border: "1px solid rgba(22,22,22,.18)", boxShadow: "none" };
const backLink = { background: "transparent", border: 0, padding: 0, color: "#666", cursor: "pointer", display: "flex", gap: 6, alignItems: "center", marginBottom: 18 };
const footer = { maxWidth: 1120, margin: "0 auto", padding: "22px 16px 34px", display: "flex", justifyContent: "center", opacity: 0.72 };
const pill = { display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, background: "var(--ink)", color: "#fff", fontSize: 10.5, fontWeight: 900 };


function getPageTheme(key) {
  const themes = {
    classic: { bg: "#f7f3eb", ink: "#161616", accent: "#f2b84b", teal: "#0d766e", surface: "#fff", soft: "#f5fbf9" },
    spotlight: { bg: "#eef7fb", ink: "#102a43", accent: "#168aad", teal: "#0b7285", surface: "#fff", soft: "#edf8fb" },
    compact: { bg: "#eff8f2", ink: "#183b2b", accent: "#3b9c63", teal: "#237a57", surface: "#fff", soft: "#effaf3" },
  };
  return themes[key] || themes.classic;
}
