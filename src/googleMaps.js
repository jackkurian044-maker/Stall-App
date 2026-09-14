// Shared Google Maps JavaScript API loader.
// Uses Google's official importLibrary bootstrap pattern so Places API (New)
// loads reliably without depending on the Maps script onload event.

let loadPromise = null;

export function loadGoogleMaps(apiKey) {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (!apiKey && !window.google?.maps) {
      throw new Error("Google Maps API key is not configured.");
    }

    if (window.google?.maps?.importLibrary) {
      await window.google.maps.importLibrary("places");
      return window.google;
    }

    const existing = document.getElementById("google-maps-script");
    if (existing) {
      const started = Date.now();
      while (Date.now() - started < 15000) {
        if (window.google?.maps?.importLibrary) {
          await window.google.maps.importLibrary("places");
          return window.google;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Google Maps JavaScript API timed out while loading.");
    }

    // Adapted from Google's documented bootstrap loader. The resolver is
    // stored on google.maps.__ib__ and importLibrary waits for the script.
    const google = (window.google = window.google || {});
    google.maps = google.maps || {};

    if (!google.maps.importLibrary) {
      google.maps.importLibrary = (library, ...rest) => {
        google.maps.importLibrary.__pending = google.maps.importLibrary.__pending || new Set();
        google.maps.importLibrary.__pending.add(library);
        return (google.maps.importLibrary.__promise || (google.maps.importLibrary.__promise = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.id = "google-maps-script";
          const params = new URLSearchParams({
            key: apiKey,
            v: "weekly",
            loading: "async",
          });
          params.set("libraries", [...google.maps.importLibrary.__pending].join(","));
          params.set("callback", "google.maps.__ib__");
          google.maps.__ib__ = () => resolve(window.google.maps);
          script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
          script.async = true;
          script.defer = true;
          script.onerror = () => reject(new Error("Failed to load Google Maps JavaScript API."));
          document.head.appendChild(script);
          setTimeout(() => reject(new Error("Google Maps JavaScript API timed out while loading.")), 15000);
        }))).then(() => window.google.maps.importLibrary(library, ...rest));
      };
    }

    await google.maps.importLibrary("places");
    return window.google;
  })().catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}
