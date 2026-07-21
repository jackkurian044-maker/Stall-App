export const CATEGORIES = [
  "Food & Produce",
  "Crafts & Goods",
  "Services",
  "Clothing & Accessories",
  "Home & Garden",
  "Other",
];

export const CATEGORY_COLORS = {
  "Food & Produce": "#B4472A",
  "Crafts & Goods": "#3F6D64",
  "Services": "#8B6D2F",
  "Clothing & Accessories": "#6E4B6E",
  "Home & Garden": "#2F6B3A",
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

// How long a Google-sourced rating/phone snapshot is trusted before it's
// treated as stale and worth re-fetching. This is the main cost lever for
// the Places API — refresh frequency scales with (listings ÷ this window),
// completely decoupled from how many people visit the site.
export const RATING_STALE_HOURS = 24;
