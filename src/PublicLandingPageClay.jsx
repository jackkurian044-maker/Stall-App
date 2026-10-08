import React, { useEffect } from "react";
import stallLogo from "./stall-logo.png";

const logo = stallLogo;
const appUrl = "https://stallapp.stallwale.in/";

const css = `
:root{
  --bg:#f7f3ea;--surface:#fffdf8;--ink:#11110f;--muted:#6c685f;--gold:#f0b429;--gold2:#ffd86a;
  --black:#0a0a09;--line:#e3ddd0;--soft:#eee8dc;--max:1240px
}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,sans-serif;line-height:1.55}a{color:inherit;text-decoration:none}
.wrap{width:min(calc(100% - 40px),var(--max));margin:auto}
.nav{position:sticky;top:0;z-index:20;background:rgba(247,243,234,.92);backdrop-filter:blur(18px);border-bottom:1px solid rgba(17,17,15,.08)}
.navin{min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand img{width:172px;height:78px;object-fit:contain}
.navlinks{display:flex;gap:24px;align-items:center;color:#4e4b45;font-size:13px;font-weight:600}.navlinks a:hover{color:#111}
.navcta{border:1px solid #111;border-radius:999px;padding:11px 17px;background:var(--gold);color:#111;font-weight:900}
.hero{padding:92px 0 68px}.hero-grid{display:grid;grid-template-columns:1.02fr .98fr;gap:60px;align-items:center}
.eyebrow,.kicker{color:#8b5f00;font-size:12px;font-weight:900;letter-spacing:1.35px;text-transform:uppercase}
.eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(240,180,41,.52);border-radius:999px;padding:8px 12px;background:#fff9e8}.dot{width:7px;height:7px;background:var(--gold);border-radius:50%}
h1,h2,h3{font-family:Poppins,Inter,sans-serif;color:var(--ink)}h1{font-size:clamp(48px,6.4vw,84px);line-height:.98;letter-spacing:-3.6px;margin:18px 0 22px}h1 span{color:#9a6700}
.lead{font-size:19px;color:#514d46;max-width:690px;margin:0 0 28px}.actions{display:flex;gap:12px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 21px;border-radius:14px;font-size:14px;font-weight:900}
.primary{background:var(--gold);color:#111;border:1px solid #111;box-shadow:4px 4px 0 #111}.primary:hover{transform:translate(-1px,-1px);box-shadow:6px 6px 0 #111}
.secondary{border:1px solid #cfc7b8;background:var(--surface);color:#111}.micro{color:#777168;font-size:12px;margin-top:13px}
.hero-card{position:relative;overflow:hidden;border:1px solid #111;background:linear-gradient(145deg,#0b0b0a,#17130a);border-radius:34px;padding:26px;box-shadow:10px 12px 0 #111;min-height:460px}
.hero-card:before{content:"";position:absolute;width:260px;height:260px;border-radius:50%;background:rgba(240,180,41,.22);right:-85px;top:-85px}
.hero-card:after{content:"";position:absolute;width:150px;height:150px;border-radius:50%;background:rgba(255,216,106,.10);left:-60px;bottom:-65px}
.brand-stage{position:relative;z-index:2;min-height:400px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.brand-stage img{width:min(430px,90%);height:auto;max-height:250px;object-fit:contain}
.brand-stage-note{margin-top:14px;color:#fff;font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase}.signal-row{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;width:100%;margin-top:30px}
.signal{background:#fffdf7;border:1px solid #111;border-radius:15px;padding:14px 12px;text-align:left;color:#111}.signal b{display:block;font-size:13px}.signal span{display:block;font-size:10px;color:#6b675f;margin-top:3px}.signal:nth-child(2){background:#f6e6ba}.signal:nth-child(3){background:#f0d89a}
.section{padding:92px 0}.alt{background:#eee8dc;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.head{max-width:820px;margin-bottom:34px}
.head h2{font-size:clamp(34px,4.7vw,56px);line-height:1.04;letter-spacing:-2.1px;margin:9px 0 13px}.head p{color:#6a665e;margin:0;font-size:16px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card,.step,.category,.plan,.metric,.flow{background:var(--surface);border:1px solid #d9d2c5;box-shadow:0 2px 0 rgba(17,17,15,.03)}
.card{border-radius:22px;padding:28px}.card h3{font-size:21px;margin:0 0 8px}.card p{color:#6d6962;margin:0}.icon{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#111;color:var(--gold2);border:1px solid #111;font-weight:900;margin-bottom:17px}
.audience{display:grid;grid-template-columns:1fr 1fr;gap:18px}.audience .card{padding:32px}.audience h3{font-size:26px}.list{padding:0;margin:20px 0 0;list-style:none}.list li{padding:9px 0;border-top:1px solid var(--line);color:#4f4b45}.list li:before{content:"✓";color:#a66f00;font-weight:900;margin-right:10px}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.step{border-radius:18px;padding:24px}.num{font-size:12px;color:#a66f00;font-weight:900}.step h3{font-size:18px;margin:12px 0 5px}.step p{color:#777168;font-size:13px;margin:0}
.category-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.category{padding:22px;border-radius:17px}.category strong{display:block;font-family:Poppins;font-size:17px}.category span{display:block;color:#777168;font-size:13px;margin-top:4px}
.intel{display:grid;grid-template-columns:1fr 1fr;gap:18px}.score{border:1px solid #111;border-radius:24px;padding:32px;background:linear-gradient(145deg,#11110f,#241b08);color:#fff;box-shadow:8px 9px 0 #111}
.score .kicker,.score p{color:#eee4ce}.score-number{font-family:Poppins;font-size:70px;line-height:1;color:var(--gold2);font-weight:800;margin:10px 0}.score p{margin:0}.compare{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.metric{border-color:rgba(255,255,255,.20);border-radius:13px;padding:15px;color:#e9e2d3;background:rgba(255,255,255,.06)}.metric b{display:block;color:#fff;font-size:18px;margin-top:4px}
.automation{display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:center}.automation-box{border:1px solid #111;border-radius:24px;padding:30px;background:var(--surface);box-shadow:8px 9px 0 #111}.automation-box h3{font-size:28px;margin:0 0 9px}.automation-box p{color:#6c675f}.automation-flow{display:grid;grid-template-columns:1fr 1fr;gap:10px}.flow{border-radius:15px;padding:18px}.flow b{display:block}.flow span{color:#777168;font-size:12px}
.plans{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.plan{border-radius:18px;padding:23px}.plan.featured{border-color:#111;background:#f4df9f;box-shadow:6px 7px 0 #111}.plan b,.plan a{color:#8d6100;font-size:11px;text-transform:uppercase;letter-spacing:1px}.plan h3{margin:8px 0;font-size:21px}.plan p{color:#777168;font-size:13px;min-height:58px}
.faq{display:grid;grid-template-columns:1fr 1fr;gap:12px}.faq .card h3{font-size:17px}.faq .card p{font-size:13px}
.cta{border:1px solid #111;border-radius:26px;padding:40px;background:linear-gradient(135deg,#11110f,#211805);box-shadow:9px 10px 0 #111;display:flex;align-items:center;justify-content:space-between;gap:25px}.cta h2{font-size:clamp(28px,3.5vw,42px);margin:0 0 7px;color:#fff}.cta p{color:#ddd4c4;margin:0;max-width:680px}.cta .kicker{color:var(--gold2)}
footer{border-top:1px solid #d9d2c5;padding:38px 0;color:#777168;font-size:12px;background:#f1ece2}.foot{display:grid;grid-template-columns:1.55fr 1fr 1fr 1fr;gap:42px;align-items:start}.foot img{width:172px;height:78px;object-fit:contain}.foot p{max-width:360px;color:#777168;margin:12px 0 0}.powered{margin-top:18px;color:#8a857d;font-size:12px}.powered strong{color:#9a6700}.footcol h3{font-size:13px;color:#111;margin:4px 0 14px;font-family:Inter,system-ui,sans-serif}.footlinks{display:flex;flex-direction:column;gap:10px}.footlinks a{color:#777168}.footlinks a:hover{color:#111}.footbottom{grid-column:1/-1;border-top:1px solid #ded7c9;padding-top:20px;margin-top:6px;color:#8a857d;font-size:11px}
@media(max-width:950px){.navlinks a:not(.navcta){display:none}.hero-grid,.audience,.intel,.automation{grid-template-columns:1fr}.hero-card{order:-1}.grid3,.category-grid{grid-template-columns:1fr 1fr}.steps,.plans{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.wrap{width:min(calc(100% - 24px),var(--max))}.navin{min-height:72px}.brand img{width:148px;height:64px}.hero{padding:52px 0 58px}h1{font-size:clamp(43px,12vw,62px);letter-spacing:-2.3px}.lead{font-size:16px}.actions .btn{width:100%}.section{padding:66px 0}.grid3,.category-grid,.steps,.plans,.faq{grid-template-columns:1fr}.card{padding:23px}.foot{grid-template-columns:1fr 1fr}.footbottom{grid-column:1/-1}.signal-row{grid-template-columns:1fr}.hero-card{min-height:430px}.brand-stage{min-height:365px}}
@media(prefers-reduced-motion:reduce){.primary:hover,.card:hover,.category:hover,.plan:hover{transform:none}}
`;

