// Loads the Google Maps JavaScript API (with the Places library) exactly once.
// Discover Nearby uses the current Places API (New) Place class directly.

let loadPromise = null;

export function loadGoogleMaps(apiKey) {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer = null;
    let timeoutTimer = null;

    const cleanup = () => {
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (window.__stallGoogleMapsReady) delete window.__stallGoogleMapsReady;
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const finish = () => {
      if (settled) return;
      if (!window.google?.maps) {
        fail(new Error("Google Maps JavaScript API did not load correctly."));
        return;
      }
      settled = true;
      cleanup();
      resolve(window.google);
    };

    window.__stallGoogleMapsReady = finish;

    if (!apiKey && !window.google?.maps) {
      fail(new Error("Google Maps API key is not configured."));
      return;
    }

    // If another component already loaded Google Maps, use it immediately.
    if (window.google?.maps) {
      finish();
      return;
    }

    const existing = document.getElementById("google-maps-script");

    if (existing) {
      // The Google loader with loading=async does not guarantee a useful
      // script load event. Poll briefly for the Maps namespace instead.
      pollTimer = setInterval(() => {
        if (window.google?.maps) finish();
      }, 100);
      timeoutTimer = setTimeout(() => {
        fail(new Error("Google Maps JavaScript API timed out while loading."));
      }, 15000);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&libraries=places` +
      `&callback=__stallGoogleMapsReady`;
    script.async = true;
    script.defer = true;
    script.onerror = () => fail(new Error("Failed to load Google Maps script"));

    timeoutTimer = setTimeout(() => {
      fail(new Error("Google Maps JavaScript API timed out while loading."));
    }, 15000);

    document.head.appendChild(script);
  }).catch((error) => {
    // Allow a later attempt if the initial Google script load failed.
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}
