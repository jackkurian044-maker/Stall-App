import React, { useEffect } from "react";
const logo = "https://stall.stallwale.in/assets/stall-logo-exact.jpg";
const appUrl = "https://stallapp.stallwale.in/";

const css = `
:root{--ivory:#f7f3ea;--paper:#fffdf8;--ink:#0d0d0c;--muted:#68645d;--line:#e4ddcf;--black:#080808;--gold:#f3b82d;--gold2:#ffd86a;--cream:#efe6d7;--green:#16835c;--blue:#347cff;--purple:#7354e7;--orange:#f17821;--max:1240px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--ivory);color:var(--ink);font-family:Inter,system-ui,sans-serif;line-height:1.55}a{color:inherit;text-decoration:none}.wrap{width:min(calc(100% - 42px),var(--max));margin:auto}
.nav{position:sticky;top:0;z-index:50;background:rgba(247,243,234,.94);backdrop-filter:blur(16px);border-bottom:1px solid rgba(13,13,12,.08)}.navin{min-height:84px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center}.brand-plaque{background:#080808;border:1px solid #111;border-radius:18px;padding:5px 12px;display:flex;align-items:center;box-shadow:4px 4px 0 rgba(0,0,0,.12)}.brand-plaque img{width:154px;height:62px;object-fit:cover;object-position:center;border-radius:10px}.navlinks{display:flex;align-items:center;gap:22px;color:#4e4a43;font-size:13px;font-weight:650}.navlinks a:hover{color:#111}.navcta{padding:11px 18px;border-radius:999px;background:var(--gold);border:1px solid #111;color:#111;font-weight:900}
.hero{padding:80px 0 26px}.hero-grid{display:grid;grid-template-columns:1.03fr .97fr;gap:54px;align-items:center}.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid rgba(243,184,45,.58);border-radius:999px;background:#fff9eb;color:#8b5d00;font-size:12px;font-weight:900;letter-spacing:.65px;text-transform:uppercase}.eyebrow i{width:7px;height:7px;border-radius:50%;background:var(--gold);display:block}h1,h2,h3{font-family:Poppins,Inter,sans-serif}h1{font-size:clamp(48px,6.6vw,84px);line-height:.98;letter-spacing:-3.9px;margin:20px 0}h1 em{font-style:normal;color:#a56d00}.lead{font-size:19px;color:#4f4b44;max-width:700px;margin:0 0 26px}.actions{display:flex;flex-wrap:wrap;gap:12px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 20px;border-radius:14px;font-size:14px;font-weight:900;transition:.18s ease}.btn:hover{transform:translateY(-2px)}.primary{background:var(--gold);border:1px solid #111;color:#111;box-shadow:4px 4px 0 #111}.secondary{background:var(--paper);border:1px solid #cfc7b8;color:#111}.micro{font-size:12px;color:#7b756b;margin-top:12px}
.hero-card{position:relative;overflow:hidden;border:1px solid #111;border-radius:30px;min-height:430px;padding:28px;background:linear-gradient(145deg,#0a0a09,#1b1508);box-shadow:10px 11px 0 #111}.hero-card:before{content:"";position:absolute;width:240px;height:240px;border-radius:50%;right:-75px;top:-75px;background:rgba(243,184,45,.22)}.hero-card:after{content:"";position:absolute;width:150px;height:150px;border-radius:50%;left:-65px;bottom:-70px;background:rgba(255,216,106,.08)}.hero-inner{position:relative;z-index:2;display:grid;grid-template-rows:auto 1fr auto;min-height:370px}.hero-brand{display:flex;justify-content:flex-end}.hero-brand img{width:335px;max-width:90%;height:255px;object-fit:cover;border-radius:18px;display:block}.insight{align-self:end;border:1px solid rgba(243,184,45,.28);border-radius:18px;background:rgba(7,7,7,.72);padding:18px;backdrop-filter:blur(8px)}.insight-top{display:flex;justify-content:space-between;align-items:center;color:#fff;gap:12px}.insight-top span:first-child{font-family:Poppins;font-size:18px}.insight-top span:last-child{color:var(--gold2);font-size:12px;font-weight:900}.insight-copy{margin:6px 0 15px;color:#bdb7ab;font-size:12px}.metric-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.metric-card{background:#fffdf7;border-radius:12px;padding:12px;color:#111}.metric-card b{display:block;font-size:17px}.metric-card span{font-size:10px;color:#726d65}
.stats{padding:16px 0 72px}.stats-bar{display:grid;grid-template-columns:repeat(4,1fr);background:var(--paper);border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:0 3px 0 rgba(0,0,0,.03)}.stat{padding:18px 20px;border-right:1px solid var(--line);display:flex;gap:12px;align-items:center}.stat:last-child{border-right:none}.stat-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:#fff3d5;border:1px solid #f0d08b;color:#a36b00;font-weight:900}.stat b{display:block;font-size:15px}.stat span{font-size:10px;color:#777168}
.section{padding:78px 0}.alt{background:#eee8dc;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.head{max-width:840px;margin-bottom:30px}.kicker{color:#9a6700;font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase}.head h2{font-size:clamp(34px,4.8vw,58px);line-height:1.02;letter-spacing:-2.3px;margin:9px 0 12px}.head p{color:#67625a;margin:0;font-size:16px}
.products-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.product{border:1px solid #d7d0c3;border-radius:22px;padding:23px;background:var(--paper);min-height:220px;display:flex;flex-direction:column;justify-content:space-between}.product-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;color:#fff;font-weight:900;margin-bottom:16px}.product:nth-child(1) .product-icon{background:var(--green)}.product:nth-child(2) .product-icon{background:var(--blue)}.product:nth-child(3) .product-icon{background:var(--purple)}.product:nth-child(4) .product-icon{background:var(--orange)}.product h3{font-size:19px;margin:0 0 7px}.product p{font-size:12px;color:#716c64;margin:0}.product a{margin-top:20px;font-weight:900;font-size:12px}.product:nth-child(1) a{color:#0f7653}.product:nth-child(2) a{color:#2465d9}.product:nth-child(3) a{color:#6344cf}.product:nth-child(4) a{color:#d96012}
.categories{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.category{position:relative;overflow:hidden;min-height:126px;border:1px solid #d6cec0;border-radius:18px;background:#fff}.category img{width:100%;height:82px;object-fit:cover;display:block}.category strong{display:block;padding:9px 11px;font-size:12px}.category span{position:absolute;left:9px;bottom:42px;background:rgba(255,255,255,.92);padding:4px 7px;border-radius:999px;font-size:9px;font-weight:900}
.ai-section{background:#090909;color:#fff;border-top:1px solid #111;border-bottom:1px solid #111}.ai-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:24px;align-items:center}.ai-copy .kicker{color:var(--gold2)}.ai-copy h2{font-size:clamp(36px,4.7vw,56px);line-height:1.02;letter-spacing:-2px;margin:8px 0 10px;color:#fff}.ai-copy p{color:#c0b9ab;max-width:620px}.ai-panel{border:1px solid rgba(243,184,45,.32);border-radius:24px;padding:20px;background:radial-gradient(circle at 85% 5%,rgba(243,184,45,.12),transparent 36%),#111;box-shadow:8px 9px 0 #000}.ai-panel-top{display:grid;grid-template-columns:1fr 1fr;gap:10px}.score-card,.opp-card{border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px;background:rgba(255,255,255,.04)}.score-label,.opp-card h3{font-size:11px;color:#b8b2a6;font-weight:900;letter-spacing:.8px;text-transform:uppercase}.score-num{font-family:Poppins;font-size:60px;font-weight:900;line-height:1;color:var(--gold2);margin:7px 0 3px}.score-good{color:#9cf2c9;font-size:11px;font-weight:900}.bars{display:flex;gap:6px;align-items:flex-end;height:52px;margin-top:12px}.bar{width:12px;background:linear-gradient(180deg,var(--gold2),var(--gold));border-radius:4px 4px 0 0}.opp-list{display:grid;gap:8px;margin-top:10px}.opp{display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:9px;color:#d8d2c6;font-size:11px}.opp b{color:var(--gold2)}.ai-cta{margin-top:10px}
.cta-section{padding:70px 0}.cta{border:1px solid #111;border-radius:26px;background:linear-gradient(135deg,#fffaf0,#eee1cc);padding:34px;display:flex;align-items:center;justify-content:space-between;gap:22px;box-shadow:8px 9px 0 #111}.cta h2{font-size:clamp(28px,3.7vw,44px);margin:0 0 7px;line-height:1.02;letter-spacing:-1.5px}.cta p{margin:0;color:#6b665d}
footer{background:#080808;color:#fff;padding:42px 0 24px}.footer-grid{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:34px}.footer-brand-plaque{display:inline-flex;background:#111;border:1px solid rgba(243,184,45,.26);border-radius:17px;padding:4px 10px}.footer-brand-plaque img{width:176px;height:80px;object-fit:cover;border-radius:10px}.footer-brand p{color:#9c978f;max-width:300px;font-size:12px;margin:11px 0 0}.footer-col h3{font-size:12px;color:var(--gold2);margin:3px 0 13px}.footer-col a{display:block;color:#aaa39a;font-size:12px;margin:0 0 9px}.footer-col a:hover{color:#fff}.footer-bottom{margin-top:25px;padding-top:18px;border-top:1px solid #2b2925;display:flex;justify-content:space-between;gap:18px;color:#777168;font-size:11px}
@media(max-width:980px){.navlinks a:not(.navcta){display:none}.hero-grid,.ai-grid{grid-template-columns:1fr}.hero-card{order:-1}.products-grid{grid-template-columns:1fr 1fr}.categories{grid-template-columns:repeat(3,1fr)}.stats-bar{grid-template-columns:1fr 1fr}.stat:nth-child(2){border-right:none}.stat:nth-child(-n+2){border-bottom:1px solid var(--line)}}
@media(max-width:600px){.wrap{width:min(calc(100% - 24px),var(--max))}.navin{min-height:72px}.brand-plaque img{width:130px;height:54px}.hero{padding:46px 0 20px}h1{font-size:clamp(43px,12vw,62px);letter-spacing:-2.6px}.lead{font-size:16px}.actions .btn{width:100%}.hero-card{min-height:390px}.hero-brand img{width:100%;height:225px}.metric-row,.ai-panel-top{grid-template-columns:1fr}.stats-bar{grid-template-columns:1fr}.stat{border-right:none!important;border-bottom:1px solid var(--line)!important}.stat:last-child{border-bottom:none!important}.products-grid,.categories{grid-template-columns:1fr}.section{padding:60px 0}.cta{padding:27px;align-items:flex-start;flex-direction:column}.footer-grid{grid-template-columns:1fr 1fr}.footer-brand{grid-column:1/-1}.footer-bottom{flex-direction:column;align-items:flex-start}}
@media(prefers-reduced-motion:reduce){.btn:hover{transform:none}}
`;