export default function PublicLandingPageClay() {
  useEffect(() => {
    document.title = "STall — Local Business Discovery & Digital Presence";
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = "https://stallwale.in/";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = "STall helps people discover local businesses and helps business owners build, manage and improve their digital presence.";
  }, []);

  return (
    <div className="stall-clay-page">
      <style dangerouslySetInnerHTML={{__html: css}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
        "@context":"https://schema.org",
        "@type":"Organization",
        "name":"STall",
        "url":"https://stallwale.in/",
        "description":"India-wide local-business discovery and digital presence platform for restaurants, salons, retail stores, healthcare, schools, preschools and local services.",
        "areaServed":{"@type":"Country","name":"India"},
        "knowsAbout":["local business discovery","business listings and claiming","digital presence management","local business visibility","business intelligence","competitive intelligence","digital score","digital store automation","restaurants","unisex salons","men's salons","retail stores","healthcare","hospitals","schools","preschools","local services"]
      })}} />
      <header className="nav"><div className="wrap navin">
        <a className="brand" href="https://stallwale.in/" aria-label="STall home"><img src={logo} alt="STall logo" /></a>
        <nav className="navlinks" aria-label="Main navigation">
          <a href="/products.html">Products</a><a href="#platform">Platform</a><a href="#intelligence">Intelligence</a><a href="#plans">Plans</a><a href="/careers.html">Careers</a><a href="#faq">FAQs</a><a className="navcta" href={appUrl}>List Free</a>
        </nav>
      </div></header>

      <main>
        <section className="hero"><div className="wrap hero-grid">
          <div>
            <div className="eyebrow"><span className="dot"/> AI-adaptive local discovery + digital growth</div>
            <h1>Make your local business <span>easier to discover.</span></h1>
            <p className="lead">STall connects customers with local businesses and gives business owners AI-adaptive tools to understand, manage and improve their digital presence.</p>
            <div className="actions"><a className="btn primary" href={appUrl}>List Your Business Free</a><a className="btn secondary" href="#platform">See How STall Works</a></div>
            <div className="micro">AI-aware discovery • Category-aware intelligence • Digital growth automation</div>
          </div>
          <div className="hero-card">
  <div className="brand-stage">
    <img src={logo} alt="STall — That's All — Discover, Connect, Grow" />
    <div className="brand-stage-note">AI-adaptive local business platform</div>
    <div className="signal-row">
      <div className="signal"><b>Discover</b><span>Category + location signals</span></div>
      <div className="signal"><b>Understand</b><span>Business + market context</span></div>
      <div className="signal"><b>Grow</b><span>Actionable next steps</span></div>
    </div>
  </div>
