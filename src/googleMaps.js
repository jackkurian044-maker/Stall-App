// Loads the Google Maps JavaScript API (with the Places library) exactly once.
// Discover Nearby uses the current Places API (New) Place class directly.

let loadPromise = null;

export function loadGoogleMaps(apiKey) {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const finish = async () => {
      try {
        if (!window.google?.maps) {
          throw new Error("Google Maps JavaScript API did not load correctly.");
        }

        // Ensure the Places library is available before resolving.
        const places = await window.google.maps.importLibrary("places");
        if (!places?.Place) {
          throw new Error("Google Places library did not load correctly.");
        }

        resolve(window.google);
      } catch (error) {
        reject(error);
      }
    };

    if (window.google?.maps) {
      finish();
      return;
    }

    const existing = document.getElementById("google-maps-script");

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps script")),
        { once: true }
      );
      return;
    }

    if (!apiKey) {
      reject(new Error("Google Maps API key is not configured."));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&libraries=places` +
      `&loading=async`;
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  }).catch((error) => {
    // Allow a later attempt if the initial Google script load failed.
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}
