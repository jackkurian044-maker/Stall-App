import React, { useEffect } from "react";

const logo = "https://stall.stallwale.in/assets/stall-logo-exact.jpg";
const appUrl = "https://stallapp.stallwale.in/";

const css = `
:root{
  --bg:#f7f3ea;--paper:#fffdf8;--ink:#0d0d0c;--muted:#69645d;--line:#e1dacd;
  --black:#080808;--gold:#f2b72c;--gold2:#ffd86a;--soft:#eee7da;--green:#16815b;
  --blue:#347cff;--purple:#7354e7;--orange:#f17821;--max:1220px
}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,sans-serif;line-height:1.55}a{color:inherit;text-decoration:none}.wrap{width:min(calc(100% - 40px),var(--max));margin:auto}
.nav{position:sticky;top:0;z-index:40;background:rgba(247,243,234,.94);backdrop-filter:blur(18px);border-bottom:1px solid rgba(13,13,12,.08)}.navin{min-height:86px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand img{width:172px;height:72px;object-fit:cover;border-radius:14px}
.navlinks{display:flex;align-items:center;gap:21px;color:#4f4b44;font-size:13px;font-weight:650}.navlinks a:hover{color:#111}.navcta{padding:11px 18px;border-radius:999px;background:var(--gold);border:1px solid #111;color:#111;font-weight:900}
.hero{padding:84px 0 62px}.hero-grid{display:grid;grid-template-columns:1.04fr .96fr;gap:54px;align-items:center}.eyebrow,.kicker{color:#936000;font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase}.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid rgba(242,183,44,.55);border-radius:999px;background:#fff9e9}.dot{width:7px;height:7px;background:var(--gold);border-radius:50%}
h1,h2,h3{font-family:Poppins,Inter,sans-serif}h1{font-size:clamp(48px,6.5vw,84px);line-height:.98;letter-spacing:-3.8px;margin:20px 0}h1 span{color:#a56d00}.lead{font-size:19px;color:#4f4b44;max-width:700px;margin:0 0 27px}.actions{display:flex;gap:12px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 20px;border-radius:14px;font-size:14px;font-weight:900;transition:.18s ease}.btn:hover{transform:translateY(-2px)}.primary{background:var(--gold);color:#111;border:1px solid #111;box-shadow:4px 4px 0 #111}.secondary{background:var(--paper);border:1px solid #cfc6b7;color:#111}.micro{color:#7a746a;font-size:12px;margin-top:12px}
.hero-card{position:relative;overflow:hidden;border:1px solid #111;background:linear-gradient(145deg,#0a0a09,#191206);border-radius:30px;padding:26px;box-shadow:10px 11px 0 #111;min-height:430px}.hero-card:before{content:"";position:absolute;width:270px;height:270px;border-radius:50%;right:-95px;top:-105px;background:rgba(242,183,44,.2)}.hero-card:after{content:"";position:absolute;width:170px;height:170px;border-radius:50%;left:-75px;bottom:-80px;background:rgba(255,216,106,.08)}.hero-card img{position:relative;z-index:2;display:block;width:100%;max-width:400px;height:260px;object-fit:cover;border-radius:18px;margin:auto}.hero-card .caption{position:relative;z-index:2;margin-top:20px;border:1px solid rgba(242,183,44,.25);border-radius:18px;padding:17px;background:rgba(8,8,8,.72);color:#aaa39a;font-size:12px}.hero-card .caption strong{display:block;color:#fff;font-size:17px;margin-bottom:4px}
.ai-badges{display:flex;gap:8px;flex-wrap:wrap;margin:-6px 0 20px}.ai-badges span{padding:7px 10px;border:1px solid #ded5c4;background:#fffaf0;border-radius:999px;font-size:10px;font-weight:900;color:#765006}
.section{padding:82px 0}.alt{background:var(--soft);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.head{max-width:820px;margin-bottom:32px}.head h2{font-size:clamp(34px,4.7vw,56px);line-height:1.03;letter-spacing:-2.2px;margin:9px 0 12px}.head p{color:#6a655d;margin:0;font-size:16px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card,.step,.category,.plan,.metric,.flow{background:var(--paper);border:1px solid #d9d1c3;box-shadow:0 3px 0 rgba(0,0,0,.03)}.card{border-radius:22px;padding:27px}.card h3{font-size:21px;margin:0 0 8px}.card p{color:#6e6961;margin:0}.icon{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#111;color:var(--gold2);border:1px solid #111;font-weight:900;margin-bottom:17px}
.audience{display:grid;grid-template-columns:1fr 1fr;gap:18px}.audience .card{padding:31px}.audience h3{font-size:25px}.list{padding:0;margin:19px 0 0;list-style:none}.list li{padding:9px 0;border-top:1px solid var(--line);color:#514c45}.list li:before{content:"✓";color:#a66f00;font-weight:900;margin-right:10px}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.step{border-radius:18px;padding:23px}.num{font-size:11px;color:#a36d00;font-weight:900;letter-spacing:.7px}.step h3{font-size:18px;margin:11px 0 5px}.step p{color:#777168;font-size:13px;margin:0}
.category-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.category{padding:22px;border-radius:17px}.category strong{display:block;font-family:Poppins;font-size:17px}.category span{display:block;color:#777168;font-size:13px;margin-top:4px}
.intel{display:grid;grid-template-columns:1fr 1fr;gap:18px}.score{border:1px solid #111;border-radius:24px;padding:32px;background:linear-gradient(145deg,#11110f,#241b08);color:#fff;box-shadow:8px 9px 0 #111}.score .kicker,.score p{color:#eee4ce}.score-number{font-family:Poppins;font-size:70px;line-height:1;color:var(--gold2);font-weight:800;margin:10px 0}.score p{margin:0}.compare{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.metric{border-color:rgba(255,255,255,.2);border-radius:13px;padding:15px;color:#e9e2d3;background:rgba(255,255,255,.06)}.metric b{display:block;color:#fff;font-size:18px;margin-top:4px}
.ai-adoption{padding:0 0 82px}.ai-adoption-wrap{position:relative;overflow:hidden;border:1px solid #111;border-radius:28px;background:linear-gradient(135deg,#0a0a09,#191308);padding:28px;box-shadow:10px 11px 0 #111;color:#fff}.ai-adoption-wrap:before{content:"";position:absolute;width:420px;height:420px;right:-170px;top:-220px;border-radius:50%;background:radial-gradient(circle,rgba(242,183,44,.22),transparent 70%)}.ai-adoption-head{position:relative;z-index:1;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:21px}.ai-adoption-head .kicker{color:var(--gold2)}.ai-adoption-head h2{font-size:clamp(30px,4vw,45px);line-height:1.02;letter-spacing:-1.6px;margin:7px 0 0;color:#fff}.ai-adoption-badge{white-space:nowrap;border:1px solid rgba(242,183,44,.44);background:rgba(242,183,44,.08);border-radius:999px;color:var(--gold2);padding:9px 12px;font-size:10px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.ai-adoption-grid{position:relative;z-index:1;display:grid;grid-template-columns:1.1fr .9fr;gap:12px}.ai-adoption-card{border:1px solid rgba(255,255,255,.13);border-radius:18px;background:rgba(255,255,255,.035);padding:20px}.ai-adoption-card h3{font-size:18px;color:#fff;margin:0 0 6px}.ai-adoption-card p{font-size:12px;color:#aaa39a;margin:0 0 16px}.ai-signals{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ai-signal{border:1px solid rgba(255,255,255,.1);border-radius:13px;background:#0e0e0d;padding:13px}.ai-signal strong{display:block;font-size:12px;color:#fff}.ai-signal span{display:block;margin-top:4px;color:#827b70;font-size:10px}.ai-path{display:grid;gap:8px}.ai-path-item{display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.1);background:#0e0e0d;border-radius:12px;padding:11px;color:#d3cdc2;font-size:11px}.ai-path-item b{color:var(--gold2);min-width:18px}.ai-note{margin-top:12px;color:#777168;font-size:10px}
.automation{display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:center}.automation-box{border:1px solid #111;border-radius:24px;padding:30px;background:var(--paper);box-shadow:8px 9px 0 #111}.automation-box h3{font-size:28px;margin:0 0 9px}.automation-box p{color:#6c675f}.automation-flow{display:grid;grid-template-columns:1fr 1fr;gap:10px}.flow{border-radius:15px;padding:18px}.flow b{display:block}.flow span{color:#777168;font-size:12px}
.plans{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.plan{border-radius:18px;padding:23px}.plan.featured{border-color:#111;background:#f4df9f;box-shadow:6px 7px 0 #111}.plan b,.plan a{color:#8d6100;font-size:11px;text-transform:uppercase;letter-spacing:1px}.plan h3{margin:8px 0;font-size:21px}.plan p{color:#777168;font-size:13px;min-height:58px}
.faq{display:grid;grid-template-columns:1fr 1fr;gap:12px}.faq .card h3{font-size:17px}.faq .card p{font-size:13px}
.cta{border:1px solid #111;border-radius:26px;padding:40px;background:linear-gradient(135deg,#fffaf0,#eee1cc);box-shadow:9px 10px 0 #111;display:flex;align-items:center;justify-content:space-between;gap:25px}.cta h2{font-size:clamp(28px,3.5vw,42px);margin:0 0 7px;line-height:1.03}.cta p{color:#6d675e;margin:0;max-width:680px}
footer{background:#080808;color:#fff;padding:40px 0 24px;border-top:1px solid #111}.foot{display:grid;grid-template-columns:1.55fr 1fr 1fr 1fr;gap:38px;align-items:start}.foot img{width:176px;height:80px;object-fit:cover;border-radius:12px}.foot p{max-width:350px;color:#9c978f;margin:12px 0 0;font-size:12px}.powered{margin-top:16px;color:#777168;font-size:11px}.powered strong{color:var(--gold2)}.footcol h3{font-size:12px;color:var(--gold2);margin:3px 0 13px}.footlinks{display:flex;flex-direction:column;gap:9px}.footlinks a{color:#aaa39a;font-size:12px}.footlinks a:hover{color:#fff}.footbottom{grid-column:1/-1;border-top:1px solid #2a2721;padding-top:18px;margin-top:3px;color:#777168;font-size:11px}
@media(max-width:950px){.navlinks a:not(.navcta){display:none}.hero-grid,.audience,.intel,.automation,.ai-adoption-grid{grid-template-columns:1fr}.hero-card{order:-1}.grid3,.category-grid{grid-template-columns:1fr 1fr}.steps,.plans{grid-template-columns:1fr 1fr}.ai-adoption-head{align-items:flex-start;flex-direction:column}}
@media(max-width:560px){.wrap{width:min(calc(100% - 24px),var(--max))}.navin{min-height:72px}.brand img{width:148px;height:64px}.hero{padding:48px 0 50px}h1{font-size:clamp(43px,12vw,62px);letter-spacing:-2.3px}.lead{font-size:16px}.actions .btn{width:100%}.section{padding:60px 0}.grid3,.category-grid,.steps,.plans,.faq,.ai-signals{grid-template-columns:1fr}.card{padding:23px}.foot{grid-template-columns:1fr 1fr}.footbottom{grid-column:1/-1}.cta{padding:27px;align-items:flex-start;flex-direction:column}.metric-row{grid-template-columns:1fr}}
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
            <div className="eyebrow"><span className="dot"/> AI-powered for local businesses</div>
            <h1>Make your local business <span>easier to discover.</span></h1>
            <p className="lead">Discover. Analyze. Automate. Grow. STall combines local business discovery with an AI-adaptive layer that helps businesses understand their digital presence, spot opportunities and take the next action.</p><div className="ai-badges"><span>AI Readiness</span><span>AI Visibility</span><span>AI Actions</span></div>
            <div className="actions"><a className="btn primary" href={appUrl}>List Your Business Free</a><a className="btn secondary" href="#platform">See How STall Works</a></div>
            <div className="micro">Discover businesses • List or claim a business • Build your digital presence</div>
          </div>
          <div className="hero-card"><img src={logo} alt="STall — local business discovery and digital presence" /><div className="caption"><strong>One platform.</strong> Local discovery for customers and practical digital tools for businesses.</div></div>
        </div></section>

        <section className="ai-adoption"><div className="wrap"><div className="ai-adoption-wrap">
          <div className="ai-adoption-head"><div><div className="kicker">AI adoption layer</div><h2>Make AI useful to the business — not just visible on the page.</h2></div><div className="ai-adoption-badge">AI-ADAPTIVE BY DESIGN</div></div>
          <div className="ai-adoption-grid">
            <article className="ai-adoption-card"><h3>From signals to decisions</h3><p>STall turns business, category and nearby-market context into a simple path toward better digital actions.</p><div className="ai-signals"><div className="ai-signal"><strong>Read</strong><span>Business profile + presence</span></div><div className="ai-signal"><strong>Compare</strong><span>Closest same-category context</span></div><div className="ai-signal"><strong>Recommend</strong><span>Prioritized next actions</span></div></div><div className="ai-note">AI supports the owner. The owner remains in control of decisions and publishing.</div></article>
            <article className="ai-adoption-card"><h3>The STall AI path</h3><p>A clear journey for a business adopting AI one practical step at a time.</p><div className="ai-path"><div className="ai-path-item"><b>01</b><span>Understand the business</span></div><div className="ai-path-item"><b>02</b><span>Understand the local market</span></div><div className="ai-path-item"><b>03</b><span>Find the highest-value opportunity</span></div><div className="ai-path-item"><b>04</b><span>Act, review and improve</span></div></div></article>
          </div>
        </div></div></section>

        <section id="platform" className="section alt"><div className="wrap">
          <div className="head"><div className="kicker">What STall does</div><h2>One platform for local discovery and business growth.</h2><p>Every part of STall has a distinct job: help people find businesses, help them connect, and give owners better tools to grow their presence.</p></div>
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
          <div className="head"><div className="kicker">Business intelligence</div><h2>Know how your business compares.</h2><p>STall can turn business information into a clearer picture of digital presence and local competitiveness.</p></div>
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
