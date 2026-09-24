import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, getDocs, orderBy, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, CheckCircle2, Clock, Globe2, MapPin, MessageCircle, Navigation, Phone, Plus, Minus, ShoppingBag, Star } from "lucide-react";
import { db } from "./firebase";
import { COLORS } from "./constants";
import { vendorLink } from "./geo";

const money = (value) => Number.isFinite(Number(value)) ? "₹" + Number(value).toFixed(0) : "Price on request";

export default function StoreLandingPage({ listingId, onBack }) {
  const [listing, setListing] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState({});
  const [customer, setCustomer] = useState({ name: "", phone: "", type: "pickup", address: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null);

  useEffect(() => {
    let alive = true;
    getDoc(doc(db, "vendors", listingId)).then(async snap => {
      if (!alive) return;
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setListing(data);
      if (data && (data.planKey === "growth_setup" || (data.isPremium && data.subscriptionTier === "growth_setup"))) {
        try {
          const ms = await getDocs(collection(db, "vendors", listingId, "direct_menu"));
          const rows = ms.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(x => x.active !== false)
            .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
          setMenuItems(rows);
        } catch {}
      }
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

  const cartItems = useMemo(
    () => menuItems.filter(i => cart[i.id]).map(i => ({ ...i, qty: cart[i.id] })),
    [menuItems, cart]
  );
  const total = cartItems.reduce((sum, i) => sum + (Number(i.price) || 0) * i.qty, 0);
  const setQty = (id, delta) => setCart(c => {
    const n = (c[id] || 0) + delta;
    const next = { ...c };
    if (n <= 0) delete next[id];
    else next[id] = n;
    return next;
  });

  async function placeOrder(e) {
    e.preventDefault();
    if (!cartItems.length || !customer.name.trim() || !customer.phone.trim()) return;
    if (customer.type === "delivery" && !customer.address.trim()) return;
    setPlacing(true);
    try {
      const ref = await addDoc(collection(db, "direct_orders"), {
        vendorId: listingId,
        vendorName: listing.name || "",
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        fulfillmentType: customer.type,
        deliveryAddress: customer.type === "delivery" ? customer.address.trim() : "",
        notes: customer.notes.trim(),
        items: cartItems.map(i => ({ itemId: i.id, name: i.name, price: Number(i.price) || 0, qty: i.qty })),
        subtotal: total,
        total,
        paymentMethod: "pay_at_store",
        paymentStatus: "pending",
        status: "new",
        createdAt: serverTimestamp()
      });
      setPlaced({ id: ref.id });
      setCart({});
    } catch {
      alert("Could not place the order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

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
  const isGrowthSetup = listing.planKey === "growth_setup" || (listing.isPremium && listing.subscriptionTier === "growth_setup");
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

  if (placed) {
    return (
      <div style={page}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 16px 50px" }}>
          <section style={{ ...box, textAlign: "center", marginTop: 30 }}>
            <CheckCircle2 size={48} color={COLORS.teal} />
            <h1>Order received</h1>
            <p style={muted}>Your order has been sent to {listing.name}. Order ID: <strong>{placed.id.slice(-8).toUpperCase()}</strong></p>
            <p style={muted}>Payment: Pay at store.</p>
            <button style={button} onClick={() => setPlaced(null)}>Back to menu</button>
          </section>
        </div>
      </div>
    );
  }

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
              {isGrowthSetup && menuItems.length > 0 && <a href="#stall-direct-order" style={{ ...button, background: COLORS.marigold, color: COLORS.ink }}><ShoppingBag size={15} /> Order / Book</a>}
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

        {isGrowthSetup && menuItems.length > 0 && (
          <section id="stall-direct-order" style={{ ...box, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={pill}>STall Direct</div>
                <h2 style={{ margin: "10px 0 4px" }}>Order directly from {listing.name}</h2>
                <p style={muted}>Choose your items, add your details and place your order without leaving the store page.</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(280px,.8fr)", gap: 12, alignItems: "start", marginTop: 14 }}>
              <div style={{ border: "1px solid #e6e6e6", borderRadius: 12, padding: 14 }}>
                <h3 style={{ margin: "0 0 8px" }}>Menu</h3>
                {menuItems.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid #eee" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>{item.description}</div>}
                      <div style={{ fontWeight: 800, marginTop: 6 }}>{money(item.price)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <button aria-label={"Remove " + item.name} onClick={() => setQty(item.id, -1)} style={stepButton}><Minus size={14} /></button>
                      <b>{cart[item.id] || 0}</b>
                      <button aria-label={"Add " + item.name} onClick={() => setQty(item.id, 1)} style={stepButton}><Plus size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ border: "1px solid #e6e6e6", borderRadius: 12, padding: 14 }}>
                <h3 style={{ margin: "0 0 8px", display: "flex", gap: 7, alignItems: "center" }}><ShoppingBag size={18} /> Your order</h3>
                {!cartItems.length ? <p style={muted}>Add items from the menu.</p> : <>
                  {cartItems.map(item => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", fontSize: 13 }}><span>{item.name} × {item.qty}</span><span>{money((Number(item.price) || 0) * item.qty)}</span></div>)}
                  <div style={totalRow}><b>Total</b><b>{money(total)}</b></div>
                  <form onSubmit={placeOrder} style={{ marginTop: 10 }}>
                    <input required placeholder="Your name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} style={input} />
                    <input required placeholder="Phone number" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} style={input} />
                    <select value={customer.type} onChange={e => setCustomer({ ...customer, type: e.target.value })} style={input}>
                      <option value="pickup">Pickup</option>
                      <option value="delivery">Delivery</option>
                    </select>
                    {customer.type === "delivery" && <textarea required placeholder="Delivery address" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} style={{ ...input, minHeight: 70 }} />}
                    <textarea placeholder="Notes (optional)" value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })} style={{ ...input, minHeight: 60 }} />
                    <button disabled={placing} style={{ ...button, width: "100%", justifyContent: "center", marginTop: 2 }}>{placing ? "Sending…" : "Place order"}</button>
                  </form>
                </>}
              </div>
            </div>
          </section>
        )}
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
const stepButton = { width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #bbb", borderRadius: 7, background: "#fff", color: COLORS.ink, cursor: "pointer" };
const pill = { display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, background: COLORS.ink, color: "#fff", fontSize: 10.5, fontWeight: 900 };
const totalRow = { display: "flex", justifyContent: "space-between", borderTop: "2px solid " + COLORS.ink, paddingTop: 10, marginTop: 8 };
const input = { width: "100%", boxSizing: "border-box", padding: "10px 11px", border: "1.5px solid #bbb", borderRadius: 8, font: "inherit", background: "#fff", marginTop: 7 };
const muted = { color: "#666", lineHeight: 1.5 };
