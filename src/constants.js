export const CATEGORIES = [
  "Food & Produce",
  "Crafts & Goods",
  "Clothing & Accessories",
  "Home & Garden",
  "Tailors",
  "Salons",
  "Electricians",
  "Plumbers",
  "Mechanics",
  "Pharmacies",
  "Tuition",
  "Home Services",
  "Services",
  "Other",
];

export const CATEGORY_COLORS = {
  "Food & Produce": "#B4472A",
  "Crafts & Goods": "#3F6D64",
  "Clothing & Accessories": "#6E4B6E",
  "Home & Garden": "#2F6B3A",
  "Tailors": "#A6763D",
  "Salons": "#9C4F6B",
  "Electricians": "#C08A2E",
  "Plumbers": "#3A6EA5",
  "Mechanics": "#4A5568",
  "Pharmacies": "#2E6B72",
  "Tuition": "#5B4B8A",
  "Home Services": "#6B5B3F",
  "Services": "#8B6D2F",
  "Other": "#55524B",
};

export const COLORS = {
  ink: "#17222c",
  paper: "#fdf9ef",
  marigold: "#f3b73d",
  goldDark: "#d99a1e",
  navy: "#0f1a24",
  navy2: "#16232f",
  muted: "#b7c2cb",
  green: "#2f9e44",
  brick: "#B4472A",
  teal: "#3F6D64",
};

export const DEFAULT_LOC = { lat: 12.9716, lng: 77.5946 }; // Bengaluru

// Cities Stall actively operates in. Used for quick-select center points
// in Discover Nearby (admin/agent) — not a hard restriction on where a
// vendor can be added, just a shortcut so switching markets doesn't
// require typing coordinates by hand each time.
export const CITIES = [
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
  { name: "Ajman", lat: 25.4052, lng: 55.5136 },
];

// How long a Google-sourced rating/phone snapshot is trusted before it's
// treated as stale and worth re-fetching. This is the main cost lever for
// the Places API — refresh frequency scales with (listings ÷ this window),
// completely decoupled from how many people visit the site.
export const RATING_STALE_HOURS = 24;
