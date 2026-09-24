import React, { useState } from "react";
import { BarChart2, Camera, CheckCircle2, MessageCircle, Pencil, Rocket, Star, Zap } from "lucide-react";
import { COLORS } from "./constants";
import { getFunctions, httpsCallable } from "firebase/functions";
import stallLogoMark from "./logo-cropped.png";

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export default function VendorSuccessPanel({ listings, onEdit, onOffer, onTab }) {
  const listing = listings[0];
  const [running, setRunning] = useState(false);
  const [improvement, setImprovement] = useState(null);
  const [improvementLoading, setImprovementLoading] = useState(false);
  const [improvementError, setImprovementError] = useState("");
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");

  if (!listing) return (
    <section style={{ background: COLORS.ink, color: "#fff", borderRadius: 14, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <img src={stallLogoMark} alt="STall" style={{ width: 28, height: 28, objectFit: "contain" }} />
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: COLORS.marigold }}>STall Digital Assistant</div>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, marginTop: 8 }}>Let&apos;s get your business visible.</div>
      <div style={{ fontSize: 12.5, opacity: .82, marginTop: 6 }}>Create or claim your business. STall will then show your digital score and the exact actions that can improve it.</div>
    </section>
  );

  const profile = {
    name: !!String(listing.name || "").trim(),
    description: !!String(listing.description || "").trim(),
    products: !!String(listing.products || "").trim(),
    phone: !!String(listing.phone || "").trim(),
    location: Number.isFinite(Number(listing.lat)) && Number.isFinite(Number(listing.lng)),
    hours: !!String(listing.hours || "").trim(),
    photos: Array.isArray(listing.photos) && listing.photos.length > 0,
  };
  const completed = Object.values(profile).filter(Boolean).length;
  const views = Number(listing.viewCount || 0);
  const calls = Number(listing.callCount || 0);
  const whatsapp = Number(listing.whatsappCount || 0);
  const actions = calls + whatsapp;
  const hasOffer = !!String(listing.offer || "").trim() || !!String(listing.todaySpecial || "").trim() || !!String(listing.todayOffer || "").trim();
  const hasRating = listing.rating != null;
  const ratingsCount = Number(listing.ratingsCount || 0);
  const hasGoogle = !!listing.placeId;

  const profileScore = completed / 7 * 25;
  const trustScore = (hasRating ? 8 : 0) + (ratingsCount >= 10 ? 5 : ratingsCount > 0 ? 3 : 0) + (hasGoogle ? 2 : 0);
  const contentScore = (profile.photos ? 7 : 0) + (profile.description ? 4 : 0) + (profile.products ? 4 : 0);
  const offerScore = hasOffer ? 8 : 0;
  const engagementScore = actions > 0 ? 10 : views >= 5 ? 6 : 2;
  const score = clamp(profileScore + trustScore + contentScore + offerScore + engagementScore);

  const items = [
    { key: "page", label: "Business page", score: clamp(completed / 7 * 25), max: 25, good: completed === 7, title: completed === 7 ? "Your core business details are ready." : "Complete your business page", text: completed === 7 ? "Everything STall needs to present your business is in place." : (7 - completed) + " important detail" + (7 - completed === 1 ? "" : "s") + " still missing.", button: "Fix it for me", icon: <Pencil size={14} />, run: () => onEdit(listing) },
    { key: "content", label: "Photos & content", score: clamp((profile.photos ? 7 : 0) + (profile.description ? 4 : 0) + (profile.products ? 4 : 0)), max: 15, good: profile.photos && profile.description && profile.products, title: profile.photos ? "Keep your content fresh" : "Add photos customers can trust", text: profile.photos ? "Your storefront has visual content. Add fresh photos when your business changes." : "Add real business photos so customers can see what you offer before they contact you.", button: "Improve content", icon: <Camera size={14} />, run: () => onEdit(listing) },
    { key: "trust", label: "Reviews & trust", score: clamp((hasRating ? 8 : 0) + (ratingsCount >= 10 ? 5 : ratingsCount > 0 ? 3 : 0) + (hasGoogle ? 2 : 0)), max: 15, good: hasRating && ratingsCount >= 10, title: hasRating ? "Keep building trust" : "Build your review presence", text: hasRating ? "Your Google rating is visible. More recent reviews can strengthen customer confidence." : "Connect your Google presence and use STall's reputation tools to improve trust.", button: hasRating ? "Open growth tools" : "Activate trust tools", icon: <Star size={14} />, run: () => onTab("premium") },
    { key: "offer", label: "Offers", score: hasOffer ? 8 : 0, max: 8, good: hasOffer, title: hasOffer ? "Offer is active" : "Give customers a reason to act", text: hasOffer ? "You have a current offer/special visible on your business page." : "Create a current offer or special so customers have a clear reason to contact or visit you.", button: hasOffer ? "Change offer" : "Activate offer", icon: <Zap size={14} />, run: () => onOffer(listing) },
    { key: "engagement", label: "Customer actions", score: clamp(actions > 0 ? 10 : views >= 5 ? 6 : 2), max: 10, good: actions > 0, title: actions > 0 ? "Customers are taking action" : "Turn views into enquiries", text: actions > 0 ? (actions) + " direct customer action" + (actions === 1 ? "" : "s") + " recorded so far." : views >= 5 ? "Customers are viewing your page. Make the next step easier with an offer or clearer contact path." : "As your visibility grows, STall will show you how customers respond.", button: "View insights", icon: <MessageCircle size={14} />, run: () => onTab("insights") },
    { key: "direct", label: "Direct business", score: (listing.planKey === "growth_setup" || (listing.isPremium && listing.subscriptionTier === "growth_setup")) ? 10 : 0, max: 10, good: listing.planKey === "growth_setup" || (listing.isPremium && listing.subscriptionTier === "growth_setup"), title: "Take direct orders & bookings", text: "If your plan includes STall Direct, orders and bookings can run through your own STall storefront.", button: "Open STall Direct", icon: <BarChart2 size={14} />, run: () => onTab("direct") },
  ];

  const gaps = items.filter((item) => !item.good);
  const next = gaps.slice(0, 3);
  const potential = clamp(score + Math.min(15, gaps.length * 4));

  const prepareImprovement = async () => {
    setImprovementError("");
    setApprovalMessage("");
    setImprovementLoading(true);
    try {
      const fn = httpsCallable(getFunctions(), "prepareGbpImprovement");
      const res = await fn({ listingId: listing.id });
      setImprovement(res.data);
    } catch (err) {
      setImprovementError(err?.message || "STall could not prepare the improvement right now.");
    } finally {
      setImprovementLoading(false);
    }
  };

  const approveImprovement = async () => {
    setApprovalMessage("");
    setImprovementError("");
    setApprovalLoading(true);
    try {
      const fn = httpsCallable(getFunctions(), "approveGbpImprovement");
      const res = await fn({ listingId: listing.id });
      setApprovalMessage(res.data?.message || "Google sync completed.");
      setImprovement((prev) => prev ? { ...prev, status: res.data?.status || "synced" } : prev);
    } catch (err) {
      setImprovementError(err?.message || "Google could not complete the approved update.");
    } finally {
      setApprovalLoading(false);
    }
  };

  const startImprovements = () => {
    if (!next.length) return;
    setRunning(true);
    next[0].run();
    window.setTimeout(() => setRunning(false), 500);
  };

  return (
    <section style={{ background: "#fff", border: "2px solid " + COLORS.ink, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 240, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={stallLogoMark} alt="STall" style={{ width: 30, height: 30, objectFit: "contain" }} />
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: COLORS.teal }}>STall Digital Assistant</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2, color: COLORS.ink }}>Your Digital Score</div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: "#666", marginTop: 7 }}>STall checks your business presence and tells you exactly what to improve. You don&apos;t need to be a digital expert.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 82, height: 82, borderRadius: "50%", border: "7px solid " + (score >= 80 ? COLORS.teal : COLORS.marigold), display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "#fff" }}>
            <div style={{ fontSize: 25, fontWeight: 900, lineHeight: 1, color: COLORS.ink }}>{score}</div>
            <div style={{ fontSize: 9.5, color: "#777", marginTop: 3 }}>/ 100</div>
          </div>
          <div style={{ minWidth: 150 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.ink }}>{score >= 85 ? "Excellent digital presence" : score >= 70 ? "Good — room to grow" : "STall found improvements"}</div>
            <div style={{ fontSize: 11.5, color: "#666", marginTop: 4 }}>Potential after improvements: <strong>{potential}/100</strong></div>
            {next.length > 0 && <button type="button" onClick={startImprovements} disabled={running} className="stall-btn" style={{ marginTop: 8, background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}><Rocket size={13} /> {running ? "Opening…" : "Start Improvements"}</button>}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 8, marginTop: 14 }}>
        {items.map((item) => (
          <div key={item.key} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10, background: item.good ? "#F8FBF9" : "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: COLORS.ink }}>{item.label}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: item.good ? COLORS.teal : "#888" }}>{item.score}/{item.max}</div>
            </div>
            <div style={{ height: 5, borderRadius: 5, background: "#eee", marginTop: 7, overflow: "hidden" }}>
              <div style={{ height: "100%", width: (item.score / item.max * 100) + "%", background: item.good ? COLORS.teal : COLORS.marigold, borderRadius: 5 }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.ink, marginTop: 8 }}>{item.title}</div>
            <div style={{ fontSize: 10.5, color: "#666", lineHeight: 1.4, marginTop: 3, minHeight: 43 }}>{item.text}</div>
            <button type="button" onClick={item.run} className="stall-btn" style={{ marginTop: 7, width: "100%", border: "1.5px solid " + COLORS.ink, background: item.good ? "#fff" : COLORS.ink, color: item.good ? COLORS.ink : "#fff", borderRadius: 7, padding: "7px 8px", fontSize: 10.5, fontWeight: 800, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 5 }}>{item.icon}{item.button}</button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 11, padding: 12, background: "#FBFAF6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: COLORS.ink }}>STall can prepare the missing Google work for you</div>
            <div style={{ fontSize: 10.5, color: "#666", marginTop: 3 }}>Images, search phrases and business copy are prepared first. Nothing is pushed until you approve it.</div>
          </div>
          {!improvement && <button type="button" onClick={prepareImprovement} disabled={improvementLoading || !hasGoogle} className="stall-btn" style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: "8px 11px", fontSize: 10.5, fontWeight: 800 }}>{improvementLoading ? "Preparing…" : hasGoogle ? "Prepare for me" : "Connect Google first"}</button>}
        </div>
        {improvement && (
          <div style={{ marginTop: 11, display: "grid", gridTemplateColumns: "minmax(150px,220px) 1fr", gap: 12, alignItems: "start" }}>
            <div style={{ border: "1px solid #ddd", borderRadius: 9, overflow: "hidden", background: "#fff" }}>
              <img src={improvement.imageUrl} alt="STall prepared promotional creative" style={{ width: "100%", display: "block", aspectRatio: "4/3", objectFit: "cover" }} />
              <div style={{ padding: 7, fontSize: 9.5, color: "#777" }}>Promotional creative — review before Google publishing.</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: COLORS.ink }}>Suggested search phrases</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                {(improvement.keywords || []).map((k) => <span key={k} style={{ fontSize: 9.5, padding: "4px 7px", borderRadius: 12, background: COLORS.teal + "12", color: COLORS.ink }}>{k}</span>)}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: COLORS.ink, marginTop: 10 }}>Google business description</div>
              <div style={{ fontSize: 10.5, color: "#555", lineHeight: 1.45, marginTop: 4 }}>{improvement.description}</div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: COLORS.ink, marginTop: 10 }}>Google update</div>
              <div style={{ fontSize: 10.5, color: "#555", lineHeight: 1.45, marginTop: 4 }}>{improvement.post}</div>
              {improvement.status === "draft" ? (
                <button type="button" onClick={approveImprovement} disabled={approvalLoading} className="stall-btn" style={{ marginTop: 10, width: "100%", background: COLORS.ink, color: "#fff", border: "none", borderRadius: 7, padding: 9, fontSize: 11, fontWeight: 900 }}>{approvalLoading ? "Syncing to Google…" : "Approve & Push to Google"}</button>
              ) : (
                <div style={{ marginTop: 10, padding: 8, borderRadius: 7, background: COLORS.teal + "12", color: COLORS.ink, fontSize: 10.5, fontWeight: 800 }}>✓ {improvement.status === "synced" ? "Google sync completed and verified." : "Google accepted the update; verification is still catching up."}</div>
              )}
            </div>
          </div>
        )}
        {(improvementError || approvalMessage) && <div style={{ marginTop: 8, fontSize: 10.5, color: improvementError ? COLORS.brick : COLORS.teal }}>{improvementError || approvalMessage}</div>}
      </div>

      {next.length > 0 ? (
        <div style={{ marginTop: 12, padding: 11, borderRadius: 10, background: COLORS.teal + "12", border: "1px solid " + COLORS.teal + "35", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: COLORS.ink }}><strong>STall found {gaps.length} improvement{gaps.length === 1 ? "" : "s"}.</strong> We&apos;ll guide you through the important ones first.</div>
          <div style={{ fontSize: 10.5, color: "#666" }}>No digital marketing knowledge required.</div>
        </div>
      ) : (
        <div style={{ marginTop: 12, padding: 11, borderRadius: 10, background: COLORS.teal + "12", color: COLORS.ink, fontSize: 12.5 }}><CheckCircle2 size={15} style={{ verticalAlign: "middle", marginRight: 6, color: COLORS.teal }} />Your core digital presence is healthy. Keep it fresh and watch your customer actions in Insights.</div>
      )}
    </section>
  );
}
