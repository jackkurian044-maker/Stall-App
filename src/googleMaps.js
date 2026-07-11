// Loads the Google Maps JavaScript API (with the Places library) exactly
// once, no matter how many components ask for it, and returns a promise
// that resolves once `window.google.maps.places` is ready to use.

let loadPromise = null;

export function loadGoogleMaps(apiKey) {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps && window.google.maps.places) {
      resolve(window.google);
      return;
    }

    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