</div>
        </div></section>

        <section id="platform" className="section alt"><div className="wrap">
          <div className="head"><div className="kicker">What STall does</div><h2>One system that understands the business, the market and the next action.</h2><p>Every part of STall has a distinct job: help people find businesses, help them connect, and give owners better tools to grow their presence.</p></div>
          <div className="grid3">
            <article className="card"><div className="icon">01</div><h3>Discover</h3><p>Find restaurants, salons, shops, services and other local businesses around you.</p></article>
            <article className="card"><div className="icon">02</div><h3>Connect</h3><p>See business information, services, offers, contact details, directions and public business pages.</p></article>
            <article className="card"><div className="icon">03</div><h3>Grow</h3><p>Owners can list or claim their business and use STall tools to keep their digital presence useful and active.</p></article>
          </div>
        </div></section>

        <section className="section"><div className="wrap">
          <div className="head"><div className="kicker">Built for two sides of local commerce</div><h2>Customers discover. Businesses grow.</h2></div>
          <div className="audience">
            <article className="card"><div className="icon">C</div><h3>For customers</h3><p>Find the right local business without having to search across disconnected places.</p><ul className="list"><li>Discover nearby businesses</li><li>Explore services and offers</li><li>View useful business information</li><li>Connect, call, visit or order when available</li></ul></article>
            <article className="card"><div className="icon">B</div><h3>For business owners</h3><p>Turn a basic listing into a stronger, managed digital presence.</p><ul className="list"><li>List or claim your business</li><li>Keep business information useful</li><li>Publish offers and updates</li><li>Use automation and growth tools</li></ul></article>
          </div>
        </div></section>

        <section className="section alt"><div className="wrap">
          <div className="head"><div className="kicker">How it works</div><h2>A clear path from listing to growth.</h2></div>
          <div className="steps">
            <article className="step"><div className="num">01 / LIST</div><h3>Put your business on STall</h3><p>Create a listing or find your existing business.</p></article>
            <article className="step"><div className="num">02 / CLAIM</div><h3>Take control</h3><p>Claim an existing listing and manage the information customers see.</p></article>
            <article className="step"><div className="num">03 / ACTIVATE</div><h3>Stay useful</h3><p>Add services, offers and relevant business updates.</p></article>
            <article className="step"><div className="num">04 / GROW</div><h3>Improve your presence</h3><p>Use STall's digital tools and intelligence as your business grows.</p></article>
          </div>
        </div></section>

        <section className="section"><div className="wrap">
          <div className="head"><div className="kicker">India-wide local business network</div><h2>Built for the categories businesses actually operate in.</h2><p>STall serves local businesses across India, including restaurants, unisex salons, men’s salons, retail stores, healthcare businesses, hospitals, schools, preschools and local services. Category and location context are kept explicit so customers and AI-powered discovery systems can understand which businesses STall serves.</p></div>
          <div className="category-grid">
            <div className="category"><strong>Restaurants</strong><span>Food, dining, offers and local discovery</span></div>
            <div className="category"><strong>Unisex Salons</strong><span>Beauty services and local offers</span></div>
            <div className="category"><strong>Men's Salons</strong><span>Category-specific salon discovery</span></div>
            <div className="category"><strong>Retail Stores</strong><span>Products, stores and neighbourhood shopping</span></div>
            <div className="category"><strong>Healthcare</strong><span>Hospitals, clinics and health services</span></div>
            <div className="category"><strong>Schools & Preschools</strong><span>Education businesses with distinct categories</span></div>
          </div>
        </div></section>

        <section id="intelligence" className="section alt"><div className="wrap">
          <div className="head"><div className="kicker">AI-adaptive business intelligence</div><h2>Know what your business needs next.</h2><p>STall can turn business information into a clearer picture of digital presence and local competitiveness.</p></div>
          <div className="intel">
            <div className="score"><div className="kicker">STall Digital Score</div><div className="score-number">72</div><p>Illustrative example — a business score can evaluate the quality and completeness of its digital presence.</p><div className="compare"><div className="metric">Business presence<b>Strong</b></div><div className="metric">Local visibility<b>Improve</b></div><div className="metric">Offers<b>Active</b></div><div className="metric">Content<b>Improve</b></div></div></div>
            <div className="card"><div className="icon">↗</div><h3>Compare with similar businesses</h3><p>STall's competitive intelligence direction is category-aware: a unisex salon should be compared with similar unisex salons, restaurants with restaurants, hospitals with hospitals, and so on.</p><ul className="list"><li>Same-category comparison</li><li>Nearby business context</li><li>Digital presence opportunities</li><li>Actionable improvement areas</li></ul></div>
          </div>
        </div></section>

        <section id="automation" className="section"><div className="wrap automation">
          <div><div className="kicker">STall Digital Store Automation</div><h2>Run your digital presence without doing everything manually.</h2><p className="lead" style={{fontSize:16}}>Create and manage business content, offers and digital updates with a workflow designed for local business owners.</p><div className="actions"><a className="btn primary" href="/products/digital-store-automation.html">Digital Store Automation</a></div></div>
          <div className="automation-box"><h3>From business information to published content.</h3><p>Keep the owner in control while reducing repetitive digital work.</p><div className="automation-flow"><div className="flow"><b>Understand</b><span>Business information</span></div><div className="flow"><b>Create</b><span>Posts and offers</span></div><div className="flow"><b>Review</b><span>Owner approval</span></div><div className="flow"><b>Publish</b><span>Supported channels</span></div></div></div>
        </div></section>

        <section id="plans" className="section alt"><div className="wrap">
          <div className="head"><div className="kicker">Plans</div><h2>Start simple. Add capability when you need it.</h2><p>STall is designed so a business can begin with a listing and move into additional visibility and digital growth capabilities.</p></div>
          <div className="plans">
            <article className="plan"><b>Start</b><h3>Free Listing</h3><p>Get your business onto the local discovery network.</p><a href={appUrl}>Get started →</a></article>
            <article className="plan featured"><b>Trust</b><h3>STall Verified</h3><p>Build a stronger verified local presence.</p><a href={appUrl}>Explore →</a></article>
            <article className="plan"><b>Growth</b><h3>Digital Growth</h3><p>Expand visibility and use more digital presence capabilities.</p><a href={appUrl}>Explore →</a></article>
            <article className="plan"><b>Scale</b><h3>Growth Setup</h3><p>For businesses that want broader visibility and deeper support.</p><a href={appUrl}>Explore →</a></article>
          </div>
        </div></section>

        <section id="faq" className="section"><div className="wrap">
          <div className="head"><div className="kicker">Frequently asked questions</div><h2>Clear answers about STall.</h2></div>
          <div className="faq">
            <article className="card"><h3>What is STall?</h3><p>STall is a local-business discovery and digital presence platform connecting customers with businesses and giving owners practical growth tools.</p></article>
            <article className="card"><h3>Who can use STall?</h3><p>Customers can discover local businesses. Owners of restaurants, salons, shops, services, healthcare, education and other local businesses can build a presence.</p></article>
            <article className="card"><h3>Can I list or claim my business?</h3><p>Yes. Business owners can create a listing or claim an existing STall business page.</p></article>
            <article className="card"><h3>What is Digital Store Automation?</h3><p>It is STall's business tool for creating and managing content, offers and digital presence with less repetitive manual work.</p></article>
          </div>
        </div></section>

        <section className="section"><div className="wrap"><div className="cta"><div><div className="kicker">Start with STall</div><h2>Make your local business easier to discover.</h2><p>List your business, claim your presence or explore STall's digital growth tools.</p></div><a className="btn primary" href={appUrl}>Get Started</a></div></div></section>
      </main>

      <footer><div className="wrap foot"><div><img src={logo} alt="STall logo"/><p>STall connects people with local businesses and gives business owners tools to build and manage their digital presence.</p><div className="powered">Powered by <strong>STallwale</strong></div></div><div className="footcol"><h3>Products</h3><div className="footlinks"><a href="/products.html">All Products</a><a href="/products/business-discovery.html">Business Discovery</a><a href="/products/digital-score.html">Digital Score</a><a href="/products/business-intelligence.html">Business Intelligence</a><a href="/products/digital-store-automation.html">Digital Store Automation</a></div></div><div className="footcol"><h3>Company</h3><div className="footlinks"><a href="/india.html">STall India</a><a href="/careers.html">Careers</a><a href="https://stall.stallwale.in/help.html">Help</a><a href="https://stall.stallwale.in/contact.html">Contact</a></div></div><div className="footcol"><h3>Get Started</h3><div className="footlinks"><a href={appUrl}>Open STall App</a><a href="https://stallwale.ai.studio/">Open STall AI Studio</a><a href="https://stall.stallwale.in/help.html">Help</a><a href="https://stall.stallwale.in/contact.html">Contact</a></div></div><div className="footbottom">© 2026 STallwale · Local business discovery and digital growth platform</div></div></footer>
    </div>
  );
}
