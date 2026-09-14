// Shared Google Maps JavaScript API loader.
// Uses Google's documented importLibrary bootstrap pattern.

let loadPromise = null;

export function loadGoogleMaps(apiKey) {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (!apiKey && !window.google?.maps) {
      throw new Error("Google Maps API key is not configured.");
    }

    const google = (window.google = window.google || {});
    const maps = (google.maps = google.maps || {});

    if (!maps.importLibrary) {
      const g = {
        key: apiKey,
        v: "weekly",
      };

      let h;
      const r = new Set();
      const p = "The Google Maps JavaScript API";
      const c = "google";
      const l = "importLibrary";
      const q = "__ib__";
      const m = document;
      const b = window;

      maps.importLibrary = (library, ...rest) => {
        r.add(library);
        return (h || (h = new Promise((resolve, reject) => {
          const script = m.createElement("script");
          const params = new URLSearchParams();

          params.set("libraries", [...r] + "");
          for (const key in g) {
            params.set(key.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()), g[key]);
          }
          params.set("callback", c + ".maps." + q);

          maps[q] = resolve;
          script.id = "google-maps-script";
          script.src = "https://maps." + c + "apis.com/maps/api/js?" + params.toString();
          script.onerror = () => reject(new Error(p + " could not load."));
          script.nonce = m.querySelector("script[nonce]")?.nonce || "";
          m.head.appendChild(script);

          setTimeout(() => reject(new Error(p + " timed out while loading.")), 15000);
        }))).then(() => maps.importLibrary(library, ...rest));
      };
    }

    await maps.importLibrary("places");
    return google;
  })().catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}
