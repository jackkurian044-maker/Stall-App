// Shared Google Maps JavaScript API loader.
// Uses Google's importLibrary bootstrap pattern so Places API (New) can be
// loaded reliably without depending on script onload timing.

let loadPromise = null;

export function loadGoogleMaps(apiKey) {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (!apiKey && !window.google?.maps) {
      throw new Error("Google Maps API key is not configured.");
    }

    // Already loaded by another part of the app.
    if (window.google?.maps?.importLibrary) {
      await window.google.maps.importLibrary("places");
      return window.google;
    }

    // If a Maps script is already being loaded by another component, wait for
    // the namespace/importLibrary to become available rather than attaching
    // another script or relying on a script load event.
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

    // Google's recommended bootstrap loader. It creates google.maps.importLibrary
    // immediately and loads the requested libraries asynchronously.
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.async = true;
    script.defer = true;

    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

    const scriptLoad = new Promise((resolve, reject) => {
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("Failed to load Google Maps JavaScript API.")), { once: true });
    });

    document.head.appendChild(script);

    await Promise.race([
      scriptLoad,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Google Maps JavaScript API timed out while loading.")), 15000)),
    ]);

    if (!window.google?.maps?.importLibrary) {
      throw new Error("Google Maps loaded, but importLibrary is unavailable.");
    }

    await window.google.maps.importLibrary("places");
    return window.google;
  })().catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}
