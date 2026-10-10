/* eslint-disable */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

const db = admin.firestore();
const HOSTING_ORIGIN = "https://stall-app-1aab7.web.app";

let cachedIndex = null;
let cachedAt = 0;

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function isActive(listing) {
  return listing && (listing.isPremium === true || ["verified", "digital_growth", "growth_setup"].includes(listing.planKey));
}

async function findListing(key) {
  // Firestore document IDs are case-sensitive. Preserve the incoming key and
  // try the exact ID first; normalize only when looking up public slugs.
  const rawKey = String(key || "").trim();
  if (!rawKey) return null;

  const direct = await db.collection("vendors").doc(rawKey).get();
  if (direct.exists) return { id: direct.id, ...direct.data() };

  const normalized = rawKey.toLowerCase();
  const bySlug = await db.collection("vendors").where("publicSlug", "==", normalized).limit(1).get();
  if (!bySlug.empty) {
    const d = bySlug.docs[0];
    return { id: d.id, ...d.data() };
  }

  if (normalized === "kerala-swaad-restaurant-janakpuri") {
    const legacy = await db.collection("vendors").doc("SGbUMqLzX6pJSw6ESZ2R").get();
    if (legacy.exists) return { id: legacy.id, ...legacy.data() };
  }

  return null;
}

function publicData(listing, canonicalUrl) {
  return {
    id: listing.id,
    publicSlug: listing.publicSlug || "",
    name: listing.name || "Local Business",
    category: listing.category || "Local Business",
    description: listing.description || "",
    address: listing.address || "",
    phone: listing.phone || "",
    website: listing.website || "",
    mapsUrl: listing.mapsUrl || "",
    hours: listing.hours || "",
    products: String(listing.products || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 10),
    offer: listing.offer || "",
    todaySpecial: listing.todaySpecial || "",
    everydaySpecial: listing.everydaySpecial || "",
    rating: listing.rating != null ? Number(listing.rating) : null,
    ratingsCount: listing.ratingsCount != null ? Number(listing.ratingsCount) : null,
    photos: Array.isArray(listing.photos) ? listing.photos.filter(Boolean).slice(0, 5) : [],
    isVerified: Boolean(listing.isVerified || listing.planKey === "verified"),
    isPremium: Boolean(listing.isPremium),
    planKey: listing.planKey || "",
    canonicalUrl,
  };
}

function renderBusinessMarkup(data) {
  const rating = data.rating != null && data.ratingsCount
    ? `<p><strong>Rating:</strong> ${escapeHtml(data.rating.toFixed(1))}/5 (${escapeHtml(data.ratingsCount)} ratings)</p>`
    : "";
  const image = data.photos[0]
    ? `<img src="${escapeHtml(data.photos[0])}" alt="${escapeHtml(data.name)}" style="max-width:100%;height:auto" />`
    : "";
  const offer = data.offer || data.todaySpecial || data.everydaySpecial
    ? `<h2>Current offer</h2><p>${escapeHtml(data.offer || data.todaySpecial || data.everydaySpecial)}</p>`
    : "";
  const products = data.products.length
    ? `<h2>Products and services</h2><p>${escapeHtml(data.products.join(", "))}</p>`
    : "";

  return `<main id="stall-public-business-prerender" itemscope itemtype="https://schema.org/LocalBusiness">
    <article>
      <p><a href="/">STall</a> / Local business</p>
      ${image}
      <h1 itemprop="name">${escapeHtml(data.name)}</h1>
      <p><strong>Category:</strong> <span itemprop="category">${escapeHtml(data.category)}</span></p>
      ${data.description ? `<p itemprop="description">${escapeHtml(data.description)}</p>` : ""}
      ${data.address ? `<p><strong>Location:</strong> <span itemprop="address">${escapeHtml(data.address)}</span></p>` : ""}
      ${data.phone ? `<p><strong>Phone:</strong> <span itemprop="telephone">${escapeHtml(data.phone)}</span></p>` : ""}
      ${data.hours ? `<p><strong>Hours:</strong> ${escapeHtml(data.hours)}</p>` : ""}
      ${rating}
      ${products}
      ${offer}
      <p>Business information provided through the STall local business platform.</p>
    </article>
  </main>`;
}

function renderSchema(data) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": data.canonicalUrl + "#business",
    name: data.name,
    url: data.canonicalUrl,
    description: data.description || undefined,
    telephone: data.phone || undefined,
    image: data.photos.length ? data.photos : undefined,
    address: data.address ? { "@type": "PostalAddress", streetAddress: data.address } : undefined,
    sameAs: [data.website, data.mapsUrl].filter(Boolean),
    identifier: data.id,
    category: data.category || undefined,
    aggregateRating: data.rating != null && data.ratingsCount
      ? { "@type": "AggregateRating", ratingValue: data.rating, reviewCount: data.ratingsCount }
      : undefined,
  };
  return `<script id="stall-business-prerender-schema" type="application/ld+json">${safeJson(schema)}</script>`;
}

async function getIndexHtml() {
  const now = Date.now();
  if (cachedIndex && now - cachedAt < 5 * 60 * 1000) return cachedIndex;
  const response = await axios.get(HOSTING_ORIGIN + "/index.html", { timeout: 8000, responseType: "text" });
  cachedIndex = response.data;
  cachedAt = now;
  return cachedIndex;
}

