import React, { useEffect } from "react";

const logo="https://stall.stallwale.in/assets/stall-logo-exact.jpg";
const appUrl="https://stallapp.stallwale.in/";
const studioUrl="https://stallwale.ai.studio/";

function ProductIcon({type}){
  const common={width:22,height:22,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",ariaHidden:true};
  if(type==="discovery") return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M8.5 11h5"/></svg>;
  if(type==="score") return <svg {...common}><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/></svg>;
  if(type==="intelligence") return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M8 12h8"/><path d="M5 5 3 3"/><path d="m19 5 2-2"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-3v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1A1.7 1.7 0 0 0 7.2 15a1.7 1.7 0 0 0-1.5-1H5v-3h.7a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-2 .1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2 2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.7v3h-.7a1.7 1.7 0 0 0-1.5 1Z"/></svg>;
}

const images={
  restaurant:"https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=700&q=80",
  unisex:"https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=700&q=80",
  men:"https://images.unsplash.com/photo-1599351431202-1e0f0b3a1f7d?auto=format&fit=crop&w=700&q=80",
  retail:"https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=700&q=80",
  healthcare:"https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=700&q=80",
  hospital:"https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=700&q=80",
  school:"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=700&q=80",
  preschool:"https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=700&q=80",
  gym:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=80",
  services:"https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=700&q=80",
  resource1:"https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
  resource2:"https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80",
  resource3:"https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80"
};

const css=`
:root{--cream:#fbf7ee;--paper:#fffdf8;--ink:#11100e;--muted:#706b63;--line:#ded6c8;--gold:#f4b72c;--gold2:#ffd968;--dark:#080807;--green:#14a36f;--blue:#367ffc;--purple:#8054e8;--orange:#f27826;--max:1240px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,system-ui,sans-serif}a{text-decoration:none;color:inherit}.wrap{width:min(calc(100% - 40px),var(--max));margin:auto}h1,h2,h3{font-family:Poppins,Inter,sans-serif}
.nav{position:sticky;top:0;z-index:50;background:rgba(8,8,7,.97);color:#fff;border-bottom:1px solid rgba(255,217,104,.15);backdrop-filter:blur(18px)}.navin{height:78px;display:flex;align-items:center;justify-content:space-between;gap:22px}.brand img{width:164px;height:68px;object-fit:cover;border-radius:12px}.navlinks{display:flex;gap:22px;align-items:center;font-size:12px;color:#ebe7df}.navlinks a:hover{color:var(--gold2)}.navcta{background:var(--gold);color:#111!important;padding:11px 18px;border-radius:999px;border:1px solid #111;font-weight:900}
.hero{padding:24px 0 10px;background:#f9f4e9}.hero-box{position:relative;overflow:hidden;border-radius:28px;border:1px solid #111;box-shadow:10px 11px 0 #111;background:radial-gradient(circle at 72% 30%,rgba(244,183,44,.26),transparent 30%),linear-gradient(135deg,#070707,#151108 58%,#090909);color:#fff}.hero-box:after{content:"";position:absolute;inset:auto -10% -60% 15%;height:80%;background:radial-gradient(circle,rgba(255,217,104,.13),transparent 65%)}.hero-grid{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1fr;min-height:470px}.hero-copy{padding:42px 28px 34px 48px;display:flex;flex-direction:column;justify-content:center}.eyebrow{display:inline-flex;align-items:center;gap:7px;width:max-content;padding:7px 12px;border:1px solid rgba(244,183,44,.46);border-radius:999px;background:rgba(244,183,44,.07);color:var(--gold2);font-size:10px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.dot{width:7px;height:7px;border-radius:50%;background:var(--gold)}.hero h1{font-size:clamp(48px,5.8vw,78px);line-height:.96;letter-spacing:-3.7px;margin:18px 0 15px}.hero h1 span{color:var(--gold2)}.hero-lead{max-width:600px;color:#c9c1b6;font-size:15px;line-height:1.48}.hero-badges{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 17px}.hero-badges span{border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:6px 9px;background:rgba(255,255,255,.03);font-size:8px;font-weight:900;color:#e9d9a7;text-transform:uppercase}.actions{display:flex;gap:10px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:13px;font-size:12px;font-weight:900}.primary{background:var(--gold);color:#111;border:1px solid #111;box-shadow:3px 3px 0 #111}.secondary{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:#fff}.hero-small{margin-top:10px;color:#807b72;font-size:9px}.hero-art{position:relative;display:flex;align-items:center;justify-content:center;padding:28px}.hero-art:before{content:"";position:absolute;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(244,183,44,.3),transparent 67%)}.phone{position:relative;z-index:2;width:250px;max-width:72%;border:7px solid #20201d;border-radius:32px;background:#fff;padding:8px;transform:rotate(-8deg);box-shadow:0 24px 38px rgba(0,0,0,.35)}.phone-screen{border-radius:24px;overflow:hidden;background:#f7f5ee;color:#111;min-height:330px}.phone-top{height:44px;background:#111;color:#fff;display:flex;align-items:center;padding:0 12px;font-size:10px;font-weight:900}.phone-card{margin:10px;border-radius:13px;background:#fff;border:1px solid #e3dccd;padding:8px}.phone-photo{height:92px;border-radius:10px;background:url(${images.restaurant}) center/cover}.phone-lines{display:grid;gap:5px;margin-top:8px}.phone-lines i{display:block;height:6px;background:#e7dfcf;border-radius:99px}.robot{position:absolute;z-index:3;right:7%;bottom:21px;width:145px;height:155px;border:1px solid rgba(244,183,44,.3);border-radius:45% 45% 35% 35%;background:linear-gradient(145deg,#e9eef0,#9ea3a0);box-shadow:0 18px 28px rgba(0,0,0,.38);transform:rotate(3deg)}.robot:before,.robot:after{content:"";position:absolute;top:52px;width:27px;height:27px;border-radius:50%;background:#080807;box-shadow:0 0 0 5px #f2b72c}.robot:before{left:31px}.robot:after{right:31px}.robot-head{position:absolute;left:45px;top:10px;width:55px;height:18px;border-radius:99px;background:#111}.robot-note{position:absolute;right:0;top:-22px;border:1px solid rgba(244,183,44,.42);background:#10100f;border-radius:13px;padding:8px;color:#ffd968;font-size:8px;font-weight:900;text-align:center}.hero-metrics{position:absolute;z-index:4;bottom:26px;left:51%;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:45%;transform:translateX(-1%)}.metric{background:#fffdf8;color:#111;border:1px solid #d7cebd;border-radius:10px;padding:9px}.metric b{display:block;font-family:Poppins;font-size:17px}.metric span{display:block;font-size:7px;color:#777168}.metric.good b{color:var(--green)}
.stats{padding:0 0 20px;background:var(--cream)}.statsbar{display:grid;grid-template-columns:repeat(4,1fr);background:var(--paper);border:1px solid #d8d0c2;border-radius:16px;overflow:hidden;box-shadow:0 3px 0 rgba(0,0,0,.03)}.stat{padding:15px 18px;display:flex;gap:10px;align-items:center;border-right:1px solid var(--line)}.stat:last-child{border-right:0}.stat-icon{width:32px;height:32px;border-radius:10px;background:#fff5d6;border:1px solid #ead7a4;display:grid;place-items:center;color:#a76d00;font-weight:900}.stat b{display:block;font-family:Poppins;font-size:15px}.stat span{font-size:9px;color:#777168}
.section{padding:54px 0}.section.alt{background:#f1eadf;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:15px;margin-bottom:19px}.section-head>div{max-width:880px}.kicker{font-size:9px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#9a6700}.section-head h2{font-size:clamp(30px,4vw,47px);line-height:1.02;letter-spacing:-1.9px;margin:7px 0 7px}.section-head p{color:#706a62;font-size:12px;margin:0}.view{font-size:10px;color:#956000;font-weight:900;white-space:nowrap}
.products{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.prod{border:1px solid #d8cfbf;border-radius:18px;padding:18px;min-height:174px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 3px 0 rgba(0,0,0,.03);transition:.18s}.prod:hover{transform:translateY(-3px);box-shadow:0 12px 24px rgba(0,0,0,.08)}.prod:nth-child(1){background:#eaf8f1}.prod:nth-child(2){background:#eaf3ff}.prod:nth-child(3){background:#f2edff}.prod:nth-child(4){background:#fff0e5}.prod-icon{width:39px;height:39px;border-radius:12px;background:#fff;display:grid;place-items:center;border:1px solid rgba(0,0,0,.08);font-weight:900}.prod h3{font-size:16px;line-height:1.08;margin:13px 0 5px}.prod p{font-size:10px;color:#6c665d;margin:0}.prod-cta{font-size:10px;font-weight:900;color:#8d5e00}
.categories{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.cat{background:#fffdf8;border:1px solid #d9d0bf;border-radius:14px;overflow:hidden;box-shadow:0 2px 0 rgba(0,0,0,.03)}.cat-img{height:86px;background-position:center;background-size:cover}.cat-label{padding:9px 10px}.cat-label b{font-family:Poppins;font-size:11px}.cat-label span{display:block;font-size:8px;color:#817a70;margin-top:2px}
.ai-panel{background:linear-gradient(135deg,#080807,#181207);border:1px solid #111;border-radius:23px;box-shadow:9px 10px 0 #111;color:#fff;padding:22px;position:relative;overflow:hidden}.ai-panel:after{content:"";position:absolute;width:320px;height:320px;right:-100px;top:-150px;border-radius:50%;background:radial-gradient(circle,rgba(244,183,44,.22),transparent 67%)}.ai-title{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-end;gap:15px}.ai-title h2{font-size:clamp(28px,4vw,44px);line-height:1.02;margin:7px 0;letter-spacing:-1.5px}.ai-title p{color:#b5aea4;font-size:10px;margin:0}.ai-badge{border:1px solid rgba(244,183,44,.42);border-radius:999px;color:var(--gold2);padding:8px 10px;font-size:8px;font-weight:900;white-space:nowrap}.ai-grid{position:relative;z-index:2;display:grid;grid-template-columns:1.15fr .85fr;gap:9px;margin-top:15px}.ai-card{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);border-radius:16px;padding:16px}.ai-card h3{margin:0 0 4px;font-size:15px}.ai-card p{margin:0 0 11px;color:#aaa39a;font-size:9px}.signals{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.signal{padding:11px;border-radius:11px;border:1px solid rgba(255,255,255,.09);background:#0e0e0c}.signal b{display:block;font-size:10px}.signal span{font-size:8px;color:#807970}.path{display:grid;gap:6px}.path div{display:flex;gap:8px;align-items:center;padding:9px;border-radius:10px;border:1px solid rgba(255,255,255,.09);background:#0e0e0c;font-size:9px}.path b{color:var(--gold2)}
.intel{display:grid;grid-template-columns:.95fr 1.05fr;gap:10px}.score-card{background:linear-gradient(145deg,#090908,#221807);border:1px solid #111;border-radius:20px;padding:22px;color:#fff;box-shadow:7px 8px 0 #111}.score-card .score{font-family:Poppins;font-size:66px;color:var(--gold2);line-height:1}.score-card small{color:#aaa39a;font-size:9px}.bars{display:grid;gap:7px;margin-top:16px}.barrow{display:grid;grid-template-columns:70px 1fr 25px;gap:7px;align-items:center;font-size:8px;color:#aaa39a}.barbg{height:7px;border-radius:99px;background:#2e281d;overflow:hidden}.barfill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:99px}.opp-card{border:1px solid #d8cfbf;background:#fffdf8;border-radius:20px;padding:22px}.opp-card h3{font-size:22px;margin:0 0 4px}.opp-card p{font-size:9px;color:#777168;margin:0 0 10px}.opp{padding:11px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;font-size:9px}.opp b{color:#8d5f00}.opp span{color:#747067;text-align:right}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.step{background:#fffdf8;border:1px solid #d8cfbf;border-radius:15px;padding:17px}.step .n{font-size:8px;font-weight:900;color:#a06b00;letter-spacing:1px}.step h3{font-size:15px;margin:8px 0 4px}.step p{font-size:9px;color:#777168;margin:0}
.trust{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.quote{background:#fffdf8;border:1px solid #d8cfbf;border-radius:17px;padding:18px}.quote-top{display:flex;justify-content:space-between;gap:6px}.quote strong{font-family:Poppins;font-size:12px}.stars{color:#e19b00;font-size:10px}.quote p{font-size:9px;color:#58534c;line-height:1.45;margin:10px 0 0}.quote small{font-size:8px;color:#8a8378}
.plans-wrap{background:linear-gradient(145deg,#080807,#161106);border:1px solid #111;border-radius:25px;box-shadow:10px 11px 0 #111;padding:22px;color:#fff}.plans{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.plan{position:relative;border:1px solid #ded5c5;background:#fffdf8;color:#111;border-radius:14px;padding:17px}.plan.featured{box-shadow:0 0 0 2px var(--gold)}.plan.featured:before{content:"MOST POPULAR";position:absolute;left:10px;top:-9px;background:var(--gold);border:1px solid #111;border-radius:99px;padding:4px 8px;font-size:7px;font-weight:900}.plan .tag{font-size:8px;font-weight:900;color:#946300;text-transform:uppercase;letter-spacing:.8px}.plan h3{font-size:17px;margin:6px 0}.price{font-family:Poppins;font-size:28px;font-weight:800}.plan p{font-size:8px;color:#777168;min-height:36px}.plan ul{list-style:none;padding:0;margin:8px 0}.plan li{font-size:8px;padding:4px 0}.plan li:before{content:"✓";color:#a36c00;font-weight:900;margin-right:6px}.plan a{display:flex;justify-content:center;align-items:center;min-height:34px;border-radius:9px;background:var(--gold);border:1px solid #111;font-size:9px;font-weight:900}
.resources{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.resource{background:#fffdf8;border:1px solid #d8cfbf;border-radius:17px;overflow:hidden}.resource-img{height:112px;background-position:center;background-size:cover}.resource-body{padding:13px}.resource-body small{font-size:8px;color:#8d8477;text-transform:uppercase;letter-spacing:.8px}.resource-body h3{font-size:14px;line-height:1.15;margin:5px 0}.resource-body p{font-size:9px;color:#777168;margin:0}
.faq{display:grid;grid-template-columns:1fr 1fr;gap:8px}.faq-item{display:flex;justify-content:space-between;gap:12px;background:#fffdf8;border:1px solid #d8cfbf;border-radius:12px;padding:13px;font-size:10px}.faq-item span{color:#726b61}
.cta{border:1px solid #111;border-radius:24px;padding:34px;background:linear-gradient(90deg,#f0dfbf,#fff7e8 52%,#f0dfbf);box-shadow:9px 10px 0 #111;text-align:center}.cta h2{font-size:clamp(28px,4vw,43px);margin:0 0 5px;letter-spacing:-1.6px}.cta p{font-size:10px;color:#6f695f;margin:0 0 18px}.cta .btn{min-width:180px}
footer{background:#080807;color:#fff;padding:34px 0 20px}.footgrid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 1fr;gap:28px}.foot-logo img{width:150px;height:65px;object-fit:cover;border-radius:10px}.foot-logo p{max-width:280px;font-size:9px;color:#8f897f;margin:9px 0}.footcol h3{font-size:9px;text-transform:uppercase;color:var(--gold2);letter-spacing:1px;margin:2px 0 10px}.footlinks{display:grid;gap:6px}.footlinks a{font-size:9px;color:#a7a198}.footlinks a:hover{color:#fff}.footbottom{border-top:1px solid #2a261e;margin-top:18px;padding-top:13px;color:#6f695f;font-size:8px;display:flex;justify-content:space-between;gap:20px}
@media(max-width:980px){.navlinks a:not(.navcta){display:none}.hero-grid,.ai-grid,.intel{grid-template-columns:1fr}.hero-copy{padding:34px 28px}.hero-art{min-height:360px}.products,.plans{grid-template-columns:1fr 1fr}.categories{grid-template-columns:repeat(3,1fr)}.steps{grid-template-columns:1fr 1fr}.trust,.resources{grid-template-columns:1fr 1fr}.statsbar{grid-template-columns:1fr 1fr}.stat:nth-child(2){border-right:0}}
@media(max-width:600px){.wrap{width:min(calc(100% - 24px),var(--max))}.navin{height:68px}.brand img{width:142px;height:60px}.hero{padding-top:14px}.hero h1{font-size:44px;letter-spacing:-2.4px}.hero-copy{padding:28px 20px}.hero-art{min-height:300px;padding:18px}.phone{width:210px}.robot{right:4%;width:105px;height:115px}.hero-metrics{left:48%;width:50%;bottom:16px}.statsbar,.products,.categories,.steps,.trust,.plans,.resources,.faq{grid-template-columns:1fr}.stat{border-right:0;border-bottom:1px solid var(--line)}.stat:last-child{border-bottom:0}.section{padding:46px 0}.section-head{align-items:flex-start;flex-direction:column}.view{margin-top:-7px}.footgrid{grid-template-columns:1fr 1fr}.footbottom{flex-direction:column}.ai-title{align-items:flex-start;flex-direction:column}}

/* Contrast/accessibility pass: keep every text tier readable against its actual surface. */
body{color:#171512}
.section-head h2,.section h2,.section h3,.prod h3,.cat-label b,.step h3,.quote strong,.plan h3,.resource-body h3,.faq-item b,.opp-card h3{color:#171512}
.section-head p,.prod p,.cat-label span,.step p,.quote p,.quote small,.resource-body p,.faq-item span,.opp-card p,.opp span{color:#514c45}
.kicker,.view,.prod-cta{color:#7a4f00}
.hero-box,.hero-box h1,.hero-box .hero-lead,.hero-box .hero-small,.hero-box .hero-badges,.ai-panel,.ai-panel h2,.ai-panel h3,.ai-panel p,.score-card{color:#fff}
.hero-box .hero-lead{color:#e4ded5}.hero-box .hero-small{color:#bdb5aa}.hero-box .hero-badges span{color:#f3e6bd}
.ai-panel .kicker,.ai-panel .ai-title p,.ai-panel .ai-card p{color:#e5ddd2}
.ai-panel .ai-card,.ai-panel .path div,.ai-panel .signal{color:#f3efe8}
.ai-panel .path div{border-color:rgba(255,255,255,.16)}
.score-card{color:#fff}.score-card small,.score-card .barrow{color:#c7beb2}
.plans-wrap,.plans-wrap h2,.plans-wrap .plans-head{color:#fff}.plans-wrap .plans-note{color:#d0c8bd}
.plan,.plan h3,.plan p,.plan li{color:#171512}.plan p,.plan li{color:#514c45}.plan .tag{color:#7a4f00}
footer,.footcol h3{color:#fff}.foot-logo p,.footlinks a{color:#d0c9bf}.footlinks a:hover{color:#fff}.footbottom{color:#aaa196}
.stats-item b{color:#171512}.stats-item span{color:#5d574f}
.phone-screen,.phone-top,.phone-card,.phone-card strong,.metric{color:#171512}.phone-top{color:#fff}.metric span{color:#5d574f}.metric.good b{color:#08744e}
.cta,.cta h2,.cta p{color:#171512}.cta p{color:#5d574f}
@media(max-width:600px){.hero-box .hero-lead{color:#e8e1d7}.footlinks a{color:#d0c9bf}}

.prod-icon{color:#111!important;font-size:0}.prod-icon svg{display:block;width:22px;height:22px;stroke:#111;stroke-width:2.2}
`;

export default function PublicLandingPageClay(){
  useEffect(()=>{
    document.title="STall — Local Business Discovery, AI Growth & Digital Store Automation";
    const canonical=document.querySelector('link[rel="canonical"]');
    if(canonical) canonical.href="https://stallwale.in/";
    const meta=document.querySelector('meta[name="description"]');
    if(meta) meta.content="STall helps local businesses get discovered, understand digital performance, compare similar businesses and grow with AI-powered tools.";
  },[]);

  const cats=[
    ["Restaurants",images.restaurant,"Food, dining and local offers"],
    ["Unisex Salon",images.unisex,"Beauty services and offers"],
    ["Men Salon",images.men,"Category-specific salon discovery"],
    ["Retail Stores",images.retail,"Products and neighbourhood shopping"],
    ["Healthcare",images.healthcare,"Clinics and health services"],
    ["Hospitals",images.hospital,"Hospitals and medical services"],
    ["Schools",images.school,"Education businesses"],
    ["Pre Schools",images.preschool,"Early education"],
    ["Gyms & Fitness",images.gym,"Fitness and wellness"],
    ["Local Services",images.services,"Everyday local services"]
  ];

  return <div className="stall-premium">
    <style dangerouslySetInnerHTML={{__html:css}}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({
      "@context":"https://schema.org","@type":"Organization","name":"STall","url":"https://stallwale.in/","logo":logo,
      "areaServed":{"@type":"Country","name":"India"},
      "description":"India-wide local business discovery and AI-powered digital growth platform.",
      "knowsAbout":["local business discovery","business listings","business claiming","digital score","business intelligence","competitive intelligence","digital store automation"]
    })}}/>

    <header className="nav"><div className="wrap navin">
      <a className="brand" href="https://stallwale.in/"><img src={logo} alt="STall logo"/></a>
      <nav className="navlinks">
        <a href="/products.html">Products⌄</a><a href="#platform">For Businesses⌄</a><a href="#plans">Pricing</a><a href="#resources">Resources⌄</a><a href="/careers.html">Careers</a><a href={appUrl}>Sign In</a><a className="navcta" href={appUrl}>Get Started Free →</a>
      </nav>
    </div></header>

    <main>
      <section className="hero"><div className="wrap"><div className="hero-box"><div className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span className="dot"/> AI-powered for local businesses</div>
          <h1>Make Your <span>Local Business</span> Grow With AI</h1>
          <p className="hero-lead">Discover. Analyze. Automate. Grow. All in one platform to help local businesses get more visibility, more customers and grow faster with the power of AI.</p>
          <div className="hero-badges"><span>AI Readiness</span><span>AI Visibility</span><span>AI Actions</span></div>
          <div className="actions"><a className="btn primary" href={appUrl}>Get Started Free →</a><a className="btn secondary" href="#platform">◉ &nbsp; Watch How STall Works</a></div>
          <div className="hero-small">No credit card required • Start with a free business listing</div>
        </div>
        <div className="hero-art">
          <div className="phone"><div className="phone-screen"><div className="phone-top">STall • Koramangala, Bengaluru</div><div className="phone-card"><div className="phone-photo"/><strong style={{fontSize:10}}>Swaad Kerala Restaurant</strong><div className="phone-lines"><i/><i/><i/></div></div><div className="phone-card"><strong style={{fontSize:10}}>Cut N Cute Studio</strong><div className="phone-lines"><i/><i/></div></div></div></div>
          <div className="robot"><div className="robot-head"/><div className="robot-note">Your<br/>AI Growth<br/>Partner</div></div>
          <div className="hero-metrics"><div className="metric good"><b>82</b><span>Digital Score</span></div><div className="metric"><b>3.5×</b><span>Visibility</span></div><div className="metric"><b>2.8×</b><span>New Customers</span></div></div>
        </div>
      </div></div></div></section>

      <section className="stats"><div className="wrap"><div className="statsbar">
        <div className="stat"><div className="stat-icon">⌂</div><div><b>10,000+</b><span>Local Businesses</span></div></div>
        <div className="stat"><div className="stat-icon">⌖</div><div><b>80+</b><span>Cities in India</span></div></div>
        <div className="stat"><div className="stat-icon">▦</div><div><b>Multiple</b><span>Business Categories</span></div></div>
        <div className="stat"><div className="stat-icon">✦</div><div><b>AI-Powered</b><span>Growth Tools</span></div></div>
      </div></div></section>

      <section id="platform" className="section"><div className="wrap">
        <div className="section-head"><div><div className="kicker">Our AI Products</div><h2>Everything your business needs to get discovered, attract customers and grow.</h2><p>One clear path from local discovery to digital intelligence and automation.</p></div><a className="view" href="/products.html">View All Products →</a></div>
        <div className="products">
          <a className="prod" href={appUrl}><div><div className="prod-icon"><ProductIcon type="discovery"/></div><h3>Business<br/>Discovery</h3><p>Find and connect with local customers.</p></div><div className="prod-cta">Open STall App →</div></a>
          <a className="prod" href={studioUrl}><div><div className="prod-icon"><ProductIcon type="score"/></div><h3>Digital Score</h3><p>Know your digital presence score.</p></div><div className="prod-cta">Check Score →</div></a>
          <a className="prod" href={studioUrl}><div><div className="prod-icon"><ProductIcon type="intelligence"/></div><h3>Business<br/>Intelligence</h3><p>AI insights to grow faster.</p></div><div className="prod-cta">Explore →</div></a>
          <a className="prod" href={studioUrl}><div><div className="prod-icon"><ProductIcon type="automation"/></div><h3>Digital Store<br/>Automation</h3><p>Automate posts, offers and engagement.</p></div><div className="prod-cta">Get Started →</div></a>
        </div>
      </div></section>

      <section className="section alt"><div className="wrap">
        <div className="section-head"><div><div className="kicker">Business Categories We Serve</div><h2>AI-powered solutions for every type of local business.</h2><p>Category and location context remain explicit so customers and AI-powered discovery systems understand who STall serves.</p></div><a className="view" href="/india.html">View All Categories →</a></div>
        <div className="categories">{cats.map(([name,img,desc])=><article className="cat" key={name}><div className="cat-img" style={{backgroundImage:`url(${img})`}}/><div className="cat-label"><b>{name}</b><span>{desc}</span></div></article>)}</div>
      </div></section>

      <section className="section" style={{paddingTop:26}}><div className="wrap"><div className="ai-panel">
        <div className="ai-title"><div><div className="kicker" style={{color:"#ffd968"}}>AI-Adaptive Business Intelligence</div><h2>Turn business signals into your next best action.</h2><p>Get personalized insights, competitor analysis and growth recommendations using AI.</p></div><div className="ai-badge">AI-ADAPTIVE BY DESIGN</div></div>
        <div className="ai-grid">
          <div className="ai-card"><h3>Understand → Compare → Recommend</h3><p>STall combines your business context with same-category nearby signals to surface practical opportunities.</p><div className="signals"><div className="signal"><b>Analyze Competitors</b><span>Same-category context</span></div><div className="signal"><b>Improve Google Profile</b><span>Digital presence signals</span></div><div className="signal"><b>Suggested Actions</b><span>Prioritized improvements</span></div></div></div>
          <div className="ai-card"><h3>The STall AI Path</h3><div className="path"><div><b>01</b> Understand the business</div><div><b>02</b> Understand the local market</div><div><b>03</b> Find the highest-value opportunity</div><div><b>04</b> Act, review and improve</div></div></div>
        </div>
      </div></div></section>

      <section id="intelligence" className="section alt"><div className="wrap">
        <div className="section-head"><div><div className="kicker">Competitive Intelligence</div><h2>Know where your business stands — and what to improve next.</h2><p>Category-aware comparison: restaurants with restaurants, unisex salons with unisex salons, hospitals with hospitals, schools with schools and preschools separately.</p></div></div>
        <div className="intel">
          <div className="score-card"><div className="kicker" style={{color:"#ffd968"}}>Your Business Score</div><div className="score">82<span style={{fontSize:23,color:"#aaa39a"}}>/100</span></div><small>Illustrative UI • production scores are calculated dynamically.</small><div className="bars"><div className="barrow"><span>Profile</span><div className="barbg"><div className="barfill" style={{width:"86%"}}/></div><b>86</b></div><div className="barrow"><span>Visibility</span><div className="barbg"><div className="barfill" style={{width:"74%"}}/></div><b>74</b></div><div className="barrow"><span>Reviews</span><div className="barbg"><div className="barfill" style={{width:"91%"}}/></div><b>91</b></div><div className="barrow"><span>Content</span><div className="barbg"><div className="barfill" style={{width:"68%"}}/></div><b>68</b></div></div></div>
          <div className="opp-card"><h3>Top Opportunities</h3><p>Examples of the kind of actions STall can prioritize.</p><div className="opp"><b>Improve Google Reviews</b><span>+40% trust potential</span></div><div className="opp"><b>Add Photos & Offers</b><span>+31% engagement</span></div><div className="opp"><b>Post Regular Updates</b><span>+24% more interactions</span></div><div className="opp"><b>Compare Nearby Peers</b><span>Find highest-value gap</span></div></div>
        </div>
      </div></section>

      <section className="section"><div className="wrap"><div className="section-head"><div><div className="kicker">How STall Works</div><h2>Get started in minutes and see real results.</h2></div></div><div className="steps">
        <article className="step"><div className="n">01 / SIGN UP</div><h3>Create your account</h3><p>Start with a free STall account.</p></article>
        <article className="step"><div className="n">02 / ADD</div><h3>Add Your Business</h3><p>List or claim your business details.</p></article>
        <article className="step"><div className="n">03 / INSIGHTS</div><h3>Get AI Insights</h3><p>Receive personalized recommendations.</p></article>
        <article className="step"><div className="n">04 / GROW</div><h3>Grow Your Business</h3><p>Launch offers, post updates and attract customers.</p></article>
      </div></div></section>

      <section className="section alt"><div className="wrap"><div className="section-head"><div><div className="kicker">Trusted by Thousands of Local Businesses</div><h2>Real businesses. Real growth. Powered by AI.</h2></div><div className="stars">★ 4.8/5</div></div><div className="trust">
        <article className="quote"><div className="quote-top"><strong>Swaad Kerala Restaurant</strong><span className="stars">★★★★★</span></div><p>“STall helped us increase our visibility and get more customers. The AI suggestions are very useful!”</p><small>Janakpuri, Delhi</small></article>
        <article className="quote"><div className="quote-top"><strong>Cut N Cute Studio</strong><span className="stars">★★★★★</span></div><p>“Our salon bookings increased after using the digital tools. The recommendations are practical and easy to use.”</p><small>Bangalore</small></article>
        <article className="quote"><div className="quote-top"><strong>The Health Care Clinic</strong><span className="stars">★★★★★</span></div><p>“We got more patient enquiries through STall. The platform is simple to use and very effective.”</p><small>HSR Layout, Bangalore</small></article>
      </div></div></section>

      <section id="plans" className="section"><div className="wrap"><div className="plans-wrap">
        <div className="section-head" style={{marginBottom:18}}><div><div className="kicker" style={{color:"#ffd968"}}>Simple & Transparent Plans</div><h2 style={{color:"#fff"}}>Choose the right plan for your business.</h2></div><div style={{fontSize:9,color:"#aaa39a"}}>Monthly</div></div>
        <div className="plans">
          <article className="plan"><div className="tag">Start</div><h3>Free Listing</h3><div className="price">₹0</div><p>Get started with basic visibility.</p><ul><li>Basic business listing</li><li>Visible within 100 metres</li><li>Essential profile details</li></ul><a href={appUrl}>Get Started Free</a></article>
          <article className="plan"><div className="tag">Trust</div><h3>STall Verified</h3><div className="price">₹99</div><p>Boost your local visibility.</p><ul><li>Verified business badge</li><li>Visible within 1 km</li><li>Priority in local search</li></ul><a href={appUrl}>Choose Plan</a></article>
          <article className="plan featured"><div className="tag">Growth</div><h3>Digital Growth</h3><div className="price">₹499</div><p>More visibility. More customers.</p><ul><li>Free landing page under STall</li><li>Visible within 5 km</li><li>AI insights & recommendations</li></ul><a href={appUrl}>Choose Plan</a></article>
          <article className="plan"><div className="tag">Scale</div><h3>Growth Pro</h3><div className="price">₹999</div><p>Maximum reach and features.</p><ul><li>Visible within 25 km</li><li>Advanced AI insights</li><li>Priority support</li></ul><a href={appUrl}>Choose Plan</a></article>
        </div>
      </div></div></section>

      <section id="resources" className="section alt"><div className="wrap"><div className="section-head"><div><div className="kicker">Latest from STall</div><h2>Tips, guides and insights to help your business grow.</h2></div><a className="view" href="/products.html">View All Resources →</a></div><div className="resources">
        <article className="resource"><div className="resource-img" style={{backgroundImage:`url(${images.resource1})`}}/><div className="resource-body"><small>Business visibility</small><h3>How to improve your Google Business Profile</h3><p>Build a stronger local presence with better business information.</p></div></article>
        <article className="resource"><div className="resource-img" style={{backgroundImage:`url(${images.resource2})`}}/><div className="resource-body"><small>Salon growth</small><h3>10 Digital Marketing Tips for Salons</h3><p>Turn customer signals into practical growth actions.</p></div></article>
        <article className="resource"><div className="resource-img" style={{backgroundImage:`url(${images.resource3})`}}/><div className="resource-body"><small>Restaurants</small><h3>Restaurant Marketing Strategies to Get More Customers</h3><p>Combine discovery, offers and an active digital presence.</p></div></article>
      </div></div></section>

      <section id="faq" className="section"><div className="wrap"><div className="section-head"><div><div className="kicker">Frequently Asked Questions</div><h2>Clear answers about STall.</h2></div><a className="view" href="https://stall.stallwale.in/faq.html">View All FAQs →</a></div><div className="faq">
        <div className="faq-item"><b>What is STall?</b><span>⌄</span></div><div className="faq-item"><b>Which businesses can join STall?</b><span>⌄</span></div>
        <div className="faq-item"><b>How does the Digital Score work?</b><span>⌄</span></div><div className="faq-item"><b>How does visibility radius work?</b><span>⌄</span></div>
        <div className="faq-item"><b>Can I try STall for free?</b><span>⌄</span></div><div className="faq-item"><b>How do I upgrade my plan?</b><span>⌄</span></div>
      </div></div></section>

      <section className="section"><div className="wrap"><div className="cta"><h2>Join Local Businesses Growing With AI</h2><p>Get discovered. Connect with more customers. Grow faster with STall.</p><a className="btn primary" href={appUrl}>Get Started Free →</a><div style={{fontSize:8,color:"#888",marginTop:9}}>No credit card required</div></div></div></section>
    </main>

    <footer><div className="wrap"><div className="footgrid">
      <div className="foot-logo"><img src={logo} alt="STall logo"/><p>STall connects people with local businesses and gives business owners AI-powered tools to build, manage and grow their digital presence.</p></div>
      <div className="footcol"><h3>Products</h3><div className="footlinks"><a href="/products.html">Business Discovery</a><a href="/products/digital-score.html">Digital Score</a><a href="/products/business-intelligence.html">Business Intelligence</a><a href="/products/digital-store-automation.html">Digital Store Automation</a></div></div>
      <div className="footcol"><h3>For Businesses</h3><div className="footlinks"><a href={appUrl}>STall App</a><a href={studioUrl}>AI Studio</a><a href="#plans">Pricing</a><a href="/careers.html">Success Stories</a></div></div>
      <div className="footcol"><h3>Resources</h3><div className="footlinks"><a href="/products.html">Blog</a><a href="/products.html">Guides</a><a href="https://stall.stallwale.in/help.html">Help Center</a><a href="https://stall.stallwale.in/contact.html">Community</a></div></div>
      <div className="footcol"><h3>Company</h3><div className="footlinks"><a href="/india.html">About Us</a><a href="/careers.html">Careers</a><a href="https://stall.stallwale.in/contact.html">Contact</a><a href={appUrl}>Follow STall</a></div></div>
    </div><div className="footbottom"><span>© 2026 STall. That’s All. Discover • Connect • Grow.</span><span>Privacy Policy&nbsp;&nbsp; | &nbsp;&nbsp;Terms of Service</span></div></div></footer>
  </div>;
}
