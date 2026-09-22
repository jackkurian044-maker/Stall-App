import React from "react";
import {
  ArrowLeft, CheckCircle2, Clock, Globe2, MapPin, MessageCircle,
  Navigation, Phone, Scissors, Star, Utensils, Share2, Crown, Sparkles,
} from "lucide-react";
import { vendorLink } from "./geo";

export function RestaurantBusinessPage({ listing, onBack }) {
  const layout = listing?.pageLayout || "classic";
  if (layout === "spotlight") return <RestaurantSpotlightPage listing={listing} onBack={onBack} />;
  if (layout === "compact") return <RestaurantCompactPage listing={listing} onBack={onBack} />;
  return <RestaurantClassicPage listing={listing} onBack={onBack} />;
}

export function SalonBusinessPage({ listing, onBack }) {
  const layout = listing?.pageLayout || "classic";
  if (layout === "spotlight") return <SalonSpotlightPage listing={listing} onBack={onBack} />;
  if (layout === "compact") return <SalonCompactPage listing={listing} onBack={onBack} />;
  return <SalonClassicPage listing={listing} onBack={onBack} />;
}

function StorePage({ listing, onBack, salon, layout }) {
  const photos = getPhotos(listing);
  const primary = photos[0];
  const phone = cleanPhone(listing.phone);
  const wa = whatsapp(phone);
  const maps = listing.mapsUrl || vendorLink(listing);
  const website = listing.website || listing.mapsUrl || maps;
  const isGrowth = ["digital_growth", "growth_setup"].includes(listing.planKey);
  const theme = getPageTheme(listing.pageTheme || layout);
  const services = csv(listing.products);
  const firstSpecial = salon ? listing.todayOffer : listing.todaySpecial;
  const secondSpecial = salon ? listing.weekendOffer : listing.everydaySpecial;
  const specialTitle1 = salon ? "Today's experience" : "Today's special";
  const specialTitle2 = salon ? "Weekend favourite" : "Everyday favourite";
  const hasSocialProof = listing.rating != null;
  const ctaLabel = salon ? "Book an appointment" : "Order / Book";

  return (
    <TemplateShell listing={listing} theme={theme}>
      <main style={pageWrap}>
        <Back onBack={onBack} />

        <section style={hero} className="stall-store-hero">
          <div style={heroImageWrap}>
            {primary ? (
              <img src={primary} alt={listing.name} style={heroImage} />
            ) : (
              <div style={{ ...heroImage, background: `linear-gradient(135deg,${theme.deep},${theme.accent})` }}>
                <div style={heroPlaceholder}><Sparkles size={30}/><span>{listing.name}</span></div>
              </div>
            )}
            <div style={heroShade} />
            <div style={heroTop}>
              <span style={categoryChip}>{listing.category}</span>
              {(listing.isVerified || listing.planKey === "verified") && (
                <span style={verifiedChip}><CheckCircle2 size={13}/> Verified</span>
              )}
            </div>
            <div style={heroPhotoCount}>{photos.length > 1 ? `${photos.length} photos` : "Welcome"}</div>
          </div>

          <div style={heroCard}>
            <div style={brandKicker}>{salon ? "YOUR LOCAL BEAUTY DESTINATION" : "WELCOME TO OUR STORE"}</div>
            <h1 style={heroTitle}>{listing.name}</h1>
            {listing.description && <p style={heroDescription}>{listing.description}</p>}
            {hasSocialProof && (
              <div style={socialProof}>
                <span style={stars}><Star size={15} fill="currentColor"/> {Number(listing.rating).toFixed(1)}</span>
                {listing.ratingsCount != null && <span>{listing.ratingsCount} Google ratings</span>}
                <span style={proofDot}>·</span><span>Open to visitors</span>
              </div>
            )}
            <div style={heroActions}>
              {isGrowth && website && <a href={website} target="_blank" rel="noreferrer" style={primaryCta}><Globe2 size={17}/>{ctaLabel}</a>}
              {wa && <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer" style={whatsappCta}><MessageCircle size={17}/> WhatsApp</a>}
              {phone && <a href={"tel:" + phone} style={secondaryCta}><Phone size={16}/> Call</a>}
              <a href={maps} target="_blank" rel="noreferrer" style={secondaryCta}><Navigation size={16}/> Directions</a>
            </div>
            <div style={trustRow}>
              <span><Clock size={14}/> {listing.hours || "Hours available"} </span>
              <span><MapPin size={14}/> {shortAddress(listing.address) || "Find us on Maps"}</span>
            </div>
          </div>
        </section>

        {(firstSpecial || secondSpecial || listing.offer) && (
          <section style={featuredSection}>
            <div style={sectionEyebrow}><Sparkles size={14}/> {salon ? "WHAT'S HAPPENING" : "WORTH A VISIT"}</div>
            <div style={featuredGrid}>
              {firstSpecial && <FeatureCard title={specialTitle1} value={firstSpecial} theme={theme} />}
              {secondSpecial && <FeatureCard title={specialTitle2} value={secondSpecial} theme={theme} />}
              {listing.offer && <FeatureCard title="Special offer" value={listing.offer} theme={theme} featured />}
            </div>
          </section>
        )}

        <section style={contentGrid} className="content-grid">
          <div style={mainColumn}>
            <section style={storyCard}>
              <div style={sectionEyebrow}><span style={eyebrowLine}/>{salon ? "THE EXPERIENCE" : "WHY VISIT"}</div>
              <h2 style={sectionTitle}>{salon ? "Look good. Feel even better." : "Come for the experience."}</h2>
              <p style={storyText}>
                {listing.description || `Discover ${listing.name}, explore what's available today, and connect with the team directly.`}
              </p>
              {services && (
                <div style={tagList}>
                  {String(listing.products || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 10).map((item, i) => (
                    <span key={item + i} style={serviceTag}>{salon ? <Scissors size={13}/> : <Utensils size={13}/>} {item}</span>
                  ))}
                </div>
              )}
            </section>

            {photos.length > 1 && <Gallery photos={photos.slice(1)} name={listing.name} />}

            <section style={visitCard}>
              <div>
                <div style={sectionEyebrow}><MapPin size={14}/> PLAN YOUR VISIT</div>
                <h2 style={{ ...sectionTitle, marginBottom: 7 }}>Come say hello.</h2>
                <p style={storyText}>{listing.address || "Location details are available on Google Maps."}</p>
              </div>
              <div style={visitDetails}>
                {listing.hours && <div><Clock size={16}/><span>{listing.hours}</span></div>}
                <a href={maps} target="_blank" rel="noreferrer" style={mapCta}><Navigation size={15}/> Get directions</a>
              </div>
            </section>
          </div>

          <aside style={sideColumn}>
            <section style={sideCard}>
              <div style={sectionEyebrow}><span style={eyebrowLine}/>{salon ? "SERVICES" : "MENU & SPECIALS"}</div>
              <h3 style={sideTitle}>{services || (salon ? "Services coming soon" : "Menu details coming soon")}</h3>
              {wa && <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer" style={sideCta}><MessageCircle size={16}/> Ask us on WhatsApp</a>}
            </section>
            {hasSocialProof && (
              <section style={reviewCard}>
                <div style={quoteMark}>“</div>
                <div style={reviewRating}><Star size={17} fill={theme.accent} color={theme.accent}/><strong>{Number(listing.rating).toFixed(1)}</strong></div>
                <p style={reviewText}>Rated by customers on Google</p>
                {listing.ratingsCount != null && <div style={reviewCount}>{listing.ratingsCount} ratings</div>}
              </section>
            )}
          </aside>
        </section>

        <section style={bottomCta} className="bottom-cta">
          <div>
            <div style={bottomKicker}>READY WHEN YOU ARE</div>
            <h2 style={bottomTitle}>{salon ? "Your next appointment starts here." : "Make your next visit a good one."}</h2>
          </div>
          <div style={bottomActions}>
            {isGrowth && website && <a href={website} target="_blank" rel="noreferrer" style={primaryCta}><Globe2 size={17}/>{ctaLabel}</a>}
            {wa && <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer" style={whatsappCta}><MessageCircle size={17}/> WhatsApp</a>}
          </div>
        </section>

        <div style={mobileBar} className="stall-mobile-bar">
          {wa && <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer"><MessageCircle size={18}/><span>WhatsApp</span></a>}
          {phone && <a href={"tel:" + phone}><Phone size={18}/><span>Call</span></a>}
          <a href={maps} target="_blank" rel="noreferrer"><Navigation size={18}/><span>Directions</span></a>
          <button onClick={() => navigator.share?.({ title: listing.name, url: window.location.href })}><Share2 size={18}/><span>Share</span></button>
        </div>
      </main>
    </TemplateShell>
  );
}

function RestaurantClassicPage({ listing, onBack }) { return <StorePage listing={listing} onBack={onBack} layout="classic" salon={false}/>; }
function RestaurantSpotlightPage({ listing, onBack }) { return <StorePage listing={listing} onBack={onBack} layout="spotlight" salon={false}/>; }
function RestaurantCompactPage({ listing, onBack }) { return <StorePage listing={listing} onBack={onBack} layout="compact" salon={false}/>; }
function SalonClassicPage({ listing, onBack }) { return <StorePage listing={listing} onBack={onBack} layout="classic" salon/>; }
function SalonSpotlightPage({ listing, onBack }) { return <StorePage listing={listing} onBack={onBack} layout="spotlight" salon/>; }
function SalonCompactPage({ listing, onBack }) { return <StorePage listing={listing} onBack={onBack} layout="compact" salon/>; }

function FeatureCard({ title, value, theme, featured }) {
  return <article style={{ ...featureCard, borderColor: featured ? theme.accent : "rgba(0,0,0,.08)", background: featured ? theme.featured : "#fff" }}>
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".09em", fontWeight: 900, color: theme.teal }}>{title}</div>
    <div style={featureValue}>{value}</div>
    {featured && <div style={featureBadge}><Crown size={12}/> Featured</div>}
  </article>;
}

function Gallery({ photos, name }) {
  return <section style={{ marginTop: 20 }}>
    <div style={sectionEyebrow}>A GLIMPSE INSIDE</div>
    <div style={galleryGrid}>
      {photos.slice(0, 6).map((photo, i) => <img key={photo + i} src={photo} alt={name + " photo " + (i + 2)} style={{ ...galleryImage, height: i === 0 ? 300 : 145, gridRow: i === 0 ? "span 2" : "auto" }}/>)}
    </div>
  </section>;
}

function TemplateShell({ children, listing, theme }) {
  return <div style={{ minHeight: "100vh", background: theme.bg, color: theme.ink, "--ink": theme.ink, "--accent": theme.accent, "--teal": theme.teal, "--surface": "#fff" }}>
    {children}
    <footer style={footer}><span>© {new Date().getFullYear()} {listing?.name || "Business"}</span><span style={{margin:"0 7px",opacity:.45}}>·</span><span>Powered by <strong>STall</strong></span></footer>
  </div>;
}

function Back({ onBack }) {
  return <button onClick={onBack} style={backLink}><ArrowLeft size={15}/> Back</button>;
}

function cleanPhone(value) { return String(value || "").replace(/\D/g, ""); }
function whatsapp(phone) {
  if (!phone) return "";
  return phone.length === 10 ? "91" + phone : phone.startsWith("0") ? "91" + phone.slice(1) : phone;
}
function csv(value) { return String(value || "").split(",").map(x => x.trim()).filter(Boolean).join(" · "); }
function getPhotos(listing) { return Array.isArray(listing?.photos) ? listing.photos.filter(Boolean) : []; }
function shortAddress(value) { return String(value || "").split(",").slice(0, 2).join(", ").trim(); }

function getPageTheme(key) {
  const themes = {
    classic: { bg:"#f6f1e8", ink:"#171717", accent:"#d59a2b", teal:"#176f68", deep:"#2b2117", featured:"#fff8e9" },
    spotlight: { bg:"#edf5f7", ink:"#102a43", accent:"#168aad", teal:"#0b7285", deep:"#123c4a", featured:"#eaf8fb" },
    compact: { bg:"#eff7f1", ink:"#183b2b", accent:"#3b9c63", teal:"#237a57", deep:"#163a2a", featured:"#eefaf2" },
  };
  return themes[key] || themes.classic;
}

const pageWrap = { maxWidth: 1180, margin: "0 auto", padding: "14px 18px 90px" };
const backLink = { border:0, background:"transparent", color:"#6c6c6c", display:"flex", alignItems:"center", gap:6, padding:"7px 0", marginBottom:12, cursor:"pointer", fontWeight:700 };
const hero = { display:"grid", gridTemplateColumns:"minmax(0,1.25fr) minmax(340px,.75fr)", minHeight:540, borderRadius:30, overflow:"hidden", background:"#fff", boxShadow:"0 28px 80px rgba(0,0,0,.13)" };
const heroImageWrap = { position:"relative", minHeight:420, background:"#ddd", overflow:"hidden" };
const heroImage = { width:"100%", height:"100%", minHeight:420, objectFit:"cover", display:"block" };
const heroShade = { position:"absolute", inset:0, background:"linear-gradient(180deg,rgba(0,0,0,.05) 20%,rgba(0,0,0,.55) 100%)", pointerEvents:"none" };
const heroTop = { position:"absolute", top:20, left:20, display:"flex", gap:8, flexWrap:"wrap" };
const categoryChip = { background:"rgba(255,255,255,.93)", color:"#161616", padding:"8px 11px", borderRadius:999, fontSize:11, fontWeight:900, backdropFilter:"blur(8px)" };
const verifiedChip = { display:"inline-flex", alignItems:"center", gap:5, background:"rgba(255,255,255,.93)", color:"#176f68", padding:"8px 11px", borderRadius:999, fontSize:11, fontWeight:900 };
const heroPhotoCount = { position:"absolute", left:20, bottom:18, color:"#fff", fontSize:12, fontWeight:800, textShadow:"0 2px 12px #000" };
const heroCard = { padding:"44px 38px", display:"flex", flexDirection:"column", justifyContent:"center", background:"#fff" };
const brandKicker = { fontSize:10.5, letterSpacing:".14em", fontWeight:950, color:"var(--teal)" };
const heroTitle = { fontSize:"clamp(38px,5vw,64px)", lineHeight:.98, letterSpacing:"-.055em", margin:"14px 0 15px", fontWeight:950 };
const heroDescription = { fontSize:15, color:"#555", lineHeight:1.65, margin:0, maxWidth:520 };
const socialProof = { display:"flex", flexWrap:"wrap", alignItems:"center", gap:8, marginTop:18, color:"#555", fontSize:12.5, fontWeight:750 };
const stars = { display:"inline-flex", alignItems:"center", gap:5, color:"var(--accent)", fontWeight:950 };
const proofDot = { color:"#bbb" };
const heroActions = { display:"flex", flexWrap:"wrap", gap:9, marginTop:24 };
const primaryCta = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8, background:"var(--ink)", color:"#fff", textDecoration:"none", borderRadius:13, padding:"13px 17px", fontWeight:900, fontSize:13, boxShadow:"0 10px 28px rgba(0,0,0,.18)" };
const whatsappCta = { ...primaryCta, background:"#25a45b" };
const secondaryCta = { ...primaryCta, background:"#fff", color:"var(--ink)", border:"1px solid rgba(0,0,0,.14)", boxShadow:"none" };
const trustRow = { display:"flex", flexDirection:"column", gap:9, marginTop:25, paddingTop:19, borderTop:"1px solid #eee", color:"#666", fontSize:12 };
const trustRowSpan = {};
const featuredSection = { marginTop:24 };
const sectionEyebrow = { display:"flex", alignItems:"center", gap:7, color:"var(--teal)", fontSize:10.5, letterSpacing:".12em", fontWeight:950, marginBottom:10 };
const eyebrowLine = { width:22, height:2, background:"var(--accent)", display:"inline-block" };
const featuredGrid = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 };
const featureCard = { position:"relative", border:"1px solid", borderRadius:20, padding:"21px 20px", minHeight:135, boxShadow:"0 10px 28px rgba(0,0,0,.05)" };
const featureValue = { fontSize:20, lineHeight:1.2, fontWeight:950, marginTop:8 };
const featureBadge = { position:"absolute", top:14, right:14, display:"flex", gap:4, alignItems:"center", fontSize:9.5, textTransform:"uppercase", fontWeight:950, color:"var(--teal)" };
const contentGrid = { display:"grid", gridTemplateColumns:"minmax(0,1.4fr) minmax(280px,.6fr)", gap:20, marginTop:26 };
const mainColumn = { minWidth:0 };
const sideColumn = { display:"flex", flexDirection:"column", gap:14 };
const storyCard = { background:"#fff", borderRadius:24, padding:"28px", boxShadow:"0 15px 45px rgba(0,0,0,.06)" };
const sectionTitle = { fontSize:"clamp(27px,3vw,38px)", lineHeight:1.05, letterSpacing:"-.04em", margin:"0 0 12px", fontWeight:950 };
const storyText = { color:"#5a5a5a", lineHeight:1.7, margin:0, fontSize:14 };
const tagList = { display:"flex", flexWrap:"wrap", gap:8, marginTop:20 };
const serviceTag = { display:"inline-flex", alignItems:"center", gap:6, border:"1px solid rgba(0,0,0,.09)", background:"#fafafa", borderRadius:999, padding:"8px 11px", fontSize:11.5, fontWeight:800 };
const sideCard = { background:"#fff", borderRadius:24, padding:"24px", boxShadow:"0 15px 45px rgba(0,0,0,.06)", height:"fit-content" };
const sideTitle = { fontSize:19, lineHeight:1.45, margin:"0 0 18px", fontWeight:900 };
const sideCta = { display:"inline-flex", alignItems:"center", gap:7, color:"var(--teal)", textDecoration:"none", fontSize:12.5, fontWeight:900 };
const reviewCard = { position:"relative", overflow:"hidden", background:"var(--ink)", color:"#fff", borderRadius:24, padding:"25px", minHeight:160 };
const quoteMark = { position:"absolute", right:18, top:-7, fontSize:100, lineHeight:1, opacity:.12, fontFamily:"Georgia" };
const reviewRating = { display:"flex", alignItems:"center", gap:7, fontSize:20 };
const reviewText = { margin:"13px 0 7px", fontSize:13, opacity:.8 };
const reviewCount = { fontSize:11, opacity:.55, fontWeight:800 };
const galleryGrid = { display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr", gap:10 };
const galleryImage = { width:"100%", objectFit:"cover", borderRadius:16, display:"block" };
const visitCard = { marginTop:20, background:"#fff", borderRadius:24, padding:"26px 28px", display:"grid", gridTemplateColumns:"1fr auto", gap:20, alignItems:"center", boxShadow:"0 15px 45px rgba(0,0,0,.06)" };
const visitDetails = { display:"flex", flexDirection:"column", gap:13, alignItems:"flex-end", fontSize:12, color:"#666" };
const mapCta = { display:"inline-flex", alignItems:"center", gap:7, color:"#fff", background:"var(--ink)", borderRadius:11, padding:"10px 13px", textDecoration:"none", fontWeight:850 };
const bottomCta = { marginTop:26, padding:"28px 30px", borderRadius:26, background:"linear-gradient(135deg,var(--ink),var(--teal))", color:"#fff", display:"flex", justifyContent:"space-between", gap:20, alignItems:"center", boxShadow:"0 20px 50px rgba(0,0,0,.16)" };
const bottomKicker = { fontSize:10, letterSpacing:".12em", fontWeight:900, opacity:.7 };
const bottomTitle = { fontSize:"clamp(23px,3vw,34px)", lineHeight:1.05, margin:"7px 0 0", letterSpacing:"-.035em" };
const bottomActions = { display:"flex", flexWrap:"wrap", gap:8 };
const mobileBar = { position:"fixed", left:12, right:12, bottom:12, zIndex:30, display:"none", background:"rgba(22,22,22,.94)", backdropFilter:"blur(14px)", borderRadius:18, padding:"8px 5px", boxShadow:"0 18px 45px rgba(0,0,0,.28)" };
const footer = { textAlign:"center", padding:"24px 16px 34px", color:"#999", fontSize:10.5 };

if (typeof document !== "undefined") {
  const styleId = "stall-premium-store-responsive";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .stall-store-hero img { transition: transform .7s ease, filter .7s ease; }
      .stall-store-hero:hover img { transform: scale(1.025); filter: saturate(1.06); }
      @media (max-width: 820px) {\n        .stall-mobile-bar { display: flex !important; justify-content: space-around; align-items: center; }\n        .stall-mobile-bar a, .stall-mobile-bar button { color:#fff; text-decoration:none; background:transparent; border:0; display:flex; flex-direction:column; align-items:center; gap:3px; font-size:9px; font-weight:800; padding:4px 8px; }
        .stall-store-hero { grid-template-columns: 1fr !important; min-height: 0 !important; border-radius: 24px !important; }
        .stall-store-hero > div:first-child { min-height: 340px !important; }
        .stall-store-hero > div:first-child img { min-height: 340px !important; }
        .stall-store-hero > div:last-child { padding: 28px 22px !important; }
        .stall-store-hero h1 { font-size: 42px !important; }
        .stall-store-hero .trust-row { margin-top: 19px !important; }
        .content-grid { grid-template-columns: 1fr !important; }
      }
      @media (max-width: 620px) {
        .stall-store-hero > div:first-child, .stall-store-hero > div:first-child img { min-height: 300px !important; }
        .stall-store-hero h1 { font-size: 38px !important; }
        .stall-store-hero .hero-actions a { flex: 1 1 auto; }
        .gallery-grid { grid-template-columns: 1fr 1fr !important; }
        .visit-card { grid-template-columns: 1fr !important; }
        .visit-card > div:last-child { align-items: flex-start !important; }
        .bottom-cta { flex-direction: column !important; align-items: flex-start !important; }\n        .bottom-cta .bottom-actions { width: 100%; }
        .stall-premium-store-responsive + * {}
      }
    `;
    document.head.appendChild(style);
  }
}
