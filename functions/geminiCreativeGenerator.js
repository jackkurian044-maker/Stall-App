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
  const services = context.services.join(', ');
  const prompts = [
    `Photorealistic premium marketing image for ${context.label}. Business: ${name}. Services: ${services}. Show a realistic customer-facing scene that represents the supplied services. Use the provided reference image when available. Do not add text, logos, fake signs, prices, awards, or unsupported claims.`,
    `Second photorealistic marketing image for ${context.label}. Business: ${name}. Services: ${services}. Show a different realistic service or customer experience scene. Use the provided reference image when available. Do not add text, logos, fake signs, prices, awards, or unsupported claims.`
  ];
  const generated = [];
  for (const prompt of prompts) {
    try {
      const img = await generateGeminiImage(prompt, refs);
      generated.push({ kind: 'business', label: 'AI service creative', buffer: img.buffer, mimeType: img.mimeType });
    } catch (err) {
      console.warn('Gemini creative failed', err.response?.status, err.message);
      generated.push(null);
    }
  }
  const fallback = refs.map((r, i) => ({ kind: 'business', label: i === 0 ? 'Real store photo' : 'Real service/store photo', buffer: r.data, mimeType: r.mimeType }));
  return [generated[0] || fallback[0] || null, generated[1] || fallback[1] || null];
}

module.exports = { makeAiCreatives };