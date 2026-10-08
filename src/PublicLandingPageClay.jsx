import React, { useEffect } from "react";

const logo = "https://stall.stallwale.in/assets/stall-logo-exact.jpg";
const appUrl = "https://stallapp.stallwale.in/";
const automationUrl = "https://stallwale.ai.studio/";

const css = `
:root{--bg:#070707;--panel:#101010;--panel2:#141414;--gold:#f5b72c;--gold2:#ffd968;--text:#fff;--muted:#a8a8a8;--line:rgba(255,255,255,.1);--max:1180px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 85% 0%,rgba(245,183,44,.11),transparent 28%),var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;line-height:1.55}a{color:inherit;text-decoration:none}.wrap{width:min(calc(100% - 36px),var(--max));margin:auto}
.nav{position:sticky;top:0;z-index:20;background:rgba(7,7,7,.9);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}.navin{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand img{width:150px;height:60px;object-fit:contain}.navlinks{display:flex;gap:22px;align-items:center;color:#bbb;font-size:13px}.navlinks a:hover{color:#fff}.navcta{border:1px solid rgba(245,183,44,.55);border-radius:999px;padding:9px 15px;color:var(--gold2);font-weight:800}
.hero{padding:88px 0 72px}.hero-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:64px;align-items:center}.eyebrow,.kicker{color:var(--gold2);font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase}.eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(245,183,44,.3);border-radius:999px;padding:7px 12px;background:rgba(245,183,44,.06);letter-spacing:.8px}.dot{width:7px;height:7px;background:var(--gold);border-radius:50%}
h1,h2,h3{font-family:Poppins,Inter,sans-serif}h1{font-size:clamp(42px,6vw,76px);line-height:1.02;letter-spacing:-2.8px;margin:20px 0 20px}h1 span{color:var(--gold2)}.lead{font-size:19px;color:#c5c5c5;max-width:690px;margin:0 0 28px}.actions{display:flex;gap:12px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 21px;border-radius:12px;font-size:14px;font-weight:800}.primary{background:linear-gradient(135deg,#ffd968,#e9a915);color:#080808}.secondary{border:1px solid rgba(255,255,255,.18);background:#111}.micro{color:#777;font-size:12px;margin-top:13px}
.hero-card{border:1px solid rgba(245,183,44,.25);background:linear-gradient(145deg,#151515,#090909);border-radius:30px;padding:34px;box-shadow:0 35px 90px rgba(0,0,0,.45)}.hero-card img{display:block;width:100%;max-width:390px;margin:auto;border-radius:20px}.hero-card .caption{margin-top:22px;border-top:1px solid var(--line);padding-top:18px;color:#999;font-size:13px}.hero-card strong{color:#fff}
.section{padding:82px 0}.alt{background:rgba(255,255,255,.018);border-top:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04)}.head{max-width:760px;margin-bottom:34px}.head h2{font-size:clamp(30px,4vw,48px);line-height:1.08;letter-spacing:-1.4px;margin:9px 0 12px}.head p{color:#aaa;margin:0;font-size:16px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{background:linear-gradient(145deg,#121212,#0d0d0d);border:1px solid var(--line);border-radius:20px;padding:27px}.card h3{font-size:21px;margin:0 0 8px}.card p{color:#a7a7a7;margin:0}.icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:rgba(245,183,44,.09);border:1px solid rgba(245,183,44,.23);color:var(--gold2);font-weight:900;margin-bottom:17px}
.audience{display:grid;grid-template-columns:1fr 1fr;gap:18px}.audience .card{padding:32px}.audience h3{font-size:26px}.list{padding:0;margin:20px 0 0;list-style:none}.list li{padding:9px 0;border-top:1px solid var(--line);color:#ccc}.list li:before{content:"✓";color:var(--gold2);font-weight:900;margin-right:10px}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.step{background:#0f0f0f;border:1px solid var(--line);border-radius:18px;padding:24px}.num{font-size:12px;color:var(--gold2);font-weight:900}.step h3{font-size:18px;margin:12px 0 5px}.step p{color:#888;font-size:13px;margin:0}
.category-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.category{padding:22px;border:1px solid var(--line);border-radius:16px;background:#0e0e0e}.category strong{display:block;font-family:Poppins;font-size:17px}.category span{display:block;color:#888;font-size:13px;margin-top:4px}
.intel{display:grid;grid-template-columns:1fr 1fr;gap:18px}.score{border:1px solid rgba(245,183,44,.3);border-radius:24px;padding:32px;background:radial-gradient(circle at 85% 15%,rgba(245,183,44,.12),transparent 35%),#101010}.score-number{font-family:Poppins;font-size:70px;line-height:1;color:var(--gold2);font-weight:800;margin:10px 0}.score p{color:#999;margin:0}.compare{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.metric{border:1px solid var(--line);border-radius:13px;padding:15px;color:#bbb;font-size:13px}.metric b{display:block;color:#fff;font-size:18px;margin-top:4px}
.automation{display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:center}.automation-box{border:1px solid rgba(245,183,44,.25);border-radius:24px;padding:30px;background:#101010}.automation-box h3{font-size:28px;margin:0 0 9px}.automation-box p{color:#999}.automation-flow{display:grid;grid-template-columns:1fr 1fr;gap:10px}.flow{border:1px solid var(--line);border-radius:15px;padding:18px;background:#0c0c0c}.flow b{display:block}.flow span{color:#888;font-size:12px}
.plans{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.plan{border:1px solid var(--line);border-radius:18px;padding:23px;background:#101010}.plan.featured{border-color:rgba(245,183,44,.45)}.plan b{color:var(--gold2);font-size:11px;text-transform:uppercase;letter-spacing:1px}.plan h3{margin:8px 0;font-size:21px}.plan p{color:#888;font-size:13px;min-height:58px}.plan a{display:inline-block;color:var(--gold2);font-weight:800;font-size:13px}
.faq{display:grid;grid-template-columns:1fr 1fr;gap:12px}.faq .card h3{font-size:17px}.faq .card p{font-size:13px}
.cta{border:1px solid rgba(245,183,44,.28);border-radius:26px;padding:40px;background:radial-gradient(circle at 85% 20%,rgba(245,183,44,.13),transparent 35%),#101010;display:flex;align-items:center;justify-content:space-between;gap:25px}.cta h2{font-size:clamp(28px,3.5vw,42px);margin:0 0 7px}.cta p{color:#999;margin:0;max-width:680px}
footer{border-top:1px solid var(--line);padding:38px 0;color:#777;font-size:12px}.foot{display:flex;justify-content:space-between;gap:20px}.foot img{width:150px;height:55px;object-fit:contain}.foot p{max-width:360px;color:#888}.powered{margin-top:12px;color:#777;font-size:12px}.powered strong{color:#aaa}.footnav{display:flex;gap:18px;flex-wrap:wrap;align-items:center}.footnav a:hover{color:#fff}
@media(max-width:950px){.navlinks a:not(.navcta){display:none}.hero-grid,.audience,.intel,.automation{grid-template-columns:1fr}.hero-card{order:-1}.grid3,.category-grid{grid-template-columns:1fr 1fr}.steps,.plans{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.wrap{width:min(calc(100% - 24px),var(--max))}.hero{padding:45px 0 55px}.hero-grid{gap:30px}h1{letter-spacing:-1.7px}.lead{font-size:16px}.actions .btn{width:100%}.section{padding:58px 0}.grid3,.category-grid,.steps,.plans,.faq{grid-template-columns:1fr}.card{padding:23px}.foot{flex-direction:column}.cta{padding:27px;align-items:flex-start;flex-direction:column}}
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
      <header className="nav"><div className="wrap navin">
        <a className="brand" href="https://stallwale.in/" aria-label="STall home"><img src={logo} alt="STall logo" /></a>
        <nav className="navlinks" aria-label="Main navigation">
          <a href="#platform">Platform</a><a href="#automation">Automation</a><a href="#intelligence">Intelligence</a><a href="#plans">Plans</a><a href="#faq">FAQs</a><a className="navcta" href={appUrl}>List Free</a>
        </nav>
      </div></header>

      <main>
        <section className="hero"><div className="wrap hero-grid">
          <div>
            <div className="eyebrow"><span className="dot"/> Local business discovery + digital growth</div>
            <h1>Make your local business <span>easier to discover.</span></h1>
            <p className="lead">STall connects customers with local businesses and gives business owners the tools to build, manage and improve their digital presence.</p>
            <div className="actions"><a className="btn primary" href={appUrl}>List Your Business Free</a><a className="btn secondary" href="#platform">See How STall Works</a></div>
            <div className="micro">Discover businesses • List or claim a business • Build your digital presence</div>
          </div>
          <div className="hero-card"><img src={logo} alt="STall — local business discovery and digital presence" /><div className="caption"><strong>One platform.</strong> Local discovery for customers and practical digital tools for businesses.</div></div>
        </div></section>

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
          <div className="head"><div className="kicker">Local business network</div><h2>Built around real businesses and real categories.</h2><p>STall keeps business categories and local context explicit so customers—and intelligent systems—can understand what a business actually is.</p></div>
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
          <div><div className="kicker">STall Digital Store Automation</div><h2>Run your digital presence without doing everything manually.</h2><p className="lead" style={{fontSize:16}}>Create and manage business content, offers and digital updates with a workflow designed for local business owners.</p><div className="actions"><a className="btn primary" href={automationUrl}>Open Digital Store Automation</a></div></div>
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

      <footer><div className="wrap foot"><div><img src={logo} alt="STall logo"/><p>STall connects people with local businesses and gives business owners tools to build and manage their digital presence.</p><div className="powered">Powered by <strong>STallwale</strong></div></div><div className="footnav"><a href="#platform">Platform</a><a href="#automation">Automation</a><a href="#intelligence">Intelligence</a><a href="#plans">Plans</a><a href="https://stall.stallwale.in/help.html">Help</a><a href="https://stall.stallwale.in/contact.html">Contact</a><a href={appUrl}>Open STall App</a></div></div></footer>
    </div>
  );
}
