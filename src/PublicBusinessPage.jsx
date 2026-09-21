import React, { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { ArrowLeft, CheckCircle2, Clock, Globe2, MapPin, MessageCircle, Navigation, Phone, Star } from "lucide-react";
import stallLogoMark from "./logo-cropped.png";
import { publicDb } from "./publicFirebase";
import { COLORS } from "./constants";
import { vendorLink } from "./geo";
import { RestaurantBusinessPage, SalonBusinessPage } from "./BusinessTemplatePages";
import StoreLandingPage from "./StoreLandingPage";

export default function PublicBusinessPage({ listingId }) {
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewLayout, setPreviewLayout] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("layout");
    return ["classic", "spotlight", "compact"].includes(requested) ? requested : null;
  });
  const layoutPreviewEnabled = new URLSearchParams(window.location.search).get("preview") === "layouts";

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const key = String(listingId || "").trim().toLowerCase();
        let snap = null;
        if (key) {
          snap = await getDoc(doc(publicDb, "vendors", key));
          if (!snap.exists()) {
            const qs = await getDocs(query(collection(publicDb, "vendors"), where("publicSlug", "==", key), limit(1)));
            snap = qs.docs[0] || null;
          }
          // Legacy bridge for Kerala Swaad until its existing vendor document is migrated.
          if (!snap && key === "kerala-swaad-restaurant-janakpuri") {
            snap = await getDoc(doc(publicDb, "vendors", "SGbUMqLzX6pJSw6ESZ2R"));
          }
        }
        if (!alive) return;
        setListing(snap?.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Unable to load this business page.");
        setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [listingId]);

  useEffect(() => {
    if (!listing) return;
    document.title = `${listing.name} | STall`;
    const description = listing.description || `${listing.name} on STall.`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = description;
    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = `${window.location.origin}/store/${slugify(listing.name)}`;
    if (!canonical.parentNode) document.head.appendChild(canonical);
  }, [listing]);

  const back = () => { window.location.href = "/"; };

  const activeLayout = previewLayout || listing.pageLayout || "classic";
  const renderListing = previewLayout
    ? { ...listing, pageLayout: previewLayout }
    : { ...listing, pageLayout: activeLayout };

  const selectPreviewLayout = (layout) => {
    setPreviewLayout(layout);
    const url = new URL(window.location.href);
    url.searchParams.set("preview", "layouts");
    url.searchParams.set("layout", layout);
    window.history.replaceState({}, "", url.toString());
  };

  if (loading) return <Shell><div style={box}><h2 style={{marginTop:0}}>Loading business page…</h2></div></Shell>;
  if (error) return <Shell><div style={box}><h2 style={{marginTop:0}}>Business page unavailable</h2><p style={muted}>{error}</p><button onClick={back} style={button}>Back to STall</button></div></Shell>;
  if (!listing) return <Shell><div style={box}><h2 style={{marginTop:0}}>Business not found</h2><button onClick={back} style={button}>Back to STall</button></div></Shell>;

  const active = ["verified","digital_growth","growth_setup"].includes(listing.planKey);
  if (!active) return <Shell><div style={box}><h2 style={{marginTop:0}}>This business page is not active</h2><p style={muted}>A STall public business page is available for active STall Verified and Growth listings.</p><button onClick={back} style={button}>Back to STall</button></div></Shell>;

  if (listing.category === "Food & Produce") return (
    <>
      {layoutPreviewEnabled && <LayoutPreviewSwitcher active={previewLayout || listing.pageLayout || "classic"} onSelect={selectPreviewLayout} />}
      <PublicPageBoundary fallback={<StoreLandingPage listingId={listing.id} onBack={back} />}><RestaurantBusinessPage listing={renderListing} onBack={back} /></PublicPageBoundary>
    </>
  );
  if (listing.category === "Salons") return (
    <>
      {layoutPreviewEnabled && <LayoutPreviewSwitcher active={previewLayout || listing.pageLayout || "classic"} onSelect={selectPreviewLayout} />}
      <PublicPageBoundary fallback={<StoreLandingPage listingId={listing.id} onBack={back} />}><SalonBusinessPage listing={renderListing} onBack={back} /></PublicPageBoundary>
    </>
  );

  const phone = String(listing.phone || "").replace(/\D/g, "");
  const wa = phone ? (phone.length === 10 ? "91"+phone : phone.startsWith("0") ? "91"+phone.slice(1) : phone) : "";
  const website = listing.website || listing.mapsUrl || vendorLink(listing);
  const isGrowth = ["digital_growth","growth_setup"].includes(listing.planKey);
  const products = String(listing.products || "").split(",").map(x=>x.trim()).filter(Boolean).slice(0,10);
  const ratingText = listing.ratingsCount != null ? " · "+listing.ratingsCount+" Google ratings" : "";
  const todaySpecial = String(listing.todaySpecial || "").trim();
  const everydaySpecial = String(listing.everydaySpecial || "").trim();
  const schema = {"@context":"https://schema.org","@type":"LocalBusiness",name:listing.name,description:listing.description||undefined,telephone:listing.phone||undefined,address:listing.address?{"@type":"PostalAddress",streetAddress:listing.address}:undefined,url:window.location.href,aggregateRating:listing.rating!=null&&listing.ratingsCount?{"@type":"AggregateRating",ratingValue:Number(listing.rating),reviewCount:Number(listing.ratingsCount)}:undefined};

  return <Shell>
    <div style={{maxWidth:900,margin:"0 auto",padding:"18px 16px 50px"}}>
      <button onClick={back} style={backLink}><ArrowLeft size={15}/> Back to STall</button>
      <section style={{...box,padding:0,overflow:"hidden"}}>
        {listing.photos?.[0] && <img src={listing.photos[0]} alt={listing.name} style={{width:"100%",height:280,objectFit:"cover"}}/>}
        <div style={{padding:24}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,alignItems:"center"}}>
            <span style={pill}>{listing.category}</span>
            {(listing.isVerified || listing.planKey==="verified") && <span style={{...pill,background:COLORS.marigold,color:COLORS.ink}}><CheckCircle2 size={12}/> STall Verified</span>}
          </div>
          <h1 style={{fontSize:34,lineHeight:1.1,margin:"12px 0 8px"}}>{listing.name}</h1>
          {listing.description && <p style={{color:"#555",lineHeight:1.6,margin:0}}>{listing.description}</p>}
          {listing.rating != null && <div style={{display:"flex",alignItems:"center",gap:6,marginTop:13,fontWeight:800}}><Star size={16} fill={COLORS.marigold} color={COLORS.marigold}/> {Number(listing.rating).toFixed(1)}{ratingText}</div>}
          <div style={{display:"flex",flexWrap:"wrap",gap:9,marginTop:18}}>
            {wa && <a href={"https://wa.me/"+wa} target="_blank" rel="noreferrer" style={button}><MessageCircle size={15}/> WhatsApp</a>}
            {phone && <a href={"tel:"+phone} style={button}><Phone size={15}/> Call</a>}
            {isGrowth && <a href={website} target="_blank" rel="noreferrer" style={{...button,background:COLORS.marigold,color:COLORS.ink}}><Globe2 size={15}/> Order / Book</a>}
            <a href={listing.mapsUrl || website} target="_blank" rel="noreferrer" style={{...button,background:"#fff",color:COLORS.ink,border:"1px solid "+COLORS.ink}}><Navigation size={15}/> Directions</a>
          </div>
        </div>
      </section>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:12}}>
        <Info icon={<MapPin size={17}/>} title="Location" value={listing.address || "Location available on STall"}/>
        {listing.hours && <Info icon={<Clock size={17}/>} title="Hours" value={listing.hours}/>}
        {products.length>0 && <Info icon={<Star size={17}/>} title="Products / Services" value={products.join(" · ")}/>}
      </div>
      {(todaySpecial || everydaySpecial) && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12,marginTop:12}}>
        {todaySpecial && <section style={{...box,marginTop:0,border:"2px solid "+COLORS.marigold,background:"#fffaf0"}}><div style={{fontSize:11,fontWeight:900,textTransform:"uppercase",color:"#8a6d1d"}}>Today’s special</div><div style={{fontSize:21,fontWeight:900,marginTop:6,lineHeight:1.25}}>{todaySpecial}</div></section>}
        {everydaySpecial && <section style={{...box,marginTop:0,border:"2px solid "+COLORS.teal,background:"#f5fbf9"}}><div style={{fontSize:11,fontWeight:900,textTransform:"uppercase",color:COLORS.teal}}>Everyday special</div><div style={{fontSize:21,fontWeight:900,marginTop:6,lineHeight:1.25}}>{everydaySpecial}</div></section>}
      </div>}
      {listing.offer && <section style={{...box,marginTop:12,border:"2px solid "+COLORS.marigold}}><div style={{fontSize:11,fontWeight:900,textTransform:"uppercase",color:"#8a6d1d"}}>Current offer</div><div style={{fontSize:22,fontWeight:900,marginTop:5}}>{listing.offer}</div></section>}
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
    </div>
  </Shell>;
}

class PublicPageBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("STall public page template failed; using safe store fallback", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function LayoutPreviewSwitcher({ active, onSelect }) {
  const layouts = [["classic", "Classic"], ["spotlight", "Spotlight"], ["compact", "Compact"]];
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#161616", borderBottom: "1px solid #333", padding: "10px 16px", boxShadow: "0 4px 18px rgba(0,0,0,.18)" }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#cfcfcf", fontSize: 11, fontWeight: 800, marginRight: 4 }}>LAYOUT</span>
        {layouts.map(([value, label]) => (
          <button key={value} type="button" onClick={() => onSelect(value)} style={{ border: active === value ? "2px solid #f2b84b" : "1px solid #555", background: active === value ? "#f2b84b" : "#222", color: active === value ? "#161616" : "#fff", borderRadius: 999, padding: "7px 14px", fontWeight: 900, fontSize: 11, cursor: "pointer" }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

function Shell({children}) {
  return <div style={{minHeight:"100vh",background:"#f7f3eb",color:COLORS.ink}}>
    <header style={{background:"#161616",borderBottom:"1px solid #2a2a2a",boxShadow:"0 2px 14px rgba(0,0,0,.35)",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <a href="/" style={{display:"flex",alignItems:"center",gap:10,textDecoration:"none",color:"#fff"}}>
        <img src={stallLogoMark} alt="STall" style={{width:40,height:"auto"}}/>
        <span style={{fontWeight:700,fontSize:"1.28rem"}}>all</span>
        <span style={{fontSize:11,letterSpacing:".04em",color:"#9c9c9c",fontWeight:600}}>what's around the corner</span>
      </a>
    </header>
    {children}
  </div>;
}
function Info({icon,title,value}) { return <div style={{...box,padding:16}}><div style={{display:"flex",alignItems:"center",gap:7,color:COLORS.teal,fontWeight:900,fontSize:12,textTransform:"uppercase"}}>{icon}{title}</div><div style={{color:"#444",whiteSpace:"pre-line",lineHeight:1.5,marginTop:7,fontSize:13}}>{value}</div></div>; }
const box={background:"#fff",border:"2px solid "+COLORS.ink,borderRadius:16,padding:22,boxShadow:"0 8px 25px rgba(0,0,0,.06)"};
const button={display:"inline-flex",alignItems:"center",gap:7,background:COLORS.ink,color:"#fff",textDecoration:"none",border:0,borderRadius:9,padding:"10px 14px",fontWeight:800,fontSize:12.5,cursor:"pointer"};
const backLink={background:"transparent",border:0,padding:0,color:"#666",cursor:"pointer",display:"flex",gap:6,alignItems:"center",marginBottom:18};
const pill={display:"inline-flex",alignItems:"center",gap:5,padding:"5px 9px",borderRadius:999,background:COLORS.ink,color:"#fff",fontSize:10.5,fontWeight:900};
const muted={color:"#666",lineHeight:1.5};


function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
