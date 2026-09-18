const fs = require("fs");
const path = require.resolve("./index.js");

let source = fs.readFileSync(path, "utf8");

if (!source.includes('defineSecret("RAZORPAY_CONFIG")')) {
  const marker = 'const crypto = require("crypto");';
  if (!source.includes(marker)) throw new Error("Premium prepare: crypto import marker not found");
  source = source.replace(
    marker,
    `${marker}\nconst { defineSecret } = require("firebase-functions/params");\nconst razorpayConfig = defineSecret("RAZORPAY_CONFIG");\n\nfunction getRazorpayConfig() {\n  let raw;\n  try {\n    raw = razorpayConfig.value();\n  } catch (err) {\n    throw new Error("RAZORPAY_CONFIG secret is unavailable: " + err.message);\n  }\n\n  let cfg;\n  try {\n    cfg = JSON.parse(raw);\n  } catch (err) {\n    throw new Error("RAZORPAY_CONFIG must contain valid JSON");\n  }\n\n  if (!cfg?.key_id || !cfg?.key_secret || !cfg?.webhook_secret) {\n    throw new Error("RAZORPAY_CONFIG is missing key_id, key_secret, or webhook_secret");\n  }\n  return cfg;\n}`
  );
}

const legacyRazorpayConfig = "functions.config().razorpay";
const legacyCount = source.split(legacyRazorpayConfig).length - 1;
if (legacyCount > 0) {
  source = source.replace(/functions\.config\(\)\.razorpay/g, "getRazorpayConfig()");
} else if (!source.includes('defineSecret("RAZORPAY_CONFIG")')) {
  throw new Error("Premium prepare: neither legacy Razorpay config nor RAZORPAY_CONFIG migration was found");
}

if (source.includes("if (cached.exists && cached.data().planId) return cached.data().planId;")) {
  source = source.replace(
    "if (cached.exists && cached.data().planId) return cached.data().planId;",
    `if (cached.exists && cached.data().planId) {\n    try {\n      const existing = await razorpay.plans.fetch(cached.data().planId);\n      const item = existing?.item || {};\n      if (\n        existing?.id === cached.data().planId &&\n        existing?.period === plan.period &&\n        Number(existing?.interval) === Number(plan.interval) &&\n        Number(item?.amount) === Number(plan.amount) &&\n        item?.currency === plan.currency\n      ) {\n        return cached.data().planId;\n      }\n      console.warn("Cached Razorpay plan does not match current plan/account; recreating", planKey);\n    } catch (err) {\n      console.warn("Cached Razorpay plan is unavailable in the current Razorpay account; recreating", planKey, err.message);\n    }\n    await cacheRef.delete();\n  }`
  );
}

for (const name of ["createSubscription", "verifySubscription", "cancelSubscription"]) {
  const legacy = `exports.${name} = functions.https.onCall(`;
  const secure = `exports.${name} = functions.runWith({ secrets: [razorpayConfig] }).https.onCall(`;
  if (source.includes(legacy)) source = source.replace(legacy, secure);
}

const legacyWebhook = "exports.razorpayWebhook = functions.https.onRequest(";
const secureWebhook = "exports.razorpayWebhook = functions.runWith({ secrets: [razorpayConfig] }).https.onRequest(";
if (source.includes(legacyWebhook)) source = source.replace(legacyWebhook, secureWebhook);

const requiredBindings = [
  "exports.createSubscription = functions.runWith({ secrets: [razorpayConfig] }).https.onCall(",
  "exports.verifySubscription = functions.runWith({ secrets: [razorpayConfig] }).https.onCall(",
  "exports.cancelSubscription = functions.runWith({ secrets: [razorpayConfig] }).https.onCall(",
  "exports.razorpayWebhook = functions.runWith({ secrets: [razorpayConfig] }).https.onRequest(",
];
for (const binding of requiredBindings) {
  if (!source.includes(binding)) throw new Error(`Premium prepare: missing binding for ${binding}`);
}

fs.writeFileSync(path, source);
console.log(`Premium prepare complete: migrated ${legacyCount} legacy Razorpay config references and bound RAZORPAY_CONFIG to the four Premium functions.`);
