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

## 2. Configure environment variables

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

## 3. Deploy the Firestore security rules

In the Firebase Console: **Firestore Database → Rules** tab → replace the
contents with everything in `firestore.rules` in this repo → **Publish**.

These rules mean:
- Anyone can *read* vendor listings (needed for public search).
- A signed-in user can create a listing (it becomes theirs).
- A listing can only be edited/deleted by its owner, an admin, or (for the
  claim flow) a signed-in user supplying the matching claim code.

## 4. Run it locally

```
npm install
npm run dev
```

Visit the printed `localhost` URL. Sign up for an account, then try
creating a listing under **My Listings**.

## 5. Make yourself an admin

1. Sign up for an account in the running app (or via Firebase Console → Authentication → Add user).
2. In Firebase Console → Authentication → Users, copy that user's **UID**.
3. In Firebase Console → Firestore Database → Data, click **Start collection** → collection ID `admins` → document ID: paste the UID → add any field (e.g. `note: "me"`) → **Save**.
4. Refresh the app and sign in with that account — the **Admin** tab will appear.

There's no in-app way to add admins on purpose: it's a manual step in the
Firebase Console, so random signups can never grant themselves admin access.

## 6. Push to GitHub

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

## 7. Deploy on GitHub Pages

GitHub Pages only serves static files — it can't read your local `.env.local`
at build time — so this repo includes a GitHub Actions workflow
(`.github/workflows/deploy.yml`) that builds the app with your Firebase
config injected from **repository secrets**, then publishes it automatically
on every push to `main`.

**One-time setup:**

1. In your GitHub repo: **Settings → Pages** → under "Build and deployment",
   set **Source** to **GitHub Actions**.
2. In your GitHub repo: **Settings → Secrets and variables → Actions →
   New repository secret**. Add each of these six, using the same values
   from your `.env.local`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Push to `main` (or re-run the workflow from the **Actions** tab). The
   workflow builds the site and deploys it — watch progress under
   **Actions**.
4. Once it finishes, your live URL is shown in **Settings → Pages**, and
   normally looks like:
   `https://<your-username>.github.io/<your-repo>/`

Every future push to `main` redeploys automatically — no manual steps
needed after this.

## 8. Firebase Auth: allow your live domain

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
  AuthPage.jsx            sign in / sign up / password reset
  VendorDashboard.jsx     vendor's own create/edit/claim flow
  AdminDashboard.jsx      admin create/edit/delete-any, claim code generation
  index.css               global styles
```

Everything in `src/` sits in one flat folder — no `components/` or `lib/`
subfolders. The one exception is `.github/workflows/deploy.yml`: GitHub
itself requires Actions workflows to live at that exact path, so that
folder can't be flattened without breaking the automatic deploy.

## Notes & next steps you might want

- Vendors currently can create multiple listings under one account — if you
  want to cap it at one, add a check in `VendorDashboard.jsx` before allowing
  a new listing.
- There's no image upload yet; add Firebase Storage if you want vendor
  photos.
- The radar chart is a stylized visualization, not a literal street map —
  swapping in a real map (e.g. Leaflet + OpenStreetMap tiles) is a
  reasonable next step if people want to see actual streets.
