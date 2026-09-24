import React from "react";
import { BarChart2, Camera, CheckCircle2, MessageCircle, Pencil, Star, Zap } from "lucide-react";
import { COLORS } from "./constants";

export default function VendorSuccessPanel({ listings, onEdit, onOffer, onTab }) {
  const listing = listings[0];
  if (!listing) return (
    <section style={{ background: COLORS.ink, color: "#fff", borderRadius: 14, padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: COLORS.marigold }}>STall will do the digital work</div>
      <div style={{ fontSize: 21, fontWeight: 800, marginTop: 5 }}>Let&apos;s get your business visible.</div>
      <div style={{ fontSize: 12.5, opacity: .82, marginTop: 6 }}>Create or claim your business. STall will help you build the digital presence customers can find.</div>
    </section>
  );

  const profileFields = [
    ["Business name", !!listing.name], ["Description", !!String(listing.description || "").trim()],
    ["Products / services", !!String(listing.products || "").trim()], ["Phone", !!String(listing.phone || "").trim()],
    ["Location", Number.isFinite(Number(listing.lat)) && Number.isFinite(Number(listing.lng))],
    ["Hours", !!String(listing.hours || "").trim()], ["Photos", Array.isArray(listing.photos) && listing.photos.length > 0],
  ];
  const completed = profileFields.filter(([, ok]) => ok).length;
  const views = Number(listing.viewCount || 0);
  const actions = Number(listing.callCount || 0) + Number(listing.whatsappCount || 0);
  const hasOffer = !!String(listing.offer || "").trim() || !!String(listing.todaySpecial || "").trim() || !!String(listing.todayOffer || "").trim();
  const hasRating = listing.rating != null;
  const hasPhotos = Array.isArray(listing.photos) && listing.photos.length > 0;
  const actionsList = [];
  if (completed < profileFields.length) actionsList.push({ icon: <Pencil size={14} />, title: "Complete your business page", text: (profileFields.length - completed) + " important detail" + (profileFields.length - completed === 1 ? "" : "s") + " still missing.", label: "Complete page", run: () => onEdit(listing) });
  if (!hasPhotos) actionsList.push({ icon: <Camera size={14} />, title: "Add a few good photos", text: "Photos help customers understand what they will get before they contact you.", label: "Add photos", run: () => onEdit(listing) });
  if (!hasOffer) actionsList.push({ icon: <Zap size={14} />, title: "Put today&apos;s reason to visit", text: "Add a current offer or special so your listing gives customers a reason to act.", label: "Create offer", run: () => onOffer(listing) });
  if (views >= 5 && actions === 0) actionsList.push({ icon: <MessageCircle size={14} />, title: "Turn views into enquiries", text: "People are looking, but nobody has contacted you yet. A clearer offer can help.", label: "Create offer", run: () => onOffer(listing) });
  if (!hasRating) actionsList.push({ icon: <Star size={14} />, title: "Build trust", text: "Connect your Google presence and keep your reputation information current.", label: "Open growth tools", run: () => onTab("premium") });
  if (listing.planKey === "growth_setup" || (listing.isPremium && listing.subscriptionTier === "growth_setup")) actionsList.push({ icon: <BarChart2 size={14} />, title: "Start taking direct business", text: "Your STall Direct tools are available for orders and bookings.", label: "Open STall Direct", run: () => onTab("direct") });
  const next = actionsList.slice(0, 3);

  return (
    <section style={{ background: "#fff", border: "2px solid " + COLORS.ink, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div><div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: COLORS.teal }}>STall Business Assistant</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 3, color: COLORS.ink }}>Let&apos;s make the next step easy.</div><div style={{ fontSize: 12.5, color: "#666", marginTop: 4 }}>STall looks at your page and customer actions and suggests only the things worth doing next.</div></div>
        <div style={{ minWidth: 120, textAlign: "right" }}><div style={{ fontSize: 10.5, color: "#777", textTransform: "uppercase", fontWeight: 800 }}>Page health</div><div style={{ fontSize: 24, fontWeight: 900, color: completed === profileFields.length ? COLORS.teal : COLORS.ink }}>{completed}/{profileFields.length}</div><div style={{ fontSize: 10.5, color: "#777" }}>core details ready</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 9, marginTop: 14 }}>
        {next.length ? next.map((item, i) => (
          <div key={item.title} style={{ border: "1px solid #ddd", borderRadius: 11, padding: 11, background: i === 0 ? "#F7F6F2" : "#fff" }}><div style={{ display: "flex", gap: 7, alignItems: "center", color: COLORS.teal, fontWeight: 800, fontSize: 12 }}>{item.icon}<span>Next step {i + 1}</span></div><div style={{ fontWeight: 800, fontSize: 13, marginTop: 7, color: COLORS.ink }}>{item.title}</div><div style={{ fontSize: 11.5, color: "#666", lineHeight: 1.45, marginTop: 4, minHeight: 34 }}>{item.text}</div><button type="button" onClick={item.run} className="stall-btn" style={{ marginTop: 8, width: "100%", border: "1.5px solid " + COLORS.ink, background: i === 0 ? COLORS.ink : "#fff", color: i === 0 ? "#fff" : COLORS.ink, borderRadius: 7, padding: "7px 9px", fontSize: 11.5, fontWeight: 800 }}>{item.label}</button></div>
        )) : (<div style={{ gridColumn: "1/-1", padding: 13, borderRadius: 10, background: COLORS.teal + "12", color: COLORS.ink, fontSize: 12.5 }}><CheckCircle2 size={15} style={{ verticalAlign: "middle", marginRight: 6, color: COLORS.teal }} />Your core page is in good shape. Keep it fresh with offers and watch your customer actions in Insights.</div>)}
      </div>
    </section>
  );
}