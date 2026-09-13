// Loads the Google Maps JavaScript API (with the Places library) exactly
// once, no matter how many components ask for it.
//
// IMPORTANT:
// DiscoverNearby.jsx still uses the existing PlacesService interface.
// This file provides a compatibility layer that routes those calls to
// Google's current Places API (New), without changing the Discover Nearby UI,
// Firestore logic, claim-code logic, duplicate checking, or other components.

let loadPromise = null;

function installPlacesCompatibilityAdapter(google) {
  const places = google?.maps?.places;

  // If the new Place class isn't available, leave the existing API untouched.
  if (!places?.Place) return;

  // Prevent installing the adapter more than once.
  if (places.__stallPlacesAdapterInstalled) return;

  const PlaceClass = places.Place;
  const RankPreference = places.SearchNearbyRankPreference;

  const OK = places.PlacesServiceStatus?.OK || "OK";
  const ERROR = places.PlacesServiceStatus?.ERROR || "ERROR";

  // Convert the new Place object into the legacy shape that
  // DiscoverNearby.jsx already expects.
  const toLegacyPlace = (place) => ({
    place_id: place.id || "",
    name: place.displayName || "",
    vicinity: place.formattedAddress || "",
    formatted_address: place.formattedAddress || "",

    geometry: place.location
      ? {
          location: place.location,
        }
      : undefined,

    rating:
      typeof place.rating === "number"
        ? place.rating
        : undefined,

    user_ratings_total:
      typeof place.userRatingCount === "number"
        ? place.userRatingCount
        : undefined,

    types: Array.isArray(place.types)
      ? place.types
      : [],

    url: place.googleMapsURI || undefined,

    website: place.websiteURI || undefined,

    formatted_phone_number:
      place.nationalPhoneNumber || undefined,

    opening_hours: place.regularOpeningHours
      ? {
          weekday_text:
            place.regularOpeningHours.weekdayDescriptions || [],
        }
      : undefined,
  });

  class PlacesServiceCompat {
    constructor() {
      // The existing DiscoverNearby code passes a div here.
      // The new Places API does not require a map container.
    }

    nearbySearch(request, callback) {
      (async () => {
        try {
          const {
            Place: NewPlaceClass,
            SearchNearbyRankPreference: NewRankPreference,
          } = await google.maps.importLibrary("places");

          const center = request.location;

          const centerValue = {
            lat:
              typeof center?.lat === "function"
                ? center.lat()
                : center?.lat,

            lng:
              typeof center?.lng === "function"
                ? center.lng()
                : center?.lng,
          };

          const radius = Math.max(
            1,
            Math.min(Number(request.radius) || 2000, 50000)
          );

          const fields = [
            "id",
            "displayName",
            "formattedAddress",
            "location",
            "rating",
            "userRatingCount",
            "types",
            "googleMapsURI",
          ];

          let response;

          /*
           * Existing DiscoverNearby behavior:
           *
           * - No keyword:
           *     Nearby Search
           *
           * - Keyword entered:
           *     Keyword-based search
           *
           * Google no longer recommends the old keyword parameter,
           * so keyword searches are routed through Text Search (New).
           */
          if (request.keyword?.trim()) {
            response = await NewPlaceClass.searchByText({
              textQuery: request.keyword.trim(),

              fields,

              locationBias: {
                center: centerValue,
                radius,
              },

              maxResultCount: 20,

              language: "en",
              region: "in",
            });
          } else {
            response = await NewPlaceClass.searchNearby({
              fields,

              locationRestriction: {
                center: centerValue,
                radius,
              },

              maxResultCount: 20,

              rankPreference:
                NewRankPreference?.DISTANCE,

              language: "en",
              region: "in",
            });
          }

          const placesResult = Array.isArray(response?.places)
            ? response.places
            : [];

          const legacyResults = placesResult.map(toLegacyPlace);

          callback(legacyResults, OK);
        } catch (error) {
          console.error(
            "[STall] Google Places search failed:",
            error
          );

          callback([], ERROR);
        }
      })();
    }

    getDetails(request, callback) {
      (async () => {
        try {
          const {
            Place: NewPlaceClass,
          } = await google.maps.importLibrary("places");

          const place = new NewPlaceClass({
            id: request.placeId,
          });

          await place.fetchFields({
            fields: [
              "formattedAddress",
              "websiteURI",
              "googleMapsURI",
              "regularOpeningHours",
              "nationalPhoneNumber",
            ],
          });

          callback(toLegacyPlace(place), OK);
        } catch (error) {
          console.error(
            "[STall] Google Place details failed:",
            error
          );

          callback({}, ERROR);
        }
      })();
    }
  }

  /*
   * Keep the existing DiscoverNearby.jsx code working.
   *
   * It continues to call:
   *     new PlacesService(...)
   *     nearbySearch(...)
   *     getDetails(...)
   *
   * But those calls now use Places API (New) internally.
   */
  places.PlacesService = PlacesServiceCompat;

  places.__stallPlacesAdapterInstalled = true;
}

export function loadGoogleMaps(apiKey) {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const finish = () => {
      try {
        if (
          !window.google ||
          !window.google.maps ||
          !window.google.maps.places
        ) {
          throw new Error(
            "Google Maps Places library did not load correctly."
          );
        }

        installPlacesCompatibilityAdapter(window.google);

        resolve(window.google);
      } catch (error) {
        reject(error);
      }
    };

    if (
      window.google &&
      window.google.maps &&
      window.google.maps.places
    ) {
      finish();
      return;
    }

    const existing =
      document.getElementById("google-maps-script");

    if (existing) {
      existing.addEventListener("load", finish, {
        once: true,
      });

      existing.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              "Failed to load Google Maps script"
            )
          ),
        { once: true }
      );

      return;
    }

    if (!apiKey) {
      reject(
        new Error(
          "Google Maps API key is not configured."
        )
      );
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

    script.onerror = () => {
      reject(
        new Error(
          "Failed to load Google Maps script"
        )
      );
    };

    document.head.appendChild(script);
  }).catch((error) => {
    // Allow a later attempt if the initial Google script load failed.
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}
