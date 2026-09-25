const axios = require('axios');
const { generateGeminiImage } = require('./reviewAutoResponder');

async function refsFromListing(listing) {
  const urls = Array.isArray(listing.photos) ? listing.photos.map((p) => typeof p === 'string' ? p : p?.url || p?.src || p?.downloadURL || '').filter(Boolean).slice(0, 3) : [];
  const out = [];
  for (const url of urls) {
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 12000, maxContentLength: 8388608 });
      const mimeType = String(res.headers['content-type'] || 'image/jpeg').split(';')[0];
      if (mimeType.startsWith('image/')) out.push({ data: Buffer.from(res.data), mimeType });
    } catch (err) {
      console.warn('creative reference skipped', err.message);
    }
  }
  return out;
}

async function makeAiCreatives(listing, context) {
  const refs = await refsFromListing(listing);
  const name = String(listing.name || 'Local business').trim();

  // Build service signals from owner-supplied fields so the images focus
  // on concrete services/offers rather than only the broad category.
  const serviceSignals = [
    ...(Array.isArray(context.services) ? context.services : []),
    String(listing.products || ''),
    String(listing.description || ''),
    String(listing.todaySpecial || ''),
    String(listing.everydaySpecial || ''),
    String(listing.todayOffer || ''),
    String(listing.weekendOffer || ''),
    String(listing.offer || ''),
  ]
    .flatMap((value) => String(value || '').split(/[,|\n]+/))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, all) => all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .slice(0, 8);

  const primaryService = serviceSignals[0] || context.label;
  const secondaryService = serviceSignals.find((value) => value.toLowerCase() !== primaryService.toLowerCase()) || primaryService;
  const offer = String(listing.offer || listing.todayOffer || listing.todaySpecial || '').trim();

  const prompts = [
    'Create a photorealistic premium marketing image for ' + context.label + '. Business: ' + name + '. Primary service to show: ' + primaryService + '. Other verified services/signals: ' + (serviceSignals.join(', ') || 'none supplied') + '. ' + (offer ? 'Current verified offer: ' + offer + '. ' : '') + 'Show the actual service in action with realistic people, setting, tools, and customer experience appropriate to the category. Use supplied business photo references when available. Do not fall back to a generic category portrait when a concrete service is supplied. Do not invent services, prices, awards, locations, guarantees, signage, logos, or claims. Do not place text, captions, logos, or watermarks inside the image.',
    'Create a second photorealistic premium marketing image for ' + context.label + '. Business: ' + name + '. Focus on this verified service signal: ' + secondaryService + '. Other verified services/signals: ' + (serviceSignals.join(', ') || 'none supplied') + '. ' + (offer ? 'Current verified offer: ' + offer + '. ' : '') + 'Show a different realistic customer-facing moment that clearly relates to the chosen service. If only one concrete service was supplied, show a different angle or customer experience of that same service rather than inventing another service. Use supplied business photo references when available. Do not invent services, prices, awards, locations, guarantees, signage, logos, or claims. Do not place text, captions, logos, or watermarks inside the image.'
  ];

  const generated = await Promise.all(prompts.map(async (prompt, index) => {
    try {
      const img = await generateGeminiImage(prompt, refs);
      return {
        kind: 'business',
        label: 'AI service creative • ' + (index === 0 ? primaryService : secondaryService),
        aiGenerated: true,
        buffer: img.buffer,
        mimeType: img.mimeType,
      };
    } catch (err) {
      console.warn('Gemini creative failed', err.response?.status, err.message);
      return null;
    }
  }));

  const fallback = refs.map((r, i) => ({
    kind: 'business',
    label: i === 0 ? 'Real store photo' : 'Real service/store photo',
    aiGenerated: false,
    buffer: r.data,
    mimeType: r.mimeType,
  }));

  return [generated[0] || fallback[0] || null, generated[1] || fallback[1] || null];
}

module.exports = { makeAiCreatives };