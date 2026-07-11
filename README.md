# STALL — local vendor finder

A live web app for listing local vendors and letting people search for what's
nearby by distance. Vendors can create and edit their own listing (after
signing in); an admin can add, edit, or remove any listing.

## How it works

- **Find** — public page, no login needed. Search by radius, category, or
  keyword; a radar chart plots vendors by real distance/direction from you.
- **My Listings** — signed-in vendors create/edit their own listing(s).
- **Claim a listing** — if an admin adds a vendor on their behalf, the admin
  gets a one-time claim code to hand to that vendor, who enters it here to
  take over editing.
- **Admin** — visible only to accounts listed in the `admins` Firestore
  collection. Can add/edit/delete any listing.

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → follow the prompts (Google Analytics is optional).
2. In the left sidebar: **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
3. In the left sidebar: **Build → Firestore Database → Create database** → start in **production mode** → pick a region.
4. Go to **Project settings** (gear icon) → scroll to **Your apps** → click the **</> (web)** icon → register an app (no Hosting needed) → copy the `firebaseConfig` values shown.

## 2. Set up Google Places (business-name address search)

This powers the "search business name or address" box when adding a
vendor, so it can find results like Google Maps does (not just street
addresses).

1. Go to [console.cloud.google.com](https://console.cloud.google.com). Your
   Firebase project is already a Google Cloud project with the same name/ID
   (e.g. `stall-app-1aab7`) — select it from the project dropdown at the top
   rather than creating a new one.
2. **Billing** must be enabled once per Cloud project: left menu → **Billing**
   → link or create a billing account (requires a card, but Google gives
   $200/month in free credit — a small local directory shouldn't exceed it
   in normal use).
3. Left menu → **APIs & Services → Library** → search for and enable:
   - **Places API**
   - **Maps JavaScript API**
4. Left menu → **APIs & Services → Credentials → Create Credentials → API key**.
   Copy the key, then click into it to restrict it (recommended, not required):
   - **Application restrictions** → **HTTP referrers** → add:
     - `http://localhost:5173/*` (for local dev)
     - `https://<your-username>.github.io/*`
   - **API restrictions** → restrict key to **Places API** and **Maps JavaScript API**
5. Save. This key goes into `VITE_GOOGLE_PLACES_API_KEY` (env var name below),
   alongside the six `VITE_FIREBASE_*` values.

If this key is ever missing or misconfigured, the address box shows
"Address search isn't configured" and falls back to the always-available
"enter manually" option with the free draggable-pin map — so a bad key
never fully blocks adding vendors.

## 3. Configure environment variables

Copy `.env.example` to `.env.local` and paste in the values from step 1:

```
cp .env.example .env.local
```

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 4. Deploy the Firestore security rules

In the Firebase Console: **Firestore Database → Rules** tab → replace the
contents with everything in `firestore.rules` in this repo → **Publish**.

These rules mean:
- Anyone can *read* vendor listings (needed for public search).
- A signed-in user can create a listing (it becomes theirs).
- A listing can only be edited/deleted by its owner, an admin, or (for the
  claim flow) a signed-in user supplying the matching claim code.

## 5. Run it locally

```
npm install
npm run dev
```

Visit the printed `localhost` URL. Sign up for an account, then try
creating a listing under **My Listings**.

## 6. Make yourself an admin

1. Sign up for an account in the running app (or via Firebase Console → Authentication → Add user).
2. In Firebase Console → Authentication → Users, copy that user's **UID**.
3. In Firebase Console → Firestore Database → Data, click **Start collection** → collection ID `admins` → document ID: paste the UID → add any field (e.g. `note: "me"`) → **Save**.
4. Refresh the app and sign in with that account — the **Admin** tab will appear.

There's no in-app way to add admins on purpose: it's a manual step in the
Firebase Console, so random signups can never grant themselves admin access.

## 7. Push to GitHub

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

`.env.local` is git-ignored on purpose — never commit real Firebase keys to
a public repo the same way you would a password. (Firebase's client keys are
not secret in the way an API secret key is — they're safe to expose in a
built frontend bundle — but keeping them out of git means you can change
projects without editing history.)

## 8. Deploy on GitHub Pages

GitHub Pages only serves static files — it can't read your local `.env.local`
at build time — so this repo includes a GitHub Actions workflow
(`.github/workflows/deploy.yml`) that builds the app with your config
injected from **repository secrets**, then publishes it automatically
on every push to `main`.

**One-time setup:**

1. In your GitHub repo: **Settings → Pages** → under "Build and deployment",
   set **Source** to **GitHub Actions**.
2. In your GitHub repo: **Settings → Secrets and variables → Actions →
   New repository secret**. Add each of these seven, using the same values
   from your `.env.local`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_GOOGLE_PLACES_API_KEY`
3. Push to `main` (or re-run the workflow from the **Actions** tab). The
   workflow builds the site and deploys it — watch progress under
   **Actions**.
4. Once it finishes, your live URL is shown in **Settings → Pages**, and
   normally looks like:
   `https://<your-username>.github.io/<your-repo>/`

Every future push to `main` redeploys automatically — no manual steps
needed after this.

## 9. Firebase Auth: allow your live domain

Firebase blocks sign-in from domains it doesn't recognize.
In Firebase Console → **Authentication → Settings → Authorized domains**,
add your GitHub Pages domain, e.g. `<your-username>.github.io`
(just the domain — no path, no `https://`).

## Project structure

```
src/
  main.jsx              app entry point
  App.jsx               auth state, admin check, view routing
  firebase.js            Firebase app/auth/db initialization
  geo.js                 distance + bearing math, claim-code generator
  constants.js           categories, colors, default map center
  Header.jsx              top nav, tab switching by auth/admin state
  FindView.jsx            public search + radar chart
  RadarChart.jsx          proximity radar (recharts)
  VendorTicket.jsx        result card
  LocationSearch.jsx      business/address search (Google Places Autocomplete)
  googleMaps.js           lazy-loads the Google Maps JS API once
  MapPicker.jsx           draggable pin preview map (Leaflet + free OSM tiles)
  AuthPage.jsx            sign in / sign up / password reset
  VendorDashboard.jsx     vendor's own create/edit/claim flow
  AdminDashboard.jsx      admin create/edit/delete-any, claim code generation
  DiscoverNearby.jsx      admin-only: search real nearby businesses via Google, pick which to add
  index.css               global styles
```

Everything in `src/` sits in one flat folder — no `components/` or `lib/`
subfolders. The one exception is `.github/workflows/deploy.yml`: GitHub
itself requires Actions workflows to live at that exact path, so that
folder can't be flattened without breaking the automatic deploy.

## Notes & next steps you might want

- **Address entry**: vendors and admins search by business name or address
  using Google Places Autocomplete — the same data Google Maps itself uses,
  so small local businesses that are listed on Google (but not necessarily
  mapped in OpenStreetMap) can be found by name. Picking a result auto-fills
  coordinates *and* shows a small map with a draggable pin — drag it to
  nudge the pin exactly onto the storefront if needed. There's also an
  "enter manually" fallback (with the same draggable map, defaulting to a
  starting point you can drag from) for anything Google Places can't find,
  or if the API key is missing/misconfigured.
  The draggable pin map itself still uses free OpenStreetMap tiles (no
  billing) — only the *search* step depends on the Google Places API key.
  If you want to remove the Google dependency entirely later, `LocationSearch.jsx`
  is the only file that would need to change back to a free geocoder like
  Nominatim (a config, not a rebuild).
- **Chains with multiple branches**: picking a specific suggestion locks
  the listing to that one physical branch's Google `place_id` forever —
  the saved address, rating, refresh button, and outbound link all always
  refer to that exact location, never a different branch or a chain-wide
  average. Search results are also biased toward the Bengaluru area and
  restricted to India (`componentRestrictions: { country: "in" }` in
  `LocationSearch.jsx`) so a nearby branch surfaces first and same-named
  branches elsewhere are easy to avoid by mistake. If you expand beyond
  India later, that restriction is a one-line change to relax or remove.
- **Discover nearby vendors** (admin-only "Discover Nearby" tab): set a
  center point (your location, or manual coordinates), search a category
  or keyword (e.g. "medical store", "bakery", "salon") and a radius, and
  browse real nearby businesses pulled directly from Google — the same
  data source as Google Maps search. Each result shows its name, address,
  distance, and rating, with a checkbox and an editable category guess
  (auto-mapped from Google's data, but not always right — review it).
  Nothing is added until you select results and click "Add N selected" —
  only then does it fetch each one's full address/website, write it to
  Firestore, and generate its claim code, shown afterward as a copyable
  list to hand to each business. Shows up to ~20 nearest matches per
  search (a limit of the underlying API) — narrow the keyword or radius
  for a more specific set if needed.
- **Google ratings**: when a listing is added via the address/business
  search, its Google rating and review count are captured and shown on the
  public listing card (a star icon next to the category badge). This is a
  **snapshot at the time the listing was added or edited** — it does not
  silently stay in sync with Google's live rating. Both the vendor and
  admin dashboards have a small refresh icon (only shown on listings that
  have a linked Google Place) to manually pull the latest rating whenever
  needed.
- **Clicking a listing** on the Find page opens the business's own website
  if Google has one on file for it, otherwise its Google Business/Maps
  profile page, otherwise (for older listings saved before this existed,
  or ones Google has no extra data for) a plain Google Maps search for the
  business name and address — so every listing is always clickable to
  *something* useful, even the oldest ones.
- Vendors currently can create multiple listings under one account — if you
  want to cap it at one, add a check in `VendorDashboard.jsx` before allowing
  a new listing.
- There's no image upload yet; add Firebase Storage if you want vendor
  photos.
- The radar chart is a stylized visualization, not a literal street map —
  swapping in a real map (e.g. Leaflet + OpenStreetMap tiles) is a
  reasonable next step if people want to see actual streets.