export default function PublicLandingPageClay() {
  useEffect(() => {
    document.title = "STall — AI-Adaptive Local Business Discovery & Growth";
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = "https://stallwale.in/";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = "STall helps people discover local businesses and gives business owners AI-adaptive tools to build, manage and grow their digital presence.";
  }, []);

  const categories = [
    ["Restaurants","Food & dining","https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&fm=jpg&q=80&w=900"],
    ["Unisex Salons","Beauty & styling","https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&fm=jpg&q=80&w=900"],
    ["Men Salons","Grooming","https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&fm=jpg&q=80&w=900"],
    ["Retail Stores","Shopping nearby","https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&fm=jpg&q=80&w=900"],
    ["Healthcare","Clinics & health","https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&fm=jpg&q=80&w=900"],
    ["Hospitals","Hospitals","https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&fm=jpg&q=80&w=900"],
    ["Schools","Education","https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&fm=jpg&q=80&w=900"],
    ["Preschools","Early learning","https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&fm=jpg&q=80&w=900"],
    ["Gyms & Fitness","Wellness","https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&fm=jpg&q=80&w=900"],
    ["Local Services","Everyday services","https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&fm=jpg&q=80&w=900"]
  ];

  return (
    <div className="stall-clay-page">
      <style dangerouslySetInnerHTML={{__html: css}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
        "@context":"https://schema.org",
        "@type":"Organization",
        "name":"STall",
        "url":"https://stallwale.in/",
        "description":"India-wide local-business discovery and AI-adaptive digital growth platform.",
        "areaServed":{"@type":"Country","name":"India"},
        "knowsAbout":["local business discovery","business listings and claiming","digital presence management","business intelligence","competitive intelligence","digital score","digital store automation","restaurants","unisex salons","men's salons","retail stores","healthcare","hospitals","schools","preschools","local services"]
      })}} />

      <header className="nav"><div className="wrap navin">
        <a className="brand" href="https://stallwale.in/" aria-label="STall home"><span className="brand-plaque"><img src={logo} alt="STall — That's All — Discover Connect Grow" /></span></a>
        <nav className="navlinks" aria-label="Main navigation">
          <a href="/products.html">Products</a><a href="#businesses">For Businesses</a><a href="#plans">Pricing</a><a href="#resources">Resources</a><a href="/careers.html">Careers</a><a className="navcta" href={appUrl}>Get Started Free</a>
        </nav>
      </div></header>

      <main>
        <section className="hero"><div className="wrap hero-grid">
          <div>
            <div className="eyebrow"><i/> AI-powered for local businesses</div>
            <h1>Make your <em>local business</em> easier to discover.</h1>
            <p className="lead">Discover. Analyze. Automate. Grow. STall brings local business discovery and AI-adaptive digital growth tools into one place.</p>
            <div className="actions"><a className="btn primary" href={appUrl}>Get Started Free →</a><a className="btn secondary" href="#products">Explore STall</a></div>
            <div className="micro">Free listing available • AI-adaptive business tools • Category-aware intelligence</div>
          </div>
          <div className="hero-card">
            <div className="hero-inner">
              <div className="hero-brand"><img src={logo} alt="STall exact brand logo" /></div>
              <div></div>
              <div className="insight"><div className="insight-top"><span>AI Insights for Your Business</span><span>LIVE SIGNAL</span></div><div className="insight-copy">Compare nearby businesses, understand your digital presence and see actionable next steps.</div><div className="metric-row"><div className="metric-card"><b>82/100</b><span>Digital Score</span></div><div className="metric-card"><b>3.5×</b><span>More views</span></div><div className="metric-card"><b>2.8×</b><span>New customer lift</span></div></div></div>
            </div>
          </div>
        </div></section>

        <section className="stats"><div className="wrap"><div className="stats-bar">
          <div className="stat"><div className="stat-icon">⌂</div><div><b>10,000+</b><span>Local Businesses</span></div></div>
          <div className="stat"><div className="stat-icon">◎</div><div><b>80+</b><span>Cities in India</span></div></div>
          <div className="stat"><div className="stat-icon">▦</div><div><b>Multiple</b><span>Business Categories</span></div></div>
          <div className="stat"><div className="stat-icon">↗</div><div><b>AI-Powered</b><span>Growth Tools</span></div></div>
        </div></div></section>

        <section id="products" className="section"><div className="wrap">
          <div className="head"><div className="kicker">Our products</div><h2>Powerful tools built for the real needs of local businesses.</h2><p>One brand, four clear products. Each product has one job and a direct path into the right STall experience.</p></div>
          <div className="products-grid">
            <article className="product"><div><div className="product-icon">⌕</div><h3>Business Discovery</h3><p>Find and connect with local businesses around you.</p></div><a href={appUrl}>Open STall App →</a></article>
            <article className="product"><div><div className="product-icon">▥</div><h3>Digital Score</h3><p>Know your digital presence score and opportunities.</p></div><a href={aiStudioUrl}>Check Score →</a></article>
            <article className="product"><div><div className="product-icon">◉</div><h3>Business Intelligence</h3><p>AI insights and category-aware competitive context.</p></div><a href={aiStudioUrl}>Explore →</a></article>
            <article className="product"><div><div className="product-icon">⚙</div><h3>Digital Store Automation</h3><p>Automate posts, offers and customer engagement.</p></div><a href={aiStudioUrl}>Get Started →</a></article>
          </div>
        </div></section>

        <section id="businesses" className="section alt"><div className="wrap">
          <div className="head"><div className="kicker">Business categories we serve</div><h2>AI-adaptive solutions for local businesses across India.</h2><p>Category and location context remain explicit so people and AI-powered discovery systems can understand who STall serves.</p></div>
          <div className="categories">{categories.map(([name,sub,img]) => <a className="category" key={name} href={appUrl}><img src={img} alt={name} loading="lazy"/><span>{sub}</span><strong>{name}</strong></a>)}</div>
        </div></section>

        <section id="resources" className="section ai-section"><div className="wrap ai-grid">
          <div className="ai-copy"><div className="kicker">AI-adaptive business intelligence</div><h2>Turn your business data into real growth.</h2><p>Get personalized insights, competitor analysis and growth recommendations using AI. STall keeps comparisons category-aware: restaurants with restaurants, unisex salons with unisex salons, hospitals with hospitals, and other businesses with their closest matches.</p><a className="btn primary ai-cta" href={aiStudioUrl}>Check My Digital Score →</a></div>
          <div className="ai-panel"><div className="ai-panel-top">
            <div className="score-card"><div className="score-label">Your Business Score</div><div className="score-num">82</div><div className="score-good">Good • improving opportunity</div><div className="bars"><div className="bar" style={{height:"18px"}}/><div className="bar" style={{height:"25px"}}/><div className="bar" style={{height:"31px"}}/><div className="bar" style={{height:"39px"}}/><div className="bar" style={{height:"47px"}}/></div></div>
            <div className="opp-card"><h3>Top opportunities</h3><div className="opp-list"><div className="opp"><span>Improve Google Reviews</span><b>+40%</b></div><div className="opp"><span>Add Photos & Offers</span><b>+35%</b></div><div className="opp"><span>Post regular updates</span><b>+28%</b></div></div></div>
          </div></div>
        </div></section>

        <section id="plans" className="cta-section"><div className="wrap"><div className="cta"><div><div className="kicker">Start with STall</div><h2>Join local businesses growing with AI.</h2><p>List your business free, claim your presence or open STall AI Studio for the digital tools.</p></div><a className="btn primary" href={appUrl}>Get Started Free →</a></div></div></section>
      </main>

      <footer><div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand"><span className="footer-brand-plaque"><img src={logo} alt="STall — That's All" /></span><p>STall connects customers with local businesses and gives owners AI-adaptive tools to build and manage their digital presence.</p></div>
          <div className="footer-col"><h3>Products</h3><a href="/products/business-discovery.html">Business Discovery</a><a href="/products/digital-score.html">Digital Score</a><a href="/products/business-intelligence.html">Business Intelligence</a><a href="/products/digital-store-automation.html">Digital Store Automation</a></div>
          <div className="footer-col"><h3>For Businesses</h3><a href={appUrl}>STall App</a><a href={aiStudioUrl}>AI Studio</a><a href="#plans">Pricing</a><a href="/india.html">STall India</a></div>
          <div className="footer-col"><h3>Company</h3><a href="/careers.html">Careers</a><a href="https://stall.stallwale.in/help.html">Help</a><a href="https://stall.stallwale.in/contact.html">Contact</a><a href="/india.html">About STall</a></div>
        </div>
        <div className="footer-bottom"><div>© 2026 STallwale · Local business discovery and digital growth platform</div><div>THAT’S ALL · DISCOVER · CONNECT · GROW</div></div>
      </div></footer>
    </div>
  );
}