exports.publicBusinessPage = functions.https.onRequest(async (req, res) => {
  const key = String(req.path || req.url || "").replace(/^\/+/, "").split("/")[1] || "";
  try {
    const listing = await findListing(key);
    if (!listing || !isActive(listing)) {
      const html = await getIndexHtml();
      res.set("Cache-Control", "public, max-age=60, s-maxage=60");
      return res.status(200).send(html);
    }

    const canonicalUrl = "https://stallwale.in/store/" + encodeURIComponent(listing.publicSlug || listing.id);
    const data = publicData(listing, canonicalUrl);
    let html = await getIndexHtml();

    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(data.name)} | STall</title>`);
    html = html.replace(/<meta name="description" content="[^"]*" \/>/i, `<meta name="description" content="${escapeHtml(data.description || (data.name + " on STall."))}" />`);
    html = html.replace(/<link rel="canonical" href="[^"]*" \/>/i, `<link rel="canonical" href="${escapeHtml(data.canonicalUrl)}" />`);
    html = html.replace(/<meta property="og:title" content="[^"]*" \/>/i, `<meta property="og:title" content="${escapeHtml(data.name + " | STall")}" />`);
    html = html.replace(/<meta property="og:description" content="[^"]*" \/>/i, `<meta property="og:description" content="${escapeHtml(data.description || (data.name + " on STall."))}" />`);
    html = html.replace(/<meta property="og:url" content="[^"]*" \/>/i, `<meta property="og:url" content="${escapeHtml(data.canonicalUrl)}" />`);
    html = html.replace(/<meta name="twitter:title" content="[^"]*" \/>/i, `<meta name="twitter:title" content="${escapeHtml(data.name + " | STall")}" />`);
    html = html.replace(/<meta name="twitter:description" content="[^"]*" \/>/i, `<meta name="twitter:description" content="${escapeHtml(data.description || (data.name + " on STall."))}" />`);

    const bootstrap = `<script id="stall-public-business-bootstrap">window.__STALL_PUBLIC_BUSINESS__=${safeJson(data)};</script>`;
    const prerender = renderBusinessMarkup(data);
    const schema = renderSchema(data);

    html = html.replace("</head>", `${schema}${bootstrap}</head>`);
    html = html.replace('<div id="root"></div>', `<div id="root">${prerender}</div>`);

    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.set("Vary", "Accept-Encoding");
    return res.status(200).send(html);
  } catch (error) {
    console.error("publicBusinessPage failed:", error?.response?.status, error?.message);
    try {
      const html = await getIndexHtml();
      res.set("Cache-Control", "public, max-age=60, s-maxage=60");
      return res.status(200).send(html);
    } catch {
      return res.status(500).send("STall public page temporarily unavailable.");
    }
  }
});


exports.publicSitemap = functions.https.onRequest(async (req, res) => {
  try {
    const snap = await db.collection("vendors").get();
    const urls = [
      "https://stallwale.in/",
      "https://stallwale.in/products.html",
      "https://stallwale.in/products/business-discovery.html",
      "https://stallwale.in/products/digital-score.html",
      "https://stallwale.in/products/business-intelligence.html",
      "https://stallwale.in/products/digital-store-automation.html",
      "https://stallwale.in/ai-discovery.html",
      "https://stallwale.in/blog.html",
      "https://stallwale.in/guides.html",
      "https://stallwale.in/help.html",
      "https://stallwale.in/community.html",
      "https://stallwale.in/contact.html",
      "https://stallwale.in/about.html",
      "https://stallwale.in/success-stories.html",
      "https://stallwale.in/follow-stall.html",
      "https://stallwale.in/privacy.html",
      "https://stallwale.in/terms.html",
      "https://stallwale.in/careers.html",
      "https://stallwale.in/india.html",
      "https://stallwale.in/local-business-digital-presence.html",
      "https://stallwale.in/solutions/local-businesses-india.html",
      "https://stallwale.in/solutions/salons.html",
      "https://stallwale.in/solutions/restaurants.html"
    ];
    const lastmodByUrl = {
      "https://stallwale.in/": "2026-10-10",
      "https://stallwale.in/india.html": "2026-10-10",
      "https://stallwale.in/solutions/local-businesses-india.html": "2026-10-10"
    };
    for (const doc of snap.docs) {
      const listing = doc.data() || {};
      if (!isActive(listing)) continue;
      const slug = String(listing.publicSlug || doc.id).trim();
      if (!slug) continue;
      urls.push("https://stallwale.in/store/" + encodeURIComponent(slug));
    }
    const unique = [...new Set(urls)];
    const body = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      unique.map((url) => {
        const lastmod = lastmodByUrl[url] ? '<lastmod>' + lastmodByUrl[url] + '</lastmod>' : '';
        return '<url><loc>' + escapeHtml(url) + '</loc>' + lastmod + '</url>';
      }).join("") +
      '</urlset>';
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=1800, s-maxage=1800");
    return res.status(200).send(body);
  } catch (error) {
    console.error("publicSitemap failed:", error?.message);
    res.set("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://stallwale.in/</loc></url></urlset>');
  }
});
